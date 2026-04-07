import express from "express";
import cors from "cors";
import db from "./db.js";

const app = express();
app.use(cors());
app.use(express.json());

const METABASE_URL =
  "https://metabase.spyne.ai/api/public/card/15e908e4-fe21-4982-9d8c-4aff07f2c948/query/json";

// ─── SQL helpers ────────────────────────────────────────────────────────────

const AGG_COLS = `
  COUNT(*) as total,
  SUM(CASE WHEN status = 'Delivered' THEN 1 ELSE 0 END) as processed,
  SUM(CASE WHEN status = 'Delivered' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END) as processedAfter24,
  SUM(CASE WHEN status != 'Delivered' THEN 1 ELSE 0 END) as notProcessed,
  SUM(CASE WHEN status != 'Delivered' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END) as notProcessedAfter24
`;

// ─── GET /api/summary ────────────────────────────────────────────────────────
// Returns pre-aggregated data for Overview / Enterprise / Rooftop / CSM tabs.
app.get("/api/summary", (_req, res) => {
  const meta    = db.prepare("SELECT MAX(synced_at) AS last_sync, COUNT(*) AS total_rows FROM vins").get();
  const totals  = db.prepare(`SELECT ${AGG_COLS} FROM vins`).get();

  const byRooftop = db.prepare(`
    SELECT rooftop as name, rooftop_type as type, csm,
      enterprise_id as enterpriseId, enterprise,
      ${AGG_COLS}
    FROM vins GROUP BY rooftop
  `).all();

  const byEnterprise = db.prepare(`
    SELECT enterprise_id as id, enterprise as name, ${AGG_COLS}
    FROM vins GROUP BY enterprise_id
  `).all();

  const byCSM = db.prepare(`
    SELECT csm as name, COUNT(DISTINCT rooftop) as rooftopCount, ${AGG_COLS}
    FROM vins GROUP BY csm ORDER BY csm
  `).all();

  const byType = db.prepare(`
    SELECT rooftop_type as label, COUNT(DISTINCT rooftop) as rooftopCount, ${AGG_COLS}
    FROM vins GROUP BY rooftop_type
  `).all();

  res.json({
    totals,
    byRooftop,
    byEnterprise,
    byCSM,
    byType,
    lastSync:   meta?.last_sync ?? null,
    totalRows:  meta?.total_rows ?? 0,
  });
});

