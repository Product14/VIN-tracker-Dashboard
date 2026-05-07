import express from "express";
import cors from "cors";
import { query, getClient } from "./db.js";
import { buildEmailHtml } from "./emailTemplate.js";
import { sendReport }     from "./emailClient.js";
import { getAllDeploymentStatuses, upsertDeploymentStatus } from "./viniStatuses.js";
import { mapMetabaseRows } from "./viniRooftopMap.js";

const app = express();
app.use(cors());
app.use(express.json());

const VIN_DETAILS_URL =
  "https://metabase.spyne.ai/api/public/card/15e908e4-fe21-4982-9d8c-4aff07f2c948/query/json";

const ROOFTOP_DETAILS_URL =
  "https://metabase.spyne.ai/api/public/card/f5c032a6-c262-40ee-8d95-c115d326d3a8/query/json";

const ENTERPRISE_DETAILS_URL =
  "https://metabase.spyne.ai/api/public/card/b8f1271c-cc5a-470f-badf-807711f74af4/query/json";

/** Metabase public card JSON URL for Vini Account Health (same columns as vini-dashboard CSV). Optional — when set, sync pulls automatically with POST /api/sync. */
const VINI_ROOFTOP_METABASE_URL = process.env.VINI_ROOFTOP_METABASE_URL?.trim() || "";

// ─── Sync helpers ────────────────────────────────────────────────────────────

const EPOCH        = "1970-01-01T00:00:00Z";
const cleanDate    = (v) => (!v || v === EPOCH) ? null : v;
const cleanAfter24 = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v.toLowerCase() === "yes" ? 1 : 0;
  return v ? 1 : 0;
};

// Fetch from Metabase with optional per-attempt timeout and exponential back-off retry.
// timeoutMs = 0 means no timeout (used for fast endpoints like Rooftops/Enterprises).
async function fetchFromMetabase(url, label, retries = 3, timeoutMs = 0) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) console.log(`[sync:${label}] retry attempt ${attempt}/${retries}`);
      const opts = timeoutMs > 0 ? { signal: AbortSignal.timeout(timeoutMs) } : {};
      const res = await fetch(url, opts);
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
  // 1 retry (not 3) — Metabase VIN fetch can take ~60s, so 3 retries would consume
  // ~240s of the 300s Vercel budget before the other syncs even get a chance.
  // 65s timeout per attempt caps a hanging request just above Metabase's worst case.
  const rows    = await fetchFromMetabase(VIN_DETAILS_URL, "VIN_DETAILS", 1, 65000);
  const syncedAt = new Date().toISOString();
  const deduped = Object.values(
    rows.reduce((acc, row) => { acc[row.vinName ?? ""] = row; return acc; }, {})
  );
  if (deduped.length > 0) console.log("[sync:VIN_DETAILS] sample row keys:", Object.keys(deduped[0]), "| has_photos sample:", deduped[0].has_photos);

  const vins = [], dealerVinIds = [], enterpriseIds = [], rooftopIds = [];
  const statuses = [], after24hs = [], receivedAts = [], processedAts = [];
  const reasonBuckets = [], holdReasons = [], hasPhotosArr = [], syncedAts = [];

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
    holdReasons.push(row.hold_reason ?? "");
    hasPhotosArr.push(cleanAfter24(row.has_photos ?? null));
    syncedAts.push(syncedAt);
  }

  const client = await getClient();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM vins");
    if (deduped.length > 0) {
      await client.query(`
        INSERT INTO vins
          (vin, dealer_vin_id, enterprise_id, rooftop_id, status, after_24h, received_at, processed_at, reason_bucket, hold_reason, has_photos, synced_at)
        SELECT
          UNNEST($1::text[]), UNNEST($2::text[]), UNNEST($3::text[]), UNNEST($4::text[]),
          UNNEST($5::text[]), UNNEST($6::smallint[]), UNNEST($7::text[]), UNNEST($8::text[]),
          UNNEST($9::text[]), UNNEST($10::text[]), UNNEST($11::smallint[]), UNNEST($12::text[])
      `, [vins, dealerVinIds, enterpriseIds, rooftopIds, statuses, after24hs, receivedAts, processedAts, reasonBuckets, holdReasons, hasPhotosArr, syncedAts]);
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

async function syncViniRooftopMetrics() {
  if (!VINI_ROOFTOP_METABASE_URL) {
    console.log("[sync:VINI_METRICS] skipped — set VINI_ROOFTOP_METABASE_URL (Metabase public card …/query/json)");
    return;
  }
  console.log("[sync:VINI_METRICS] fetching…");
  const rows = await fetchFromMetabase(VINI_ROOFTOP_METABASE_URL, "VINI_METRICS", 1, 120000);
  const payload = Array.isArray(rows) ? rows : [];
  await query(
    `INSERT INTO vini_metrics_cache (id, rows_json, synced_at)
     VALUES ('global', $1::jsonb, NOW())
     ON CONFLICT (id) DO UPDATE SET rows_json = EXCLUDED.rows_json, synced_at = NOW()`,
    [JSON.stringify(payload)]
  );
  console.log(`[sync:VINI_METRICS] done — ${payload.length} rows`);
}

// Atomically claims a sync lock in the DB, runs all three syncs sequentially,
// then releases the lock. Returns { skipped: true } if already running.
// VINs is treated as critical — its failure propagates as an HTTP 500.
// Rooftops and Enterprises run first (milliseconds) and fail silently.
// completed_at is only stamped when VINs succeeds.
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

  console.log("[sync] started — Rooftops, Enterprises (non-critical), then VINs (critical)");
  let succeeded = false;
  try {
    // Non-critical syncs first — fast and must not be blocked by VINs timing out.
    for (const [fn, name] of [[syncRooftops, "Rooftops"], [syncEnterprises, "Enterprises"]]) {
      try { await fn(); } catch (e) { console.error(`[sync] ${name} failed:`, e?.message); }
    }
    // VINs is critical — let failure throw so the caller returns HTTP 500.
    await syncVins();
    succeeded = true;
  } finally {
    // Only stamp completed_at when VINs actually succeeded so the UI
    // does not show a fresh "synced X min ago" after a failed sync.
    if (succeeded) {
      await query(`UPDATE sync_state SET running = FALSE, completed_at = NOW() WHERE id = 'global'`);
      // Precompute all 3 summary variants and store in summary_cache so
      // GET /api/summary becomes a trivial single-row lookup (<5ms).
      for (const df of [null, 'post', 'pre']) {
        try {
          const payload = await computeSummary(df);
          await upsertSummaryCache(df, payload);
        } catch (e) {
          console.error(`[sync] summary precompute failed for dateFilter=${df}:`, e?.message);
        }
      }
      // Update meta in sync_state so GET /api/sync/status needs no vins scan.
      await query(`
        UPDATE sync_state
           SET total_rows = (SELECT COUNT(*)::int FROM vins),
               last_sync  = (SELECT MAX(synced_at) FROM vins)
         WHERE id = 'global'
      `);
      // Refresh materialized views with new vins data, then precompute
      // filter-options cache so GET /api/filter-options is a trivial lookup.
      await query(`REFRESH MATERIALIZED VIEW CONCURRENTLY v_by_rooftop`);
      await query(`REFRESH MATERIALIZED VIEW CONCURRENTLY v_by_enterprise`);
      try {
        const filterPayload = await computeFilterOptions();
        await upsertFilterCache(filterPayload);
      } catch (e) {
        console.error(`[sync] filter-options precompute failed:`, e?.message);
      }
      try {
        await syncViniRooftopMetrics();
      } catch (e) {
        console.error("[sync] Vini metrics failed:", e?.message);
      }
    } else {
      await query(`UPDATE sync_state SET running = FALSE WHERE id = 'global'`);
    }
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
    holdReason:   r.hold_reason || null,
    after24h:     r.after_24h !== null ? Boolean(r.after_24h) : null,
    hasPhotos:    r.has_photos !== null ? Boolean(r.has_photos) : false,
    receivedAt:   r.received_at,
    processedAt:  r.processed_at,
    syncedAt:     r.synced_at,
  };
}

