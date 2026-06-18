// ─── Studio Health "Images" section — live metrics from the VIN-tracker DB ────
// Computes the 4 Images rows × 9 columns straight from the `vins` table, replacing
// the manually-maintained Google-Sheet numbers for this one section. All metrics are
// anchored on received_at and the image-VIN cohort (has_photos = 1):
//
//   • Delivered (<6 hrs) %  — of VINs DELIVERED in the window, share with turnaround < 6h
//   • Pendency              — VINs received in the window that are STILL not delivered now
//   • P95 Delivery Time     — 95th percentile of turnaround (hrs) over delivered VINs
//   • Avg Media Score       — AVG(vin_score) over delivered VINs
//
// Columns (all on received_at, in $tz): MTD · ENT/MID/SMB (MTD split by customer_segment)
//   · D-1/2/3 (last 3 calendar days) · M-1/M-2 (previous two calendar months).
//
// Everything is LIVE from the current snapshot — historical D/M columns are only
// correct insofar as the Metabase VIN card still contains rows with received_at in
// those days/months (the table is replaced each sync). See the plan's caveats.

import { query } from '../db.js'

// Turnaround (hours) for a row, NULL unless both timestamps are present and ordered.
const TAT_HOURS = `
  CASE WHEN processed_at IS NOT NULL AND processed_at <> ''
            AND received_at IS NOT NULL AND received_at <> ''
            AND processed_at::timestamptz >= received_at::timestamptz
       THEN EXTRACT(EPOCH FROM (processed_at::timestamptz - received_at::timestamptz)) / 3600.0
       ELSE NULL END`

// Bucket key → membership predicate over (rdate, today, customer_segment). Evaluated
// ONCE per row in the `flags` CTE (as a boolean column) so the 45 downstream aggregate
// FILTERs are cheap boolean checks rather than re-deriving date_trunc/segment per agg.
const MTD_PRED = `rdate >= date_trunc('month', today)::date AND rdate <= today`
const BUCKETS = {
  mtd: MTD_PRED,
  ent: `(${MTD_PRED}) AND lower(customer_segment) = 'ent'`,
  mid: `(${MTD_PRED}) AND lower(customer_segment) = 'mid'`,
  smb: `(${MTD_PRED}) AND lower(customer_segment) = 'smb'`,
  d1: `rdate = today - 1`,
  d2: `rdate = today - 2`,
  d3: `rdate = today - 3`,
  m1: `rdate >= (date_trunc('month', today) - INTERVAL '1 month')::date AND rdate < date_trunc('month', today)::date`,
  m2: `rdate >= (date_trunc('month', today) - INTERVAL '2 months')::date AND rdate < (date_trunc('month', today) - INTERVAL '1 month')::date`,
}
const BUCKET_KEYS = Object.keys(BUCKETS) // mtd, ent, mid, smb, d1, d2, d3, m1, m2

// Per-bucket aggregate expressions, filtering on the precomputed boolean flags
// (is_<key>, dlv, lt6). Each is aliased <metric>_<bucket>.
function aggsFor(key) {
  const inb = `is_${key}`
  return [
    `COUNT(*) FILTER (WHERE ${inb})::int AS cnt_${key}`,
    `100.0 * COUNT(*) FILTER (WHERE ${inb} AND dlv AND lt6)
       / NULLIF(COUNT(*) FILTER (WHERE ${inb} AND dlv), 0) AS pct_${key}`,
    `COUNT(*) FILTER (WHERE ${inb} AND NOT dlv)::int AS pend_${key}`,
    `percentile_cont(0.95) WITHIN GROUP (ORDER BY tat_hours)
       FILTER (WHERE ${inb} AND dlv AND tat_hours IS NOT NULL) AS p95_${key}`,
    `AVG(vin_score) FILTER (WHERE ${inb} AND dlv) AS media_${key}`,
  ]
}

// Publishing scope, matching server/app.js getPublishingCondition (NULL = ON).
function publishingClause(publishing) {
  if (publishing === 'on') return `AND COALESCE(is_publishing, 1) = 1`
  if (publishing === 'off') return `AND COALESCE(is_publishing, 1) = 0`
  return '' // 'all' / null → no filter
}

const DASH = '—'
const fmtPct = (v) => (v == null ? DASH : `${Math.round(v)}%`)
const fmtInt = (v) => (v == null ? DASH : String(Math.round(v)))
const fmtScore = (v) => (v == null ? DASH : Number(v).toFixed(1))

