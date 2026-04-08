import express from "express";
import cors from "cors";
import db from "./db.js";

const app = express();
app.use(cors());
app.use(express.json());

const METABASE_URL =
  "https://metabase.spyne.ai/api/public/card/15e908e4-fe21-4982-9d8c-4aff07f2c948/query/json";

const WEBSITE_SCORE_URL =
  "https://metabase.spyne.ai/api/public/card/10a24df7-a062-452f-969f-fe4d45af3f79/query/json";

// ─── Sync helpers ────────────────────────────────────────────────────────────

const EPOCH        = "1970-01-01T00:00:00Z";
const cleanDate    = (v) => (!v || v === EPOCH) ? null : v;
const cleanAfter24 = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v.toLowerCase() === "yes" ? 1 : 0;
  return v ? 1 : 0;
};

const insertStmt = db.prepare(`
  INSERT INTO vins
    (vin, enterprise_id, enterprise, rooftop_id, rooftop, rooftop_type,
     csm, status, after_24h, received_at, processed_at, synced_at)
  VALUES
    (@vin, @enterpriseId, @enterprise, @rooftopId, @rooftop, @rooftopType,
     @csm, @status, @after24h, @receivedAt, @processedAt, @syncedAt)
`);

const insertScoreStmt = db.prepare(`
  INSERT INTO website_scores (team_id, enterprise_id, website_score, synced_at)
  VALUES (@teamId, @enterpriseId, @websiteScore, @syncedAt)
`);