function toTotals(r) {
  return {
    total:                   r.total,
    enterpriseCount:         r.enterprise_count ?? 0,
    withPhotos:              r.with_photos ?? 0,
    deliveredWithPhotos:     r.delivered_with_photos ?? 0,
    pendingWithPhotos:       r.pending_with_photos ?? 0,
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
    withPhotos:               r.with_photos ?? 0,
    deliveredWithPhotos:      r.delivered_with_photos ?? 0,
    pendingWithPhotos:        r.pending_with_photos ?? 0,
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
    bucketQcHold:             r.bucket_qc_hold,
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
    withPhotos:               r.with_photos ?? 0,
    deliveredWithPhotos:      r.delivered_with_photos ?? 0,
    pendingWithPhotos:        r.pending_with_photos ?? 0,
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
    bucketQcHold:             r.bucket_qc_hold,
    bucketSold:               r.bucket_sold,
    bucketOthers:             r.bucket_others,
  };
}

function toCsmRow(r) {
  return {
    name:                     r.name,
    label:                    r.name,
    rooftopCount:             r.rooftop_count,
    enterpriseCount:          r.enterprise_count ?? 0,
    total:                    r.total,
    withPhotos:               r.with_photos ?? 0,
    deliveredWithPhotos:      r.delivered_with_photos ?? 0,
    pendingWithPhotos:        r.pending_with_photos ?? 0,
    processed:                r.processed,
    processedAfter24:         r.processed_after_24h,
    notProcessed:             r.not_processed,
    notProcessedAfter24:      r.not_processed_after_24h,
    avgWebsiteScore:          r.avg_website_score ?? null,
    missingWebsiteCount:      r.missing_website_count ?? 0,
    integratedCount:          r.integrated_count ?? 0,
    publishingCount:          r.publishing_count ?? 0,
    bucketProcessingPending:  r.bucket_processing_pending,
    bucketPublishingPending:  r.bucket_publishing_pending,
    bucketQcPending:          r.bucket_qc_pending,
    bucketQcHold:             r.bucket_qc_hold,
    bucketSold:               r.bucket_sold,
    bucketOthers:             r.bucket_others,
  };
}

