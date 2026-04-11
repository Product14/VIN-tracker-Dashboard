import express from "express";
import cors from "cors";
import db from "./db.js";

const app = express();
app.use(cors());
app.use(express.json());

const VIN_DETAILS_URL =
  "https://metabase.spyne.ai/api/public/card/15e908e4-fe21-4982-9d8c-4aff07f2c948/query/json";

const ROOFTOP_DETAILS_URL =
  "https://metabase.spyne.ai/api/public/card/f5c032a6-c262-40ee-8d95-c115d326d3a8/query/json";

const ENTERPRISE_DETAILS_URL =
  "https://metabase.spyne.ai/api/public/card/b8f1271c-cc5a-470f-badf-807711f74af4/query/json";

// ─── Sync helpers ────────────────────────────────────────────────────────────

const EPOCH        = "1970-01-01T00:00:00Z";
const cleanDate    = (v) => (!v || v === EPOCH) ? null : v;
const cleanAfter24 = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v.toLowerCase() === "yes" ? 1 : 0;
  return v ? 1 : 0;
};

const insertVinStmt = db.prepare(`
  INSERT INTO vins
    (vin, dealer_vin_id, enterprise_id, rooftop_id, status, after_24h, received_at, processed_at, reason_bucket, synced_at)
  VALUES
    (@vin, @dealerVinId, @enterpriseId, @rooftopId, @status, @after24h, @receivedAt, @processedAt, @reasonBucket, @syncedAt)
`);

const insertRooftopStmt = db.prepare(`
  INSERT INTO rooftop_details (team_id, enterprise_id, team_name, team_type, website_score, website_listing_url, ims_integration_status, publishing_status, synced_at)
  VALUES (@teamId, @enterpriseId, @teamName, @teamType, @websiteScore, @websiteListingUrl, @imsIntegrationStatus, @publishingStatus, @syncedAt)
`);

const insertEnterpriseStmt = db.prepare(`
  INSERT INTO enterprise_details (enterprise_id, name, type, website_url, poc_email, synced_at)
  VALUES (@enterpriseId, @name, @type, @websiteUrl, @pocEmail, @syncedAt)
`);

// ─── Sync state ──────────────────────────────────────────────────────────────

const syncState = {
  running:     false,
  startedAt:   null,
  completedAt: null,
  tables: {
    vins:        { status: "idle", count: null, error: null, syncedAt: null },
    rooftops:    { status: "idle", count: null, error: null, syncedAt: null },
    enterprises: { status: "idle", count: null, error: null, syncedAt: null },
  },
};

