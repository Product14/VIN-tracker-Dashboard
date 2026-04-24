import pg from "pg";
const { Pool } = pg;

// For Vercel serverless: keep pool small to avoid exhausting Supabase connections.
// Use the Supabase transaction-mode pooler URL (port 6543) in DATABASE_URL.
// max 5: allows up to 3 parallel batch inserts during sync + headroom for other queries.
// idleTimeoutMillis: release connections quickly between Lambda invocations.
const pool = new Pool({
  connectionString: process.env.VIN_TRACKER_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
});

export const query     = (text, params) => pool.query(text, params);
export const getClient = ()             => pool.connect();

// ─── Schema init ──────────────────────────────────────────────────────────────
// Idempotent — safe to call on every cold start.

export async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS vins (
      dealer_vin_id        TEXT PRIMARY KEY,
      vin                  TEXT,
      enterprise_id        TEXT,
      rooftop_id           TEXT,
      status               TEXT,
      after_24h            SMALLINT,
      received_at          TEXT,
      processed_at         TEXT,
      reason_bucket        TEXT,
      hold_reason          TEXT DEFAULT '',
      has_photos           SMALLINT DEFAULT 0,
      output_image_count   INT,
      thumbnail_url        TEXT,
      vehicle_price        REAL,
      synced_at            TEXT
    );
    ALTER TABLE vins ADD COLUMN IF NOT EXISTS hold_reason TEXT DEFAULT '';
    ALTER TABLE vins ADD COLUMN IF NOT EXISTS has_photos SMALLINT DEFAULT 0;
    ALTER TABLE vins ADD COLUMN IF NOT EXISTS output_image_count INT;
    ALTER TABLE vins ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
    ALTER TABLE vins ADD COLUMN IF NOT EXISTS vehicle_price REAL;
    ALTER TABLE vins ADD COLUMN IF NOT EXISTS make         TEXT;
    ALTER TABLE vins ADD COLUMN IF NOT EXISTS model        TEXT;
    ALTER TABLE vins ADD COLUMN IF NOT EXISTS year         TEXT;
    ALTER TABLE vins ADD COLUMN IF NOT EXISTS trim         TEXT;
    ALTER TABLE vins ADD COLUMN IF NOT EXISTS stock_number TEXT;

    -- Migration: swap PK from vin → dealer_vin_id on existing deployments.
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.key_column_usage kcu
        JOIN information_schema.table_constraints tc
          ON kcu.constraint_name = tc.constraint_name AND kcu.table_name = tc.table_name
        WHERE kcu.table_name = 'vins' AND kcu.column_name = 'vin'
          AND tc.constraint_type = 'PRIMARY KEY'
      ) THEN
        ALTER TABLE vins DROP CONSTRAINT vins_pkey;
        DELETE FROM vins WHERE dealer_vin_id IS NULL;
        ALTER TABLE vins ADD PRIMARY KEY (dealer_vin_id);
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS idx_vins_rooftop_id        ON vins(rooftop_id);
    CREATE INDEX IF NOT EXISTS idx_vins_enterprise_id     ON vins(enterprise_id);
    CREATE INDEX IF NOT EXISTS idx_vins_status            ON vins(status);
    CREATE INDEX IF NOT EXISTS idx_vins_received_at       ON vins(received_at);
    CREATE INDEX IF NOT EXISTS idx_vins_has_photos        ON vins(has_photos);
    CREATE INDEX IF NOT EXISTS idx_vins_reason_bucket     ON vins(reason_bucket);
    CREATE INDEX IF NOT EXISTS idx_vins_status_photos_24h ON vins(status, has_photos, after_24h);

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
      enterprise_id TEXT PRIMARY KEY,
      name          TEXT,
      type          TEXT,
      website_url   TEXT,
      poc_email     TEXT,
      synced_at     TEXT
    );
    ALTER TABLE enterprise_details ADD COLUMN IF NOT EXISTS timezone TEXT;

    -- Recipient config uploaded via CSV — maps email addresses to rooftop/enterprise IDs.
    CREATE TABLE IF NOT EXISTS email_recipients (
      id            SERIAL PRIMARY KEY,
      email         TEXT NOT NULL,
      rooftop_id    TEXT,
      enterprise_id TEXT,
      report_type   TEXT NOT NULL   -- 'Rooftop' | 'Group'
    );

    -- Single-row table used as a distributed sync lock (survives Lambda restarts).
    CREATE TABLE IF NOT EXISTS sync_state (
      id            TEXT PRIMARY KEY DEFAULT 'global',
      running       BOOLEAN NOT NULL DEFAULT FALSE,
      started_at    TIMESTAMPTZ,
      completed_at  TIMESTAMPTZ
    );
    INSERT INTO sync_state (id) VALUES ('global') ON CONFLICT (id) DO NOTHING;
    ALTER TABLE sync_state ADD COLUMN IF NOT EXISTS total_rows INTEGER;
    ALTER TABLE sync_state ADD COLUMN IF NOT EXISTS last_sync  TEXT;

    -- Stores precomputed summary payloads keyed by date_filter ('all', 'post', 'pre').
    -- Populated at the end of each sync so the summary API is a trivial row lookup.
    CREATE TABLE IF NOT EXISTS summary_cache (
      date_filter  TEXT PRIMARY KEY,
      payload      JSONB NOT NULL,
      computed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Stores precomputed filter-options payload (single global row).
    -- Populated at the end of each sync so GET /api/filter-options is a trivial row lookup.
    CREATE TABLE IF NOT EXISTS filter_cache (
      id           TEXT PRIMARY KEY DEFAULT 'global',
      payload      JSONB NOT NULL,
      computed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Audit log for every /api/send-daily-report run — one row per recipient.
    CREATE TABLE IF NOT EXISTS report_run_logs (
      id          SERIAL PRIMARY KEY,
      run_id      TEXT        NOT NULL,
      run_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      test_mode   BOOLEAN     NOT NULL DEFAULT FALSE,
      report_type TEXT,
      entity_id   TEXT,
      name        TEXT,
      email       TEXT,
      status      TEXT        NOT NULL,
      reason      TEXT
    );
    ALTER TABLE report_run_logs ADD COLUMN IF NOT EXISTS to_emails  TEXT[];
    ALTER TABLE report_run_logs ADD COLUMN IF NOT EXISTS cc_emails  TEXT[];
    ALTER TABLE report_run_logs ADD COLUMN IF NOT EXISTS bcc_emails TEXT[];
    CREATE INDEX IF NOT EXISTS idx_report_run_logs_run_id ON report_run_logs(run_id);
    CREATE INDEX IF NOT EXISTS idx_report_run_logs_run_at ON report_run_logs(run_at DESC);

    -- Job tracking table for async /api/send-daily-report runs.
    -- Each run is split into self-chaining batches of 50 recipients per Vercel invocation.
    CREATE TABLE IF NOT EXISTS daily_report_runs (
      run_id          TEXT        PRIMARY KEY,
      run_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      test_mode       BOOLEAN     NOT NULL DEFAULT FALSE,
      status          TEXT        NOT NULL DEFAULT 'pending',
      recipient_count INT,
      sent            INT,
      skipped         INT,
      errors          INT,
      completed_at    TIMESTAMPTZ,
      params          JSONB
    );
    CREATE INDEX IF NOT EXISTS idx_daily_report_runs_run_at ON daily_report_runs(run_at DESC);
  `);

  // Materialized views — dropped and recreated on every cold start so schema changes
  // (column additions, reorders) are always picked up automatically.
  //
  // Migration note: on first deploy, v_by_rooftop / v_by_enterprise may still be
  // regular views. DROP VIEW silently fails if they're already materialized views
  // (different object type), so we catch the error and fall through to the
  // DROP MATERIALIZED VIEW which handles the post-migration case.
  await pool.query(`DROP VIEW IF EXISTS v_totals, v_by_csm, v_by_type`).catch(() => {});
  await pool.query(`DROP VIEW IF EXISTS v_by_rooftop, v_by_enterprise`).catch(() => {});
  await pool.query(`DROP MATERIALIZED VIEW IF EXISTS v_by_rooftop, v_by_enterprise`);

  await pool.query(`
    CREATE MATERIALIZED VIEW v_by_rooftop AS
    SELECT
      v.rooftop_id,
      v.enterprise_id,
      MAX(rd.team_name)                   AS name,
      MAX(rd.team_type)                   AS type,
      MAX(ed.poc_email)                   AS csm,
      MAX(ed.name)                        AS enterprise,
      COUNT(*)::int                                                                                                            AS total,
      SUM(CASE WHEN COALESCE(v.has_photos,0)=1 THEN 1 ELSE 0 END)::int                                                       AS with_photos,
      SUM(CASE WHEN v.status = 'Delivered' AND COALESCE(v.has_photos,0)=1 THEN 1 ELSE 0 END)::int                            AS delivered_with_photos,
      SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.has_photos,0)=1 THEN 1 ELSE 0 END)::int                           AS pending_with_photos,
      SUM(CASE WHEN v.status = 'Delivered' THEN 1 ELSE 0 END)::int                                                            AS processed,
      SUM(CASE WHEN v.status = 'Delivered' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int                             AS processed_after_24h,
      SUM(CASE WHEN v.status != 'Delivered' THEN 1 ELSE 0 END)::int                                                           AS not_processed,
      SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.has_photos,0)=1 AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int AS not_processed_after_24h,
      MAX(rd.website_score)               AS website_score,
      MAX(rd.website_listing_url)         AS website_listing_url,
      MAX(rd.ims_integration_status)      AS ims_integration_status,
      MAX(rd.publishing_status)           AS publishing_status,
      SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.has_photos,0)=1 AND v.reason_bucket = 'Processing Pending' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_processing_pending,
      SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.has_photos,0)=1 AND v.reason_bucket = 'Publishing Pending' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_publishing_pending,
      SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.has_photos,0)=1 AND v.reason_bucket = 'QC Pending'         AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_qc_pending,
      SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.has_photos,0)=1 AND v.reason_bucket = 'QC Hold'            AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_qc_hold,
      SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.has_photos,0)=1 AND v.reason_bucket = 'Sold'               AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_sold,
      SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.has_photos,0)=1 AND v.reason_bucket = 'Others'             AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_others
    FROM vins v
    LEFT JOIN rooftop_details rd ON v.rooftop_id = rd.team_id
    LEFT JOIN enterprise_details ed ON v.enterprise_id = ed.enterprise_id
    GROUP BY v.rooftop_id, v.enterprise_id;
  `);

  await pool.query(`
    CREATE MATERIALIZED VIEW v_by_enterprise AS
    SELECT
      v.enterprise_id                       AS id,
      MAX(ed.name)                          AS name,
      MAX(ed.poc_email)                     AS csm,
      COUNT(*)::int                                                                                                            AS total,
      SUM(CASE WHEN COALESCE(v.has_photos,0)=1 THEN 1 ELSE 0 END)::int                                                       AS with_photos,
      SUM(CASE WHEN v.status = 'Delivered' AND COALESCE(v.has_photos,0)=1 THEN 1 ELSE 0 END)::int                            AS delivered_with_photos,
      SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.has_photos,0)=1 THEN 1 ELSE 0 END)::int                           AS pending_with_photos,
      SUM(CASE WHEN v.status = 'Delivered' THEN 1 ELSE 0 END)::int                                                            AS processed,
      SUM(CASE WHEN v.status = 'Delivered' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int                             AS processed_after_24h,
      SUM(CASE WHEN v.status != 'Delivered' THEN 1 ELSE 0 END)::int                                                           AS not_processed,
      SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.has_photos,0)=1 AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int AS not_processed_after_24h,
      COUNT(DISTINCT v.rooftop_id)::int     AS rooftop_count,
      COUNT(DISTINCT CASE WHEN rd.ims_integration_status = 'false' THEN v.rooftop_id END)::int AS not_integrated_count,
      COUNT(DISTINCT CASE WHEN rd.publishing_status = 'false' THEN v.rooftop_id END)::int      AS publishing_disabled_count,
      ROUND(AVG(rd.website_score)::numeric, 2)  AS avg_website_score,
      MAX(ed.website_url)                   AS website_url,
      MAX(ed.type)                          AS account_type,
      SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.has_photos,0)=1 AND v.reason_bucket = 'Processing Pending' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_processing_pending,
      SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.has_photos,0)=1 AND v.reason_bucket = 'Publishing Pending' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_publishing_pending,
      SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.has_photos,0)=1 AND v.reason_bucket = 'QC Pending'         AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_qc_pending,
      SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.has_photos,0)=1 AND v.reason_bucket = 'QC Hold'            AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_qc_hold,
      SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.has_photos,0)=1 AND v.reason_bucket = 'Sold'               AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_sold,
      SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.has_photos,0)=1 AND v.reason_bucket = 'Others'             AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_others
    FROM vins v
    LEFT JOIN enterprise_details ed ON v.enterprise_id = ed.enterprise_id
    LEFT JOIN rooftop_details rd    ON v.rooftop_id = rd.team_id
    GROUP BY v.enterprise_id;
  `);

  // Unique indexes required for REFRESH MATERIALIZED VIEW CONCURRENTLY.
  // Without these, a refresh would take an exclusive lock blocking all reads.
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uix_mv_rooftop_id    ON v_by_rooftop(rooftop_id);
    CREATE UNIQUE INDEX IF NOT EXISTS uix_mv_enterprise_id ON v_by_enterprise(id);
  `);

}
