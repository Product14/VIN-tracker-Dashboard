// ─── Studio Health Report — Executive Board (single-screen, fit-to-display) ───
// A browser-viewable, single-glance executive layout of the same Studio Health
// Report data. NOT an email — it uses a real <style> block + CSS grid so the six
// segments tile cleanly on screen, but it borrows the EXACT design system of the
// email template (studioHealthTemplate.js): light page, eyebrow + pill header,
// colored section bars, the MTD..M-2 metric matrix (bold MTD, lavender month
// columns), and the lifecycle funnel table.
//
// Layout (designed at a fixed ~16:9 logical canvas, then scaled to fit any screen):
//   Row 1 (HERO, no cards, divided off from the rest):
//     Col 1 — Funnel — Contracted → Live  (heading + bare table, no byline, no card)
//     Col 2 — Plan                        (heading + 3 KPI cards, no card)
//   ── divider ──
//   Rows 2–3 (carded panels):  Images · Video  |  360 · Adoption
//
// FIT-TO-SCREEN: the whole canvas (#fitwrap) is scaled with a CSS transform to fill
// the viewport in both dimensions — no scroll, gaps/proportions preserved exactly,
// scaling up on large LED/studio displays and down on laptops. Falls back to a normal
// scrollable single column on narrow/portrait screens (phones).
//
// The numbers are live: the handler re-fetches the three sheet tabs on each request.
// The "Refresh" button forces a no-cache re-fetch; an hourly Vercel cron keeps the
// edge cache warm. All figures come straight from buildStudioHealthPayload.

import { fmtInt, pct, fmtMoneyCompact } from './format.js'

// ─── Design tokens (identical to the email template) ──────────────────────────
const PAGE_BG = '#f4f4f5'
const CARD_BG = '#ffffff'
const BORDER = '#e5e7eb'
const ROW_BORDER = '#f1f1f4'
const TEXT_DARK = '#111827'
const TEXT_BODY = '#374151'
const TEXT_MUTED = '#6b7280'
const PILL_BG = '#1c1c1e'
const LAVENDER = '#f5f3ff'

const SEC = {
  funnel: '#2563eb',
  plan: '#0ea5e9',
  images: '#16a34a',
  three60: '#d97706',
  video: '#db2777',
  adoption: '#4f46e5',
}

// Lifecycle-stage dot colors for the funnel (substring match → label variants resolve).
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
  return '#9ca3af'
}

// Plan-tier accent colors — reuse the exact email KPI label colors.
const PLAN_TIER = [
  { key: 'lite', label: 'Studio-Lite', color: '#0284c7' },
  { key: 'pro', label: 'Studio-Pro', color: '#16a34a' },
  { key: 'others', label: 'Studio-Others', color: '#64748b' },
]

// Metric matrix columns: MTD bold; `sep` draws a left divider; `lav` washes the month cells.
const COLS = [
  { k: 'mtd', label: 'MTD', cls: 'c-mtd' },
  { k: 'ent', label: 'ENT', cls: 'c-sep' },
  { k: 'mid', label: 'MID' },
  { k: 'smb', label: 'SMB' },
  { k: 'd1', label: 'D-1', cls: 'c-sep' },
  { k: 'd2', label: 'D-2' },
  { k: 'd3', label: 'D-3' },
  { k: 'm1', label: 'M-1', cls: 'c-sep c-lav' },
  { k: 'm2', label: 'M-2', cls: 'c-lav' },
]

// ─── Small helpers ────────────────────────────────────────────────────────────
// Section heading: colored bar + title + optional byline. `lg` enlarges it slightly
// for the hero row so Row 1 reads as the summary tier.
function sectionHead(title, subtitle, color, lg) {
  return `
    <header class="sec-head${lg ? ' sec-head-lg' : ''}">
      <span class="sec-bar" style="background:${color};"></span>
      <div>
        <div class="sec-title">${title}</div>
        ${subtitle ? `<div class="sec-sub">${subtitle}</div>` : ''}
      </div>
    </header>`
}

// A carded panel (used for rows 2–3): heading + body inside a white card.
function panel(title, subtitle, color, body) {
  return `
    <section class="panel">
      ${sectionHead(title, subtitle, color)}
      <div class="panel-body">${body}</div>
    </section>`
}

