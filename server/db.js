import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// On Vercel the main filesystem is read-only; use /tmp instead.
const DB_PATH = process.env.VERCEL
  ? "/tmp/vins.db"
  : join(__dirname, "vins.db");

const db = new Database(DB_PATH);

// ─── Schema ──────────────────────────────────────────────────────────────────

// Drop legacy tables (renamed as part of schema normalization).
db.exec(`DROP TABLE IF EXISTS website_scores`);
db.exec(`DROP TABLE IF EXISTS website_urls`);

// Recreate vins without denormalized columns — enterprise/rooftop details are
// now joined at query time from rooftop_details and enterprise_details.
db.exec(`DROP TABLE IF EXISTS vins`);

db.exec(`
  CREATE TABLE IF NOT EXISTS vins (
    vin             TEXT PRIMARY KEY,
    dealer_vin_id   TEXT,
    enterprise_id   TEXT,
    rooftop_id      TEXT,
    status          TEXT,
    after_24h       INTEGER,
    received_at     TEXT,
    processed_at    TEXT,
    reason_bucket   TEXT,
    synced_at       TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_vins_rooftop_id    ON vins(rooftop_id);
  CREATE INDEX IF NOT EXISTS idx_vins_enterprise_id ON vins(enterprise_id);
  CREATE INDEX IF NOT EXISTS idx_vins_status        ON vins(status);
  CREATE INDEX IF NOT EXISTS idx_vins_received_at   ON vins(received_at);
`);

db.exec(`DROP TABLE IF EXISTS rooftop_details`);
db.exec(`
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
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS enterprise_details (
    enterprise_id  TEXT PRIMARY KEY,
    name           TEXT,
    type           TEXT,
    website_url    TEXT,
    poc_email      TEXT,
    synced_at      TEXT
  );
`);

// ─── Views ───────────────────────────────────────────────────────────────────

db.exec(`
  DROP VIEW IF EXISTS v_totals;
  CREATE VIEW v_totals AS
  SELECT
    COUNT(*)                                                                              AS total,
    SUM(CASE WHEN status = 'Delivered' THEN 1 ELSE 0 END)                                AS processed,
    SUM(CASE WHEN status = 'Delivered' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END)   AS processed_after_24h,
    SUM(CASE WHEN status != 'Delivered' THEN 1 ELSE 0 END)                               AS not_processed,
    SUM(CASE WHEN status != 'Delivered' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END)  AS not_processed_after_24h,
    SUM(CASE WHEN reason_bucket = 'Processing Pending' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END)               AS bucket_processing_pending,
    SUM(CASE WHEN reason_bucket = 'Publishing Pending' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END)               AS bucket_publishing_pending,
    SUM(CASE WHEN reason_bucket = 'QC Pending' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END)               AS bucket_qc_pending,
    SUM(CASE WHEN reason_bucket = 'Sold' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END)               AS bucket_sold,
    SUM(CASE WHEN reason_bucket = 'Others' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END)               AS bucket_others
  FROM vins;
`);

db.exec(`
  DROP VIEW IF EXISTS v_by_rooftop;
  CREATE VIEW v_by_rooftop AS
  SELECT
    v.rooftop_id,
    v.enterprise_id,
    MAX(rd.team_name)            AS name,
    MAX(rd.team_type)             AS type,
    MAX(ed.poc_email)            AS csm,
    MAX(ed.name)                 AS enterprise,
    COUNT(*)                                                                                AS total,
    SUM(CASE WHEN v.status = 'Delivered' THEN 1 ELSE 0 END)                                AS processed,
    SUM(CASE WHEN v.status = 'Delivered' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END) AS processed_after_24h,
    SUM(CASE WHEN v.status != 'Delivered' THEN 1 ELSE 0 END)                               AS not_processed,
    SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END) AS not_processed_after_24h,
    MAX(rd.website_score)             AS website_score,
    MAX(rd.website_listing_url)       AS website_listing_url,
    MAX(rd.ims_integration_status)    AS ims_integration_status,
    MAX(rd.publishing_status)         AS publishing_status,
    SUM(CASE WHEN v.reason_bucket = 'Processing Pending' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END) AS bucket_processing_pending,
    SUM(CASE WHEN v.reason_bucket = 'Publishing Pending' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END) AS bucket_publishing_pending,
    SUM(CASE WHEN v.reason_bucket = 'QC Pending' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END) AS bucket_qc_pending,
    SUM(CASE WHEN v.reason_bucket = 'Sold' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END) AS bucket_sold,
    SUM(CASE WHEN v.reason_bucket = 'Others' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END) AS bucket_others
  FROM vins v
  LEFT JOIN rooftop_details rd ON v.rooftop_id = rd.team_id
  LEFT JOIN enterprise_details ed ON v.enterprise_id = ed.enterprise_id
  GROUP BY v.rooftop_id, v.enterprise_id;
`);