function toTypeRow(r) {
  return {
    label:                    r.label,
    rooftopCount:             r.rooftop_count,
    enterpriseCount:          r.enterprise_count ?? 0,
    total:                    r.total,
    withPhotos:               r.with_photos ?? 0,
    deliveredWithPhotos:      r.delivered_with_photos ?? 0,
    pendingWithPhotos:        r.pending_with_photos ?? 0,
    processed:                r.processed,
    processedAfter24:         r.processed_after_24h,
    notProcessed:             r.not_processed,
    notProcessedAfter24:      r.not_processed_after_24h,
    avgWebsiteScore:          r.avg_website_score ?? null,
    missingWebsiteCount:      r.missing_website_count ?? 0,
    integratedCount:          r.integrated_count ?? 0,
    publishingCount:          r.publishing_count ?? 0,
    bucketProcessingPending:  r.bucket_processing_pending,
    bucketPublishingPending:  r.bucket_publishing_pending,
    bucketQcPending:          r.bucket_qc_pending,
    bucketQcHold:             r.bucket_qc_hold,
    bucketSold:               r.bucket_sold,
    bucketOthers:             r.bucket_others,
  };
}

// ─── Date filter helpers ──────────────────────────────────────────────────────

const DATE_CUTOFF = '2026-04-01';

// Returns a SQL condition string for the date filter, or null for "all".
// alias: table alias prefix (e.g. 'v' → 'v.received_at'), or '' for bare column.
function getDateCondition(dateFilter, alias = '') {
  const col = alias ? `${alias}.received_at` : 'received_at';
  if (dateFilter === 'post') return `${col} >= '${DATE_CUTOFF}'`;
  if (dateFilter === 'pre')  return `(${col} < '${DATE_CUTOFF}' OR ${col} IS NULL)`;
  return null;
}

// Returns { prefix, from } for the rooftop aggregation source.
// When dateFilter is active, inlines the view SQL as a CTE so the date
// condition can be applied before aggregation.
function buildRooftopSource(dateFilter) {
  const dc = getDateCondition(dateFilter, 'v');
  if (!dc) return { prefix: '', from: 'v_by_rooftop' };
  const prefix = `
    WITH rt AS (
      SELECT
        v.rooftop_id,
        v.enterprise_id,
        MAX(rd.team_name)                   AS name,
        MAX(rd.team_type)                   AS type,
        MAX(ed.poc_email)                   AS csm,
        MAX(ed.name)                        AS enterprise,
        COUNT(*)::int                       AS total,
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
      WHERE ${dc}
      GROUP BY v.rooftop_id, v.enterprise_id
    )
  `;
  return { prefix, from: 'rt' };
}