// Fetch from Metabase with no artificial timeout — wait as long as Metabase
// needs. Retry on HTTP errors or network failures with exponential back-off.
async function fetchFromMetabase(url, label, retries = 3) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) console.log(`[sync:${label}] retry attempt ${attempt}/${retries}`);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        const delay = 3000 * (attempt + 1);
        console.warn(`[sync:${label}] failed, retrying in ${delay / 1000}s — ${err.message}`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

// Each table syncs independently — a failure in one does not affect the others.

async function syncVins() {
  syncState.tables.vins = { status: "running", count: null, error: null, syncedAt: null };
  try {
    console.log("[sync:VIN_DETAILS] fetching…");
    const rows = await fetchFromMetabase(VIN_DETAILS_URL, "VIN_DETAILS");
    const syncedAt = new Date().toISOString();
    const deduped = Object.values(
      rows.reduce((acc, row) => { acc[row.vinName ?? ""] = row; return acc; }, {})
    );
    db.transaction(() => {
      db.prepare("DELETE FROM vins").run();
      for (const row of deduped) {
        insertVinStmt.run({
          vin:          row.vinName ?? "",
          dealerVinId:  row["m.dealerVinId"] ?? null,
          enterpriseId: row.enterpriseId ?? "",
          rooftopId:    String(row.teamId ?? ""),
          status:       row.status ?? "",
          after24h:     cleanAfter24(row.after_24_hrs ?? row.after_24hrs ?? null),
          receivedAt:   cleanDate(row.receivedAt),
          processedAt:  cleanDate(row.sentAt),
          reasonBucket: row.reason_bucket ?? "",
          syncedAt,
        });
      }
    })();
    syncState.tables.vins = { status: "success", count: deduped.length, error: null, syncedAt };
    console.log(`[sync:VIN_DETAILS] done — ${deduped.length} rows`);
  } catch (err) {
    console.error(`[sync:VIN_DETAILS] failed — ${err.message}`);
    syncState.tables.vins = { status: "error", count: null, error: err.message, syncedAt: null };
  }
}

async function syncRooftops() {
  syncState.tables.rooftops = { status: "running", count: null, error: null, syncedAt: null };
  try {
    console.log("[sync:ROOFTOP_DETAILS] fetching…");
    const rows = await fetchFromMetabase(ROOFTOP_DETAILS_URL, "ROOFTOP_DETAILS");
    const syncedAt = new Date().toISOString();
    const deduped = Object.values(
      rows.reduce((acc, row) => { if (row.team_id) acc[String(row.team_id)] = row; return acc; }, {})
    );
    db.transaction(() => {
      db.prepare("DELETE FROM rooftop_details").run();
      for (const row of deduped) {
        insertRooftopStmt.run({
          teamId:               String(row.team_id),
          enterpriseId:         String(row["t.enterprise_id"] ?? ""),
          teamName:             row.team_name ?? null,
          teamType:             row.team_type ?? null,
          websiteScore:         row.overallScore != null ? Number(row.overallScore) : null,
          websiteListingUrl:    row.website_listing_url ?? null,
          imsIntegrationStatus: row.ims_integration_status != null ? String(row.ims_integration_status) : null,
          publishingStatus:     row.publishing_status != null ? String(row.publishing_status) : null,
          syncedAt,
        });
      }
    })();
    syncState.tables.rooftops = { status: "success", count: deduped.length, error: null, syncedAt };
    console.log(`[sync:ROOFTOP_DETAILS] done — ${deduped.length} rows`);
  } catch (err) {
    console.error(`[sync:ROOFTOP_DETAILS] failed — ${err.message}`);
    syncState.tables.rooftops = { status: "error", count: null, error: err.message, syncedAt: null };
  }
}

async function syncEnterprises() {
  syncState.tables.enterprises = { status: "running", count: null, error: null, syncedAt: null };
  try {
    console.log("[sync:ENTERPRISE_DETAILS] fetching…");
    const rows = await fetchFromMetabase(ENTERPRISE_DETAILS_URL, "ENTERPRISE_DETAILS");
    const syncedAt = new Date().toISOString();
    const deduped = Object.values(
      rows.reduce((acc, row) => { if (row["dt.enterprise_id"]) acc[String(row["dt.enterprise_id"])] = row; return acc; }, {})
    );
    db.transaction(() => {
      db.prepare("DELETE FROM enterprise_details").run();
      for (const row of deduped) {
        insertEnterpriseStmt.run({
          enterpriseId: String(row["dt.enterprise_id"]),
          name:         row.name ?? null,
          type:         row.type ?? null,
          websiteUrl:   row.website_url ?? null,
          pocEmail:     row.email_id ?? null,
          syncedAt,
        });
      }
    })();
    syncState.tables.enterprises = { status: "success", count: deduped.length, error: null, syncedAt };
    console.log(`[sync:ENTERPRISE_DETAILS] done — ${deduped.length} rows`);
  } catch (err) {
    console.error(`[sync:ENTERPRISE_DETAILS] failed — ${err.message}`);
    syncState.tables.enterprises = { status: "error", count: null, error: err.message, syncedAt: null };
  }
}

// Runs all three table syncs in parallel. Returns immediately if already running.
async function runSync() {
  if (syncState.running) {
    console.warn("[sync] already in progress — skipping duplicate request");
    return;
  }
  syncState.running     = true;
  syncState.startedAt   = new Date().toISOString();
  syncState.completedAt = null;
  for (const t of Object.keys(syncState.tables)) {
    syncState.tables[t] = { status: "idle", count: null, error: null, syncedAt: null };
  }

  console.log("[sync] started — VINs, Rooftops, Enterprises running in parallel");
  // allSettled so all three run to completion regardless of individual failures
  await Promise.allSettled([syncVins(), syncRooftops(), syncEnterprises()]);

  syncState.running     = false;
  syncState.completedAt = new Date().toISOString();
  const { vins, rooftops, enterprises } = syncState.tables;
  console.log(`[sync] complete — vins:${vins.status}(${vins.count ?? "err"}) rooftops:${rooftops.status}(${rooftops.count ?? "err"}) enterprises:${enterprises.status}(${enterprises.count ?? "err"})`);
}

// ─── Row serialiser ──────────────────────────────────────────────────────────

function toApiRow(r) {
  return {
    vin:          r.vin,
    dealerVinId:  r.dealer_vin_id ?? null,
    enterpriseId: r.enterprise_id,
    enterprise:   r.enterprise,
    rooftopId:    r.rooftop_id,
    rooftop:      r.rooftop,
    rooftopType:  r.rooftop_type,
    csm:          r.csm,
    status:       r.status,
    reasonBucket: r.reason_bucket || null,
    after24h:     r.after_24h !== null ? Boolean(r.after_24h) : null,
    receivedAt:   r.received_at,
    processedAt:  r.processed_at,
    syncedAt:     r.synced_at,
  };
}

// ─── VIN query helpers ───────────────────────────────────────────────────────

const VIN_FROM = `
  FROM vins v
  LEFT JOIN rooftop_details rd ON v.rooftop_id = rd.team_id
  LEFT JOIN enterprise_details ed ON v.enterprise_id = ed.enterprise_id
`;

const VIN_SELECT = `
  SELECT v.vin, v.dealer_vin_id, v.enterprise_id, v.rooftop_id,
         v.status, v.after_24h, v.received_at, v.processed_at, v.reason_bucket, v.synced_at,
         rd.team_name AS rooftop, rd.team_type AS rooftop_type,
         ed.name AS enterprise, ed.poc_email AS csm
  ${VIN_FROM}
`;

function buildVinFilters(query) {
  const { search, rooftop, rooftopId, rooftopType, csm, status, after24h, enterprise, enterpriseId, reasonBucket } = query;
  const conditions = [];
  const params     = [];

  if (search) {
    conditions.push("(v.vin LIKE ? OR rd.team_name LIKE ? OR ed.poc_email LIKE ? OR ed.name LIKE ?)");
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }
  if (enterpriseId) { conditions.push("v.enterprise_id = ?");  params.push(enterpriseId); }
  if (rooftopId)    { conditions.push("v.rooftop_id = ?");     params.push(rooftopId); }
  if (rooftop)      { conditions.push("rd.team_name = ?");     params.push(rooftop); }
  if (rooftopType)  { conditions.push("rd.team_type = ?");     params.push(rooftopType); }
  if (csm)          { conditions.push("ed.poc_email = ?");     params.push(csm); }
  if (status)       { conditions.push("v.status = ?");         params.push(status); }
  if (enterprise)   { conditions.push("ed.name = ?");          params.push(enterprise); }
  if (after24h === "true"  || after24h === "1") { conditions.push("COALESCE(v.after_24h,0) = 1"); }
  if (after24h === "false" || after24h === "0") { conditions.push("COALESCE(v.after_24h,0) = 0"); }
  if (reasonBucket) { conditions.push("v.reason_bucket = ?"); params.push(reasonBucket); }

  return { where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "", params };
}

// ─── GET /api/sync/status ────────────────────────────────────────────────────

app.get("/api/sync/status", (_req, res) => {
  const meta = db.prepare("SELECT MAX(synced_at) AS last_sync, COUNT(*) AS total_rows FROM vins").get();
  res.json({
    running:     syncState.running,
    startedAt:   syncState.startedAt,
    completedAt: syncState.completedAt,
    tables:      syncState.tables,
    lastSync:    meta?.last_sync ?? null,
    totalRows:   meta?.total_rows ?? 0,
  });
});

// ─── POST /api/sync ──────────────────────────────────────────────────────────
// Fires sync in the background and returns 202 immediately.
// Poll GET /api/sync/status to track progress.

app.post("/api/sync", (_req, res) => {
  if (syncState.running) {
    return res.status(202).json({ status: "already_running", startedAt: syncState.startedAt });
  }
  // Fire and forget — do NOT await
  runSync().catch(err => console.error("[sync] unexpected error:", err.message));
  res.status(202).json({ status: "started" });
});

// ─── Summary serialisers (snake_case DB → camelCase API) ─────────────────────

function toTotals(r) {
  return {
    total:                      r.total,
    processed:                  r.processed,
    processedAfter24:           r.processed_after_24h,
    notProcessed:               r.not_processed,
    notProcessedAfter24:        r.not_processed_after_24h,
    bucketProcessingPending:    r.bucket_processing_pending,
    bucketPublishingPending:    r.bucket_publishing_pending,
    bucketQcPending:            r.bucket_qc_pending,
    bucketSold:                 r.bucket_sold,
    bucketOthers:               r.bucket_others,
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
    websiteScore:               r.website_score ?? null,
    websiteListingUrl:          r.website_listing_url ?? null,
    imsIntegrationStatus:       r.ims_integration_status ?? null,
    publishingStatus:           r.publishing_status ?? null,
    bucketProcessingPending:    r.bucket_processing_pending,
    bucketPublishingPending:    r.bucket_publishing_pending,
    bucketQcPending:            r.bucket_qc_pending,
    bucketSold:                 r.bucket_sold,
    bucketOthers:               r.bucket_others,
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
    rooftopCount:               r.rooftop_count ?? 0,
    notIntegratedCount:         r.not_integrated_count ?? 0,
    publishingDisabledCount:    r.publishing_disabled_count ?? 0,
    avgWebsiteScore:            r.avg_website_score ?? null,
    websiteUrl:                 r.website_url ?? null,
    accountType:                r.account_type ?? null,
    bucketProcessingPending:    r.bucket_processing_pending,
    bucketPublishingPending:    r.bucket_publishing_pending,
    bucketQcPending:            r.bucket_qc_pending,
    bucketSold:                 r.bucket_sold,
    bucketOthers:               r.bucket_others,
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
    avgWebsiteScore:            r.avg_website_score ?? null,
    integratedCount:            r.integrated_count ?? 0,
    publishingCount:            r.publishing_count ?? 0,
    bucketProcessingPending:    r.bucket_processing_pending,
    bucketPublishingPending:    r.bucket_publishing_pending,
    bucketQcPending:            r.bucket_qc_pending,
    bucketSold:                 r.bucket_sold,
    bucketOthers:               r.bucket_others,
  };
}

function toTypeRow(r) {
  return {
    label:                      r.label,
    rooftopCount:               r.rooftop_count,
    total:                      r.total,
    processed:                  r.processed,
    processedAfter24:           r.processed_after_24h,
    notProcessed:               r.not_processed,
    notProcessedAfter24:        r.not_processed_after_24h,
    integratedCount:            r.integrated_count ?? 0,
    publishingCount:            r.publishing_count ?? 0,
    bucketProcessingPending:    r.bucket_processing_pending,
    bucketPublishingPending:    r.bucket_publishing_pending,
    bucketQcPending:            r.bucket_qc_pending,
    bucketSold:                 r.bucket_sold,
    bucketOthers:               r.bucket_others,
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
  const byBucket     = db.prepare(`
    SELECT reason_bucket AS label, COUNT(*) AS count
    FROM vins
    WHERE status != 'Delivered' AND COALESCE(after_24h,0)=1
      AND reason_bucket IS NOT NULL AND reason_bucket != ''
    GROUP BY reason_bucket
    ORDER BY
      CASE reason_bucket
        WHEN 'Processing Pending' THEN 1
        WHEN 'Publishing Pending' THEN 2
        WHEN 'QC Pending'         THEN 3
        WHEN 'Sold'               THEN 4
        ELSE 5
      END, reason_bucket
  `).all().map(r => ({ label: r.label, count: r.count }));
  res.json({ lastSync: meta?.last_sync ?? null, totalRows: meta?.total_rows ?? 0, totals, byRooftop, byEnterprise, byCSM, byType, byBucket });
});

// ─── GET /api/vins ───────────────────────────────────────────────────────────

app.get("/api/vins", (req, res) => {
  const page     = Math.max(1, parseInt(req.query.page)     || 1);
  const pageSize = Math.min(500, Math.max(10, parseInt(req.query.pageSize) || 50));
  const offset   = (page - 1) * pageSize;

  const { where, params } = buildVinFilters(req.query);

  const total = db.prepare(`SELECT COUNT(*) AS n ${VIN_FROM} ${where}`).get(...params).n;
  const rows  = db.prepare(`
    ${VIN_SELECT} ${where}
    ORDER BY v.received_at DESC NULLS LAST
    LIMIT ${pageSize} OFFSET ${offset}
  `).all(...params);

  res.json({ data: rows.map(toApiRow), total, page, pageSize, pageCount: Math.ceil(total / pageSize) });
});

// Keep old path as alias
app.get("/api/vins/raw", (req, res) => {
  res.redirect(307, `/api/vins?${new URLSearchParams(req.query)}`);
});

// ─── GET /api/vins/export ────────────────────────────────────────────────────

app.get("/api/vins/export", (req, res) => {
  const { where, params } = buildVinFilters(req.query);

  const rows = db.prepare(`
    ${VIN_SELECT} ${where}
    ORDER BY v.received_at DESC NULLS LAST
  `).all(...params);

  res.json({ data: rows.map(toApiRow) });
});

export default app;