db.exec(`
  DROP VIEW IF EXISTS v_by_enterprise;
  CREATE VIEW v_by_enterprise AS
  SELECT
    v.enterprise_id                   AS id,
    MAX(ed.name)                      AS name,
    MAX(ed.poc_email)                 AS csm,
    COUNT(*)                                                                                AS total,
    SUM(CASE WHEN v.status = 'Delivered' THEN 1 ELSE 0 END)                                AS processed,
    SUM(CASE WHEN v.status = 'Delivered' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END) AS processed_after_24h,
    SUM(CASE WHEN v.status != 'Delivered' THEN 1 ELSE 0 END)                               AS not_processed,
    SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END) AS not_processed_after_24h,
    ROUND(AVG(rd.website_score), 2)   AS avg_website_score,
    MAX(ed.website_url)               AS website_url,
    MAX(ed.type)                      AS account_type,
    SUM(CASE WHEN v.reason_bucket = 'Processing Pending' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END) AS bucket_processing_pending,
    SUM(CASE WHEN v.reason_bucket = 'Publishing Pending' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END) AS bucket_publishing_pending,
    SUM(CASE WHEN v.reason_bucket = 'QC Pending' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END) AS bucket_qc_pending,
    SUM(CASE WHEN v.reason_bucket = 'Sold' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END) AS bucket_sold,
    SUM(CASE WHEN v.reason_bucket = 'Others' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END) AS bucket_others
  FROM vins v
  LEFT JOIN enterprise_details ed ON v.enterprise_id = ed.enterprise_id
  LEFT JOIN rooftop_details rd ON v.rooftop_id = rd.team_id
  GROUP BY v.enterprise_id;
`);

db.exec(`
  DROP VIEW IF EXISTS v_by_csm;
  CREATE VIEW v_by_csm AS
  SELECT
    ed.poc_email                  AS name,
    COUNT(DISTINCT v.rooftop_id)  AS rooftop_count,
    COUNT(*)                                                                                AS total,
    SUM(CASE WHEN v.status = 'Delivered' THEN 1 ELSE 0 END)                                AS processed,
    SUM(CASE WHEN v.status = 'Delivered' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END) AS processed_after_24h,
    SUM(CASE WHEN v.status != 'Delivered' THEN 1 ELSE 0 END)                               AS not_processed,
    SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END) AS not_processed_after_24h,
    ROUND(AVG(rd.website_score), 2) AS avg_website_score,
    COUNT(DISTINCT CASE WHEN rd.ims_integration_status = 'false' THEN v.rooftop_id END) AS integrated_count,
    COUNT(DISTINCT CASE WHEN rd.publishing_status = 'false' THEN v.rooftop_id END) AS publishing_count,
    SUM(CASE WHEN v.reason_bucket = 'Processing Pending' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END) AS bucket_processing_pending,
    SUM(CASE WHEN v.reason_bucket = 'Publishing Pending' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END) AS bucket_publishing_pending,
    SUM(CASE WHEN v.reason_bucket = 'QC Pending' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END) AS bucket_qc_pending,
    SUM(CASE WHEN v.reason_bucket = 'Sold' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END) AS bucket_sold,
    SUM(CASE WHEN v.reason_bucket = 'Others' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END) AS bucket_others
  FROM vins v
  LEFT JOIN enterprise_details ed ON v.enterprise_id = ed.enterprise_id
  LEFT JOIN rooftop_details rd ON v.rooftop_id = rd.team_id
  GROUP BY ed.poc_email
  ORDER BY ed.poc_email;
`);

db.exec(`
  DROP VIEW IF EXISTS v_by_type;
  CREATE VIEW v_by_type AS
  SELECT
    rd.team_type                   AS label,
    COUNT(DISTINCT v.rooftop_id)  AS rooftop_count,
    COUNT(*)                                                                                AS total,
    SUM(CASE WHEN v.status = 'Delivered' THEN 1 ELSE 0 END)                                AS processed,
    SUM(CASE WHEN v.status = 'Delivered' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END) AS processed_after_24h,
    SUM(CASE WHEN v.status != 'Delivered' THEN 1 ELSE 0 END)                               AS not_processed,
    SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END) AS not_processed_after_24h,
    COUNT(DISTINCT CASE WHEN rd.ims_integration_status = 'false' THEN v.rooftop_id END) AS integrated_count,
    COUNT(DISTINCT CASE WHEN rd.publishing_status = 'false' THEN v.rooftop_id END) AS publishing_count,
    SUM(CASE WHEN v.reason_bucket = 'Processing Pending' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END) AS bucket_processing_pending,
    SUM(CASE WHEN v.reason_bucket = 'Publishing Pending' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END) AS bucket_publishing_pending,
    SUM(CASE WHEN v.reason_bucket = 'QC Pending' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END) AS bucket_qc_pending,
    SUM(CASE WHEN v.reason_bucket = 'Sold' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END) AS bucket_sold,
    SUM(CASE WHEN v.reason_bucket = 'Others' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END) AS bucket_others
  FROM vins v
  LEFT JOIN rooftop_details rd ON v.rooftop_id = rd.team_id
  GROUP BY rd.team_type;
`);

export default db;
