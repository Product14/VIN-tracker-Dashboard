import express from "express";
import cors from "cors";
import { query, getClient } from "./db.js";
import { buildEmailHtml }                                    from "./emailTemplate.js";
import { buildRooftopReportHtml, buildGroupReportHtml }     from "./emailTemplateDaily.js";
import { sendReport, sendDailyReport }                      from "./emailClient.js";

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
      const json = await res.json();
      if (Array.isArray(json)) return json;
      // Metabase sometimes wraps rows in { data: [...] } — normalise to array.
      if (Array.isArray(json?.data)) return json.data;
      console.warn(`[sync:${label}] unexpected response shape:`, JSON.stringify(json).slice(0, 300));
      return [];
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
  // 1 retry (not 3) — Metabase VIN fetch can take 60-120s for 130K rows, so 3 retries
  // would consume the entire 300s Vercel budget before DB writes even start.
  // 180s timeout per attempt gives Metabase headroom while leaving ~120s for DB writes.
  const rows    = await fetchFromMetabase(VIN_DETAILS_URL, "VIN_DETAILS", 1, 180000);
  const syncedAt = new Date().toISOString();
  // Deduplicate by dealerVinId (primary key). Skip rows with no dealerVinId.
  const deduped = Object.values(
    rows.reduce((acc, row) => { if (row["dealerVinId"]) acc[row["dealerVinId"]] = row; return acc; }, {})
  );
  if (deduped.length > 0) console.log("[sync:VIN_DETAILS] sample row keys:", Object.keys(deduped[0]), "| has_photos sample:", deduped[0].has_photos, "| output_image_count sample:", deduped[0].output_image_count);

  const vins = [], dealerVinIds = [], enterpriseIds = [], rooftopIds = [];
  const statuses = [], after24hs = [], receivedAts = [], processedAts = [];
  const reasonBuckets = [], holdReasons = [], hasPhotosArr = [];
  const outputImageCounts = [], thumbnailUrls = [], vehiclePrices = [], syncedAts = [];
  const makes = [], models = [], years = [], trims = [], stockNumbers = [];

  for (const row of deduped) {
    vins.push(row.vinName ?? "");
    dealerVinIds.push(row["dealerVinId"] ?? null);
    enterpriseIds.push(row.enterpriseId ?? "");
    rooftopIds.push(String(row.teamId ?? ""));
    statuses.push(row.status ?? "");
    after24hs.push(cleanAfter24(row.after_24_hrs ?? row.after_24hrs ?? null));
    receivedAts.push(cleanDate(row.receivedAt));
    processedAts.push(cleanDate(row.sentAt));
    reasonBuckets.push(row.reason_bucket ?? "");
    holdReasons.push(row.hold_reason ?? "");
    hasPhotosArr.push(cleanAfter24(row.has_photos ?? null));
    outputImageCounts.push(row.output_image_count != null ? Number(row.output_image_count) : null);
    thumbnailUrls.push(row.thumbnail_url ?? null);
    vehiclePrices.push(row.sellingPrice != null ? Number(row.sellingPrice) : row.vehicle_price != null ? Number(row.vehicle_price) : null);
    makes.push(row.make ?? null);
    models.push(row.model ?? null);
    years.push(row.year != null ? String(row.year) : null);
    trims.push(row.trim ?? null);
    stockNumbers.push(row.stockNumber ?? null);
    syncedAts.push(syncedAt);
  }

  const BATCH_SIZE   = 25000;
  const PARALLEL     = 3;      // concurrent inserts — stay within pool max (5)

  // Step 1: Delete all existing rows in its own committed transaction.
  // This must commit before parallel inserts begin so they don't conflict.
  const deleteClient = await getClient();
  try {
    await deleteClient.query("BEGIN");
    await deleteClient.query("SET LOCAL statement_timeout = 0");
    await deleteClient.query("DELETE FROM vins");
    await deleteClient.query("COMMIT");
  } catch (e) {
    await deleteClient.query("ROLLBACK");
    throw e;
  } finally {
    deleteClient.release();
  }

  // Step 2: Build batch index list and run inserts PARALLEL at a time.
  const INSERT_SQL = `
    INSERT INTO vins
      (dealer_vin_id, vin, enterprise_id, rooftop_id, status, after_24h, received_at, processed_at,
       reason_bucket, hold_reason, has_photos, output_image_count, thumbnail_url, vehicle_price,
       make, model, year, trim, stock_number, synced_at)
    SELECT
      UNNEST($1::text[]),    UNNEST($2::text[]),     UNNEST($3::text[]),     UNNEST($4::text[]),
      UNNEST($5::text[]),    UNNEST($6::smallint[]), UNNEST($7::text[]),     UNNEST($8::text[]),
      UNNEST($9::text[]),    UNNEST($10::text[]),    UNNEST($11::smallint[]),UNNEST($12::int[]),
      UNNEST($13::text[]),   UNNEST($14::real[]),
      UNNEST($15::text[]),   UNNEST($16::text[]),   UNNEST($17::text[]),    UNNEST($18::text[]),
      UNNEST($19::text[]),   UNNEST($20::text[])
  `;

  const batchStarts = [];
  for (let i = 0; i < deduped.length; i += BATCH_SIZE) batchStarts.push(i);

  for (let g = 0; g < batchStarts.length; g += PARALLEL) {
    const group = batchStarts.slice(g, g + PARALLEL);
    await Promise.all(group.map(async (i) => {
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const slice = (arr) => arr.slice(i, i + BATCH_SIZE);
      const client = await getClient();
      try {
        await client.query("SET statement_timeout = 0");
        await client.query(INSERT_SQL, [
          slice(dealerVinIds), slice(vins), slice(enterpriseIds), slice(rooftopIds),
          slice(statuses), slice(after24hs), slice(receivedAts), slice(processedAts),
          slice(reasonBuckets), slice(holdReasons), slice(hasPhotosArr), slice(outputImageCounts),
          slice(thumbnailUrls), slice(vehiclePrices),
          slice(makes), slice(models), slice(years), slice(trims),
          slice(stockNumbers), slice(syncedAts),
        ]);
        console.log(`[sync:VIN_DETAILS] batch ${batchNum} done (rows ${i + 1}–${Math.min(i + BATCH_SIZE, deduped.length)})`);
      } finally {
        client.release();
      }
    }));
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
    // Preserve manually-set timezone values — they are not sourced from Metabase
    // and would otherwise be lost by the DELETE below.
    const { rows: tzRows } = await client.query(
      `SELECT enterprise_id, timezone FROM enterprise_details WHERE timezone IS NOT NULL`
    );
    const savedTimezones = new Map(tzRows.map(r => [r.enterprise_id, r.timezone]));

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
    // Restore saved timezones
    for (const [enterpriseId, tz] of savedTimezones) {
      await client.query(
        `UPDATE enterprise_details SET timezone = $1 WHERE enterprise_id = $2`,
        [tz, enterpriseId]
      );
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

// Atomically claims a sync lock in the DB, runs all three syncs sequentially,
// then releases the lock. Returns { skipped: true } if already running.
// VINs is treated as critical — its failure propagates as an HTTP 500.
// Rooftops and Enterprises run first (milliseconds) and fail silently.
// completed_at is only stamped when VINs succeeds.
async function runSync() {
  // Atomic claim: only one instance wins this UPDATE at a time.
  // Also steal the lock if running = TRUE but started_at is older than 10 minutes —
  // this handles the case where a previous Vercel function was killed by the 300s
  // timeout before the finally block could release the lock.
  const { rows } = await query(`
    UPDATE sync_state
       SET running = TRUE, started_at = NOW(), completed_at = NULL
     WHERE id = 'global'
       AND (running = FALSE OR started_at < NOW() - INTERVAL '10 minutes')
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
  const { search, rooftop, rooftopId, rooftopType, csm, status, after24h, hasPhotos, hasVin, enterprise, enterpriseId, reasonBucket, dateFilter } = queryParams;
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
  if (hasVin === "true"  || hasVin === "1") conditions.push("(v.vin IS NOT NULL AND v.vin != '')");
  if (hasVin === "false" || hasVin === "0") conditions.push("(v.vin IS NULL OR v.vin = '')");
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
    query("SELECT rooftop_id AS id, MAX(name) AS name, MAX(enterprise_id) AS enterprise_id FROM v_by_rooftop WHERE name IS NOT NULL GROUP BY rooftop_id ORDER BY MAX(name)"),
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
    rooftops:        rooftopNamesRes.rows,
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
  const [cacheRes, syncRes] = await Promise.all([
    query("SELECT payload, computed_at FROM filter_cache WHERE id = 'global'"),
    query("SELECT completed_at FROM sync_state WHERE id = 'global'"),
  ]);

  const row        = cacheRes.rows[0];
  const lastSync   = syncRes.rows[0]?.completed_at;
  const cached     = row?.payload;
  const computedAt = row?.computed_at;

  // Shape check: rooftops must be the current {id, name, enterprise_id}[] format.
  const hasValidShape = cached &&
    Array.isArray(cached.rooftops) &&
    (cached.rooftops.length === 0 || cached.rooftops[0]?.enterprise_id !== undefined);

  // Freshness check: cache must have been computed after the last completed sync.
  // If a sync ran more recently, the materialized views were refreshed and the
  // cache may be missing newly added rooftops (like Forrester Lincoln).
  const isFresh = computedAt && lastSync
    ? new Date(computedAt) >= new Date(lastSync)
    : true; // no sync yet — treat existing cache as fresh

  if (hasValidShape && isFresh) return res.json(cached);

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

  const skipSync = req.query["skip-sync"] === "true";
  console.log(`[scheduled-report] starting — ${timeLabel}${skipSync ? " (skip-sync)" : ""}`);

  // ── Step 1: Sync data from Metabase ───────────────────────────────────────
  let syncSkipped = skipSync;
  if (!skipSync) {
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

// ─── Daily Report Aggregation ─────────────────────────────────────────────────
// All "yesterday" KPIs scope to VINs received on the given date (received_at date).
// TTD = AVG(processed_at - received_at) for delivered VINs received yesterday.

async function computeRooftopDailyReport(rooftopId, yesterday, timezone = "America/New_York") {
  // yesterday: YYYY-MM-DD date string for the target day (in the given timezone)

  const { rows: [kpi] } = await query(`
    SELECT
      -- Vehicles shot yesterday with photos (received_at date = yesterday, has_photos = 1)
      COUNT(*) FILTER (WHERE DATE(received_at::timestamptz AT TIME ZONE $3) = $2::date AND COALESCE(has_photos, 0) = 1)                                                        AS new_vins,
      COALESCE(SUM(output_image_count) FILTER (WHERE DATE(received_at::timestamptz AT TIME ZONE $3) = $2::date AND COALESCE(has_photos, 0) = 1), 0)                            AS images_received,
      -- Vehicles published yesterday with photos (received_at date = yesterday, status = Delivered, has_photos = 1)
      COUNT(*) FILTER (WHERE status = 'Delivered' AND COALESCE(has_photos, 0) = 1 AND DATE(received_at::timestamptz AT TIME ZONE $3) = $2::date)                              AS vins_delivered,
      COALESCE(SUM(output_image_count) FILTER (WHERE status = 'Delivered' AND COALESCE(has_photos, 0) = 1 AND DATE(received_at::timestamptz AT TIME ZONE $3) = $2::date), 0) AS images_processed,
      -- Vehicles received yesterday with photos that are still not delivered
      COUNT(*) FILTER (WHERE status != 'Delivered' AND COALESCE(has_photos, 0) = 1 AND DATE(received_at::timestamptz AT TIME ZONE $3) = $2::date) AS vins_pending,
      -- Avg TAT for VINs received yesterday, published, with photos
      ROUND(AVG(
        EXTRACT(EPOCH FROM (processed_at::timestamptz - received_at::timestamptz)) / 3600.0
      ) FILTER (WHERE status = 'Delivered' AND COALESCE(has_photos, 0) = 1 AND DATE(received_at::timestamptz AT TIME ZONE $3) = $2::date
                  AND processed_at IS NOT NULL AND received_at IS NOT NULL)::numeric, 1) AS avg_ttd_hrs
    FROM vins
    WHERE rooftop_id = $1
  `, [rooftopId, yesterday, timezone]);

  const { rows: [totals] } = await query(`
    SELECT
      COUNT(*)                                                                          AS total_active,
      COUNT(*) FILTER (WHERE status = 'Delivered' AND COALESCE(has_photos, 0) = 1)   AS total_delivered,
      COUNT(*) FILTER (WHERE status != 'Delivered')                                   AS total_pending,
      COUNT(*) FILTER (WHERE COALESCE(has_photos, 0) = 1)                             AS with_photos
    FROM vins
    WHERE rooftop_id = $1
      AND (received_at IS NULL OR DATE(received_at::timestamptz AT TIME ZONE $3) <= $2::date)
  `, [rooftopId, yesterday, timezone]);

  const { rows: [rooftop] } = await query(`
    SELECT team_name, enterprise_id FROM rooftop_details WHERE team_id = $1
  `, [rooftopId]);

  // Delivered VINs published yesterday — per-VIN table (max 5 for email) + total count
  const [{ rows: processedVins }, { rows: [processedCount] }] = await Promise.all([
    query(`
      SELECT
        vin,
        dealer_vin_id,
        stock_number,
        vehicle_price,
        thumbnail_url,
        make,
        model,
        year,
        trim,
        received_at,
        processed_at,
        ROUND(
          EXTRACT(EPOCH FROM (processed_at::timestamptz - received_at::timestamptz)) / 3600.0
          ::numeric, 2
        )                                                  AS ttd_hrs
      FROM vins
      WHERE rooftop_id = $1
        AND status = 'Delivered'
        AND COALESCE(has_photos, 0) = 1
        AND DATE(received_at::timestamptz AT TIME ZONE $3) = $2::date
      ORDER BY received_at DESC
      LIMIT 5
    `, [rooftopId, yesterday, timezone]),
    query(`
      SELECT COUNT(*)::int AS total
      FROM vins
      WHERE rooftop_id = $1
        AND status = 'Delivered'
        AND COALESCE(has_photos, 0) = 1
        AND DATE(received_at::timestamptz AT TIME ZONE $3) = $2::date
    `, [rooftopId, yesterday, timezone]),
  ]);

  // VINs without images — top 5 for email display + total count for "+x more"
  const [{ rows: noImageVins }, { rows: [noImageCount] }] = await Promise.all([
    query(`
      SELECT
        vin,
        dealer_vin_id,
        stock_number,
        make,
        model,
        year,
        trim,
        received_at,
        EXTRACT(day FROM NOW() - received_at::timestamptz)::int AS days_on_lot
      FROM vins
      WHERE rooftop_id = $1
        AND COALESCE(has_photos, 0) = 0
      ORDER BY received_at ASC
      LIMIT 5
    `, [rooftopId]),
    query(`
      SELECT COUNT(*)::int AS total
      FROM vins
      WHERE rooftop_id = $1
        AND COALESCE(has_photos, 0) = 0
    `, [rooftopId]),
  ]);

  const totalActive    = Number(totals.total_active)    || 0;
  const totalDelivered = Number(totals.total_delivered)  || 0;
  const totalPending   = Number(totals.total_pending)    || 0;
  const withPhotos     = Number(totals.with_photos)      || 0;
  const deliveryPct    = totalActive > 0 ? Math.round(totalDelivered / totalActive * 1000) / 10 : 0;
  const pendingPct     = totalActive > 0 ? Math.round(totalPending   / totalActive * 1000) / 10 : 0;
  const withPhotosPct  = totalActive > 0 ? Math.round(withPhotos     / totalActive * 1000) / 10 : 0;

  return {
    rooftopId,
    enterpriseId:    rooftop?.enterprise_id ?? null,
    rooftopName:     rooftop?.team_name ?? rooftopId,
    // Yesterday KPIs
    newVins:         Number(kpi.new_vins)        || 0,
    vinsDelivered:   Number(kpi.vins_delivered)  || 0,
    vinsPending:     Number(kpi.vins_pending)    || 0,
    imagesReceived:  Number(kpi.images_received) || 0,
    imagesProcessed: Number(kpi.images_processed)|| 0,
    imagesPending:   Number(kpi.images_pending)  || 0,
    avgTtdHrs:       kpi.avg_ttd_hrs != null ? Number(kpi.avg_ttd_hrs) : null,
    // Total inventory KPIs
    totalActive,
    withPhotos,
    withPhotosPct,
    totalDelivered,
    totalPending,
    deliveryPct,
    pendingPct,
    // Per-VIN tables
    processedVins,
    processedVinsTotal: Number(processedCount.total) || 0,
    noImageVins,
    noImagesTotal: Number(noImageCount.total) || 0,
  };
}

async function computeGroupDailyReport(enterpriseId, yesterday, timezone = "America/New_York") {
  const { rows: [kpi] } = await query(`
    SELECT
      COUNT(*)                                                                            AS new_vins,
      COUNT(*) FILTER (WHERE status = 'Delivered')                                       AS vins_delivered,
      COUNT(*) FILTER (WHERE status != 'Delivered')                                      AS vins_pending,
      COALESCE(SUM(output_image_count), 0)                                               AS images_received,
      COALESCE(SUM(output_image_count) FILTER (WHERE status = 'Delivered'), 0)           AS images_processed,
      COALESCE(SUM(output_image_count) FILTER (WHERE status != 'Delivered'), 0)          AS images_pending,
      ROUND(AVG(
        EXTRACT(EPOCH FROM (processed_at::timestamptz - received_at::timestamptz)) / 3600.0
      ) FILTER (WHERE status = 'Delivered' AND processed_at IS NOT NULL)::numeric, 1)   AS avg_ttd_hrs
    FROM vins
    WHERE enterprise_id = $1
      AND DATE(received_at::timestamptz AT TIME ZONE $3) = $2::date
  `, [enterpriseId, yesterday, timezone]);

  const { rows: [totals] } = await query(`
    SELECT
      COUNT(*)                                             AS total_active,
      COUNT(*) FILTER (WHERE status = 'Delivered')        AS total_delivered,
      COUNT(*) FILTER (WHERE status != 'Delivered')       AS total_pending,
      COUNT(DISTINCT rooftop_id)                          AS rooftop_count
    FROM vins
    WHERE enterprise_id = $1
  `, [enterpriseId]);

  const { rows: [enterprise] } = await query(`
    SELECT name FROM enterprise_details WHERE enterprise_id = $1
  `, [enterpriseId]);

  // Top 5 rooftops by new VINs yesterday
  const { rows: topProcessed } = await query(`
    SELECT
      v.rooftop_id,
      MAX(rd.team_name)                                                                          AS rooftop_name,
      COUNT(*)                                                                                   AS new_vins,
      COUNT(*) FILTER (WHERE v.status = 'Delivered')                                            AS vins_delivered,
      COUNT(*) FILTER (WHERE v.status != 'Delivered')                                           AS vins_pending,
      ROUND(AVG(
        EXTRACT(EPOCH FROM (v.processed_at::timestamptz - v.received_at::timestamptz)) / 3600.0
      ) FILTER (WHERE v.status = 'Delivered' AND v.processed_at IS NOT NULL)::numeric, 1)      AS avg_ttd_hrs
    FROM vins v
    LEFT JOIN rooftop_details rd ON v.rooftop_id = rd.team_id
    WHERE v.enterprise_id = $1
      AND DATE(v.received_at::timestamptz AT TIME ZONE $3) = $2::date
    GROUP BY v.rooftop_id
    ORDER BY new_vins DESC
    LIMIT 5
  `, [enterpriseId, yesterday, timezone]);

  // Top 5 rooftops by VINs without images
  const { rows: topNoImages } = await query(`
    SELECT
      v.rooftop_id,
      MAX(rd.team_name)                                       AS rooftop_name,
      COUNT(*)                                                AS vin_count,
      COALESCE(SUM(v.vehicle_price), 0)                      AS total_value,
      ROUND(AVG(
        EXTRACT(day FROM NOW() - v.received_at::timestamptz)
      )::numeric, 1)                                         AS avg_days_on_lot
    FROM vins v
    LEFT JOIN rooftop_details rd ON v.rooftop_id = rd.team_id
    WHERE v.enterprise_id = $1
      AND COALESCE(v.has_photos, 0) = 0
    GROUP BY v.rooftop_id
    ORDER BY vin_count DESC
    LIMIT 5
  `, [enterpriseId]);

  const totalActive    = Number(totals.total_active)    || 0;
  const totalDelivered = Number(totals.total_delivered)  || 0;
  const totalPending   = Number(totals.total_pending)    || 0;
  const deliveryPct    = totalActive > 0 ? Math.round(totalDelivered / totalActive * 1000) / 10 : 0;
  const pendingPct     = totalActive > 0 ? Math.round(totalPending   / totalActive * 1000) / 10 : 0;

  return {
    enterpriseId,
    enterpriseName:  enterprise?.name ?? enterpriseId,
    rooftopCount:    Number(totals.rooftop_count) || 0,
    // Yesterday KPIs
    newVins:         Number(kpi.new_vins)        || 0,
    vinsDelivered:   Number(kpi.vins_delivered)  || 0,
    vinsPending:     Number(kpi.vins_pending)    || 0,
    imagesReceived:  Number(kpi.images_received) || 0,
    imagesProcessed: Number(kpi.images_processed)|| 0,
    imagesPending:   Number(kpi.images_pending)  || 0,
    avgTtdHrs:       kpi.avg_ttd_hrs != null ? Number(kpi.avg_ttd_hrs) : null,
    // Total inventory KPIs
    totalActive,
    totalDelivered,
    totalPending,
    deliveryPct,
    pendingPct,
    // Per-rooftop tables
    topProcessed,
    topNoImages,
  };
}

// ─── Daily Report Helpers ─────────────────────────────────────────────────────

// Returns { yesterdayStr: "YYYY-MM-DD", dateLabel: "21 Apr 2026 (EDT)" }
// for the calendar day before "today" in the given IANA timezone.
function yesterdayFor(tz = "America/New_York") {
  const todayLocal = new Date().toLocaleDateString("en-CA", { timeZone: tz }); // "YYYY-MM-DD"
  const [yr, mo, dy] = todayLocal.split("-").map(Number);
  const d = new Date(Date.UTC(yr, mo - 1, dy - 1)); // yesterday as UTC midnight
  const yesterdayStr = d.toISOString().slice(0, 10);
  const tzAbbr = new Date().toLocaleString("en-US", { timeZone: tz, timeZoneName: "short" })
    .split(" ").pop(); // "EST" or "EDT"
  const dateLabel = d.toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  }) + ` (${tzAbbr})`;
  return { yesterdayStr, dateLabel };
}

// ─── Email Recipients ─────────────────────────────────────────────────────────

// GET /api/email-recipients
// Returns the current recipient list as a downloadable CSV file.
app.get("/api/email-recipients", async (_req, res) => {
  try {
    const { rows } = await query(
      "SELECT email, rooftop_id, enterprise_id, report_type FROM email_recipients ORDER BY id"
    );
    const escape = (v) => (v == null ? "" : `"${String(v).replace(/"/g, '""')}"`);
    const csv = [
      "email,rooftop_id,enterprise_id,report_type",
      ...rows.map((r) =>
        [r.email, r.rooftop_id, r.enterprise_id, r.report_type].map(escape).join(",")
      ),
    ].join("\r\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="email-recipients.csv"');
    res.send(csv);
  } catch (e) {
    console.error("[email-recipients] DB error on GET:", e?.message);
    res.status(500).json({ error: "DB error fetching recipients" });
  }
});

