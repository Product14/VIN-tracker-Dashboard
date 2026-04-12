import express from "express";
import cors from "cors";
import { query, getClient } from "./db.js";

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

// ─── Per-table sync functions ─────────────────────────────────────────────────
// Each syncs independently — a failure in one does not affect the others.
// Uses UNNEST bulk-insert for efficiency (single query vs N queries per row).

async function syncVins() {
  console.log("[sync:VIN_DETAILS] fetching…");
  const rows    = await fetchFromMetabase(VIN_DETAILS_URL, "VIN_DETAILS");
  const syncedAt = new Date().toISOString();
  const deduped = Object.values(
    rows.reduce((acc, row) => { acc[row.vinName ?? ""] = row; return acc; }, {})
  );

  const vins = [], dealerVinIds = [], enterpriseIds = [], rooftopIds = [];
  const statuses = [], after24hs = [], receivedAts = [], processedAts = [];
  const reasonBuckets = [], syncedAts = [];

  for (const row of deduped) {
    vins.push(row.vinName ?? "");
    dealerVinIds.push(row["m.dealerVinId"] ?? null);
    enterpriseIds.push(row.enterpriseId ?? "");
    rooftopIds.push(String(row.teamId ?? ""));
    statuses.push(row.status ?? "");
    after24hs.push(cleanAfter24(row.after_24_hrs ?? row.after_24hrs ?? null));
    receivedAts.push(cleanDate(row.receivedAt));
    processedAts.push(cleanDate(row.sentAt));
    reasonBuckets.push(row.reason_bucket ?? "");
    syncedAts.push(syncedAt);
  }

  const client = await getClient();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM vins");
    if (deduped.length > 0) {
      await client.query(`
        INSERT INTO vins
          (vin, dealer_vin_id, enterprise_id, rooftop_id, status, after_24h, received_at, processed_at, reason_bucket, synced_at)
        SELECT
          UNNEST($1::text[]), UNNEST($2::text[]), UNNEST($3::text[]), UNNEST($4::text[]),
          UNNEST($5::text[]), UNNEST($6::smallint[]), UNNEST($7::text[]), UNNEST($8::text[]),
          UNNEST($9::text[]), UNNEST($10::text[])
      `, [vins, dealerVinIds, enterpriseIds, rooftopIds, statuses, after24hs, receivedAts, processedAts, reasonBuckets, syncedAts]);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  console.log(`[sync:VIN_DETAILS] done — ${deduped.length} rows`);
}

async function syncRooftops() {
  console.log("[sync:ROOFTOP_DETAILS] fetching…");
  const rows    = await fetchFromMetabase(ROOFTOP_DETAILS_URL, "ROOFTOP_DETAILS");
  const syncedAt = new Date().toISOString();
  const deduped = Object.values(
    rows.reduce((acc, row) => { if (row.team_id) acc[String(row.team_id)] = row; return acc; }, {})
  );

  const teamIds = [], enterpriseIds = [], teamNames = [], teamTypes = [];
  const websiteScores = [], websiteListingUrls = [], imsStatuses = [], publishingStatuses = [], syncedAts = [];

  for (const row of deduped) {
    teamIds.push(String(row.team_id));
    enterpriseIds.push(String(row["t.enterprise_id"] ?? ""));
    teamNames.push(row.team_name ?? null);
    teamTypes.push(row.team_type ?? null);
    websiteScores.push(row.overallScore != null ? Number(row.overallScore) : null);
    websiteListingUrls.push(row.website_listing_url ?? null);
    imsStatuses.push(row.ims_integration_status != null ? String(row.ims_integration_status) : null);
    publishingStatuses.push(row.publishing_status != null ? String(row.publishing_status) : null);
    syncedAts.push(syncedAt);
  }

  const client = await getClient();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM rooftop_details");
    if (deduped.length > 0) {
      await client.query(`
        INSERT INTO rooftop_details
          (team_id, enterprise_id, team_name, team_type, website_score, website_listing_url, ims_integration_status, publishing_status, synced_at)
        SELECT
          UNNEST($1::text[]), UNNEST($2::text[]), UNNEST($3::text[]), UNNEST($4::text[]),
          UNNEST($5::real[]), UNNEST($6::text[]), UNNEST($7::text[]), UNNEST($8::text[]),
          UNNEST($9::text[])
      `, [teamIds, enterpriseIds, teamNames, teamTypes, websiteScores, websiteListingUrls, imsStatuses, publishingStatuses, syncedAts]);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  console.log(`[sync:ROOFTOP_DETAILS] done — ${deduped.length} rows`);
}

async function syncEnterprises() {
  console.log("[sync:ENTERPRISE_DETAILS] fetching…");
  const rows    = await fetchFromMetabase(ENTERPRISE_DETAILS_URL, "ENTERPRISE_DETAILS");
  const syncedAt = new Date().toISOString();
  const deduped = Object.values(
    rows.reduce((acc, row) => { if (row["dt.enterprise_id"]) acc[String(row["dt.enterprise_id"])] = row; return acc; }, {})
  );

  const enterpriseIds = [], names = [], types = [], websiteUrls = [], pocEmails = [], syncedAts = [];

  for (const row of deduped) {
    enterpriseIds.push(String(row["dt.enterprise_id"]));
    names.push(row.name ?? null);
    types.push(row.type ?? null);
    websiteUrls.push(row.website_url ?? null);
    pocEmails.push(row.email_id ?? null);
    syncedAts.push(syncedAt);
  }

  const client = await getClient();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM enterprise_details");
    if (deduped.length > 0) {
      await client.query(`
        INSERT INTO enterprise_details
          (enterprise_id, name, type, website_url, poc_email, synced_at)
        SELECT
          UNNEST($1::text[]), UNNEST($2::text[]), UNNEST($3::text[]),
          UNNEST($4::text[]), UNNEST($5::text[]), UNNEST($6::text[])
      `, [enterpriseIds, names, types, websiteUrls, pocEmails, syncedAts]);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  console.log(`[sync:ENTERPRISE_DETAILS] done — ${deduped.length} rows`);
}

// Atomically claims a sync lock in the DB, runs all three syncs in parallel,
// then releases the lock. Returns { skipped: true } if already running.
async function runSync() {
  // Atomic claim: only one instance wins this UPDATE at a time.
  const { rows } = await query(`
    UPDATE sync_state
       SET running = TRUE, started_at = NOW(), completed_at = NULL
     WHERE id = 'global' AND running = FALSE
    RETURNING id
  `);

  if (rows.length === 0) {
    console.warn("[sync] already in progress — skipping duplicate request");
    return { skipped: true };
  }

  console.log("[sync] started — VINs, Rooftops, Enterprises running in parallel");
  try {
    // allSettled so all three run to completion regardless of individual failures
    const results = await Promise.allSettled([syncVins(), syncRooftops(), syncEnterprises()]);
    for (const r of results) {
      if (r.status === "rejected") console.error("[sync] table sync failed:", r.reason?.message);
    }
  } finally {
    await query(`UPDATE sync_state SET running = FALSE, completed_at = NOW() WHERE id = 'global'`);
  }

  console.log("[sync] complete");
  return { skipped: false };
}

// ─── Row serialisers ──────────────────────────────────────────────────────────

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

function toTotals(r) {
  return {
    total:                   r.total,
    processed:               r.processed,
    processedAfter24:        r.processed_after_24h,
    notProcessed:            r.not_processed,
    notProcessedAfter24:     r.not_processed_after_24h,
    bucketProcessingPending: r.bucket_processing_pending,
    bucketPublishingPending: r.bucket_publishing_pending,
    bucketQcPending:         r.bucket_qc_pending,
    bucketSold:              r.bucket_sold,
    bucketOthers:            r.bucket_others,
  };
}

function toRooftopRow(r) {
  return {
    rooftopId:                r.rooftop_id,
    name:                     r.name,
    type:                     r.type,
    csm:                      r.csm,
    enterpriseId:             r.enterprise_id,
    enterprise:               r.enterprise,
    total:                    r.total,
    processed:                r.processed,
    processedAfter24:         r.processed_after_24h,
    notProcessed:             r.not_processed,
    notProcessedAfter24:      r.not_processed_after_24h,
    websiteScore:             r.website_score ?? null,
    websiteListingUrl:        r.website_listing_url ?? null,
    imsIntegrationStatus:     r.ims_integration_status ?? null,
    publishingStatus:         r.publishing_status ?? null,
    bucketProcessingPending:  r.bucket_processing_pending,
    bucketPublishingPending:  r.bucket_publishing_pending,
    bucketQcPending:          r.bucket_qc_pending,
    bucketSold:               r.bucket_sold,
    bucketOthers:             r.bucket_others,
  };
}

function toEnterpriseRow(r) {
  return {
    id:                       r.id,
    name:                     r.name,
    csm:                      r.csm ?? null,
    total:                    r.total,
    processed:                r.processed,
    processedAfter24:         r.processed_after_24h,
    notProcessed:             r.not_processed,
    notProcessedAfter24:      r.not_processed_after_24h,
    rooftopCount:             r.rooftop_count ?? 0,
    notIntegratedCount:       r.not_integrated_count ?? 0,
    publishingDisabledCount:  r.publishing_disabled_count ?? 0,
    avgWebsiteScore:          r.avg_website_score ?? null,
    websiteUrl:               r.website_url ?? null,
    accountType:              r.account_type ?? null,
    bucketProcessingPending:  r.bucket_processing_pending,
    bucketPublishingPending:  r.bucket_publishing_pending,
    bucketQcPending:          r.bucket_qc_pending,
    bucketSold:               r.bucket_sold,
    bucketOthers:             r.bucket_others,
  };
}

function toCsmRow(r) {
  return {
    name:                     r.name,
    label:                    r.name,
    rooftopCount:             r.rooftop_count,
    total:                    r.total,
    processed:                r.processed,
    processedAfter24:         r.processed_after_24h,
    notProcessed:             r.not_processed,
    notProcessedAfter24:      r.not_processed_after_24h,
    avgWebsiteScore:          r.avg_website_score ?? null,
    integratedCount:          r.integrated_count ?? 0,
    publishingCount:          r.publishing_count ?? 0,
    bucketProcessingPending:  r.bucket_processing_pending,
    bucketPublishingPending:  r.bucket_publishing_pending,
    bucketQcPending:          r.bucket_qc_pending,
    bucketSold:               r.bucket_sold,
    bucketOthers:             r.bucket_others,
  };
}

function toTypeRow(r) {
  return {
    label:                    r.label,
    rooftopCount:             r.rooftop_count,
    total:                    r.total,
    processed:                r.processed,
    processedAfter24:         r.processed_after_24h,
    notProcessed:             r.not_processed,
    notProcessedAfter24:      r.not_processed_after_24h,
    integratedCount:          r.integrated_count ?? 0,
    publishingCount:          r.publishing_count ?? 0,
    bucketProcessingPending:  r.bucket_processing_pending,
    bucketPublishingPending:  r.bucket_publishing_pending,
    bucketQcPending:          r.bucket_qc_pending,
    bucketSold:               r.bucket_sold,
    bucketOthers:             r.bucket_others,
  };
}

// ─── VIN query helpers ────────────────────────────────────────────────────────

// Whitelist map: frontend column key → DB expression (prevents SQL injection)
const SORT_MAP = {
  enterprise:   "ed.name",
  rooftop:      "rd.team_name",
  rooftopType:  "rd.team_type",
  csm:          "ed.poc_email",
  vin:          "v.vin",
  dealerVinId:  "v.dealer_vin_id",
  status:       "v.status",
  after24h:     "v.after_24h",
  receivedAt:   "v.received_at",
  processedAt:  "v.processed_at",
  reasonBucket: "v.reason_bucket",
};

function buildVinSort({ sortBy, sortDir } = {}) {
  const col = SORT_MAP[sortBy];
  if (!col) return "v.received_at DESC NULLS LAST";
  return `${col} ${sortDir === "asc" ? "ASC" : "DESC"} NULLS LAST`;
}

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

// Builds a WHERE clause with PostgreSQL positional params ($1, $2, …).
// Returns { where: string, params: any[] }.
function buildVinFilters(queryParams) {
  const { search, rooftop, rooftopId, rooftopType, csm, status, after24h, enterprise, enterpriseId, reasonBucket } = queryParams;
  const conditions = [];
  const params = [];

  // Helper: push value to params array, return its $N placeholder
  const p = (val) => { params.push(val); return `$${params.length}`; };

  if (search) {
    const s = `%${search}%`;
    conditions.push(`(v.vin ILIKE ${p(s)} OR rd.team_name ILIKE ${p(s)} OR ed.poc_email ILIKE ${p(s)} OR ed.name ILIKE ${p(s)})`);
  }
  if (enterpriseId) conditions.push(`v.enterprise_id = ${p(enterpriseId)}`);
  if (rooftopId)    conditions.push(`v.rooftop_id = ${p(rooftopId)}`);
  if (rooftop)      conditions.push(`rd.team_name = ${p(rooftop)}`);
  if (rooftopType)  conditions.push(`rd.team_type = ${p(rooftopType)}`);
  if (csm)          conditions.push(`ed.poc_email = ${p(csm)}`);
  if (status)       conditions.push(`v.status = ${p(status)}`);
  if (enterprise)   conditions.push(`ed.name = ${p(enterprise)}`);
  if (after24h === "true"  || after24h === "1") conditions.push("COALESCE(v.after_24h, 0) = 1");
  if (after24h === "false" || after24h === "0") conditions.push("COALESCE(v.after_24h, 0) = 0");
  if (reasonBucket) conditions.push(`v.reason_bucket = ${p(reasonBucket)}`);

  return { where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "", params };
}

// ─── GET /api/sync/status ─────────────────────────────────────────────────────

app.get("/api/sync/status", async (_req, res) => {
  const [metaRes, stateRes] = await Promise.all([
    query("SELECT MAX(synced_at) AS last_sync, COUNT(*)::int AS total_rows FROM vins"),
    query("SELECT running, started_at, completed_at FROM sync_state WHERE id = 'global'"),
  ]);
  const meta  = metaRes.rows[0];
  const state = stateRes.rows[0];
  res.json({
    running:     state?.running    ?? false,
    startedAt:   state?.started_at ?? null,
    completedAt: state?.completed_at ?? null,
    lastSync:    meta?.last_sync   ?? null,
    totalRows:   meta?.total_rows  ?? 0,
  });
});

// ─── POST /api/sync ───────────────────────────────────────────────────────────
// Synchronous — awaits the full sync before responding.
// maxDuration: 300 is set in vercel.json to allow up to 5 minutes.

app.post("/api/sync", async (_req, res) => {
  const result = await runSync();
  if (result.skipped) {
    const { rows } = await query("SELECT started_at FROM sync_state WHERE id = 'global'");
    return res.status(202).json({ status: "already_running", startedAt: rows[0]?.started_at });
  }
  res.json({ status: "completed" });
});

// ─── GET /api/summary ─────────────────────────────────────────────────────────

app.get("/api/summary", async (_req, res) => {
  const [metaRes, totalsRes, byCsmRes, byTypeRes, byBucketRes] = await Promise.all([
    query("SELECT MAX(synced_at) AS last_sync, COUNT(*)::int AS total_rows FROM vins"),
    query("SELECT * FROM v_totals"),
    query("SELECT * FROM v_by_csm"),
    query("SELECT * FROM v_by_type"),
    query(`
      SELECT reason_bucket AS label, COUNT(*)::int AS count
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
    `),
  ]);

  const meta = metaRes.rows[0];
  res.json({
    lastSync:  meta?.last_sync  ?? null,
    totalRows: meta?.total_rows ?? 0,
    totals:    toTotals(totalsRes.rows[0]),
    byCSM:     byCsmRes.rows.map(toCsmRow),
    byType:    byTypeRes.rows.map(toTypeRow),
    byBucket:  byBucketRes.rows.map(r => ({ label: r.label, count: r.count })),
  });
});

// ─── GET /api/filter-options ──────────────────────────────────────────────────

app.get("/api/filter-options", async (_req, res) => {
  const [
    rooftopNamesRes,
    rooftopTypesRes,
    rooftopCSMsRes,
    enterprisesRes,
    enterpriseCSMsRes,
    enterpriseTypesRes,
    rooftopBucketFlagsRes,
    enterpriseColFlagsRes,
  ] = await Promise.all([
    query("SELECT DISTINCT name FROM v_by_rooftop WHERE name IS NOT NULL ORDER BY name"),
    query("SELECT DISTINCT type FROM v_by_rooftop WHERE type IS NOT NULL ORDER BY type"),
    query("SELECT DISTINCT csm  FROM v_by_rooftop WHERE csm  IS NOT NULL ORDER BY csm"),
    query("SELECT DISTINCT enterprise_id AS id, enterprise AS name FROM v_by_rooftop WHERE enterprise IS NOT NULL ORDER BY enterprise"),
    query("SELECT DISTINCT csm  FROM v_by_enterprise WHERE csm  IS NOT NULL ORDER BY csm"),
    query("SELECT DISTINCT account_type FROM v_by_enterprise WHERE account_type IS NOT NULL ORDER BY account_type"),
    query(`
      SELECT
        BOOL_OR(bucket_processing_pending > 0) AS bucket_processing_pending,
        BOOL_OR(bucket_publishing_pending > 0) AS bucket_publishing_pending,
        BOOL_OR(bucket_qc_pending         > 0) AS bucket_qc_pending,
        BOOL_OR(bucket_sold               > 0) AS bucket_sold,
        BOOL_OR(bucket_others             > 0) AS bucket_others
      FROM v_by_rooftop
    `),
    query(`
      SELECT
        BOOL_OR(not_integrated_count      > 0) AS has_not_integrated,
        BOOL_OR(publishing_disabled_count > 0) AS has_publishing_disabled
      FROM v_by_enterprise
    `),
  ]);

  const bf = rooftopBucketFlagsRes.rows[0] ?? {};
  const cf = enterpriseColFlagsRes.rows[0]  ?? {};
  res.json({
    rooftopNames:    rooftopNamesRes.rows.map(r => r.name),
    rooftopTypes:    rooftopTypesRes.rows.map(r => r.type),
    rooftopCSMs:     rooftopCSMsRes.rows.map(r => r.csm),
    enterprises:     enterprisesRes.rows,
    enterpriseCSMs:  enterpriseCSMsRes.rows.map(r => r.csm),
    enterpriseTypes: enterpriseTypesRes.rows.map(r => r.account_type),
    bucketFlags: {
      bucketProcessingPending: bf.bucket_processing_pending ?? false,
      bucketPublishingPending: bf.bucket_publishing_pending ?? false,
      bucketQcPending:         bf.bucket_qc_pending         ?? false,
      bucketSold:              bf.bucket_sold               ?? false,
      bucketOthers:            bf.bucket_others             ?? false,
    },
    hasNotIntegrated:      cf.has_not_integrated      ?? false,
    hasPublishingDisabled: cf.has_publishing_disabled ?? false,
  });
});

// ─── GET /api/vins ────────────────────────────────────────────────────────────

app.get("/api/vins", async (req, res) => {
  const page     = Math.max(1, parseInt(req.query.page)     || 1);
  const pageSize = Math.min(500, Math.max(10, parseInt(req.query.pageSize) || 50));
  const offset   = (page - 1) * pageSize;

  const { where, params } = buildVinFilters(req.query);
  const orderBy = buildVinSort(req.query);

  const [countRes, rowsRes] = await Promise.all([
    query(`SELECT COUNT(*)::int AS n ${VIN_FROM} ${where}`, params),
    query(`${VIN_SELECT} ${where} ORDER BY ${orderBy} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset]),
  ]);

  const total = countRes.rows[0].n;
  res.json({ data: rowsRes.rows.map(toApiRow), total, page, pageSize, pageCount: Math.ceil(total / pageSize) });
});

// Keep old path as alias
app.get("/api/vins/raw", (req, res) => {
  res.redirect(307, `/api/vins?${new URLSearchParams(req.query)}`);
});

// ─── GET /api/rooftops ────────────────────────────────────────────────────────

const ROOFTOP_SORT_MAP = {
  name:                "name",
  type:                "type",
  enterprise:          "enterprise",
  csm:                 "csm",
  total:               "total",
  processed:           "processed",
  notProcessed:        "not_processed",
  notProcessedAfter24: "not_processed_after_24h",
  rate:                "not_processed_after_24h", // proxy: sort by count as approximation
  websiteScore:        "website_score",
};

function buildRooftopFilters(queryParams) {
  const conditions = [];
  const params = [];
  const p = (val) => { params.push(val); return `$${params.length}`; };

  if (queryParams.search) {
    const s = `%${queryParams.search}%`;
    conditions.push(`(name ILIKE ${p(s)} OR rooftop_id ILIKE ${p(s)})`);
  }
  if (queryParams.enterpriseId)   conditions.push(`enterprise_id = ${p(queryParams.enterpriseId)}`);
  if (queryParams.enterprise)     conditions.push(`enterprise = ${p(queryParams.enterprise)}`);
  if (queryParams.type)           conditions.push(`type = ${p(queryParams.type)}`);
  if (queryParams.csm)            conditions.push(`csm = ${p(queryParams.csm)}`);
  if (queryParams.imsIntegration === "Yes") conditions.push("ims_integration_status = 'true'");
  if (queryParams.imsIntegration === "No")  conditions.push("ims_integration_status != 'true'");
  if (queryParams.publishingStatus === "Yes") conditions.push("publishing_status = 'true'");
  if (queryParams.publishingStatus === "No")  conditions.push("publishing_status != 'true'");
  if (queryParams.websiteScore === "Poor (<6)")     conditions.push("website_score < 6");
  if (queryParams.websiteScore === "Average (6\u20138)") conditions.push("(website_score >= 6 AND website_score < 8)");
  if (queryParams.websiteScore === "Good (8+)")     conditions.push("website_score >= 8");

  return { where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "", params };
}

app.get("/api/rooftops", async (req, res) => {
  const page     = Math.max(1, parseInt(req.query.page)     || 1);
  const pageSize = Math.min(500, Math.max(10, parseInt(req.query.pageSize) || 50));
  const offset   = (page - 1) * pageSize;

  const { where, params } = buildRooftopFilters(req.query);
  const sortCol = ROOFTOP_SORT_MAP[req.query.sortBy] ?? "not_processed_after_24h";
  const sortDir = req.query.sortDir === "asc" ? "ASC" : "DESC";
  const orderBy = `ORDER BY ${sortCol} ${sortDir} NULLS LAST`;

  const [countRes, rowsRes] = await Promise.all([
    query(`SELECT COUNT(*)::int AS n FROM v_by_rooftop ${where}`, params),
    query(`SELECT * FROM v_by_rooftop ${where} ${orderBy} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset]),
  ]);

  const total = countRes.rows[0].n;
  res.json({ data: rowsRes.rows.map(toRooftopRow), total, page, pageSize, pageCount: Math.ceil(total / pageSize) });
});

app.get("/api/rooftops/export", async (req, res) => {
  const { where, params } = buildRooftopFilters(req.query);
  const sortCol = ROOFTOP_SORT_MAP[req.query.sortBy] ?? "not_processed_after_24h";
  const sortDir = req.query.sortDir === "asc" ? "ASC" : "DESC";
  const { rows } = await query(`SELECT * FROM v_by_rooftop ${where} ORDER BY ${sortCol} ${sortDir} NULLS LAST`, params);
  res.json({ data: rows.map(toRooftopRow) });
});

// ─── GET /api/enterprises ─────────────────────────────────────────────────────

const ENTERPRISE_SORT_MAP = {
  name:                   "name",
  csm:                    "csm",
  total:                  "total",
  processed:              "processed",
  notProcessed:           "not_processed",
  notProcessedAfter24:    "not_processed_after_24h",
  processedAfter24:       "processed_after_24h",
  rate:                   "not_processed_after_24h", // proxy
  rooftopCount:           "rooftop_count",
  notIntegratedCount:     "not_integrated_count",
  publishingDisabledCount:"publishing_disabled_count",
  avgWebsiteScore:        "avg_website_score",
};

function buildEnterpriseFilters(queryParams) {
  const conditions = [];
  const params = [];
  const p = (val) => { params.push(val); return `$${params.length}`; };

  if (queryParams.search) {
    const s = `%${queryParams.search}%`;
    conditions.push(`(name ILIKE ${p(s)} OR id ILIKE ${p(s)})`);
  }
  if (queryParams.csm)         conditions.push(`csm = ${p(queryParams.csm)}`);
  if (queryParams.accountType) conditions.push(`account_type = ${p(queryParams.accountType)}`);
  if (queryParams.websiteScore === "Poor (<6)")     conditions.push("avg_website_score < 6");
  if (queryParams.websiteScore === "Average (6\u20138)") conditions.push("(avg_website_score >= 6 AND avg_website_score < 8)");
  if (queryParams.websiteScore === "Good (8+)")     conditions.push("avg_website_score >= 8");

  return { where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "", params };
}

app.get("/api/enterprises", async (req, res) => {
  const page     = Math.max(1, parseInt(req.query.page)     || 1);
  const pageSize = Math.min(500, Math.max(10, parseInt(req.query.pageSize) || 50));
  const offset   = (page - 1) * pageSize;

  const { where, params } = buildEnterpriseFilters(req.query);
  const sortCol = ENTERPRISE_SORT_MAP[req.query.sortBy] ?? "not_processed_after_24h";
  const sortDir = req.query.sortDir === "asc" ? "ASC" : "DESC";
  const orderBy = `ORDER BY ${sortCol} ${sortDir} NULLS LAST`;

  const [countRes, rowsRes] = await Promise.all([
    query(`SELECT COUNT(*)::int AS n FROM v_by_enterprise ${where}`, params),
    query(`SELECT * FROM v_by_enterprise ${where} ${orderBy} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset]),
  ]);

  const total = countRes.rows[0].n;
  res.json({ data: rowsRes.rows.map(toEnterpriseRow), total, page, pageSize, pageCount: Math.ceil(total / pageSize) });
});

app.get("/api/enterprises/export", async (req, res) => {
  const { where, params } = buildEnterpriseFilters(req.query);
  const sortCol = ENTERPRISE_SORT_MAP[req.query.sortBy] ?? "not_processed_after_24h";
  const sortDir = req.query.sortDir === "asc" ? "ASC" : "DESC";
  const { rows } = await query(`SELECT * FROM v_by_enterprise ${where} ORDER BY ${sortCol} ${sortDir} NULLS LAST`, params);
  res.json({ data: rows.map(toEnterpriseRow) });
});

// ─── GET /api/vins/export ─────────────────────────────────────────────────────

app.get("/api/vins/export", async (req, res) => {
  const { where, params } = buildVinFilters(req.query);
  const orderBy = buildVinSort(req.query);
  const { rows } = await query(`${VIN_SELECT} ${where} ORDER BY ${orderBy}`, params);
  res.json({ data: rows.map(toApiRow) });
});

export default app;
