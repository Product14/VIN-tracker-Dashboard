// ─── Studio Health Report — Email HTML Template ───────────────────────────────
// Self-contained, Gmail-safe (table-based, inline-CSS) HTML email styled after the
// "Control Tower" daily report: light page, eyebrow + pill header, colored section
// bars, stacked KPI cards (colored label / dark value), and metric tables that bold
// MTD and de-emphasize the D-1..M-2 trend columns.
// Sections, top to bottom:
//   Plan KPIs · Rooftops KPIs · Images · 360 · Video · Adoption · VLP/Campaign KPIs.

import { fmtInt, pct, fmtMoneyCompact } from './format.js'

// Palette
const PAGE_BG = '#f4f4f5'
const CARD_BG = '#ffffff'
const BORDER = '#e5e7eb'
const ROW_BORDER = '#f1f1f4'
const TEXT_DARK = '#111827' // values, metric labels
const TEXT_BODY = '#374151' // segment columns (ENT/MID/SMB)
const TEXT_MUTED = '#6b7280' // subs, header labels
const TEXT_FAINT = '#9ca3af' // trend columns (D-1..M-2)
const EYEBROW = '#0ea5e9'
const PILL_BG = '#1c1c1e'
const LAVENDER = '#f5f3ff' // very light lavender fill for the M-1/M-2 columns
const CALLOUT_BG = '#ededf1' // commentary box fill

// Per-section accent (left bar) colors.
const SEC = {
  funnel: '#2563eb',
  plan: '#0ea5e9',
  images: '#16a34a',
  three60: '#d97706',
  video: '#db2777',
  adoption: '#4f46e5',
}

// Lifecycle-stage dot colors for the funnel (matches the Control Tower legend).
// Substring match so label variants (e.g. "In Onboarding") still resolve a color.
const STAGE_DOT = {
  contracted: '#0ea5e9',
  pws: '#7c3aed',
  onboarding: '#d97706',
  live: '#16a34a',
  churned: '#dc2626',
}

function stageDot(stage) {
  const s = (stage || '').toLowerCase()
  for (const key of Object.keys(STAGE_DOT)) if (s.includes(key)) return STAGE_DOT[key]
  return TEXT_FAINT
}

// MTD is bold; every other column is body text. `sep` draws a vertical divider on a
// column's left edge (after MTD, and between D-3 and M-1). `lav` fills the month
// columns (M-1/M-2) with a light lavender wash.
const COLS = [
  { k: 'mtd', label: 'MTD', bold: true },
  { k: 'ent', label: 'ENT', sep: true },
  { k: 'mid', label: 'MID' },
  { k: 'smb', label: 'SMB' },
  { k: 'd1', label: 'D-1', sep: true },
  { k: 'd2', label: 'D-2' },
  { k: 'd3', label: 'D-3' },
  { k: 'm1', label: 'M-1', sep: true, lav: true },
  { k: 'm2', label: 'M-2', lav: true },
]

// ─── Partials ───────────────────────────────────────────────────────────────

function kpiCard(label, value, sub, labelColor, width, valueAside) {
  return `
    <td width="${width}" valign="top" style="padding:6px;">
      <div style="background:${CARD_BG}; border:1px solid ${BORDER}; border-radius:12px; padding:18px 20px;">
        <div style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:${labelColor};">${label}</div>
        <div style="font-size:34px; font-weight:800; color:${TEXT_DARK}; line-height:1.1; margin-top:10px;">${value}${valueAside ? `<span style="font-size:15px; font-weight:700; color:${TEXT_MUTED}; margin-left:9px;">${valueAside}</span>` : ''}</div>
        ${sub ? `<div style="font-size:13px; color:${TEXT_MUTED}; margin-top:7px;">${sub}</div>` : ''}
      </div>
    </td>`
}

function kpiRow(cards) {
  return `
    <tr><td style="padding-top:2px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cards.join('')}</tr></table>
    </td></tr>`
}

