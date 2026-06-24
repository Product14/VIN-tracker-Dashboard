// ─── Studio Health "360" section — live spin metrics from the VIN-tracker DB ──
// Computes the 4 "360" rows × 9 columns and the 6 KPI-card values straight from the
// spin columns on `public.vins` (the native 360/Spin funnel — see HANDOFF_360_dashboard.md),
// replacing the Google-Sheet numbers for this section. Mirrors studioImagesDb.js exactly,
// swapping catalog → spin columns:
//   status→spin_status · processed_at→spin_sent_at · output_processing_catalog→output_processing_spin
//   · >6h flag = spin_after_6h. Cohort = requested (output_processing_spin=1, NULL→0) AND has_photos=1.
// 360 is always all-scope (no publishing on/off — HANDOFF_360 locked decision #4), so no
// publishing clause. customer_segment is shared, so the ENT/MID/SMB splits work as for Images.

import { query } from '../db.js'

// Read-only queries are idempotent, so retry transient connection-level failures.
async function queryWithRetry(sql, params, retries = 2) {
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await query(sql, params)
    } catch (e) {
      lastErr = e
      if (attempt < retries) await new Promise((r) => setTimeout(r, 300 * (attempt + 1)))
    }
  }
  throw lastErr
}

// Spin turnaround (hours): spin_sent_at − received_at, NULL unless both present and ordered.
const TAT_HOURS = `
  CASE WHEN spin_sent_at IS NOT NULL AND spin_sent_at <> ''
            AND received_at IS NOT NULL AND received_at <> ''
            AND spin_sent_at::timestamptz >= received_at::timestamptz
       THEN EXTRACT(EPOCH FROM (spin_sent_at::timestamptz - received_at::timestamptz)) / 3600.0
       ELSE NULL END`

// The requested + with-photos cohort (the native funnel's "With Photos within Requested").
// output_processing_spin uses COALESCE(...,0) — NULL = NOT requested (legacy cards had no spin).
const COHORT = `COALESCE(output_processing_spin, 0) = 1 AND COALESCE(has_photos, 0) = 1`

// Bucket key → membership predicate over (rdate, today, customer_segment).
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

// Per-bucket aggregates on the precomputed flags (is_<key>, dlv, lt6). Each aliased
// <metric>_<bucket>. `ful` = delivered / cohort (fulfillment); `pct` = delivered <6h %.
function aggsFor(key) {
  const inb = `is_${key}`
  return [
    `COUNT(*) FILTER (WHERE ${inb})::int AS cnt_${key}`,
    `100.0 * COUNT(*) FILTER (WHERE ${inb} AND dlv)
       / NULLIF(COUNT(*) FILTER (WHERE ${inb}), 0) AS ful_${key}`,
    `100.0 * COUNT(*) FILTER (WHERE ${inb} AND dlv AND lt6)
       / NULLIF(COUNT(*) FILTER (WHERE ${inb} AND dlv), 0) AS pct_${key}`,
    `COUNT(*) FILTER (WHERE ${inb} AND NOT dlv)::int AS pend_${key}`,
    `percentile_cont(0.95) WITHIN GROUP (ORDER BY tat_hours)
       FILTER (WHERE ${inb} AND dlv AND tat_hours IS NOT NULL) AS p95_${key}`,
  ]
}

const DASH = '—'
const fmtPct = (v) => (v == null ? DASH : `${Math.round(v)}%`)
const fmtInt = (v) => (v == null ? DASH : String(Math.round(v)))

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
 * @param {string} [opts.tz] reference timezone for day/month bucketing (default America/New_York)
 * @returns {Promise<Array<{label:string, sub?:string, cols:object}>>} the 4 "360" rows in display order
 */