export async function syncFromMetabase() {
  // Fetch both datasets in parallel
  const [vinResponse, scoreResponse] = await Promise.all([
    fetch(METABASE_URL),
    fetch(WEBSITE_SCORE_URL),
  ]);
  if (!vinResponse.ok)   throw new Error(`Metabase VINs HTTP ${vinResponse.status}`);
  if (!scoreResponse.ok) throw new Error(`Metabase scores HTTP ${scoreResponse.status}`);

  const [metaRows, scoreRows] = await Promise.all([
    vinResponse.json(),
    scoreResponse.json(),
  ]);

  const syncedAt = new Date().toISOString();

  // Deduplicate by vin — Metabase sometimes returns the same VIN twice; keep last occurrence.
  const deduped = Object.values(
    metaRows.reduce((acc, row) => { acc[row.vinName ?? ""] = row; return acc; }, {})
  );

  // Delete all existing rows and insert fresh — inside one transaction so the
  // tables are never left empty if an insert fails partway through.
  db.transaction(() => {
    db.prepare("DELETE FROM vins").run();
    for (const row of deduped) {
      insertStmt.run({
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
    // Deduplicate website scores by teamId — keep last occurrence.
    const dedupedScores = Object.values(
      scoreRows.reduce((acc, row) => {
        if (row.teamId) acc[String(row.teamId)] = row;
        return acc;
      }, {})
    );
    db.prepare("DELETE FROM website_scores").run();
    for (const row of dedupedScores) {
      const score = row.websiteScore !== null && row.websiteScore !== undefined
        ? Number(row.websiteScore) : null;
      insertScoreStmt.run({
        teamId:       String(row.teamId),
        enterpriseId: String(row.enterpriseId ?? ""),
        websiteScore: score,
        syncedAt,
      });
    }
  })();

  return { count: deduped.length, scoreCount: scoreRows.length, syncedAt };
}

// ─── Row serialiser ──────────────────────────────────────────────────────────

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

// ─── ensureData removed — data is only refreshed via manual POST /api/sync ───

// ─── GET /api/sync/status ────────────────────────────────────────────────────

app.get("/api/sync/status", (_req, res) => {
  const meta = db.prepare("SELECT MAX(synced_at) AS last_sync, COUNT(*) AS total_rows FROM vins").get();
  res.json({ lastSync: meta?.last_sync ?? null, totalRows: meta?.total_rows ?? 0 });
});

// ─── POST /api/sync ──────────────────────────────────────────────────────────

app.post("/api/sync", async (_req, res) => {
  try {
    const { count, syncedAt } = await syncFromMetabase();
    const meta = db.prepare("SELECT MAX(synced_at) AS last_sync, COUNT(*) AS total_rows FROM vins").get();
    res.json({ synced: count, syncedAt, lastSync: meta?.last_sync ?? null, totalRows: meta?.total_rows ?? 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Summary serialisers (snake_case DB → camelCase API) ─────────────────────

function toTotals(r) {
  return {
    total:                r.total,
    processed:            r.processed,
    processedAfter24:     r.processed_after_24h,
    notProcessed:         r.not_processed,
    notProcessedAfter24:  r.not_processed_after_24h,
  };
}

function toRooftopRow(r) {
  return {
    rooftopId:            r.rooftop_id,
    name:                 r.name,
    type:                 r.type,
    csm:                  r.csm,
    enterpriseId:         r.enterprise_id,
    enterprise:           r.enterprise,
    total:                r.total,
    processed:            r.processed,
    processedAfter24:     r.processed_after_24h,
    notProcessed:         r.not_processed,
    notProcessedAfter24:  r.not_processed_after_24h,
    websiteScore:         r.website_score ?? null,
  };
}

function toEnterpriseRow(r) {
  return {
    id:                   r.id,
    name:                 r.name,
    csm:                  r.csm ?? null,
    total:                r.total,
    processed:            r.processed,
    processedAfter24:     r.processed_after_24h,
    notProcessed:         r.not_processed,
    notProcessedAfter24:  r.not_processed_after_24h,
    avgWebsiteScore:      r.avg_website_score ?? null,
  };
}

function toCsmRow(r) {
  return {
    name:                 r.name,
    label:                r.name,   // OverviewTab uses `label` for this field
    rooftopCount:         r.rooftop_count,
    total:                r.total,
    processed:            r.processed,
    processedAfter24:     r.processed_after_24h,
    notProcessed:         r.not_processed,
    notProcessedAfter24:  r.not_processed_after_24h,
    avgWebsiteScore:      r.avg_website_score ?? null,
  };
}

function toTypeRow(r) {
  return {
    label:                r.label,
    rooftopCount:         r.rooftop_count,
    total:                r.total,
    processed:            r.processed,
    processedAfter24:     r.processed_after_24h,
    notProcessed:         r.not_processed,
    notProcessedAfter24:  r.not_processed_after_24h,
  };
}

// ─── GET /api/summary ────────────────────────────────────────────────────────

app.get("/api/summary", async (_req, res) => {
  const meta         = db.prepare("SELECT MAX(synced_at) AS last_sync, COUNT(*) AS total_rows FROM vins").get();
  const totals       = toTotals(db.prepare("SELECT * FROM v_totals").get());
  const byRooftop    = db.prepare("SELECT * FROM v_by_rooftop").all().map(toRooftopRow);
  const byEnterprise = db.prepare("SELECT * FROM v_by_enterprise").all().map(toEnterpriseRow);
  const byCSM        = db.prepare("SELECT * FROM v_by_csm").all().map(toCsmRow);
  const byType       = db.prepare("SELECT * FROM v_by_type").all().map(toTypeRow);
  res.json({ lastSync: meta?.last_sync ?? null, totalRows: meta?.total_rows ?? 0, totals, byRooftop, byEnterprise, byCSM, byType });
});

app.get("/api/summary/totals",        async (_req, res) => { await ensureData(); res.json(toTotals(db.prepare("SELECT * FROM v_totals").get())); });
app.get("/api/summary/by-rooftop",    async (_req, res) => { await ensureData(); res.json(db.prepare("SELECT * FROM v_by_rooftop").all().map(toRooftopRow)); });
app.get("/api/summary/by-enterprise", async (_req, res) => { await ensureData(); res.json(db.prepare("SELECT * FROM v_by_enterprise").all().map(toEnterpriseRow)); });
app.get("/api/summary/by-csm",        async (_req, res) => { await ensureData(); res.json(db.prepare("SELECT * FROM v_by_csm").all().map(toCsmRow)); });
app.get("/api/summary/by-type",       async (_req, res) => { await ensureData(); res.json(db.prepare("SELECT * FROM v_by_type").all().map(toTypeRow)); });

// ─── GET /api/vins ───────────────────────────────────────────────────────────

app.get("/api/vins", async (req, res) => {

  const page     = Math.max(1, parseInt(req.query.page)     || 1);
  const pageSize = Math.min(500, Math.max(10, parseInt(req.query.pageSize) || 50));
  const offset   = (page - 1) * pageSize;

  const { search, rooftop, rooftopId, rooftopType, csm, status, after24h, enterprise, enterpriseId } = req.query;

  const conditions = [];
  const params     = [];

  if (search) {
    conditions.push("(vin LIKE ? OR rooftop LIKE ? OR csm LIKE ? OR enterprise LIKE ?)");
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }
  if (enterpriseId) { conditions.push("enterprise_id = ?"); params.push(enterpriseId); }
  if (rooftopId)    { conditions.push("rooftop_id = ?");    params.push(rooftopId); }
  if (rooftop)      { conditions.push("rooftop = ?");       params.push(rooftop); }
  if (rooftopType)  { conditions.push("rooftop_type = ?");  params.push(rooftopType); }
  if (csm)          { conditions.push("csm = ?");           params.push(csm); }
  if (status)       { conditions.push("status = ?");        params.push(status); }
  if (enterprise)   { conditions.push("enterprise = ?");    params.push(enterprise); }
  if (after24h === "true"  || after24h === "1") { conditions.push("COALESCE(after_24h,0) = 1"); }
  if (after24h === "false" || after24h === "0") { conditions.push("COALESCE(after_24h,0) = 0"); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const total = db.prepare(`SELECT COUNT(*) AS n FROM vins ${where}`).get(...params).n;
  const rows  = db.prepare(`
    SELECT * FROM vins ${where}
    ORDER BY received_at DESC NULLS LAST
    LIMIT ${pageSize} OFFSET ${offset}
  `).all(...params);

  res.json({ data: rows.map(toApiRow), total, page, pageSize, pageCount: Math.ceil(total / pageSize) });
});

// Keep old path as alias
app.get("/api/vins/raw", (req, res) => {
  res.redirect(307, `/api/vins?${new URLSearchParams(req.query)}`);
});

// ─── GET /api/vins/export ────────────────────────────────────────────────────

app.get("/api/vins/export", async (req, res) => {

  const { search, rooftop, rooftopId, rooftopType, csm, status, after24h, enterprise, enterpriseId } = req.query;

  const conditions = [];
  const params     = [];

  if (search) {
    conditions.push("(vin LIKE ? OR rooftop LIKE ? OR csm LIKE ? OR enterprise LIKE ?)");
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }
  if (enterpriseId) { conditions.push("enterprise_id = ?"); params.push(enterpriseId); }
  if (rooftopId)    { conditions.push("rooftop_id = ?");    params.push(rooftopId); }
  if (rooftop)      { conditions.push("rooftop = ?");       params.push(rooftop); }
  if (rooftopType)  { conditions.push("rooftop_type = ?");  params.push(rooftopType); }
  if (csm)          { conditions.push("csm = ?");           params.push(csm); }
  if (status)       { conditions.push("status = ?");        params.push(status); }
  if (enterprise)   { conditions.push("enterprise = ?");    params.push(enterprise); }
  if (after24h === "true"  || after24h === "1") { conditions.push("COALESCE(after_24h,0) = 1"); }
  if (after24h === "false" || after24h === "0") { conditions.push("COALESCE(after_24h,0) = 0"); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = db.prepare(`
    SELECT * FROM vins ${where}
    ORDER BY received_at DESC NULLS LAST
  `).all(...params);

  res.json({ data: rows.map(toApiRow) });
});

export default app;