function sectionTitle(title, subtitle, color) {
  return `
    <tr>
      <td style="padding:44px 0 14px;">
        <table cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="4" valign="top" style="background:${color}; border-radius:2px; font-size:0; line-height:0;">&nbsp;</td>
            <td style="padding-left:13px;">
              <div style="font-size:19px; font-weight:800; color:${TEXT_DARK}; line-height:1.2;">${title}</div>
              ${subtitle ? `<div style="font-size:13px; color:${TEXT_MUTED}; margin-top:3px;">${subtitle}</div>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>`
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Escape, then turn **x** into upright (non-italic) bold — used inside the italic
// commentary box. Guards against any stray HTML in model output.
function mdBoldToHtml(text) {
  return escapeHtml(text).replace(
    /\*\*(.+?)\*\*/g,
    `<strong style="font-style:normal; color:${TEXT_DARK};">$1</strong>`,
  )
}

// A vertical list of italic bullets (one <tr> per point).
function bulletList(points) {
  if (!points.length) return ''
  const rows = points
    .map(
      (p) => `
        <tr>
          <td valign="top" style="width:12px; padding:0 6px 8px 0; font-size:14px; color:${TEXT_BODY}; line-height:1.5;">&bull;</td>
          <td style="padding:0 0 8px 0; font-size:14px; font-style:italic; color:${TEXT_BODY}; line-height:1.5;">${mdBoldToHtml(p)}</td>
        </tr>`,
    )
    .join('')
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`
}

// Commentary box with a colored left bar: bullet points split across two left-aligned
// columns (first half left, remainder right).
function calloutBox(points, color) {
  const mid = Math.ceil(points.length / 2)
  const left = points.slice(0, mid)
  const right = points.slice(mid)
  return `
    <tr><td style="padding-bottom:14px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
             style="background:${CALLOUT_BG}; border-radius:8px; border-left:4px solid ${color}; border-collapse:separate;">
        <tr><td style="padding:14px 18px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="50%" valign="top" style="padding-right:18px;">${bulletList(left)}</td>
              <td width="50%" valign="top">${bulletList(right)}</td>
            </tr>
          </table>
        </td></tr>
      </table>
    </td></tr>`
}

// A metric matrix: leftmost "Metric" column + the 9 MTD..M-2 value columns.
// `rows` is [{ label, sub?, cols: { mtd, ent, ..., m2 } }].
function metricTable(rows) {
  const thBase = `padding:11px 10px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; white-space:nowrap; border-bottom:1px solid ${BORDER};`
  const headers = `<tr>
    <th style="${thBase} text-align:left; color:${TEXT_MUTED};">Metric</th>
    ${COLS.map(
      (c) =>
        `<th style="${thBase} text-align:right; color:${TEXT_MUTED}; ${c.lav ? `background:${LAVENDER};` : ''} ${c.sep ? `border-left:1px solid ${BORDER};` : ''}">${c.label}</th>`,
    ).join('')}
  </tr>`

  const body = rows
    .map((r, i) => {
      const bg = i % 2 === 0 ? CARD_BG : '#fafafa'
      const labelCell = `<td style="padding:13px 10px; text-align:left; border-bottom:1px solid ${ROW_BORDER};">
        <div style="font-size:13px; font-weight:700; color:${TEXT_DARK};">${r.label}</div>
        ${r.sub ? `<div style="font-size:11px; color:${TEXT_MUTED}; margin-top:1px;">${r.sub}</div>` : ''}
      </td>`
      const valueCells = COLS.map((c) => {
        const weight = c.bold ? `font-weight:700; color:${TEXT_DARK};` : `color:${TEXT_BODY};`
        const fill = c.lav ? `background:${LAVENDER};` : ''
        return `<td style="padding:13px 10px; font-size:13px; ${weight} ${fill} text-align:right; white-space:nowrap; border-bottom:1px solid ${ROW_BORDER}; ${c.sep ? `border-left:1px solid ${BORDER};` : ''}">${r.cols[c.k]}</td>`
      }).join('')
      return `<tr style="background:${bg};">${labelCell}${valueCells}</tr>`
    })
    .join('')

  const empty = `<tr><td colspan="10" style="padding:16px; text-align:center; color:${TEXT_MUTED}; font-size:13px;">No data</td></tr>`

  return `
    <tr><td>
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
             style="background:${CARD_BG}; border:1px solid ${BORDER}; border-radius:12px; overflow:hidden; border-collapse:separate; border-spacing:0;">
        ${headers}
        ${body || empty}
      </table>
    </td></tr>`
}

function tableSection(title, subtitle, color, rows, kpiRowHtml = '') {
  // Insights/commentary callout removed. `kpiRowHtml` (optional, Images only) renders a
  // row of KPI cards between the heading and the metric table.
  return `${sectionTitle(title, subtitle, color)}${kpiRowHtml}${metricTable(rows)}`
}