// Build one metric's 9-column object; an empty bucket (no rows) renders all-"—".
function colsFor(row, fmt, prefix) {
  const cols = {}
  for (const k of BUCKET_KEYS) {
    const empty = (row[`cnt_${k}`] ?? 0) === 0
    cols[k] = empty ? DASH : fmt(row[`${prefix}_${k}`])
  }
  return cols
}

/**
 * @param {object} [opts]
 * @param {'all'|'on'|'off'} [opts.publishing='all']
 * @param {string} [opts.tz] reference timezone for day/month bucketing (default America/New_York)
 * @returns {Promise<Array<{label:string, cols:object}>>} the 4 Images rows in display order
 */
export async function computeImagesMatrix({ publishing = 'all', tz } = {}) {
  const zone = tz || process.env.STUDIO_HEALTH_TZ || 'America/New_York'
  const flagCols = BUCKET_KEYS.map((k) => `(${BUCKETS[k]}) AS is_${k}`).join(',\n        ')
  const aggs = BUCKET_KEYS.flatMap((k) => aggsFor(k)).join(',\n    ')

  // base: parse/cast each row once, and PREFILTER to the last 3 calendar months
  //   (oldest bucket is M-2) so we never scan the long historical tail.
  // flags: derive per-row booleans once (bucket membership + delivered + <6h).
  const sql = `
    WITH ref AS (SELECT (NOW() AT TIME ZONE $1)::date AS today),
    base AS (
      SELECT
        DATE(received_at::timestamptz AT TIME ZONE $1) AS rdate,
        customer_segment, vin_score,
        (status = 'Delivered') AS dlv,
        ${TAT_HOURS} AS tat_hours
      FROM vins
      WHERE received_at IS NOT NULL AND received_at <> ''
        AND COALESCE(has_photos, 0) = 1
        AND DATE(received_at::timestamptz AT TIME ZONE $1)
            >= (date_trunc('month', (NOW() AT TIME ZONE $1)) - INTERVAL '2 months')::date
        ${publishingClause(publishing)}
    ),
    flags AS MATERIALIZED (
      SELECT
        b.dlv, b.tat_hours, b.vin_score,
        (b.tat_hours IS NOT NULL AND b.tat_hours < 6) AS lt6,
        ${flagCols}
      FROM base b CROSS JOIN ref r
    )
    SELECT
    ${aggs}
    FROM flags`

  const { rows } = await query(sql, [zone])
  const r = rows[0] || {}

  return [
    { label: 'Delivered (&lt;6 hrs) %', cols: colsFor(r, fmtPct, 'pct') },
    { label: 'Pendency', cols: colsFor(r, fmtInt, 'pend') },
    { label: 'P95 Delivery Time (hrs)', cols: colsFor(r, fmtInt, 'p95') },
    { label: 'Avg Media Score', cols: colsFor(r, fmtScore, 'media') },
  ]
}

/**
 * Current-snapshot Images KPIs over the WHOLE image cohort in `vins` (no date window —
 * the table is already the card's active-inventory window). Reuses the project's 6h SLA.
 * @param {object} [opts]
 * @param {'all'|'on'|'off'} [opts.publishing='all']
 * @returns {Promise<{delivered:number, deliveredOver6h:number, pendencyOver6h:number}>}
 */
export async function computeImagesKpis({ publishing = 'all' } = {}) {
  const sql = `
    SELECT
      COUNT(*) FILTER (WHERE status = 'Delivered')::int AS delivered,
      COUNT(*) FILTER (
        WHERE status = 'Delivered' AND received_at <> '' AND processed_at <> ''
          AND processed_at::timestamptz >= received_at::timestamptz + INTERVAL '6 hours'
      )::int AS delivered_over6,
      COUNT(*) FILTER (
        WHERE status <> 'Delivered' AND received_at <> ''
          AND received_at::timestamptz + INTERVAL '6 hours' <= NOW()
      )::int AS pendency_over6
    FROM vins
    WHERE COALESCE(has_photos, 0) = 1
      ${publishingClause(publishing)}`

  const { rows } = await query(sql)
  const r = rows[0] || {}
  return {
    delivered: r.delivered ?? 0,
    deliveredOver6h: r.delivered_over6 ?? 0,
    pendencyOver6h: r.pendency_over6 ?? 0,
  }
}