// Returns { prefix, from } for the enterprise aggregation source.
function buildEnterpriseSource(dateFilter) {
  const dc = getDateCondition(dateFilter, 'v');
  if (!dc) return { prefix: '', from: 'v_by_enterprise' };
  const prefix = `
    WITH et AS (
      SELECT
        v.enterprise_id                       AS id,
        MAX(ed.name)                          AS name,
        MAX(ed.poc_email)                     AS csm,
        COUNT(*)::int                         AS total,
        SUM(CASE WHEN v.status = 'Delivered' THEN 1 ELSE 0 END)::int                                       AS processed,
        SUM(CASE WHEN v.status = 'Delivered' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int        AS processed_after_24h,
        SUM(CASE WHEN v.status != 'Delivered' THEN 1 ELSE 0 END)::int                                      AS not_processed,
        SUM(CASE WHEN v.status != 'Delivered' AND COALESCE(v.after_24h,0)=1 THEN 1 ELSE 0 END)::int       AS not_processed_after_24h,
        COUNT(DISTINCT v.rooftop_id)::int     AS rooftop_count,
        COUNT(DISTINCT CASE WHEN rd.ims_integration_status = 'false' THEN v.rooftop_id END)::int AS not_integrated_count,
        COUNT(DISTINCT CASE WHEN rd.publishing_status = 'false' THEN v.rooftop_id END)::int      AS publishing_disabled_count,
        ROUND(AVG(rd.website_score)::numeric, 2) AS avg_website_score,
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
      WHERE ${dc}
      GROUP BY v.enterprise_id
    )
  `;
  return { prefix, from: 'et' };
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
  holdReason:   "v.hold_reason",
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
         v.status, v.after_24h, v.has_photos, v.received_at, v.processed_at, v.reason_bucket, v.hold_reason, v.synced_at,
         rd.team_name AS rooftop, rd.team_type AS rooftop_type,
         ed.name AS enterprise, ed.poc_email AS csm
  ${VIN_FROM}
`;

// Builds a WHERE clause with PostgreSQL positional params ($1, $2, …).
// Returns { where: string, params: any[] }.
function buildVinFilters(queryParams) {
  const { search, rooftop, rooftopId, rooftopType, csm, status, after24h, hasPhotos, enterprise, enterpriseId, reasonBucket, dateFilter } = queryParams;
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
  if (hasPhotos === "true"  || hasPhotos === "1") conditions.push("COALESCE(v.has_photos, 0) = 1");
  if (hasPhotos === "false" || hasPhotos === "0") conditions.push("COALESCE(v.has_photos, 0) = 0");
  if (reasonBucket) conditions.push(`v.reason_bucket = ${p(reasonBucket)}`);
  const dc = getDateCondition(dateFilter, 'v');
  if (dc) conditions.push(dc);

  return { where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "", params };
}

// ─── GET /api/sync/status ─────────────────────────────────────────────────────

app.get("/api/sync/status", async (_req, res) => {
  const { rows } = await query(
    "SELECT running, started_at, completed_at, total_rows, last_sync FROM sync_state WHERE id = 'global'"
  );
  const state = rows[0];
  res.json({
    running:     state?.running     ?? false,
    startedAt:   state?.started_at  ?? null,
    completedAt: state?.completed_at ?? null,
    lastSync:    state?.last_sync   ?? null,
    totalRows:   state?.total_rows  ?? 0,
  });
});

// ─── POST /api/sync ───────────────────────────────────────────────────────────
// Synchronous — awaits the full sync before responding.
// maxDuration: 300 is set in vercel.json to allow up to 5 minutes.

app.post("/api/sync", async (_req, res) => {
  try {
    const result = await runSync();
    if (result.skipped) {
      const { rows } = await query("SELECT started_at FROM sync_state WHERE id = 'global'");
      return res.status(202).json({ status: "already_running", startedAt: rows[0]?.started_at });
    }
    res.json({ status: "completed" });
  } catch (err) {
    console.error("[POST /api/sync] error:", err);
    res.status(500).json({ error: err.message || "Sync failed" });
  }
});

// ─── Summary computation ──────────────────────────────────────────────────────
// Runs the full aggregation query and returns the shaped JS object.
// Called at the end of each sync (to precompute all 3 variants) and as a
// fallback in GET /api/summary when the cache is empty (first deploy).

async function computeSummary(dateFilter) {
  const dc = getDateCondition(dateFilter);
  const statsWhere = dc ? `WHERE ${dc}` : '';
  const { rows } = await query(`
    WITH
      meta AS (
        SELECT MAX(synced_at) AS last_sync, COUNT(*)::int AS total_rows FROM vins
      ),
      base AS MATERIALIZED (
        SELECT
          v.status,
          v.has_photos,
          v.after_24h,
          v.reason_bucket,
          v.rooftop_id,
          v.enterprise_id,
          ed.poc_email,
          rd.team_type,
          rd.website_score,
          rd.website_listing_url,
          rd.ims_integration_status,
          rd.publishing_status
        FROM vins v
        LEFT JOIN enterprise_details ed ON v.enterprise_id = ed.enterprise_id
        LEFT JOIN rooftop_details rd    ON v.rooftop_id    = rd.team_id
        ${statsWhere}
      ),
      totals AS (
        SELECT
          COUNT(*)::int                                                                                                          AS total,
          COUNT(DISTINCT enterprise_id)::int                                                                                    AS enterprise_count,
          SUM(CASE WHEN COALESCE(has_photos,0)=1 THEN 1 ELSE 0 END)::int                                                       AS with_photos,
          SUM(CASE WHEN status = 'Delivered' AND COALESCE(has_photos,0)=1 THEN 1 ELSE 0 END)::int                              AS delivered_with_photos,
          SUM(CASE WHEN status != 'Delivered' AND COALESCE(has_photos,0)=1 THEN 1 ELSE 0 END)::int                             AS pending_with_photos,
          SUM(CASE WHEN status = 'Delivered' THEN 1 ELSE 0 END)::int                                                            AS processed,
          SUM(CASE WHEN status = 'Delivered' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END)::int                               AS processed_after_24h,
          SUM(CASE WHEN status != 'Delivered' THEN 1 ELSE 0 END)::int                                                           AS not_processed,
          SUM(CASE WHEN status != 'Delivered' AND COALESCE(has_photos,0)=1 AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END)::int AS not_processed_after_24h,
          SUM(CASE WHEN status != 'Delivered' AND COALESCE(has_photos,0)=1 AND reason_bucket = 'Processing Pending' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_processing_pending,
          SUM(CASE WHEN status != 'Delivered' AND COALESCE(has_photos,0)=1 AND reason_bucket = 'Publishing Pending' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_publishing_pending,
          SUM(CASE WHEN status != 'Delivered' AND COALESCE(has_photos,0)=1 AND reason_bucket = 'QC Pending'         AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_qc_pending,
          SUM(CASE WHEN status != 'Delivered' AND COALESCE(has_photos,0)=1 AND reason_bucket = 'QC Hold'            AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_qc_hold,
          SUM(CASE WHEN status != 'Delivered' AND COALESCE(has_photos,0)=1 AND reason_bucket = 'Sold'               AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_sold,
          SUM(CASE WHEN status != 'Delivered' AND COALESCE(has_photos,0)=1 AND reason_bucket = 'Others'             AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_others
        FROM base
      ),
      by_csm AS (
        SELECT
          poc_email                                                                                                                  AS name,
          COUNT(DISTINCT rooftop_id)::int                                                                                           AS rooftop_count,
          COUNT(DISTINCT enterprise_id)::int                                                                                        AS enterprise_count,
          COUNT(*)::int                                                                                                              AS total,
          SUM(CASE WHEN COALESCE(has_photos,0)=1 THEN 1 ELSE 0 END)::int                                                           AS with_photos,
          SUM(CASE WHEN status = 'Delivered' AND COALESCE(has_photos,0)=1 THEN 1 ELSE 0 END)::int                                  AS delivered_with_photos,
          SUM(CASE WHEN status != 'Delivered' AND COALESCE(has_photos,0)=1 THEN 1 ELSE 0 END)::int                                 AS pending_with_photos,
          SUM(CASE WHEN status = 'Delivered' THEN 1 ELSE 0 END)::int                                                                AS processed,
          SUM(CASE WHEN status = 'Delivered' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END)::int                                   AS processed_after_24h,
          SUM(CASE WHEN status != 'Delivered' THEN 1 ELSE 0 END)::int                                                               AS not_processed,
          SUM(CASE WHEN status != 'Delivered' AND COALESCE(has_photos,0)=1 AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END)::int     AS not_processed_after_24h,
          ROUND(AVG(website_score)::numeric, 2)                                                                                     AS avg_website_score,
          COUNT(DISTINCT CASE WHEN (website_listing_url IS NULL OR website_listing_url = '') THEN rooftop_id END)::int              AS missing_website_count,
          COUNT(DISTINCT CASE WHEN ims_integration_status = 'false' THEN rooftop_id END)::int                                      AS integrated_count,
          COUNT(DISTINCT CASE WHEN publishing_status = 'false' THEN rooftop_id END)::int                                           AS publishing_count,
          SUM(CASE WHEN status != 'Delivered' AND COALESCE(has_photos,0)=1 AND reason_bucket = 'Processing Pending' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_processing_pending,
          SUM(CASE WHEN status != 'Delivered' AND COALESCE(has_photos,0)=1 AND reason_bucket = 'Publishing Pending' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_publishing_pending,
          SUM(CASE WHEN status != 'Delivered' AND COALESCE(has_photos,0)=1 AND reason_bucket = 'QC Pending'         AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_qc_pending,
          SUM(CASE WHEN status != 'Delivered' AND COALESCE(has_photos,0)=1 AND reason_bucket = 'QC Hold'            AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_qc_hold,
          SUM(CASE WHEN status != 'Delivered' AND COALESCE(has_photos,0)=1 AND reason_bucket = 'Sold'               AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_sold,
          SUM(CASE WHEN status != 'Delivered' AND COALESCE(has_photos,0)=1 AND reason_bucket = 'Others'             AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_others
        FROM base
        GROUP BY poc_email
      ),
      by_type AS (
        SELECT
          team_type                                                                                                                  AS label,
          COUNT(DISTINCT rooftop_id)::int                                                                                           AS rooftop_count,
          COUNT(DISTINCT enterprise_id)::int                                                                                        AS enterprise_count,
          COUNT(*)::int                                                                                                              AS total,
          SUM(CASE WHEN COALESCE(has_photos,0)=1 THEN 1 ELSE 0 END)::int                                                           AS with_photos,
          SUM(CASE WHEN status = 'Delivered' AND COALESCE(has_photos,0)=1 THEN 1 ELSE 0 END)::int                                  AS delivered_with_photos,
          SUM(CASE WHEN status != 'Delivered' AND COALESCE(has_photos,0)=1 THEN 1 ELSE 0 END)::int                                 AS pending_with_photos,
          SUM(CASE WHEN status = 'Delivered' THEN 1 ELSE 0 END)::int                                                                AS processed,
          SUM(CASE WHEN status = 'Delivered' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END)::int                                   AS processed_after_24h,
          SUM(CASE WHEN status != 'Delivered' THEN 1 ELSE 0 END)::int                                                               AS not_processed,
          SUM(CASE WHEN status != 'Delivered' AND COALESCE(has_photos,0)=1 AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END)::int     AS not_processed_after_24h,
          ROUND(AVG(website_score)::numeric, 2)                                                                                     AS avg_website_score,
          COUNT(DISTINCT CASE WHEN (website_listing_url IS NULL OR website_listing_url = '') THEN rooftop_id END)::int              AS missing_website_count,
          COUNT(DISTINCT CASE WHEN ims_integration_status = 'false' THEN rooftop_id END)::int                                      AS integrated_count,
          COUNT(DISTINCT CASE WHEN publishing_status = 'false' THEN rooftop_id END)::int                                           AS publishing_count,
          SUM(CASE WHEN status != 'Delivered' AND COALESCE(has_photos,0)=1 AND reason_bucket = 'Processing Pending' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_processing_pending,
          SUM(CASE WHEN status != 'Delivered' AND COALESCE(has_photos,0)=1 AND reason_bucket = 'Publishing Pending' AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_publishing_pending,
          SUM(CASE WHEN status != 'Delivered' AND COALESCE(has_photos,0)=1 AND reason_bucket = 'QC Pending'         AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_qc_pending,
          SUM(CASE WHEN status != 'Delivered' AND COALESCE(has_photos,0)=1 AND reason_bucket = 'QC Hold'            AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_qc_hold,
          SUM(CASE WHEN status != 'Delivered' AND COALESCE(has_photos,0)=1 AND reason_bucket = 'Sold'               AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_sold,
          SUM(CASE WHEN status != 'Delivered' AND COALESCE(has_photos,0)=1 AND reason_bucket = 'Others'             AND COALESCE(after_24h,0)=1 THEN 1 ELSE 0 END)::int AS bucket_others
        FROM base
        GROUP BY team_type
      ),
      by_bucket AS (
        SELECT reason_bucket AS label, COUNT(*)::int AS count
        FROM base
        WHERE status != 'Delivered' AND COALESCE(has_photos,0)=1 AND COALESCE(after_24h,0)=1
          AND reason_bucket IS NOT NULL AND reason_bucket != ''
        GROUP BY reason_bucket
      )
    SELECT
      (SELECT last_sync   FROM meta)                AS last_sync,
      (SELECT total_rows  FROM meta)                AS total_rows,
      (SELECT row_to_json(t) FROM totals t)         AS totals_json,
      (SELECT json_agg(c ORDER BY c.rooftop_count DESC)
       FROM by_csm c)                               AS by_csm_json,
      (SELECT json_agg(t ORDER BY
          CASE t.label
            WHEN 'Franchise Group'        THEN 1
            WHEN 'Franchise Individual'   THEN 2
            WHEN 'Independent Group'      THEN 3
            WHEN 'Independent Individual' THEN 4
            WHEN 'Others'                 THEN 5
            ELSE 6
          END, t.label)
       FROM by_type t)                              AS by_type_json,
      (SELECT json_agg(b ORDER BY
          CASE b.label
            WHEN 'Processing Pending' THEN 1
            WHEN 'Publishing Pending' THEN 2
            WHEN 'QC Pending'         THEN 3
            WHEN 'Sold'               THEN 4
            ELSE 5
          END, b.label)
       FROM by_bucket b)                            AS by_bucket_json
  `);
  const row = rows[0];
  return {
    lastSync:  row.last_sync  ?? null,
    totalRows: row.total_rows ?? 0,
    totals:    toTotals(row.totals_json),
    byCSM:     (row.by_csm_json    ?? []).map(toCsmRow),
    byType:    (row.by_type_json   ?? []).map(toTypeRow),
    byBucket:  (row.by_bucket_json ?? []).map(r => ({ label: r.label, count: r.count })),
  };
}

async function upsertSummaryCache(dateFilter, payload) {
  await query(
    `INSERT INTO summary_cache (date_filter, payload, computed_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (date_filter) DO UPDATE SET payload = $2, computed_at = NOW()`,
    [dateFilter ?? 'all', JSON.stringify(payload)]
  );
}

// ─── GET /api/summary ─────────────────────────────────────────────────────────
// Serves from summary_cache (precomputed at end of each sync) — trivial lookup.
// Falls back to computing on-demand if cache is empty (first deploy with existing data).

app.get("/api/summary", async (req, res) => {
  const dateFilter = req.query.dateFilter ?? null;
  const cacheKey   = dateFilter ?? 'all';
  const { rows } = await query(
    'SELECT payload FROM summary_cache WHERE date_filter = $1',
    [cacheKey]
  );
  if (rows.length > 0) {
    return res.json(rows[0].payload);
  }
  // Cache not yet populated — compute and store so the next request is instant.
  const payload = await computeSummary(dateFilter);
  await upsertSummaryCache(dateFilter, payload);
  res.json(payload);
});

// ─── Filter-options computation ───────────────────────────────────────────────
// Queries the materialized views (pre-aggregated at sync time) and returns the
// shaped payload. Called at the end of each sync and as a fallback on cold start.

async function computeFilterOptions() {
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
        BOOL_OR(bucket_qc_hold            > 0) AS bucket_qc_hold,
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
  return {
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
      bucketQcHold:            bf.bucket_qc_hold            ?? false,
      bucketSold:              bf.bucket_sold               ?? false,
      bucketOthers:            bf.bucket_others             ?? false,
    },
    hasNotIntegrated:      cf.has_not_integrated      ?? false,
    hasPublishingDisabled: cf.has_publishing_disabled ?? false,
  };
}

async function upsertFilterCache(payload) {
  await query(
    `INSERT INTO filter_cache (id, payload, computed_at)
     VALUES ('global', $1, NOW())
     ON CONFLICT (id) DO UPDATE SET payload = $1, computed_at = NOW()`,
    [JSON.stringify(payload)]
  );
}

// ─── GET /api/filter-options ──────────────────────────────────────────────────
// Serves from filter_cache (precomputed at end of each sync) — trivial lookup.
// Falls back to computing on-demand if cache is empty (first deploy).

app.get("/api/filter-options", async (_req, res) => {
  const { rows } = await query(
    "SELECT payload FROM filter_cache WHERE id = 'global'"
  );
  if (rows.length > 0) return res.json(rows[0].payload);
  // Cache not yet populated — compute and store so the next request is instant.
  const payload = await computeFilterOptions();
  await upsertFilterCache(payload);
  res.json(payload);
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

  const { prefix, from } = buildRooftopSource(req.query.dateFilter);
  const { where, params } = buildRooftopFilters(req.query);
  const sortCol = ROOFTOP_SORT_MAP[req.query.sortBy] ?? "not_processed_after_24h";
  const sortDir = req.query.sortDir === "asc" ? "ASC" : "DESC";
  const orderBy = `ORDER BY ${sortCol} ${sortDir} NULLS LAST`;

  const [countRes, rowsRes] = await Promise.all([
    query(`${prefix} SELECT COUNT(*)::int AS n FROM ${from} ${where}`, params),
    query(`${prefix} SELECT * FROM ${from} ${where} ${orderBy} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset]),
  ]);

  const total = countRes.rows[0].n;
  res.json({ data: rowsRes.rows.map(toRooftopRow), total, page, pageSize, pageCount: Math.ceil(total / pageSize) });
});

app.get("/api/rooftops/export", async (req, res) => {
  const { prefix, from } = buildRooftopSource(req.query.dateFilter);
  const { where, params } = buildRooftopFilters(req.query);
  const sortCol = ROOFTOP_SORT_MAP[req.query.sortBy] ?? "not_processed_after_24h";
  const sortDir = req.query.sortDir === "asc" ? "ASC" : "DESC";
  const { rows } = await query(`${prefix} SELECT * FROM ${from} ${where} ORDER BY ${sortCol} ${sortDir} NULLS LAST`, params);
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

  const { prefix, from } = buildEnterpriseSource(req.query.dateFilter);
  const { where, params } = buildEnterpriseFilters(req.query);
  const sortCol = ENTERPRISE_SORT_MAP[req.query.sortBy] ?? "not_processed_after_24h";
  const sortDir = req.query.sortDir === "asc" ? "ASC" : "DESC";
  const orderBy = `ORDER BY ${sortCol} ${sortDir} NULLS LAST`;

  const [countRes, rowsRes] = await Promise.all([
    query(`${prefix} SELECT COUNT(*)::int AS n FROM ${from} ${where}`, params),
    query(`${prefix} SELECT * FROM ${from} ${where} ${orderBy} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset]),
  ]);

  const total = countRes.rows[0].n;
  res.json({ data: rowsRes.rows.map(toEnterpriseRow), total, page, pageSize, pageCount: Math.ceil(total / pageSize) });
});

app.get("/api/enterprises/export", async (req, res) => {
  const { prefix, from } = buildEnterpriseSource(req.query.dateFilter);
  const { where, params } = buildEnterpriseFilters(req.query);
  const sortCol = ENTERPRISE_SORT_MAP[req.query.sortBy] ?? "not_processed_after_24h";
  const sortDir = req.query.sortDir === "asc" ? "ASC" : "DESC";
  const { rows } = await query(`${prefix} SELECT * FROM ${from} ${where} ORDER BY ${sortCol} ${sortDir} NULLS LAST`, params);
  res.json({ data: rows.map(toEnterpriseRow) });
});

// ─── GET /api/vins/export ─────────────────────────────────────────────────────

app.get("/api/vins/export", async (req, res) => {
  const { where, params } = buildVinFilters(req.query);
  const orderBy = buildVinSort(req.query);
  const { rows } = await query(`${VIN_SELECT} ${where} ORDER BY ${orderBy}`, params);
  res.json({ data: rows.map(toApiRow) });
});

// ─── GET /api/scheduled-report ───────────────────────────────────────────────
// Called by Vercel Cron at 06:30, 12:30, 18:30 UTC (12:00 PM / 6:00 PM / 12:00 AM IST).
// Workflow: sync data from Metabase → compute summary → build HTML → send email.
// Secured via Vercel's built-in CRON_SECRET: Vercel sends it as
//   Authorization: Bearer <CRON_SECRET>
// so the endpoint rejects anything that doesn't match.

app.get("/api/scheduled-report", async (req, res) => {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // ── Time label (what the email header will show) ───────────────────────────
  const timeLabel = new Date().toLocaleString("en-IN", {
    timeZone:  "Asia/Kolkata",
    hour:      "2-digit",
    minute:    "2-digit",
    hour12:    true,
  }).toUpperCase().replace(/\s+/g, " ");

  const dashboardUrl = process.env.DASHBOARD_URL || "";

  console.log(`[scheduled-report] starting — ${timeLabel}`);

  // ── Step 1: Sync data from Metabase ───────────────────────────────────────
  let syncSkipped = false;
  try {
    const result = await runSync();
    syncSkipped = result.skipped;
    if (syncSkipped) {
      console.warn("[scheduled-report] sync was already running — sending email with cached data");
    } else {
      console.log("[scheduled-report] sync complete");
    }
  } catch (err) {
    // Sync failed (VINs critical failure). Log and fall through to send email
    // with the last cached summary so recipients still get a report.
    console.error("[scheduled-report] sync failed — sending email with cached data:", err?.message);
  }

  // ── Step 2: Compute fresh summary directly from DB ───────────────────────
  // Always query live — never read from cache — so lastSync reflects the
  // sync that just completed, not a previously cached value.
  let summary;
  try {
    summary = await computeSummary(null);
  } catch (err) {
    console.error("[scheduled-report] failed to compute summary:", err?.message);
    return res.status(500).json({ error: "Failed to compute summary data" });
  }

  // ── Step 3: Build HTML and send ───────────────────────────────────────────
  try {
    const html = buildEmailHtml(summary, timeLabel, dashboardUrl);
    await sendReport(html, timeLabel);
    console.log("[scheduled-report] done");
    return res.json({ ok: true, timeLabel, syncSkipped });
  } catch (err) {
    console.error("[scheduled-report] email send failed:", err?.message);
    return res.status(500).json({ error: err?.message });
  }
});

// ─── Vini Account Health — deployment statuses (Supabase, optional) ─────────
// Mirrors Product14/vini-dashboard GET/POST /api/statuses.

app.get("/api/statuses", async (_req, res) => {
  try {
    const statuses = await getAllDeploymentStatuses();
    return res.json(statuses);
  } catch (err) {
    console.error("GET /api/statuses error:", err?.message);
    return res.json({});
  }
});

app.post("/api/statuses", async (req, res) => {
  try {
    const { rooftopKey, rooftopName, enterprise, statuses } = req.body ?? {};
    if (!rooftopKey || !statuses) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    await upsertDeploymentStatus(rooftopKey, rooftopName ?? "", enterprise ?? "", statuses);
    return res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/statuses error:", err?.message);
    return res.status(500).json({ error: err?.message ?? "Failed to save" });
  }
});

// ─── GET /api/agents — Day-on-day agent calls per rooftop (Metabase passthrough) ──

const AGENTS_METABASE_URL =
  "https://metabase.spyne.ai/api/public/card/524f9fb4-b27c-49f4-a670-7d2c406e77a2/query/json";

let agentsCache = { data: null, fetchedAt: 0 };
const AGENTS_TTL_MS = 5 * 60 * 1000; // 5 minutes

app.get("/api/agents", async (req, res) => {
  try {
    const force = req.query.refresh === "1";
    const fresh = !force && agentsCache.data && (Date.now() - agentsCache.fetchedAt) < AGENTS_TTL_MS;
    if (!fresh) {
      const rows = await fetchFromMetabase(AGENTS_METABASE_URL, "AGENTS", 1, 60000);
      agentsCache = { data: Array.isArray(rows) ? rows : [], fetchedAt: Date.now() };
    }
    return res.json({
      rowCount: agentsCache.data.length,
      fetchedAt: new Date(agentsCache.fetchedAt).toISOString(),
      rows: agentsCache.data,
    });
  } catch (err) {
    console.error("GET /api/agents error:", err?.message);
    return res.status(500).json({ error: err?.message ?? "Failed to load agents data" });
  }
});

// ─── GET /api/agents-v2 — Unified multi-agent day-on-day (Metabase passthrough) ──
//
// Returns one row per day × team_id × agent_type with the unified schema
// (AgentRowV2) covering all four agents. The card UUID comes from env so the
// new card can be swapped in without a code change; the old /api/agents route
// continues to serve the v1 schema in parallel.

const AGENTS_V2_METABASE_URL =
  process.env.AGENTS_V2_METABASE_URL?.trim() ||
  "https://metabase.spyne.ai/api/public/card/REPLACE-WITH-AGENTS-V2-CARD-UUID/query/json";

let agentsV2Cache = { data: null, fetchedAt: 0 };
const AGENTS_V2_TTL_MS = 5 * 60 * 1000; // 5 minutes

app.get("/api/agents-v2", async (req, res) => {
  try {
    const force = req.query.refresh === "1";
    const fresh = !force && agentsV2Cache.data && (Date.now() - agentsV2Cache.fetchedAt) < AGENTS_V2_TTL_MS;
    if (!fresh) {
      const rows = await fetchFromMetabase(AGENTS_V2_METABASE_URL, "AGENTS_V2", 1, 60000);
      agentsV2Cache = { data: Array.isArray(rows) ? rows : [], fetchedAt: Date.now() };
    }
    return res.json({
      rowCount: agentsV2Cache.data.length,
      fetchedAt: new Date(agentsV2Cache.fetchedAt).toISOString(),
      rows: agentsV2Cache.data,
    });
  } catch (err) {
    console.error("GET /api/agents-v2 error:", err?.message);
    return res.status(500).json({ error: err?.message ?? "Failed to load agents-v2 data" });
  }
});

// ─── GET /api/agents-v3 — Per-agent campaign metrics (Metabase passthrough) ──
//
// Hits the same Metabase card as /api/agents but with the post-update column
// set (touched_leads, eligible_campaign_leads, leads_targeted, leads_engaged,
// avg_followups_till_appt, coverage, conversion_rate, quality_score, etc.).
// Maintained as a separate endpoint with its own cache so V3 dashboard can
// evolve independently of V1.

const AGENTS_V3_METABASE_URL =
  process.env.AGENTS_V3_METABASE_URL?.trim() ||
  "https://metabase.spyne.ai/api/public/card/524f9fb4-b27c-49f4-a670-7d2c406e77a2/query/json";

let agentsV3Cache = { data: null, fetchedAt: 0 };
const AGENTS_V3_TTL_MS = 5 * 60 * 1000; // 5 minutes

app.get("/api/agents-v3", async (req, res) => {
  try {
    const force = req.query.refresh === "1";
    const fresh = !force && agentsV3Cache.data && (Date.now() - agentsV3Cache.fetchedAt) < AGENTS_V3_TTL_MS;
    if (!fresh) {
      const rows = await fetchFromMetabase(AGENTS_V3_METABASE_URL, "AGENTS_V3", 1, 60000);
      agentsV3Cache = { data: Array.isArray(rows) ? rows : [], fetchedAt: Date.now() };
    }
    return res.json({
      rowCount: agentsV3Cache.data.length,
      fetchedAt: new Date(agentsV3Cache.fetchedAt).toISOString(),
      rows: agentsV3Cache.data,
    });
  } catch (err) {
    console.error("GET /api/agents-v3 error:", err?.message);
    return res.status(500).json({ error: err?.message ?? "Failed to load agents-v3 data" });
  }
});

// ─── GET /api/vini/rooftops — Vini Account Health rows (Metabase → DB cache) ──

app.get("/api/vini/rooftops", async (_req, res) => {
  try {
    const { rows } = await query(
      "SELECT rows_json, synced_at FROM vini_metrics_cache WHERE id = 'global'"
    );
    if (!rows.length) {
      return res.json({ source: "none", syncedAt: null, rowCount: 0, rooftops: [] });
    }
    const raw = rows[0].rows_json;
    const arr = Array.isArray(raw) ? raw : [];
    const rooftops = mapMetabaseRows(arr);
    return res.json({
      source: arr.length ? "metabase" : "none",
      syncedAt: rows[0].synced_at,
      rowCount: arr.length,
      rooftops,
    });
  } catch (err) {
    console.error("GET /api/vini/rooftops error:", err?.message);
    return res.status(500).json({ error: err?.message ?? "Failed to load" });
  }
});

export default app;