// POST /api/email-recipients/upload
// Body: text/csv with header row: email,rooftop_id,enterprise_id,report_type
// Replaces all rows in email_recipients with the uploaded CSV content.

app.post(
  "/api/email-recipients/upload",
  express.text({ type: "text/csv" }),
  async (req, res) => {
    // ── 1. Basic body validation ───────────────────────────────────────────────
    const body = req.body;
    if (!body || typeof body !== "string") {
      return res.status(400).json({ error: "Expected text/csv body" });
    }

    const lines = body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      return res.status(400).json({ error: "CSV must have a header row and at least one data row" });
    }

    // Parse header (case-insensitive)
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const col = (name) => headers.indexOf(name);
    const iEmail        = col("email");
    const iRooftopId    = col("rooftop_id");
    const iEnterpriseId = col("enterprise_id");
    const iReportType   = col("report_type");

    if (iEmail === -1 || iReportType === -1) {
      return res.status(400).json({ error: "CSV must have columns: email, report_type (and rooftop_id / enterprise_id)" });
    }

    // ── 2. Sync-in-progress gate ───────────────────────────────────────────────
    const { rows: [syncState] } = await query("SELECT running FROM sync_state WHERE id = 'global'");
    if (syncState?.running) {
      return res.status(409).json({ ok: false, error: "sync_in_progress" });
    }

    // ── 3. Parse all rows — collect ALL format errors before touching the DB ───
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const errors = [];
    const valid  = [];

    for (let i = 1; i < lines.length; i++) {
      const cells       = lines[i].split(",").map((c) => c.trim());
      const email        = iEmail        >= 0 ? (cells[iEmail]        ?? "") : "";
      const rooftopId    = iRooftopId    >= 0 ? (cells[iRooftopId]    ?? "") : "";
      const enterpriseId = iEnterpriseId >= 0 ? (cells[iEnterpriseId] ?? "") : "";
      const reportType   = iReportType   >= 0 ? (cells[iReportType]   ?? "") : "";
      const rowNum       = i + 1; // 1-based, header = row 1

      let reason = null;
      if (!email || !EMAIL_RE.test(email)) {
        reason = "invalid email format";
      } else if (reportType !== "Rooftop" && reportType !== "Group") {
        reason = "report_type must be Rooftop or Group";
      } else if (reportType === "Rooftop" && !enterpriseId) {
        reason = "Rooftop report requires enterprise_id";
      } else if (reportType === "Rooftop" && !rooftopId) {
        reason = "Rooftop report requires rooftop_id";
      } else if (reportType === "Group" && rooftopId) {
        reason = "Group report must not have rooftop_id";
      } else if (reportType === "Group" && !enterpriseId) {
        reason = "Group report requires enterprise_id";
      }

      if (reason) {
        errors.push({ row: rowNum, data: lines[i], reason });
      } else {
        valid.push({
          _row:          rowNum,
          email,
          rooftop_id:    rooftopId    || null,
          enterprise_id: enterpriseId || null,
          report_type:   reportType,
        });
      }
    }

    // ── 4. Batch DB existence checks (runs for all format-valid rows, regardless
    //       of whether other rows had format errors — so all errors are surfaced
    //       in one response rather than requiring multiple upload attempts) ──────
    if (valid.length > 0) {
      const uniqueRooftopIds    = [...new Set(valid.filter((r) => r.report_type === "Rooftop").map((r) => r.rooftop_id))];
      const uniqueEnterpriseIds = [...new Set(valid.map((r) => r.enterprise_id).filter(Boolean))];

      const [rooftopRes, enterpriseRes] = await Promise.all([
        uniqueRooftopIds.length > 0
          ? query("SELECT team_id, enterprise_id FROM rooftop_details WHERE team_id = ANY($1::text[])", [uniqueRooftopIds])
          : { rows: [] },
        uniqueEnterpriseIds.length > 0
          ? query("SELECT enterprise_id FROM enterprise_details WHERE enterprise_id = ANY($1::text[])", [uniqueEnterpriseIds])
          : { rows: [] },
      ]);

      const validRooftopSet    = new Set(rooftopRes.rows.map((r) => r.team_id));
      const rooftopEntMap      = new Map(rooftopRes.rows.map((r) => [r.team_id, r.enterprise_id]));
      const validEnterpriseSet = new Set(enterpriseRes.rows.map((r) => r.enterprise_id));

      for (const r of valid) {
        let reason = null;
        if (r.report_type === "Rooftop") {
          if (!validRooftopSet.has(r.rooftop_id)) {
            reason = "rooftop_id not found in database";
          } else if (!validEnterpriseSet.has(r.enterprise_id)) {
            reason = "enterprise_id not found in database";
          } else if (rooftopEntMap.get(r.rooftop_id) !== r.enterprise_id) {
            reason = "rooftop does not belong to this enterprise";
          }
        } else if (r.report_type === "Group") {
          if (!validEnterpriseSet.has(r.enterprise_id)) {
            reason = "enterprise_id not found in database";
          }
        }
        if (reason) errors.push({ row: r._row, data: lines[r._row - 1], reason });
      }
    }

    // ── 5. Fail-all-or-nothing ────────────────────────────────────────────────
    if (errors.length > 0) {
      return res.status(422).json({ ok: false, errors });
    }

    // ── 6. Transactional DELETE + bulk INSERT ─────────────────────────────────
    const client = await getClient();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM email_recipients");
      if (valid.length > 0) {
        const emails        = valid.map((r) => r.email);
        const rooftopIds    = valid.map((r) => r.rooftop_id);
        const enterpriseIds = valid.map((r) => r.enterprise_id);
        const reportTypes   = valid.map((r) => r.report_type);
        await client.query(
          `INSERT INTO email_recipients (email, rooftop_id, enterprise_id, report_type)
           SELECT UNNEST($1::text[]), UNNEST($2::text[]), UNNEST($3::text[]), UNNEST($4::text[])`,
          [emails, rooftopIds, enterpriseIds, reportTypes]
        );
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
      console.error("[email-recipients] DB error on upload:", e?.message);
      return res.status(500).json({ error: "DB error saving recipients" });
    }
    client.release();

    console.log(`[email-recipients] uploaded ${valid.length} recipients`);
    return res.json({ ok: true, inserted: valid.length });
  }
);