// ─── GET /api/vins/raw ───────────────────────────────────────────────────────
// Paginated + filtered raw rows for VIN Data tab.
app.get("/api/vins/raw", (req, res) => {
  const page     = Math.max(1, parseInt(req.query.page)     || 1);
  const pageSize = Math.min(500, Math.max(10, parseInt(req.query.pageSize) || 50));
  const offset   = (page - 1) * pageSize;

  const { search, rooftop, rooftopType, csm, status, after24h, enterprise } = req.query;

  const conditions = [];
  const params     = [];

  if (search) {
    conditions.push("(vin LIKE ? OR rooftop LIKE ? OR csm LIKE ? OR enterprise LIKE ?)");
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }
  if (rooftop)     { conditions.push("rooftop = ?");      params.push(rooftop); }
  if (rooftopType) { conditions.push("rooftop_type = ?"); params.push(rooftopType); }
  if (csm)         { conditions.push("csm = ?");          params.push(csm); }
  if (status)      { conditions.push("status = ?");       params.push(status); }
  if (enterprise)  { conditions.push("enterprise = ?");   params.push(enterprise); }
  if (after24h === "true" || after24h === "1")  { conditions.push("COALESCE(after_24h,0) = 1"); }
  if (after24h === "false"|| after24h === "0")  { conditions.push("COALESCE(after_24h,0) = 0"); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const total = db.prepare(`SELECT COUNT(*) as n FROM vins ${where}`).get(...params).n;
  const rows  = db.prepare(`
    SELECT * FROM vins ${where}
    ORDER BY received_at DESC NULLS LAST
    LIMIT ${pageSize} OFFSET ${offset}
  `).all(...params);

  res.json({
    data:      rows.map(toApiRow),
    total,
    page,
    pageSize,
    pageCount: Math.ceil(total / pageSize),
  });
});

// ─── POST /api/sync ──────────────────────────────────────────────────────────
// Fetch from Metabase → upsert DB → return updated summary.
app.post("/api/sync", async (_req, res) => {
  try {
    const response = await fetch(METABASE_URL);
    if (!response.ok) throw new Error(`Metabase HTTP ${response.status}`);
    const metaRows = await response.json();

    const syncedAt = new Date().toISOString();

    const upsert = db.prepare(`
      INSERT INTO vins
        (vin, enterprise_id, enterprise, rooftop_id, rooftop, rooftop_type,
         csm, status, after_24h, received_at, processed_at, synced_at)
      VALUES
        (@vin, @enterpriseId, @enterprise, @rooftopId, @rooftop, @rooftopType,
         @csm, @status, @after24h, @receivedAt, @processedAt, @syncedAt)
      ON CONFLICT(vin) DO UPDATE SET
        enterprise_id = excluded.enterprise_id,
        enterprise    = excluded.enterprise,
        rooftop_id    = excluded.rooftop_id,
        rooftop       = excluded.rooftop,
        rooftop_type  = excluded.rooftop_type,
        csm           = excluded.csm,
        status        = excluded.status,
        after_24h     = excluded.after_24h,
        received_at   = excluded.received_at,
        processed_at  = excluded.processed_at,
        synced_at     = excluded.synced_at
    `);

    const EPOCH       = "1970-01-01T00:00:00Z";
    const cleanDate   = (v) => (!v || v === EPOCH) ? null : v;
    const cleanAfter24 = (v) => {
      if (v === null || v === undefined) return null;
      if (typeof v === "string") return v.toLowerCase() === "yes" ? 1 : 0;
      return v ? 1 : 0;
    };

    db.transaction(() => {
      for (const row of metaRows) {
        upsert.run({
          vin:          row.vinName ?? "",
          enterpriseId: row["m.enterpriseId"] ?? "",
          enterprise:   row.name ?? "",
          rooftopId:    String(row["m.teamId"] ?? ""),
          rooftop:      row.rooftop_name ?? "",
          rooftopType:  row.type ?? "",
          csm:          row.email_id ?? "",
          status:       row.status ?? "",
          after24h:     cleanAfter24(row.after_24_hrs ?? row.after_24hrs ?? null),
          receivedAt:   cleanDate(row.receivedAt),
          processedAt:  cleanDate(row.sentAt),
          syncedAt,
        });
      }
    })();

    // Return fresh summary (not all raw rows)
    const meta      = db.prepare("SELECT MAX(synced_at) AS last_sync, COUNT(*) AS total_rows FROM vins").get();
    const totals    = db.prepare(`SELECT ${AGG_COLS} FROM vins`).get();
    const byRooftop = db.prepare(`SELECT rooftop as name, rooftop_type as type, csm, enterprise_id as enterpriseId, enterprise, ${AGG_COLS} FROM vins GROUP BY rooftop`).all();
    const byEnterprise = db.prepare(`SELECT enterprise_id as id, enterprise as name, ${AGG_COLS} FROM vins GROUP BY enterprise_id`).all();
    const byCSM  = db.prepare(`SELECT csm as name, COUNT(DISTINCT rooftop) as rooftopCount, ${AGG_COLS} FROM vins GROUP BY csm ORDER BY csm`).all();
    const byType = db.prepare(`SELECT rooftop_type as label, COUNT(DISTINCT rooftop) as rooftopCount, ${AGG_COLS} FROM vins GROUP BY rooftop_type`).all();

    res.json({
      synced: metaRows.length,
      syncedAt,
      totals, byRooftop, byEnterprise, byCSM, byType,
      lastSync: meta?.last_sync ?? null,
      totalRows: meta?.total_rows ?? 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function toApiRow(r) {
  return {
    vin:          r.vin,
    enterpriseId: r.enterprise_id,
    enterprise:   r.enterprise,
    rooftopId:    r.rooftop_id,
    rooftop:      r.rooftop,
    rooftopType:  r.rooftop_type,
    csm:          r.csm,
    status:       r.status,
    after24h:     r.after_24h !== null ? Boolean(r.after_24h) : null,
    receivedAt:   r.received_at,
    processedAt:  r.processed_at,
    syncedAt:     r.synced_at,
  };
}

const PORT = 3001;
app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`));
