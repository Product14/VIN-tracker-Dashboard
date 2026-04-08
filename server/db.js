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

db.exec(`
  CREATE TABLE IF NOT EXISTS vins (
    vin           TEXT PRIMARY KEY,
    enterprise_id TEXT,
    enterprise    TEXT,
    rooftop_id    TEXT,
    rooftop       TEXT,
    rooftop_type  TEXT,
    csm           TEXT,
    status        TEXT,
    after_24h     INTEGER,
    received_at   TEXT,
    processed_at  TEXT,
    synced_at     TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_vins_rooftop       ON vins(rooftop);
  CREATE INDEX IF NOT EXISTS idx_vins_enterprise_id ON vins(enterprise_id);
  CREATE INDEX IF NOT EXISTS idx_vins_csm           ON vins(csm);
  CREATE INDEX IF NOT EXISTS idx_vins_status        ON vins(status);
  CREATE INDEX IF NOT EXISTS idx_vins_rooftop_type  ON vins(rooftop_type);
  CREATE INDEX IF NOT EXISTS idx_vins_received_at   ON vins(received_at);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS website_scores (
    team_id       TEXT PRIMARY KEY,
    enterprise_id TEXT,
    website_score REAL,
    synced_at     TEXT
  );
`);

// ─── Views ───────────────────────────────────────────────────────────────────

db.exec(`
  DROP VIEW IF EXISTS v_totals;
  CREATE VIEW v_totals AS
  SELECT
    COUNT(*)                                                                          AS total,
    SUM(CASE WHEN status = 'Delivered' THEN 1 ELSE 0 END)                            AS processed,
    SUM(CASE WHEN status = 'Delivered' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END) AS processed_after_24h,
    SUM(CASE WHEN status != 'Delivered' THEN 1 ELSE 0 END)                           AS not_processed,
    SUM(CASE WHEN status != 'Delivered' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END) AS not_processed_after_24h
  FROM vins;
`);

db.exec(`
  DROP VIEW IF EXISTS v_by_rooftop;
  CREATE VIEW v_by_rooftop AS
  SELECT
    rooftop       AS name,
    rooftop_type  AS type,
    csm,
    enterprise_id,
    enterprise,
    COUNT(*)                                                                          AS total,
    SUM(CASE WHEN status = 'Delivered' THEN 1 ELSE 0 END)                            AS processed,
    SUM(CASE WHEN status = 'Delivered' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END) AS processed_after_24h,
    SUM(CASE WHEN status != 'Delivered' THEN 1 ELSE 0 END)                           AS not_processed,
    SUM(CASE WHEN status != 'Delivered' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END) AS not_processed_after_24h
  FROM vins
  GROUP BY rooftop;
`);

db.exec(`
  DROP VIEW IF EXISTS v_by_enterprise;
  CREATE VIEW v_by_enterprise AS
  SELECT
    enterprise_id AS id,
    enterprise    AS name,
    COUNT(*)                                                                          AS total,
    SUM(CASE WHEN status = 'Delivered' THEN 1 ELSE 0 END)                            AS processed,
    SUM(CASE WHEN status = 'Delivered' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END) AS processed_after_24h,
    SUM(CASE WHEN status != 'Delivered' THEN 1 ELSE 0 END)                           AS not_processed,
    SUM(CASE WHEN status != 'Delivered' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END) AS not_processed_after_24h
  FROM vins
  GROUP BY enterprise_id;
`);

db.exec(`
  DROP VIEW IF EXISTS v_by_csm;
  CREATE VIEW v_by_csm AS
  SELECT
    v.csm                     AS name,
    COUNT(DISTINCT v.rooftop) AS rooftop_count,
    COUNT(*)                                                                            AS total,
    SUM(CASE WHEN v.status = 'Delivered' THEN 1 ELSE 0 END)                            AS processed,
    SUM(CASE WHEN v.status = 'Delivered' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END) AS processed_after_24h,
    SUM(CASE WHEN v.status != 'Delivered' THEN 1 ELSE 0 END)                           AS not_processed,
    SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END) AS not_processed_after_24h,
    ws_avg.avg_score AS avg_website_score
  FROM vins v
  LEFT JOIN (
    SELECT rv.csm, ROUND(AVG(ws.website_score), 2) AS avg_score
    FROM (SELECT DISTINCT csm, rooftop_id FROM vins) rv
    INNER JOIN website_scores ws ON rv.rooftop_id = ws.team_id
    GROUP BY rv.csm
  ) ws_avg ON v.csm = ws_avg.csm
  GROUP BY v.csm
  ORDER BY v.csm;
`);

db.exec(`
  DROP VIEW IF EXISTS v_by_type;
  CREATE VIEW v_by_type AS
  SELECT
    rooftop_type            AS label,
    COUNT(DISTINCT rooftop) AS rooftop_count,
    COUNT(*)                                                                          AS total,
    SUM(CASE WHEN status = 'Delivered' THEN 1 ELSE 0 END)                            AS processed,
    SUM(CASE WHEN status = 'Delivered' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END) AS processed_after_24h,
    SUM(CASE WHEN status != 'Delivered' THEN 1 ELSE 0 END)                           AS not_processed,
    SUM(CASE WHEN status != 'Delivered' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END) AS not_processed_after_24h
  FROM vins
  GROUP BY rooftop_type;
`);

export default db;