// ─── Daily Report Endpoint ────────────────────────────────────────────────────
// Returns 202 immediately. Enqueues all recipients into report_queue.
// Processing is handled by POST /api/process-report-queue (cron, every minute).

app.get("/api/send-daily-report", async (req, res) => {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // ── Test-mode override ─────────────────────────────────────────────────────
  // ?to=a@b.com&cc=c@d.com&rooftopId=123&reportType=Rooftop
  // ?to=a@b.com&cc=c@d.com&enterpriseId=456&reportType=Group
  // Bypasses the email_recipients table but still applies IMS + pending gates.
  const testTo   = req.query.to ? String(req.query.to).split(",").map(s => s.trim()).filter(Boolean) : null;
  const testCc   = req.query.cc ? String(req.query.cc).split(",").map(s => s.trim()).filter(Boolean) : null;
  const testMode = testTo !== null;

  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const runAt = new Date().toISOString();
  const testModeLabel = testMode
    ? (req.query.rooftopId || req.query.enterpriseId ? "single-entity" : "full-run")
    : "production";
  console.log(`[daily-report] queuing run ${runId} (${testModeLabel}${testMode ? ` → ${testTo.join(",")}` : ""})`);

  // ── Load recipients ────────────────────────────────────────────────────────
  // Three modes:
  //   1. testMode + rooftopId/enterpriseId → single entity test (one recipient)
  //   2. testMode + no entity ID           → full-run test (all email_recipients, TO overridden, no CC)
  //   3. production                        → all email_recipients, real TO/CC
  let recipients;
  try {
    if (testMode && (req.query.rooftopId || req.query.enterpriseId)) {
      recipients = [];
      if (req.query.rooftopId)    recipients.push({ email: testTo.join(","), rooftop_id: String(req.query.rooftopId),    enterprise_id: null,                           report_type: "Rooftop" });
      if (req.query.enterpriseId) recipients.push({ email: testTo.join(","), rooftop_id: null,                          enterprise_id: String(req.query.enterpriseId), report_type: "Group"   });
    } else {
      const { rows } = await query("SELECT email, rooftop_id, enterprise_id, report_type FROM email_recipients");
      recipients = rows;
    }
  } catch (e) {
    console.error("[daily-report] failed to load recipients:", e?.message);
    return res.status(500).json({ error: "DB error loading recipients" });
  }

  // ── Create run record ──────────────────────────────────────────────────────
  try {
    await query(
      `INSERT INTO daily_report_runs (run_id, run_at, test_mode, status, recipient_count, test_to, test_cc)
       VALUES ($1, $2, $3, 'pending', $4, $5, $6)`,
      [runId, runAt, testMode, recipients.length, testTo, testCc]
    );
  } catch (e) {
    console.error("[daily-report] failed to store run:", e?.message);
    return res.status(500).json({ error: "DB error creating run" });
  }

  // ── Enqueue all recipients into report_queue ───────────────────────────────
  if (recipients.length > 0) {
    try {
      const placeholders = recipients.map((_, i) => `($1, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4}, $${i * 4 + 5})`).join(", ");
      const params = [runId, ...recipients.flatMap(r => [r.email, r.rooftop_id || null, r.enterprise_id || null, r.report_type])];
      await query(
        `INSERT INTO report_queue (run_id, email, rooftop_id, enterprise_id, report_type) VALUES ${placeholders}`,
        params
      );
    } catch (e) {
      console.error("[daily-report] failed to enqueue recipients:", e?.message);
      return res.status(500).json({ error: "DB error enqueuing recipients" });
    }
  }

  console.log(`[daily-report] run ${runId} queued — ${recipients.length} recipients`);

  return res.status(202).json({
    ok: true,
    runId,
    status: "pending",
    recipientCount: recipients.length,
    statusUrl: `/api/send-daily-report/status?runId=${runId}`,
  });
});