export async function computeThree60Matrix({ tz } = {}) {
  const zone = tz || process.env.STUDIO_HEALTH_TZ || 'America/New_York'
  const flagCols = BUCKET_KEYS.map((k) => `(${BUCKETS[k]}) AS is_${k}`).join(',\n        ')
  const aggs = BUCKET_KEYS.flatMap((k) => aggsFor(k)).join(',\n    ')

  // base: cast/derive each row once, prefiltered to the cohort + last 3 calendar months.
  // <6h uses the spin_after_6h flag (the native funnel's source of truth for the SLA).
  const sql = `
    WITH ref AS (SELECT (NOW() AT TIME ZONE $1)::date AS today),
    base AS (
      SELECT
        DATE(received_at::timestamptz AT TIME ZONE $1) AS rdate,
        customer_segment,
        (spin_status = 'Delivered') AS dlv,
        (COALESCE(spin_after_6h, 0) = 0) AS lt6,
        ${TAT_HOURS} AS tat_hours
      FROM vins
      WHERE received_at IS NOT NULL AND received_at <> ''
        AND ${COHORT}
        AND DATE(received_at::timestamptz AT TIME ZONE $1)
            >= (date_trunc('month', (NOW() AT TIME ZONE $1)) - INTERVAL '2 months')::date
    ),
    flags AS MATERIALIZED (
      SELECT
        b.dlv, b.tat_hours, b.lt6,
        ${flagCols}
      FROM base b CROSS JOIN ref r
    )
    SELECT
    ${aggs}
    FROM flags`

  const { rows } = await queryWithRetry(sql, [zone])
  const r = rows[0] || {}

  return [
    { label: 'Delivered %', sub: '(Fulfillment)', cols: colsFor(r, fmtPct, 'ful') },
    { label: 'Delivered (&lt;6 hrs) %', cols: colsFor(r, fmtPct, 'pct') },
    { label: 'Pendency', cols: colsFor(r, fmtInt, 'pend') },
    { label: 'P95 Delivery Time (hrs)', cols: colsFor(r, fmtInt, 'p95') },
  ]
}

/**
 * Current-snapshot 360 KPIs over the spin cohort (requested + with-photos) in `vins`, plus
 * two rolling-30-day fields (anchored on received_at). Same shape as computeImagesKpis, so
 * the template renders the same 6 cards (with "360 Delivered" instead of "VINs Delivered").
 * The cohort lives in the WHERE, so every count is implicitly requested + has_photos.
 * @returns {Promise<{delivered:number, deliveredOver6h:number, pendencyOver6h:number,
 *   pendencyTotal:number, deliveredUnder6hPct30:(number|null), p95Delivery30:(number|null)}>}
 */
export async function computeThree60Kpis() {
  const sql = `
    SELECT
      COUNT(*) FILTER (WHERE spin_status = 'Delivered')::int AS delivered,
      COUNT(*) FILTER (WHERE spin_status = 'Delivered' AND COALESCE(spin_after_6h, 0) = 1)::int AS delivered_over6,
      COUNT(*) FILTER (WHERE spin_status <> 'Delivered' AND COALESCE(spin_after_6h, 0) = 1)::int AS pendency_over6,
      COUNT(*) FILTER (WHERE spin_status <> 'Delivered')::int AS pendency_total,
      -- Rolling 30 days on received_at: of spin-delivered VINs received in the window, the
      -- share delivered within 6h (spin_after_6h = 0).
      100.0 * COUNT(*) FILTER (
          WHERE spin_status = 'Delivered' AND received_at <> ''
            AND received_at::timestamptz >= NOW() - INTERVAL '30 days'
            AND COALESCE(spin_after_6h, 0) = 0
        )
        / NULLIF(COUNT(*) FILTER (
          WHERE spin_status = 'Delivered' AND received_at <> ''
            AND received_at::timestamptz >= NOW() - INTERVAL '30 days'
        ), 0) AS pct_under6_30,
      -- Rolling 30 days on received_at: P95 spin turnaround (hours) over delivered VINs.
      -- The received_at <> '' guard precedes the cast (empty strings error on ::timestamptz).
      percentile_cont(0.95) WITHIN GROUP (ORDER BY ${TAT_HOURS}) FILTER (
          WHERE spin_status = 'Delivered' AND received_at <> ''
            AND received_at::timestamptz >= NOW() - INTERVAL '30 days'
            AND ${TAT_HOURS} IS NOT NULL
      ) AS p95_30
    FROM vins
    WHERE ${COHORT}`

  const { rows } = await queryWithRetry(sql)
  const r = rows[0] || {}
  return {
    delivered: r.delivered ?? 0,
    deliveredOver6h: r.delivered_over6 ?? 0,
    pendencyOver6h: r.pendency_over6 ?? 0,
    pendencyTotal: r.pendency_total ?? 0,
    deliveredUnder6hPct30: r.pct_under6_30 == null ? null : Number(r.pct_under6_30),
    p95Delivery30: r.p95_30 == null ? null : Number(r.p95_30),
  }
}
