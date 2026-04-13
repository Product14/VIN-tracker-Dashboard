import pg from "pg";
const { Pool } = pg;

// For Vercel serverless: keep pool small to avoid exhausting Supabase connections.
// Use the Supabase transaction-mode pooler URL (port 6543) in DATABASE_URL.
// max 3: sync runs 3 concurrent getClient() calls — that is the peak need.
// Summary queries are now sequential so they only need 1 connection at a time.
// idleTimeoutMillis 1000: release connections quickly between Lambda invocations.
const pool = new Pool({
  connectionString: process.env.VIN_TRACKER_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
  idleTimeoutMillis: 1000,
  connectionTimeoutMillis: 10000,
});

export const query     = (text, params) => pool.query(text, params);
export const getClient = ()             => pool.connect();

// ─── Schema init ──────────────────────────────────────────────────────────────
// Idempotent — safe to call on every cold start.

export async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS vins (
      vin             TEXT PRIMARY KEY,
      dealer_vin_id   TEXT,
      enterprise_id   TEXT,
      rooftop_id      TEXT,
      status          TEXT,
      after_24h       SMALLINT,
      received_at     TEXT,
      processed_at    TEXT,
      reason_bucket   TEXT,
      synced_at       TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_vins_rooftop_id    ON vins(rooftop_id);
    CREATE INDEX IF NOT EXISTS idx_vins_enterprise_id ON vins(enterprise_id);
    CREATE INDEX IF NOT EXISTS idx_vins_status        ON vins(status);
    CREATE INDEX IF NOT EXISTS idx_vins_received_at   ON vins(received_at);

    CREATE TABLE IF NOT EXISTS rooftop_details (
      team_id                TEXT PRIMARY KEY,
      enterprise_id          TEXT,
      team_name              TEXT,
      team_type              TEXT,
      website_score          REAL,
      website_listing_url    TEXT,
      ims_integration_status TEXT,
      publishing_status      TEXT,
      synced_at              TEXT
    );

    CREATE TABLE IF NOT EXISTS enterprise_details (
      enterprise_id  TEXT PRIMARY KEY,
      name           TEXT,
      type           TEXT,
      website_url    TEXT,
      poc_email      TEXT,
      synced_at      TEXT
    );

    -- Single-row table used as a distributed sync lock (survives Lambda restarts).
    CREATE TABLE IF NOT EXISTS sync_state (
      id            TEXT PRIMARY KEY DEFAULT 'global',
      running       BOOLEAN NOT NULL DEFAULT FALSE,
      started_at    TIMESTAMPTZ,
      completed_at  TIMESTAMPTZ
    );
    INSERT INTO sync_state (id) VALUES ('global') ON CONFLICT (id) DO NOTHING;
  `);

  // Views — recreated fresh each time to pick up any SQL changes.
  await pool.query(`
    CREATE OR REPLACE VIEW v_totals AS
    SELECT
      COUNT(*)::int                                                                                        AS total,
      SUM(CASE WHEN status = 'Delivered' THEN 1 ELSE 0 END)::int                                          AS processed,
      SUM(CASE WHEN status = 'Delivered' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END)::int             AS processed_after_24h,
      SUM(CASE WHEN status != 'Delivered' THEN 1 ELSE 0 END)::int                                         AS not_processed,
      SUM(CASE WHEN status != 'Delivered' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END)::int            AS not_processed_after_24h,
      SUM(CASE WHEN status != 'Delivered' AND reason_bucket = 'Processing Pending' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_processing_pending,
      SUM(CASE WHEN status != 'Delivered' AND reason_bucket = 'Publishing Pending' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_publishing_pending,
      SUM(CASE WHEN status != 'Delivered' AND reason_bucket = 'QC Pending'         AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_qc_pending,
      SUM(CASE WHEN status != 'Delivered' AND reason_bucket = 'Sold'               AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_sold,
      SUM(CASE WHEN status != 'Delivered' AND reason_bucket = 'Others'             AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_others
    FROM vins;
  `);

  await pool.query(`
    CREATE OR REPLACE VIEW v_by_rooftop AS
    SELECT
      v.rooftop_id,
      v.enterprise_id,
      MAX(rd.team_name)                   AS name,
      MAX(rd.team_type)                   AS type,
      MAX(ed.poc_email)                   AS csm,
      MAX(ed.name)                        AS enterprise,
      COUNT(*)::int                                                                                        AS total,
      SUM(CASE WHEN v.status = 'Delivered' THEN 1 ELSE 0 END)::int                                       AS processed,
      SUM(CASE WHEN v.status = 'Delivered' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int        AS processed_after_24h,
      SUM(CASE WHEN v.status != 'Delivered' THEN 1 ELSE 0 END)::int                                      AS not_processed,
      SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int       AS not_processed_after_24h,
      MAX(rd.website_score)               AS website_score,
      MAX(rd.website_listing_url)         AS website_listing_url,
      MAX(rd.ims_integration_status)      AS ims_integration_status,
      MAX(rd.publishing_status)           AS publishing_status,
      SUM(CASE WHEN v.status != 'Delivered' AND v.reason_bucket = 'Processing Pending' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_processing_pending,
      SUM(CASE WHEN v.status != 'Delivered' AND v.reason_bucket = 'Publishing Pending' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_publishing_pending,
      SUM(CASE WHEN v.status != 'Delivered' AND v.reason_bucket = 'QC Pending'         AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_qc_pending,
      SUM(CASE WHEN v.status != 'Delivered' AND v.reason_bucket = 'Sold'               AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_sold,
      SUM(CASE WHEN v.status != 'Delivered' AND v.reason_bucket = 'Others'             AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_others
    FROM vins v
    LEFT JOIN rooftop_details rd ON v.rooftop_id = rd.team_id
    LEFT JOIN enterprise_details ed ON v.enterprise_id = ed.enterprise_id
    GROUP BY v.rooftop_id, v.enterprise_id;
  `);

  await pool.query(`
    CREATE OR REPLACE VIEW v_by_enterprise AS
    SELECT
      v.enterprise_id                       AS id,
      MAX(ed.name)                          AS name,
      MAX(ed.poc_email)                     AS csm,
      COUNT(*)::int                                                                                        AS total,
      SUM(CASE WHEN v.status = 'Delivered' THEN 1 ELSE 0 END)::int                                       AS processed,
      SUM(CASE WHEN v.status = 'Delivered' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int        AS processed_after_24h,
      SUM(CASE WHEN v.status != 'Delivered' THEN 1 ELSE 0 END)::int                                      AS not_processed,
      SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int       AS not_processed_after_24h,
      COUNT(DISTINCT v.rooftop_id)::int     AS rooftop_count,
      COUNT(DISTINCT CASE WHEN rd.ims_integration_status = 'false' THEN v.rooftop_id END)::int AS not_integrated_count,
      COUNT(DISTINCT CASE WHEN rd.publishing_status = 'false' THEN v.rooftop_id END)::int      AS publishing_disabled_count,
      ROUND(AVG(rd.website_score)::numeric, 2)  AS avg_website_score,
      MAX(ed.website_url)                   AS website_url,
      MAX(ed.type)                          AS account_type,
      SUM(CASE WHEN v.status != 'Delivered' AND v.reason_bucket = 'Processing Pending' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_processing_pending,
      SUM(CASE WHEN v.status != 'Delivered' AND v.reason_bucket = 'Publishing Pending' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_publishing_pending,
      SUM(CASE WHEN v.status != 'Delivered' AND v.reason_bucket = 'QC Pending'         AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_qc_pending,
      SUM(CASE WHEN v.status != 'Delivered' AND v.reason_bucket = 'Sold'               AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_sold,
      SUM(CASE WHEN v.status != 'Delivered' AND v.reason_bucket = 'Others'             AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_others
    FROM vins v
    LEFT JOIN enterprise_details ed ON v.enterprise_id = ed.enterprise_id
    LEFT JOIN rooftop_details rd    ON v.rooftop_id = rd.team_id
    GROUP BY v.enterprise_id;
  `);

  await pool.query(`
    CREATE OR REPLACE VIEW v_by_csm AS
    SELECT
      ed.poc_email                          AS name,
      COUNT(DISTINCT v.rooftop_id)::int     AS rooftop_count,
      COUNT(*)::int                                                                                        AS total,
      SUM(CASE WHEN v.status = 'Delivered' THEN 1 ELSE 0 END)::int                                       AS processed,
      SUM(CASE WHEN v.status = 'Delivered' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int        AS processed_after_24h,
      SUM(CASE WHEN v.status != 'Delivered' THEN 1 ELSE 0 END)::int                                      AS not_processed,
      SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int       AS not_processed_after_24h,
      ROUND(AVG(rd.website_score)::numeric, 2) AS avg_website_score,
      COUNT(DISTINCT CASE WHEN rd.ims_integration_status = 'false' THEN v.rooftop_id END)::int AS integrated_count,
      COUNT(DISTINCT CASE WHEN rd.publishing_status = 'false' THEN v.rooftop_id END)::int      AS publishing_count,
      SUM(CASE WHEN v.status != 'Delivered' AND v.reason_bucket = 'Processing Pending' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_processing_pending,
      SUM(CASE WHEN v.status != 'Delivered' AND v.reason_bucket = 'Publishing Pending' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_publishing_pending,
      SUM(CASE WHEN v.status != 'Delivered' AND v.reason_bucket = 'QC Pending'         AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_qc_pending,
      SUM(CASE WHEN v.status != 'Delivered' AND v.reason_bucket = 'Sold'               AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_sold,
      SUM(CASE WHEN v.status != 'Delivered' AND v.reason_bucket = 'Others'             AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_others
    FROM vins v
    LEFT JOIN enterprise_details ed ON v.enterprise_id = ed.enterprise_id
    LEFT JOIN rooftop_details rd    ON v.rooftop_id = rd.team_id
    GROUP BY ed.poc_email
    ORDER BY ed.poc_email;
  `);

  await pool.query(`
    CREATE OR REPLACE VIEW v_by_type AS
    SELECT
      rd.team_type                          AS label,
      COUNT(DISTINCT v.rooftop_id)::int     AS rooftop_count,
      COUNT(*)::int                                                                                        AS total,
      SUM(CASE WHEN v.status = 'Delivered' THEN 1 ELSE 0 END)::int                                       AS processed,
      SUM(CASE WHEN v.status = 'Delivered' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int        AS processed_after_24h,
      SUM(CASE WHEN v.status != 'Delivered' THEN 1 ELSE 0 END)::int                                      AS not_processed,
      SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int       AS not_processed_after_24h,
      COUNT(DISTINCT CASE WHEN rd.ims_integration_status = 'false' THEN v.rooftop_id END)::int AS integrated_count,
      COUNT(DISTINCT CASE WHEN rd.publishing_status = 'false' THEN v.rooftop_id END)::int      AS publishing_count,
      SUM(CASE WHEN v.status != 'Delivered' AND v.reason_bucket = 'Processing Pending' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_processing_pending,
      SUM(CASE WHEN v.status != 'Delivered' AND v.reason_bucket = 'Publishing Pending' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_publishing_pending,
      SUM(CASE WHEN v.status != 'Delivered' AND v.reason_bucket = 'QC Pending'         AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_qc_pending,
      SUM(CASE WHEN v.status != 'Delivered' AND v.reason_bucket = 'Sold'               AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_sold,
      SUM(CASE WHEN v.status != 'Delivered' AND v.reason_bucket = 'Others'             AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_others
    FROM vins v
    LEFT JOIN rooftop_details rd ON v.rooftop_id = rd.team_id
    GROUP BY rd.team_type;
  `);
}