// ─── Daily Report Queue Processor ────────────────────────────────────────────
// POST /api/process-report-queue
// Called every minute by Vercel cron. Claims up to 50 pending report_queue rows
// using SELECT FOR UPDATE SKIP LOCKED, processes them, and updates status.
// Safe to run concurrently — locking prevents duplicate sends.
// Stuck rows (processing > 10 min) are automatically reset and retried.

app.post("/api/process-report-queue", async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // ── Step 0: Check Metabase sync lock ──────────────────────────────────────
  try {
    const { rows: [syncState] } = await query("SELECT running FROM sync_state LIMIT 1");
    if (syncState?.running) {
      console.log("[process-queue] Metabase sync in progress — skipping tick");
      return res.json({ ok: true, skipped: true, reason: "sync_in_progress" });
    }
  } catch (e) {
    console.error("[process-queue] failed to check sync state:", e?.message);
  }

  // ── Step 1: Reset stuck rows (processing for > 10 min) ────────────────────
  try {
    await query(`
      UPDATE report_queue
         SET status        = CASE WHEN attempt_count >= 2 THEN 'error' ELSE 'pending' END,
             attempt_count = attempt_count + 1,
             error_reason  = CASE WHEN attempt_count >= 2 THEN 'timed_out' ELSE error_reason END,
             processing_started_at = NULL
       WHERE status = 'processing'
         AND processing_started_at < NOW() - INTERVAL '10 minutes'
    `);
  } catch (e) {
    console.error("[process-queue] failed to reset stuck rows:", e?.message);
  }

  // ── Step 2: Claim a batch atomically ──────────────────────────────────────
  let batch = [];
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(`
      SELECT id, run_id, email, rooftop_id, enterprise_id, report_type, attempt_count
        FROM report_queue
       WHERE status = 'pending'
       ORDER BY created_at
       LIMIT 20
         FOR UPDATE SKIP LOCKED
    `);
    batch = rows;
    if (batch.length > 0) {
      await client.query(
        `UPDATE report_queue SET status = 'processing', processing_started_at = NOW() WHERE id = ANY($1)`,
        [batch.map(r => r.id)]
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    client.release();
    console.error("[process-queue] failed to claim batch:", e?.message);
    return res.status(500).json({ error: "DB error claiming batch" });
  }
  client.release();

  if (batch.length === 0) {
    return res.json({ ok: true, processed: 0, message: "queue empty" });
  }

  console.log(`[process-queue] claimed ${batch.length} rows`);

  // ── Load run metadata for all unique run_ids in this batch ────────────────
  const runIds = [...new Set(batch.map(r => r.run_id))];
  let runMeta = {};
  try {
    const { rows: runRows } = await query(
      `SELECT run_id, run_at, test_mode, test_to, test_cc FROM daily_report_runs WHERE run_id = ANY($1)`,
      [runIds]
    );
    runMeta = Object.fromEntries(runRows.map(r => [r.run_id, r]));
  } catch (e) {
    console.error("[process-queue] failed to load run metadata:", e?.message);
  }

  // ── Gate helpers ───────────────────────────────────────────────────────────
  async function imsOffForRooftop(rooftopId) {
    const { rows: [rt] } = await query(
      "SELECT ims_integration_status FROM rooftop_details WHERE team_id = $1",
      [rooftopId]
    );
    return !rt || rt.ims_integration_status !== "true";
  }

  async function imsOffForEnterprise(enterpriseId) {
    const { rows: [r] } = await query(
      `SELECT COUNT(*) AS not_integrated FROM rooftop_details
        WHERE enterprise_id = $1 AND ims_integration_status != 'true'`,
      [enterpriseId]
    );
    return Number(r.not_integrated) > 0;
  }

  async function hasStalePendingVins(field, id, tz, yesterdayStr) {
    const { rows: [r] } = await query(
      `SELECT COUNT(*) AS pending_count FROM vins
        WHERE ${field} = $1
          AND COALESCE(has_photos, 0) = 1
          AND DATE(received_at::timestamptz AT TIME ZONE $2) <= $3::date
          AND status != 'Delivered'`,
      [id, tz, yesterdayStr]
    );
    return Number(r.pending_count) > 1;
  }

  async function hasNegativeTat(field, id, tz, yesterdayStr) {
    const { rows: [r] } = await query(
      `SELECT COUNT(*) AS negative_count FROM (
         SELECT processed_at, received_at FROM vins
          WHERE ${field} = $1
            AND status = 'Delivered'
            AND COALESCE(has_photos, 0) = 1
            AND DATE(received_at::timestamptz AT TIME ZONE $2) = $3::date
          ORDER BY received_at DESC LIMIT 5
       ) sub
       WHERE processed_at IS NOT NULL
         AND received_at IS NOT NULL
         AND processed_at::timestamptz < received_at::timestamptz`,
      [id, tz, yesterdayStr]
    );
    return Number(r.negative_count) > 0;
  }

  async function hasLowPhotoCoverage(field, id, tz, yesterdayStr) {
    const { rows: [r] } = await query(
      `SELECT COUNT(*) AS total_active,
              COUNT(*) FILTER (WHERE COALESCE(has_photos, 0) = 1) AS with_photos
         FROM vins
        WHERE ${field} = $1
          AND (received_at IS NULL OR DATE(received_at::timestamptz AT TIME ZONE $2) <= $3::date)`,
      [id, tz, yesterdayStr]
    );
    const total = Number(r.total_active) || 0;
    if (total === 0) return false;
    return Number(r.with_photos) / total * 100 < 75;
  }

  // ── Step 3: Process each row ───────────────────────────────────────────────
  let sentCount = 0, skippedCount = 0, errorCount = 0;

  for (const row of batch) {
    const { id, run_id, email, rooftop_id, enterprise_id, report_type, attempt_count } = row;
    const run      = runMeta[run_id] || {};
    const testMode = run.test_mode || false;
    const testTo   = run.test_to   || null;
    const testCc   = run.test_cc   || null;

    try {
      if (report_type === "Rooftop") {
        const { rows: [rt] } = await query(
          `SELECT rd.team_id, rd.team_name, rd.enterprise_id,
                  COALESCE(ed.timezone, 'America/New_York') AS timezone,
                  ed.poc_email
             FROM rooftop_details rd
             LEFT JOIN enterprise_details ed ON rd.enterprise_id = ed.enterprise_id
            WHERE rd.team_id = $1`,
          [rooftop_id]
        );
        if (!rt) {
          await query(`UPDATE report_queue SET status='error', error_reason=$2, processed_at=NOW() WHERE id=$1`, [id, "Rooftop not found"]);
          errorCount++; continue;
        }

        const tz = rt.timezone || "America/New_York";
        const { yesterdayStr, dateLabel } = yesterdayFor(tz);

        if (await imsOffForRooftop(rooftop_id)) {
          await query(`UPDATE report_queue SET status='skipped', entity_id=$2, entity_name=$3, error_reason='ims_off', processed_at=NOW() WHERE id=$1`, [id, rooftop_id, rt.team_name]);
          console.log(`[process-queue] rooftop ${rooftop_id} skipped — IMS not active`);
          skippedCount++; continue;
        }
        if (await hasStalePendingVins("rooftop_id", rooftop_id, tz, yesterdayStr)) {
          await query(`UPDATE report_queue SET status='skipped', entity_id=$2, entity_name=$3, error_reason='pending_vins', processed_at=NOW() WHERE id=$1`, [id, rooftop_id, rt.team_name]);
          console.log(`[process-queue] rooftop ${rooftop_id} skipped — pending VINs > 1`);
          skippedCount++; continue;
        }
        if (await hasNegativeTat("rooftop_id", rooftop_id, tz, yesterdayStr)) {
          await query(`UPDATE report_queue SET status='skipped', entity_id=$2, entity_name=$3, error_reason='negative_tat', processed_at=NOW() WHERE id=$1`, [id, rooftop_id, rt.team_name]);
          console.log(`[process-queue] rooftop ${rooftop_id} skipped — negative TAT detected`);
          skippedCount++; continue;
        }
        if (await hasLowPhotoCoverage("rooftop_id", rooftop_id, tz, yesterdayStr)) {
          await query(`UPDATE report_queue SET status='skipped', entity_id=$2, entity_name=$3, error_reason='low_photo_coverage', processed_at=NOW() WHERE id=$1`, [id, rooftop_id, rt.team_name]);
          console.log(`[process-queue] rooftop ${rooftop_id} skipped — photo coverage < 75%`);
          skippedCount++; continue;
        }

        const data    = await computeRooftopDailyReport(rooftop_id, yesterdayStr, tz);
        const html    = buildRooftopReportHtml(data, dateLabel, tz);
        const to      = testMode ? testTo : email.split(",").map(s => s.trim()).filter(Boolean);
        const cc      = testMode ? testCc : (rt.poc_email || undefined);
        const subject = `${testMode ? "[TEST] " : ""}Studio AI Daily Report — ${rt.team_name || rooftop_id} — ${dateLabel}`;
        await sendDailyReport(html, { to, ...(cc && { cc }), subject });

        const toArr = Array.isArray(to) ? to : [to];
        const ccArr = cc ? (Array.isArray(cc) ? cc : [cc]) : null;
        await query(
          `UPDATE report_queue SET status='sent', entity_id=$2, entity_name=$3, to_emails=$4, cc_emails=$5, processed_at=NOW() WHERE id=$1`,
          [id, rooftop_id, rt.team_name, toArr, ccArr]
        );
        console.log(`[process-queue] rooftop report sent → ${toArr.join(",")} (${rt.team_name})`);
        sentCount++;

      } else if (report_type === "Group") {
        const { rows: [ent] } = await query(
          `SELECT enterprise_id, name, COALESCE(timezone, 'America/New_York') AS timezone, poc_email
             FROM enterprise_details WHERE enterprise_id = $1`,
          [enterprise_id]
        );
        if (!ent) {
          await query(`UPDATE report_queue SET status='error', error_reason=$2, processed_at=NOW() WHERE id=$1`, [id, "Enterprise not found"]);
          errorCount++; continue;
        }

        const tz = ent.timezone || "America/New_York";
        const { yesterdayStr, dateLabel } = yesterdayFor(tz);

        if (await imsOffForEnterprise(enterprise_id)) {
          await query(`UPDATE report_queue SET status='skipped', entity_id=$2, entity_name=$3, error_reason='ims_off', processed_at=NOW() WHERE id=$1`, [id, enterprise_id, ent.name]);
          console.log(`[process-queue] enterprise ${enterprise_id} skipped — one or more rooftops have IMS off`);
          skippedCount++; continue;
        }
        if (await hasStalePendingVins("enterprise_id", enterprise_id, tz, yesterdayStr)) {
          await query(`UPDATE report_queue SET status='skipped', entity_id=$2, entity_name=$3, error_reason='pending_vins', processed_at=NOW() WHERE id=$1`, [id, enterprise_id, ent.name]);
          console.log(`[process-queue] enterprise ${enterprise_id} skipped — pending VINs > 1`);
          skippedCount++; continue;
        }
        if (await hasNegativeTat("enterprise_id", enterprise_id, tz, yesterdayStr)) {
          await query(`UPDATE report_queue SET status='skipped', entity_id=$2, entity_name=$3, error_reason='negative_tat', processed_at=NOW() WHERE id=$1`, [id, enterprise_id, ent.name]);
          console.log(`[process-queue] enterprise ${enterprise_id} skipped — negative TAT detected`);
          skippedCount++; continue;
        }
        if (await hasLowPhotoCoverage("enterprise_id", enterprise_id, tz, yesterdayStr)) {
          await query(`UPDATE report_queue SET status='skipped', entity_id=$2, entity_name=$3, error_reason='low_photo_coverage', processed_at=NOW() WHERE id=$1`, [id, enterprise_id, ent.name]);
          console.log(`[process-queue] enterprise ${enterprise_id} skipped — photo coverage < 75%`);
          skippedCount++; continue;
        }

        const data    = await computeGroupDailyReport(enterprise_id, yesterdayStr, tz);
        const html    = buildGroupReportHtml(data, dateLabel);
        const to      = testMode ? testTo : email.split(",").map(s => s.trim()).filter(Boolean);
        const cc      = testMode ? testCc : (ent.poc_email || undefined);
        const subject = `${testMode ? "[TEST] " : ""}Studio AI Group Report — ${ent.name || enterprise_id} — ${dateLabel}`;
        await sendDailyReport(html, { to, ...(cc && { cc }), subject });

        const toArr = Array.isArray(to) ? to : [to];
        const ccArr = cc ? (Array.isArray(cc) ? cc : [cc]) : null;
        await query(
          `UPDATE report_queue SET status='sent', entity_id=$2, entity_name=$3, to_emails=$4, cc_emails=$5, processed_at=NOW() WHERE id=$1`,
          [id, enterprise_id, ent.name, toArr, ccArr]
        );
        console.log(`[process-queue] group report sent → ${toArr.join(",")} (${ent.name})`);
        sentCount++;

      } else {
        await query(`UPDATE report_queue SET status='error', error_reason=$2, processed_at=NOW() WHERE id=$1`, [id, `Unknown report_type: ${report_type}`]);
        errorCount++;
      }

    } catch (e) {
      const newAttemptCount = (attempt_count || 0) + 1;
      const newStatus = newAttemptCount >= 3 ? "error" : "pending";
      console.error(`[process-queue] ERROR — type=${report_type} id=${rooftop_id || enterprise_id} run=${run_id}:`, e?.message, e);
      await query(
        `UPDATE report_queue
            SET status = $2, attempt_count = $3, error_reason = $4, processing_started_at = NULL
          WHERE id = $1`,
        [id, newStatus, newAttemptCount, e?.message]
      ).catch(dbErr => console.error("[process-queue] failed to update error status:", dbErr?.message));
      errorCount++;
    }
  }

  console.log(`[process-queue] batch complete — sent=${sentCount} skipped=${skippedCount} errors=${errorCount}`);

  // ── Step 4: Check run completion ───────────────────────────────────────────
  for (const runId of runIds) {
    try {
      const { rows: [{ count }] } = await query(
        `SELECT COUNT(*)::int AS count FROM report_queue WHERE run_id = $1 AND status IN ('pending', 'processing')`,
        [runId]
      );
      if (count === 0) {
        await query(`UPDATE daily_report_runs SET status = 'done', completed_at = NOW() WHERE run_id = $1`, [runId]);
        console.log(`[process-queue] run ${runId} complete`);
      }
    } catch (e) {
      console.error(`[process-queue] failed to check run completion for ${runId}:`, e?.message);
    }
  }

  return res.json({ ok: true, processed: batch.length, sent: sentCount, skipped: skippedCount, errors: errorCount });
});