// The lifecycle funnel: Stage (colored dot) · Accounts · Rooftops · Active · ARR.
// `rows` is lifecycleFunnel() output (Contracted ⊇ PWS/Onboarding/Live, no Total row).
function funnelTable(rows) {
  const thBase = `padding:12px 16px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:${TEXT_MUTED}; white-space:nowrap; border-bottom:1px solid ${BORDER};`
  const headers = `<tr>
    <th style="${thBase} text-align:left;">Stage</th>
    <th style="${thBase} text-align:right;">Accounts</th>
    <th style="${thBase} text-align:right;">Rooftops</th>
    <th style="${thBase} text-align:right;">Active Rooftops</th>
    <th style="${thBase} text-align:right;">ARR</th>
  </tr>`

  const cellBase = `padding:15px 16px; border-bottom:1px solid ${ROW_BORDER}; white-space:nowrap;`
  const body = rows
    .map((r, i) => {
      const bg = i % 2 === 0 ? CARD_BG : '#fafafa'
      const dot = stageDot(r.stage)
      return `<tr style="background:${bg};">
        <td style="${cellBase} text-align:left; font-size:15px; font-weight:700; color:${TEXT_DARK};">
          <span style="color:${dot}; font-size:13px;">&#9679;</span>&nbsp;&nbsp;${r.stage}
        </td>
        <td style="${cellBase} text-align:right; font-size:15px; color:${TEXT_BODY};">${fmtInt(r.accounts)}</td>
        <td style="${cellBase} text-align:right; font-size:15px; color:${TEXT_BODY};">${fmtInt(r.rooftops)}</td>
        <td style="${cellBase} text-align:right; font-size:15px; color:${TEXT_BODY};">${fmtInt(r.active)}</td>
        <td style="${cellBase} text-align:right; font-size:15px; font-weight:700; color:${TEXT_DARK};">${fmtMoneyCompact(r.arr)}</td>
      </tr>`
    })
    .join('')

  const empty = `<tr><td colspan="5" style="padding:16px; text-align:center; color:${TEXT_MUTED}; font-size:13px;">No data</td></tr>`

  return `
    <tr><td>
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
             style="background:${CARD_BG}; border:1px solid ${BORDER}; border-radius:12px; overflow:hidden; border-collapse:separate; border-spacing:0;">
        ${headers}
        ${body || empty}
      </table>
    </td></tr>`
}

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * @param {object}  data
 * @param {Array}   data.funnel      lifecycleFunnel() result [{ stage, accounts, rooftops, active, arr }]
 * @param {object}  data.planCounts  { lite, pro, others, total, liteArr, proArr, othersArr }
 * @param {Array}   data.images      [{ label, sub?, cols }] rows for the Images table
 * @param {Array}   data.three60     [{ label, sub?, cols }] rows for the 360 table
 * @param {Array}   data.video       [{ label, sub?, cols }] rows for the Video table
 * @param {Array}   data.adoption    [{ label, cols }] rows for the Adoption table
 * @returns {string} full HTML email string
 */