// ─── Funnel table (Col 1 · Row 1) ─────────────────────────────────────────────
function funnelTable(rows) {
  const body = rows
    .map(
      (r) => `
        <tr>
          <td class="lead"><span class="dot" style="background:${stageDot(r.stage)};"></span>${r.stage}</td>
          <td class="num">${fmtInt(r.accounts)}</td>
          <td class="num">${fmtInt(r.rooftops)}</td>
          <td class="num">${fmtInt(r.active)}</td>
          <td class="num strong">${fmtMoneyCompact(r.arr)}</td>
        </tr>`,
    )
    .join('')
  return `
    <table class="grid-table funnel">
      <thead>
        <tr>
          <th class="l">Stage</th><th class="r">Accounts</th><th class="r">Rooftops</th>
          <th class="r">Active Rooftops</th><th class="r">ARR</th>
        </tr>
      </thead>
      <tbody>${body || `<tr><td colspan="5" class="empty">No data</td></tr>`}</tbody>
    </table>`
}

// ─── Plan KPI cards (Col 2 · Row 1) ───────────────────────────────────────────
// The same three KPI cards as the daily email: colored tier label, big count with
// an ARR aside, and "% of Live Rooftops" sub.
function kpiCard(label, value, sub, color, aside) {
  return `
    <div class="kpi">
      <div class="kpi-label" style="color:${color};">${label}</div>
      <div class="kpi-value">${value}${aside ? `<span class="kpi-aside">${aside}</span>` : ''}</div>
      ${sub ? `<div class="kpi-sub">${sub}</div>` : ''}
    </div>`
}

function planKpis(plan) {
  return PLAN_TIER.map((t) =>
    kpiCard(
      t.label,
      fmtInt(plan[t.key]),
      `${pct(plan[t.key], plan.total)} of Live Rooftops`,
      t.color,
      `${fmtMoneyCompact(plan[`${t.key}Arr`])} ARR`,
    ),
  ).join('')
}

// ─── Metric matrix (Images / 360 / Video / Adoption) ──────────────────────────
function metricTable(rows) {
  const headers = `<tr>
    <th class="l">Metric</th>
    ${COLS.map((c) => `<th class="r ${c.cls || ''}">${c.label}</th>`).join('')}
  </tr>`
  const body = rows
    .map((r) => {
      const cells = COLS.map((c) => `<td class="r ${c.cls || ''}">${r.cols[c.k]}</td>`).join('')
      return `<tr>
        <td class="metric"><span class="m-label">${r.label}</span>${r.sub ? `<span class="m-sub">${r.sub}</span>` : ''}</td>
        ${cells}
      </tr>`
    })
    .join('')
  return `
    <table class="grid-table matrix">
      <thead>${headers}</thead>
      <tbody>${body || `<tr><td colspan="10" class="empty">No data</td></tr>`}</tbody>
    </table>`
}

function metricPanel(title, subtitle, color, rows) {
  return panel(title, subtitle, color, metricTable(rows))
}

// ─── Main builder ─────────────────────────────────────────────────────────────
/**
 * @param {object} data  Same payload as buildStudioHealthHtml:
 *   { funnel, planCounts, images, three60, video, adoption, commentary }
 * @returns {string} full HTML page
 */