// ─── Daily Report Status ──────────────────────────────────────────────────────
// GET /api/send-daily-report/status?runId=xxx
// Poll this after the 202 to check progress. Counts are derived from report_queue.

app.get("/api/send-daily-report/status", async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { runId } = req.query;
  if (!runId) return res.status(400).json({ error: "runId required" });

  const { rows: [run] } = await query(
    `SELECT run_id, run_at, test_mode, status, recipient_count, completed_at
       FROM daily_report_runs WHERE run_id = $1`,
    [runId]
  );
  if (!run) return res.status(404).json({ error: "Run not found" });

  const { rows: counts } = await query(
    `SELECT status, COUNT(*)::int AS count FROM report_queue WHERE run_id = $1 GROUP BY status`,
    [runId]
  );
  const countMap = Object.fromEntries(counts.map(r => [r.status, r.count]));

  return res.json({
    ...run,
    sent:       countMap.sent       || 0,
    skipped:    countMap.skipped    || 0,
    errors:     countMap.error      || 0,
    pending:    countMap.pending    || 0,
    processing: countMap.processing || 0,
  });
});

// ─── Email Preview (browser, real DB data, no emails sent) ───────────────────

function _prevDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
function _nextDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

app.get("/api/preview-daily-report", async (req, res) => {
  // Date: ?date=YYYY-MM-DD or yesterday (EST default — no enterprise context on index page)
  let targetDate;
  if (req.query.date) {
    targetDate = String(req.query.date);
  } else {
    targetDate = yesterdayFor("America/New_York").yesterdayStr;
  }
  try {
    // ── No rooftopId → index page listing all rooftops ──────────────────────
    if (!req.query.rooftopId) {
      const { rows } = await query(
        `SELECT team_id, team_name FROM rooftop_details ORDER BY team_name ASC`
      );
      const links = rows.map(r =>
        `<li style="margin-bottom:4px;">
           <a href="/api/preview-daily-report?rooftopId=${encodeURIComponent(r.team_id)}&date=${targetDate}"
              style="font-size:14px;color:#2563EB;text-decoration:none;">
             ${r.team_name || r.team_id}
           </a>
         </li>`
      ).join("\n");
      return res.send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Rooftop Preview Index</title></head>
<body style="font-family:Arial,sans-serif;padding:32px;max-width:640px;">
  <h2 style="margin-bottom:4px;color:#111827;">Rooftop Email Preview</h2>
  <p style="color:#6B7280;margin-top:0;font-size:13px;">
    Reporting date: <strong style="color:#111827;">${targetDate}</strong>
    &nbsp;&middot;&nbsp;
    <a href="?date=${_prevDate(targetDate)}" style="color:#2563EB;">&larr; prev day</a>
    &nbsp;&middot;&nbsp;
    <a href="?date=${_nextDate(targetDate)}" style="color:#2563EB;">next day &rarr;</a>
  </p>
  <ul style="list-style:none;padding:0;line-height:2;">${links}</ul>
</body></html>`);
    }

    // ── Single rooftop → wrapper page with iframe ────────────────────────────
    const rooftopId = encodeURIComponent(String(req.query.rooftopId));
    const rawSrc    = `/api/preview-daily-report/raw?rooftopId=${rooftopId}&date=${targetDate}`;
    return res.send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Preview — ${targetDate}</title>
<style>
  * { box-sizing:border-box; }
  body { margin:0; padding:0; background:#DEDEDE; font-family:Arial,sans-serif; }
  .bar { display:flex; align-items:center; gap:16px; padding:10px 20px; background:#1a1a2e; font-size:12px; }
  .bar a { color:#94a3b8; text-decoration:none; }
  .bar a:hover { color:#fff; }
  .bar .sep { color:#334155; }
  .bar .title { color:#e2e8f0; font-weight:600; flex:1; }
  iframe { display:block; width:640px; max-width:100%; margin:24px auto; border:none;
           box-shadow:0 4px 24px rgba(0,0,0,0.18); background:#fff; }
</style></head>
<body>
  <div class="bar">
    <a href="/api/preview-daily-report?date=${targetDate}">&larr; All rooftops</a>
    <span class="sep">|</span>
    <span class="title">Reporting: ${targetDate}</span>
    <a href="?rooftopId=${rooftopId}&date=${_prevDate(targetDate)}">&larr; prev day</a>
    <a href="?rooftopId=${rooftopId}&date=${_nextDate(targetDate)}">next day &rarr;</a>
  </div>
  <iframe src="${rawSrc}" id="f" scrolling="no"></iframe>
  <script>
    const f = document.getElementById("f");
    function resize() { f.style.height = f.contentDocument.body.scrollHeight + "px"; }
    f.addEventListener("load", resize);
  </script>
</body></html>`);

  } catch (e) {
    console.error("[preview-daily-report] error:", e?.message);
    return res.status(500).send(`<pre>Error: ${e?.message}</pre>`);
  }
});