export function buildStudioHealthHtml({ funnel, planCounts, images, three60, video, adoption, imagesKpis, slack = false }) {
  const dateLabel = new Date().toLocaleDateString('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  // KPI cards for the Images section (omitted if KPIs unavailable). The Slack JPEG drops
  // the metric table, so it shows 4 cards (incl. rolling-30 metrics); the email keeps its
  // 3 current-snapshot cards above the table.
  const fmtPct1 = (v) => (v == null ? '—' : `${Math.round(v)}%`)
  const fmtHrs1 = (v) => (v == null ? '—' : String(Math.round(v)))
  // Share-of-total: one decimal when under 1% so a tiny share doesn't collapse to "0%".
  const pctOfTotal = (v, total) => {
    if (!total) return '0%'
    const p = (v / total) * 100
    return p > 0 && p < 1 ? `${p.toFixed(1)}%` : `${Math.round(p)}%`
  }
  let imagesKpiRow = ''
  if (imagesKpis && slack) {
    // The 3 current-snapshot cards (same as the email) + a second row of 3 new cards
    // (Total Pendency + the two rolling-30 metrics). Grey sublines give each card context.
    const k = imagesKpis
    imagesKpiRow =
      kpiRow([
        kpiCard('VINs Delivered', fmtInt(k.delivered), 'Total', '#16a34a', '33.33%'),
        kpiCard('Delivered &gt; 6 hrs', fmtInt(k.deliveredOver6h), `${pctOfTotal(k.deliveredOver6h, k.delivered)} of total`, '#d97706', '33.34%'),
        kpiCard('Pendency &gt; 6 hrs', fmtInt(k.pendencyOver6h), `${pctOfTotal(k.pendencyOver6h, k.pendencyTotal)} of total pendency`, '#dc2626', '33.33%'),
      ]) +
      kpiRow([
        kpiCard('Total Pendency', fmtInt(k.pendencyTotal), `${pctOfTotal(k.pendencyTotal, k.delivered + k.pendencyTotal)} of total`, '#dc2626', '33.33%'),
        kpiCard('Delivered &lt; 6 hrs %', fmtPct1(k.deliveredUnder6hPct30), 'Rolling 30', '#16a34a', '33.34%'),
        kpiCard('P95 Delivery', fmtHrs1(k.p95Delivery30), 'Rolling 30', '#d97706', '33.33%', 'hrs'),
      ])
  } else if (imagesKpis) {
    imagesKpiRow = kpiRow([
      kpiCard('VINs Delivered', fmtInt(imagesKpis.delivered), '', '#16a34a', '33.33%'),
      kpiCard('Delivered &gt; 6 hrs', fmtInt(imagesKpis.deliveredOver6h), '', '#d97706', '33.34%'),
      kpiCard('Pendency &gt; 6 hrs', fmtInt(imagesKpis.pendencyOver6h), '', '#dc2626', '33.33%'),
    ])
  }

  const planRow = kpiRow([
    kpiCard('Studio-Lite', fmtInt(planCounts.lite), `${pct(planCounts.lite, planCounts.total)} of Live Rooftops`, '#0284c7', '33.33%', `${fmtMoneyCompact(planCounts.liteArr)} ARR`),
    kpiCard('Studio-Pro', fmtInt(planCounts.pro), `${pct(planCounts.pro, planCounts.total)} of Live Rooftops`, '#16a34a', '33.34%', `${fmtMoneyCompact(planCounts.proArr)} ARR`),
    kpiCard('Studio-Others', fmtInt(planCounts.others), `${pct(planCounts.others, planCounts.total)} of Live Rooftops`, '#64748b', '33.33%', `${fmtMoneyCompact(planCounts.othersArr)} ARR`),
  ])

  const dashboardUrl =(process.env.STUDIO_HEALTH_DASHBOARD_URL || 'https://analytics.spyne.ai/studio').replace(/\/$/, '')
  const ctaHtml = dashboardUrl
    ? `
    <tr>
      <td style="padding:32px 0 8px; text-align:center;">
        <a href="${dashboardUrl}" target="_blank" rel="noopener noreferrer"
           style="display:inline-block; background:${PILL_BG}; color:#fff; font-size:14px; font-weight:600;
                  text-decoration:none; padding:12px 32px; border-radius:8px; letter-spacing:0.02em;">
          View Dashboard
        </a>
      </td>
    </tr>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Studio Health Report — ${dateLabel}</title>
</head>
<body style="margin:0; padding:0; background:${PAGE_BG}; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAGE_BG}; padding:28px 0;">
    <tr>
      <td align="center">

        <table width="800" cellpadding="0" cellspacing="0" border="0" style="max-width:800px; width:100%;">

          <!-- Header -->
          <tr>
            <td style="border-top:2px solid ${TEXT_DARK}; padding:18px 4px 8px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size:12px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:${EYEBROW};">
                    Studio · Daily
                  </td>
                  <td align="right">
                    <span style="display:inline-block; background:${PILL_BG}; color:#fff; font-size:11px; font-weight:700; letter-spacing:0.08em; padding:6px 14px; border-radius:999px;">STUDIO</span>
                  </td>
                </tr>
              </table>
              <div style="font-size:32px; font-weight:800; color:${TEXT_DARK}; line-height:1.15; margin-top:8px;">Studio Health Report</div>
              <div style="font-size:15px; color:${TEXT_MUTED}; margin-top:6px;">${dateLabel}</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:4px 4px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">

                ${sectionTitle('Funnel — Contracted → Live', 'Accounts · Rooftops · ARR per lifecycle stage', SEC.funnel)}
                ${funnelTable(funnel)}

                ${sectionTitle('Plan', `Rooftops by plan tier · share of <strong style="color:${TEXT_DARK}; font-weight:700;">${fmtInt(planCounts.total)} Live rooftops</strong>`, SEC.plan)}
                ${planRow}

                ${slack
                  ? `${sectionTitle('Images', 'Delivery health — snapshot &amp; rolling 30d', SEC.images)}${imagesKpiRow}`
                  : tableSection('Images', 'Delivery health across segments & trend', SEC.images, images, imagesKpiRow)}
                ${tableSection('360', 'Delivery health across segments & trend', SEC.three60, three60)}
                ${tableSection('Video', 'Delivery health across segments & trend', SEC.video, video)}
                ${tableSection('Adoption', 'Adoption % across segments & trend', SEC.adoption, adoption)}

                ${ctaHtml}

              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`
}