export function buildStudioHealthBoardHtml({
  funnel,
  planCounts,
  images,
  three60,
  video,
  adoption,
}) {
  const now = new Date()
  const dateLabel = now.toLocaleDateString('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const stamp = now.toLocaleString('en-US', {
    timeZone: 'Asia/Kolkata',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  const dashboardUrl = (process.env.STUDIO_HEALTH_DASHBOARD_URL || 'https://analytics.spyne.ai/studio').replace(/\/$/, '')

  // Unified 2×3 grid of panels, row-major order:
  //   Plan     | Images
  //   Funnel   | 360
  //   Adoption | Video
  // Plan: bare heading (no card) + 3 separate KPI boxes.
  const planCell = `
    <div class="plan-cell">
      ${sectionHead('Plan', `${fmtInt(planCounts.total)} Live rooftops`, SEC.plan)}
      <div class="kpi-row">${planKpis(planCounts)}</div>
    </div>`
  const boardHtml = `
    ${planCell}
    ${metricPanel('Images', 'Delivery health across segments & trend', SEC.images, images)}
    ${panel('Funnel — Contracted → Live', '', SEC.funnel, funnelTable(funnel))}
    ${metricPanel('360', 'Delivery health across segments & trend', SEC.three60, three60)}
    ${metricPanel('Adoption', '', SEC.adoption, adoption)}
    ${metricPanel('Video', 'Delivery health across segments & trend', SEC.video, video)}`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Studio Health Report — ${dateLabel}</title>
  <!-- Detect iframe embedding ASAP (before paint) so the embedded styles apply with no flash. -->
  <script>try{if(window.self!==window.top)document.documentElement.classList.add('embedded')}catch(e){document.documentElement.classList.add('embedded')}</script>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      margin: 0; background: ${PAGE_BG}; color: ${TEXT_DARK}; overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    /* Fluid full-viewport canvas: fills the whole screen WIDTH (thin side margin)
       and HEIGHT (no scroll). Pure CSS flexbox — no JS transform — so it is robust
       on TV / set-top browsers. Sections flex to fill; tables stretch to fill. */
    .wrap { height: 100vh; width: 100%; padding: 10px 14px; display: flex; flex-direction: column; }

    /* Header */
    .topline { flex: 0 0 auto; display: flex; justify-content: space-between; align-items: center; gap: 24px; }
    h1 { font-size: 25px; font-weight: 800; line-height: 1.1; margin: 0; }
    .date { font-size: 13px; color: ${TEXT_MUTED}; margin-top: 3px; }
    .head-right { display: flex; flex-direction: column; align-items: flex-end; gap: 7px; }
    .refresh-btn { display: inline-flex; align-items: center; gap: 7px; background: ${CARD_BG}; color: ${TEXT_DARK}; border: 1px solid ${BORDER}; border-radius: 8px; padding: 7px 14px; font-size: 12.5px; font-weight: 600; cursor: pointer; box-shadow: 0 1px 2px rgba(17,24,39,0.05); transition: background .15s, border-color .15s; }
    .refresh-btn:hover { background: #fafafa; border-color: #d1d5db; }
    .refresh-btn:disabled { cursor: default; opacity: .7; }
    .rf-icon { font-size: 14px; line-height: 1; display: inline-block; }
    .refresh-btn.spin .rf-icon { animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .stamp { font-size: 11.5px; color: ${TEXT_MUTED}; }

    /* Section heading (shared by hero + panels) */
    .sec-head { flex: 0 0 auto; display: flex; gap: 10px; align-items: flex-start; margin-bottom: 6px; }
    .sec-bar { flex: 0 0 4px; align-self: stretch; min-height: 26px; border-radius: 2px; }
    .sec-title { font-size: 15px; font-weight: 800; line-height: 1.2; }
    .sec-sub { font-size: 11.5px; color: ${TEXT_MUTED}; margin-top: 1px; }
    .sec-head-lg .sec-bar { min-height: 32px; flex-basis: 5px; }
    .sec-head-lg .sec-title { font-size: 17px; }
    .sec-head-lg .sec-sub { font-size: 12px; font-weight: 600; color: ${TEXT_BODY}; }

    /* Unified 2×3 grid of carded panels (Plan|Images · Funnel|360 · Adoption|Video).
       minmax(0,1fr) lets rows shrink below content so tables compress instead of clipping. */
    .board { flex: 1 1 auto; min-height: 0; margin-top: 8px; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: repeat(3, minmax(0, 1fr)); gap: 6px; }

    .panel { background: ${CARD_BG}; border: 1px solid ${BORDER}; border-radius: 12px; padding: 10px 14px; display: flex; flex-direction: column; min-height: 0; overflow: hidden; box-shadow: 0 1px 2px rgba(17,24,39,0.04); }
    .panel-body { flex: 1 1 auto; min-height: 0; }
    .panel-body > .grid-table { height: 100%; }

    /* Plan cell: bare (no card) heading + a row of 3 separate KPI boxes filling the cell */
    .plan-cell { display: flex; flex-direction: column; min-height: 0; }
    .plan-cell .kpi-row { flex: 1 1 auto; min-height: 0; }
    .plan-cell .sec-sub { font-weight: 700; color: ${TEXT_DARK}; }

    /* KPI boxes (Plan) — 3 separate cards */
    .kpi-row { display: flex; gap: 6px; width: 100%; align-items: stretch; }
    .kpi { flex: 1 1 0; background: ${CARD_BG}; border: 1px solid ${BORDER}; border-radius: 12px; padding: 14px 18px; display: flex; flex-direction: column; justify-content: center; box-shadow: 0 1px 2px rgba(17,24,39,0.04); }
    .kpi-label { font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .kpi-value { font-size: 60px; font-weight: 800; color: ${TEXT_DARK}; line-height: 1.0; margin-top: 10px; white-space: nowrap; }
    .kpi-aside { font-size: 16px; font-weight: 700; color: ${TEXT_MUTED}; margin-left: 9px; }
    .kpi-sub { font-size: 17px; color: ${TEXT_MUTED}; margin-top: 10px; }

    /* Shared table — width:100% fills the column; height:100% stretches the rows to fill the panel */
    .grid-table { width: 100%; height: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid ${BORDER}; border-radius: 11px; overflow: hidden; background: ${CARD_BG}; }
    .grid-table th { font-size: 12.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; color: ${TEXT_MUTED}; padding: 6px 9px; white-space: nowrap; border-bottom: 1px solid ${BORDER}; background: ${CARD_BG}; }
    .grid-table td { padding: 6px 9px; font-size: 15px; vertical-align: middle; border-bottom: 1px solid ${ROW_BORDER}; white-space: nowrap; color: ${TEXT_BODY}; }
    .grid-table tbody tr:last-child td { border-bottom: 0; }
    .grid-table tbody tr:nth-child(even) td { background: #fafafa; }
    .grid-table th.l, .grid-table td.l, .grid-table td.lead, .grid-table td.metric { text-align: left; }
    .grid-table th.r, .grid-table td.num, .grid-table td.r { text-align: right; }
    .grid-table td.strong, .grid-table td.num.strong { font-weight: 700; color: ${TEXT_DARK}; }

    /* Funnel table — numeric columns center-aligned (header + cells); Stage stays left */
    .funnel th, .funnel td { padding: 9px 14px; font-size: 16.5px; }
    .funnel td.lead { font-weight: 700; color: ${TEXT_DARK}; }
    .funnel th.r, .funnel td.num { text-align: center; }
    .dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 9px; vertical-align: middle; }

    /* Metric matrix specifics — numeric columns centered. The Metric (first) column is a
       fixed width with large label text sized so the longest label ("P95 Delivery Time
       (hrs)") fills the cell; every label shares that size for consistency. Height is
       unaffected (rows stretch to fill the panel), so this never adds vertical scroll. */
    .matrix { table-layout: fixed; }
    .matrix th.l, .matrix td.metric { width: 34%; }
    .matrix th.r, .matrix td.r { text-align: center; }
    .matrix td.metric .m-label { display: block; font-size: 24px; font-weight: 700; color: ${TEXT_DARK}; line-height: 1.15; }
    .matrix td.metric .m-sub { display: block; font-size: 14px; color: ${TEXT_MUTED}; margin-top: 1px; }
    .matrix td.c-mtd, .matrix th.c-mtd { font-weight: 700; color: ${TEXT_DARK}; }
    .matrix .c-sep { border-left: 1px solid ${BORDER}; }
    .matrix .c-lav { background: ${LAVENDER}; }
    .matrix tbody tr:nth-child(even) td.c-lav { background: #efeafe; }

    .empty { text-align: center; color: ${TEXT_MUTED}; padding: 14px; }

    /* Footer — small, centered View Dashboard button pinned to the bottom so the
       data fills the rest of the page above it */
    .foot { flex: 0 0 auto; display: flex; align-items: center; justify-content: center; margin-top: 8px; }
    .cta { display: inline-block; background: ${PILL_BG}; color: #fff; font-size: 11.5px; font-weight: 600; text-decoration: none; padding: 5px 20px; border-radius: 7px; letter-spacing: 0.02em; }

    /* ── Narrow / portrait fallback (phones): single column, scroll normally ── */
    @media (max-width: 820px) {
      body { overflow: auto; }
      .wrap { height: auto; }
      .board { grid-template-columns: 1fr; grid-template-rows: auto; }
      .panel-body > .grid-table { height: auto; }
      .plan-cell .kpi-row { flex: 0 0 auto; }
      .kpi-row { flex-wrap: wrap; }
    }
    /* ── Short-but-wide screens (e.g. 1366×768 laptops): keep 2 columns but let the
       page scroll at natural height instead of clipping. TVs/monitors (≥ ~850px tall)
       keep the single-screen fill. ── */
    @media (min-width: 821px) and (max-height: 850px) {
      body { overflow: auto; }
      .wrap { height: auto; min-height: 100vh; }
      .board { grid-template-rows: auto auto auto; }
      .panel-body > .grid-table { height: auto; }
      .plan-cell .kpi-row { flex: 0 0 auto; }
    }

    /* ── Embedded in an iframe (e.g. the vin-tracker "Studio Health" tab): render on a
       fixed 16:9-ish canvas and scale it to fit the iframe so the FULL board always
       shows — no clipping, no scroll — whatever the host screen size. The html.embedded
       rules outrank the responsive fallbacks above (higher specificity). ── */
    html.embedded, html.embedded body { width: 100%; height: 100%; overflow: hidden; background: ${PAGE_BG}; }
    html.embedded .wrap { position: absolute; top: 0; left: 0; width: 1920px; height: 960px; transform-origin: top left; }
    html.embedded .board { grid-template-columns: 1fr 1fr; grid-template-rows: repeat(3, minmax(0, 1fr)); }
    html.embedded .panel-body > .grid-table { height: 100%; }
    html.embedded .kpi-row { flex-wrap: nowrap; }
  </style>
</head>
<body>
  <div class="wrap">

    <div class="topline">
      <div>
        <h1>Studio Health Report</h1>
        <div class="date">${dateLabel}</div>
      </div>
      <div class="head-right">
        <button id="refresh" class="refresh-btn" type="button" data-label="Refresh" title="Re-fetch live numbers from the source sheet">
          <span class="rf-icon">&#8635;</span><span class="rf-text">Refresh</span>
        </button>
        <span id="stamp" class="stamp">Updated ${stamp} IST</span>
      </div>
    </div>

    <!-- 2×3 grid: Plan|Images · Funnel|360 · Adoption|Video -->
    <div id="board" class="board">${boardHtml}</div>

    <div class="foot">
      ${dashboardUrl ? `<a class="cta" href="${dashboardUrl}" target="_blank" rel="noopener noreferrer">View Dashboard</a>` : ''}
    </div>

  </div>

  <script>
    // ── Embedded (iframe): scale the fixed 1920×960 canvas to fit the iframe, centered ──
    (function () {
      if (!document.documentElement.classList.contains('embedded')) return;
      function fit() {
        var w = document.querySelector('.wrap');
        if (!w) return;
        var s = Math.min(window.innerWidth / 1920, window.innerHeight / 960);
        var x = Math.max(0, (window.innerWidth - 1920 * s) / 2);
        var y = Math.max(0, (window.innerHeight - 960 * s) / 2);
        w.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + s + ')';
      }
      window.__fitEmbed = fit;
      window.addEventListener('resize', fit);
      window.addEventListener('load', fit);
      if (document.readyState !== 'loading') fit();
      else document.addEventListener('DOMContentLoaded', fit);
    })();

    // ── Refresh: live re-fetch (no cache), swap the dynamic regions in place ──
    (function () {
      var btn = document.getElementById('refresh');
      if (!btn) return;
      var txt = btn.querySelector('.rf-text');
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        btn.disabled = true;
        btn.classList.add('spin');
        if (txt) txt.textContent = 'Refreshing…';
        var url = location.pathname + '?refresh=1&t=' + Date.now();
        fetch(url, { cache: 'no-store' })
          .then(function (r) { return r.text(); })
          .then(function (html) {
            var doc = new DOMParser().parseFromString(html, 'text/html');
            var src = doc.getElementById('board'), dst = document.getElementById('board');
            if (src && dst) dst.innerHTML = src.innerHTML;
            var s = doc.getElementById('stamp'), sd = document.getElementById('stamp');
            if (s && sd) sd.textContent = s.textContent;
          })
          .catch(function (e) { console.error('refresh failed', e); })
          .finally(function () {
            btn.disabled = false;
            btn.classList.remove('spin');
            if (txt) txt.textContent = btn.getAttribute('data-label') || 'Refresh';
          });
      });
    })();
  </script>
</body>
</html>`
}