// Raw email HTML — loaded inside the iframe above, isolated from outer page styles.
app.get("/api/preview-daily-report/raw", async (req, res) => {
  try {
    const rooftopId = String(req.query.rooftopId);

    // Look up the enterprise timezone for this rooftop
    const { rows: [rtTz] } = await query(
      `SELECT COALESCE(ed.timezone, 'America/New_York') AS timezone
       FROM rooftop_details rd
       LEFT JOIN enterprise_details ed ON rd.enterprise_id = ed.enterprise_id
       WHERE rd.team_id = $1`,
      [rooftopId]
    );
    const tz = rtTz?.timezone || "America/New_York";

    let targetDate;
    if (req.query.date) {
      targetDate = String(req.query.date);
    } else {
      targetDate = yesterdayFor(tz).yesterdayStr;
    }
    const tzAbbr = new Date().toLocaleString("en-US", { timeZone: tz, timeZoneName: "short" }).split(" ").pop();
    const dateLabel = new Date(targetDate + "T00:00:00Z").toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
    }) + ` (${tzAbbr})`;
    const data = await computeRooftopDailyReport(rooftopId, targetDate, tz);
    const html = buildRooftopReportHtml(data, dateLabel, tz);
    // Minimal reset — counteracts browser UA defaults without touching email layout
    const reset = `<style>
      body  { margin:0 !important; padding:0 !important; }
      table { border-collapse:collapse !important; border-spacing:0 !important; }
      img   { display:block !important; border:0 !important; }
      p     { margin:0; padding:0; }
    </style>`;
    res.setHeader("Content-Type", "text/html");
    return res.send(html.replace("</head>", reset + "</head>"));
  } catch (e) {
    console.error("[preview-daily-report/raw] error:", e?.message);
    return res.status(500).send(`<pre>Error: ${e?.message}</pre>`);
  }
});

export default app;
