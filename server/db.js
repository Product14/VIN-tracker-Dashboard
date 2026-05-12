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
      vdp_url              TEXT,
      vehicle_price        REAL,
      synced_at            TEXT
    );
    ALTER TABLE vins ADD COLUMN IF NOT EXISTS hold_reason TEXT DEFAULT '';
    ALTER TABLE vins ADD COLUMN IF NOT EXISTS has_photos SMALLINT DEFAULT 0;
    ALTER TABLE vins ADD COLUMN IF NOT EXISTS output_image_count INT;
    ALTER TABLE vins ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
    ALTER TABLE vins ADD COLUMN IF NOT EXISTS vdp_url TEXT;
    ALTER TABLE vins ADD COLUMN IF NOT EXISTS vehicle_price REAL;
    ALTER TABLE vins ADD COLUMN IF NOT EXISTS make         TEXT;
    ALTER TABLE vins ADD COLUMN IF NOT EXISTS model        TEXT;
    ALTER TABLE vins ADD COLUMN IF NOT EXISTS year         TEXT;
    ALTER TABLE vins ADD COLUMN IF NOT EXISTS trim         TEXT;
    ALTER TABLE vins ADD COLUMN IF NOT EXISTS stock_number TEXT;
    ALTER TABLE vins ADD COLUMN IF NOT EXISTS vin_score REAL;

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

    -- Run header for /api/send-daily-report — one row per trigger.
    -- Aggregate counts (sent/skipped/errors) are derived on-demand from report_queue.
    CREATE TABLE IF NOT EXISTS daily_report_runs (
      run_id          TEXT        PRIMARY KEY,
      run_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      test_mode       BOOLEAN     NOT NULL DEFAULT FALSE,
      status          TEXT        NOT NULL DEFAULT 'pending',  -- pending | done
      recipient_count INT,
      completed_at    TIMESTAMPTZ,
      test_to         TEXT[],   -- test-mode TO override
      test_cc         TEXT[]    -- test-mode CC override
    );
    ALTER TABLE daily_report_runs ADD COLUMN IF NOT EXISTS test_to TEXT[];
    ALTER TABLE daily_report_runs ADD COLUMN IF NOT EXISTS test_cc TEXT[];
    CREATE INDEX IF NOT EXISTS idx_daily_report_runs_run_at ON daily_report_runs(run_at DESC);

    -- Queue + audit trail for /api/send-daily-report — one row per recipient per run.
    -- Drives processing (status: pending → processing → sent/skipped/error).
    -- Replaces report_run_logs.
    CREATE TABLE IF NOT EXISTS report_queue (
      id                    SERIAL PRIMARY KEY,
      run_id                TEXT        NOT NULL,
      email                 TEXT        NOT NULL,
      rooftop_id            TEXT,
      enterprise_id         TEXT,
      report_type           TEXT        NOT NULL,
      entity_id             TEXT,
      entity_name           TEXT,
      status                TEXT        NOT NULL DEFAULT 'pending',
      attempt_count         INT         NOT NULL DEFAULT 0,
      error_reason          TEXT,
      to_emails             TEXT[],
      cc_emails             TEXT[],
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      processing_started_at TIMESTAMPTZ,
      processed_at          TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_report_queue_pending    ON report_queue(status, created_at)           WHERE status = 'pending';
    CREATE INDEX IF NOT EXISTS idx_report_queue_processing ON report_queue(status, processing_started_at) WHERE status = 'processing';
    CREATE INDEX IF NOT EXISTS idx_report_queue_run_id     ON report_queue(run_id, status);

    -- Recipient clubbing: email is now optional (to_emails holds the full list).
    ALTER TABLE report_queue ALTER COLUMN email DROP NOT NULL;

    -- report_date: end-of-yesterday in entity's local timezone, stored as UTC TIMESTAMPTZ.
    -- e.g. EDT entity → "2026-04-25 23:59:59.999 EDT" stored as "2026-04-26 03:59:59.999 UTC".
    -- Encodes both the reporting date and the entity's timezone offset in one value.
    -- Used for: per-day dedup (exact match) and email processing (format back in entity's tz).
    ALTER TABLE report_queue ADD COLUMN IF NOT EXISTS report_date TIMESTAMPTZ;

    -- Partial index for fast per-day dedup lookups at enqueue time.
    CREATE INDEX IF NOT EXISTS idx_report_queue_sent_dedup
      ON report_queue(entity_id, report_type, report_date)
      WHERE status = 'sent';

    -- Backfill existing rows: approximate using UTC midnight - 1ms (entity tz unavailable for old rows).
    UPDATE report_queue rq
    SET report_date = date_trunc('day', dr.run_at AT TIME ZONE 'UTC') - INTERVAL '1 millisecond'
    FROM daily_report_runs dr
    WHERE rq.run_id = dr.run_id
      AND rq.report_date IS NULL
      AND dr.test_mode = false;

    -- Snapshot table: one row per (rooftop, report_day) written at run completion.
    -- Stores the definitive per-rooftop report status for each daily run so that
    -- Report Status tab and Rooftop View drill-downs share a stable, consistent source.
    -- report_day = report_date::date - 1 (UTC arithmetic recovers the local calendar date).
    CREATE TABLE IF NOT EXISTS rooftop_report_status_daily (
      report_day    DATE NOT NULL,
      rooftop_id    TEXT NOT NULL,
      enterprise_id TEXT,
      status        TEXT NOT NULL,  -- 'sent' | 'skipped' | 'error'
      error_reason  TEXT,           -- null when status = 'sent'
      PRIMARY KEY (report_day, rooftop_id)
    );
    CREATE INDEX IF NOT EXISTS idx_rrsd_day_reason
      ON rooftop_report_status_daily (report_day, error_reason)
      WHERE status IN ('skipped', 'error');
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

  // Pendency threshold: VIN counts as ">12h pending" when either it's still
  // unprocessed and was received more than 12 hours ago, or it was eventually
  // processed but took 12+ hours from receipt to processing. Mirrors the legacy
  // Metabase `after_24_hrs` shape with the interval flipped to 12 hours; columns
  // / aggregates downstream still use the legacy `*_after_24h` names.
  const PENDENCY_PREDICATE = `(
    (
      (v.processed_at IS NULL OR v.processed_at = '')
      AND v.received_at IS NOT NULL AND v.received_at <> ''
      AND v.received_at::timestamptz + INTERVAL '12 hours' <= NOW()
    ) OR (
      v.processed_at IS NOT NULL AND v.processed_at <> ''
      AND v.received_at IS NOT NULL AND v.received_at <> ''
      AND v.processed_at::timestamptz >= v.received_at::timestamptz + INTERVAL '12 hours'
    )
  )`;

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
      SUM(CASE WHEN v.status = 'Delivered' AND ${PENDENCY_PREDICATE} THEN 1 ELSE 0 END)::int                             AS processed_after_24h,
      SUM(CASE WHEN v.status != 'Delivered' THEN 1 ELSE 0 END)::int                                                           AS not_processed,
      SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.has_photos,0)=1 AND ${PENDENCY_PREDICATE} THEN 1 ELSE 0 END)::int AS not_processed_after_24h,
      MAX(rd.website_score)               AS website_score,
      MAX(rd.website_listing_url)         AS website_listing_url,
      MAX(rd.ims_integration_status)      AS ims_integration_status,
      MAX(rd.publishing_status)           AS publishing_status,
      ROUND(AVG(v.vin_score)::numeric, 2) AS avg_inventory_score,
      SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.has_photos,0)=1 AND v.reason_bucket = 'Upload Pending'      AND ${PENDENCY_PREDICATE} THEN 1 ELSE 0 END)::int AS bucket_upload_pending,
      SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.has_photos,0)=1 AND v.reason_bucket = 'Processing Pending' AND ${PENDENCY_PREDICATE} THEN 1 ELSE 0 END)::int AS bucket_processing_pending,
      SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.has_photos,0)=1 AND v.reason_bucket = 'Publishing Pending' AND ${PENDENCY_PREDICATE} THEN 1 ELSE 0 END)::int AS bucket_publishing_pending,
      SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.has_photos,0)=1 AND v.reason_bucket = 'QC Pending'         AND ${PENDENCY_PREDICATE} THEN 1 ELSE 0 END)::int AS bucket_qc_pending,
      SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.has_photos,0)=1 AND v.reason_bucket = 'QC Hold'            AND ${PENDENCY_PREDICATE} THEN 1 ELSE 0 END)::int AS bucket_qc_hold,
      SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.has_photos,0)=1 AND v.reason_bucket = 'Sold'               AND ${PENDENCY_PREDICATE} THEN 1 ELSE 0 END)::int AS bucket_sold,
      SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.has_photos,0)=1 AND v.reason_bucket = 'Others'             AND ${PENDENCY_PREDICATE} THEN 1 ELSE 0 END)::int AS bucket_others
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
      SUM(CASE WHEN v.status = 'Delivered' AND ${PENDENCY_PREDICATE} THEN 1 ELSE 0 END)::int                             AS processed_after_24h,
      SUM(CASE WHEN v.status != 'Delivered' THEN 1 ELSE 0 END)::int                                                           AS not_processed,
      SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.has_photos,0)=1 AND ${PENDENCY_PREDICATE} THEN 1 ELSE 0 END)::int AS not_processed_after_24h,
      COUNT(DISTINCT v.rooftop_id)::int     AS rooftop_count,
      COUNT(DISTINCT CASE WHEN rd.ims_integration_status = 'false' THEN v.rooftop_id END)::int AS not_integrated_count,
      COUNT(DISTINCT CASE WHEN rd.publishing_status = 'false' THEN v.rooftop_id END)::int      AS publishing_disabled_count,
      ROUND(AVG(rd.website_score)::numeric, 2)  AS avg_website_score,
      ROUND(AVG(v.vin_score)::numeric, 2)       AS avg_inventory_score,
      MAX(ed.website_url)                   AS website_url,
      MAX(ed.type)                          AS account_type,
      SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.has_photos,0)=1 AND v.reason_bucket = 'Upload Pending'      AND ${PENDENCY_PREDICATE} THEN 1 ELSE 0 END)::int AS bucket_upload_pending,
      SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.has_photos,0)=1 AND v.reason_bucket = 'Processing Pending' AND ${PENDENCY_PREDICATE} THEN 1 ELSE 0 END)::int AS bucket_processing_pending,
      SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.has_photos,0)=1 AND v.reason_bucket = 'Publishing Pending' AND ${PENDENCY_PREDICATE} THEN 1 ELSE 0 END)::int AS bucket_publishing_pending,
      SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.has_photos,0)=1 AND v.reason_bucket = 'QC Pending'         AND ${PENDENCY_PREDICATE} THEN 1 ELSE 0 END)::int AS bucket_qc_pending,
      SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.has_photos,0)=1 AND v.reason_bucket = 'QC Hold'            AND ${PENDENCY_PREDICATE} THEN 1 ELSE 0 END)::int AS bucket_qc_hold,
      SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.has_photos,0)=1 AND v.reason_bucket = 'Sold'               AND ${PENDENCY_PREDICATE} THEN 1 ELSE 0 END)::int AS bucket_sold,
      SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.has_photos,0)=1 AND v.reason_bucket = 'Others'             AND ${PENDENCY_PREDICATE} THEN 1 ELSE 0 END)::int AS bucket_others
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
