// ─── Daily Email Template Builder ────────────────────────────────────────────
// buildRooftopReportHtml(data, dateLabel) — per-rooftop daily delivery report
//
// Gmail-safe: all styles inline, table-based layout, no flex/grid,
// no CSS custom properties. 600px container width.

import { SPYNE_LOGO_SRC } from "./spyneLogo.js";
import { scoreColor, formatScore } from "./scoreUtil.js";

// ─── Formatters ───────────────────────────────────────────────────────────────

function n(v) {
  if (v == null) return "—";
  return Number(v).toLocaleString("en-US");
}

// Sanitise a display string — returns null for blank, "0", or "null" values
// so that filter(Boolean) correctly drops them from vehicle name assembly.
function clean(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return (s === "" || s === "0" || s === "null") ? null : s;
}

// Vehicle condition → display label. Null/blank/unknown → "Unmarked".
function condLabel(v) {
  const s = clean(v);
  if (!s) return "Unmarked";
  const l = s.toLowerCase();
  if (l === "new")  return "New";
  if (l === "used") return "Used";
  return s;
}

// "Apr 16 · 9:12 AM EDT" — tz is an IANA timezone string (e.g. "America/New_York")
function formatDt(iso, tz = "America/New_York") {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d)) return "—";
    const date = d.toLocaleString("en-US", { timeZone: tz, month: "short", day: "numeric" });
    const time = d.toLocaleString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true });
    const tzAbbr = d.toLocaleString("en-US", { timeZone: tz, timeZoneName: "short" }).split(" ").pop();
    return `${date} · ${time} ${tzAbbr}`;
  } catch { return "—"; }
}

// Dynamic duration: "Xd Yh" once it crosses a day, else "Yh Zm", else "Zm".
function formatHM(totalMins) {
  const t = Math.max(0, Math.round(Number(totalMins)));
  if (t < 60) return `${t}m`;
  const h = Math.floor(t / 60);
  if (h < 24) {
    const m = t - h * 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }
  const d = Math.floor(h / 24);
  const rh = h - d * 24;
  return rh === 0 ? `${d}d` : `${d}d ${rh}h`;
}

function formatTat(hrs) {
  if (hrs == null) return "—";
  return formatHM(Number(hrs) * 60);
}

// ─── Shared snippets ──────────────────────────────────────────────────────────

// Vertical spacer. Use when nested inside a <td> (between sibling tables).
function spacer(px) {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;"><tr><td height="${px}" style="height:${px}px;font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
}

// Row-form variants — use between sibling <tr> elements of an outer table.
// A bare <table> placed between <tr> rows is invalid HTML5 and gets
// foster-parented OUT of the parent table by browsers (Gmail tolerates it),
// which breaks the 600px-wide email layout when previewed in a browser.
function ruleRow(color = "#E5E7EB") {
  return `<tr><td style="padding:0;line-height:0;font-size:0;height:1px;background:${color};">&nbsp;</td></tr>`;
}
function spacerRow(px) {
  return `<tr><td height="${px}" style="height:${px}px;font-size:0;line-height:0;padding:0;">&nbsp;</td></tr>`;
}

// ─── Donut / chip helpers (shared by rooftop + group templates) ──────────────

const DASHBOARD_URL = (process.env.DASHBOARD_URL
  || process.env.PUBLIC_BASE_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")
).replace(/\/+$/, "");

const donutImg = ({ green = 0, blue = 0, amber = 0, total = 100, center = "", label = "" }, size = 150) => {
  // Render SVG at 3× the display size so Gmail's image proxy rasterizes at a
  // higher resolution; the <img> width/height attributes downscale to the
  // intended CSS size for crisp output on retina/3× DPI screens.
  const renderSize = size * 3;
  const qs = new URLSearchParams({
    green: String(green), blue: String(blue), amber: String(amber), total: String(total),
    center, label, w: String(renderSize),
  }).toString();
  return `<img src="${DASHBOARD_URL}/api/donut.svg?${qs}" width="${size}" height="${size}" alt="" style="display:block;width:${size}px;height:${size}px;border:0;outline:none;text-decoration:none;" />`;
};

const formatTtl = (days) => {
  if (days == null) return null;
  return formatHM(Number(days) * 24 * 60);
};

// Half-circle gauge image (hosted /api/gauge.svg). Renders at 3× for retina, like
// donutImg. Non-square (150:118), so height tracks width. Used by the Time to
// Market and Photo Score KPI cards. `value` may be null (renders without a thumb).
const gaugeImg = ({ value = null, min = 0, max = 100, t1, t2, dir = "asc", center = "", scale = "" }, size = 150) => {
  const renderW = size * 3;
  const dispH   = Math.round((size * 118) / 150);
  const params = { min: String(min), max: String(max), dir, center, scale, w: String(renderW) };
  if (value != null) params.value = String(value);
  if (t1 != null)    params.t1 = String(t1);
  if (t2 != null)    params.t2 = String(t2);
  const qs = new URLSearchParams(params).toString();
  return `<img src="${DASHBOARD_URL}/api/gauge.svg?${qs}" width="${size}" height="${dispH}" alt="" style="display:block;width:${size}px;height:${dispH}px;border:0;outline:none;text-decoration:none;" />`;
};

// ─── "Vehicles needing attention" helpers ────────────────────────────────────

// Red-tinted 44×32 thumb with an inline camera-slash SVG, used in the
// "Vehicles needing attention" rows since these VINs have no photo yet.
// Image is inlined as a data URI so it renders without any external fetch.
const noPhotoThumb = () => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23dc2626' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><rect x='3' y='5' width='18' height='14' rx='2'/><circle cx='12' cy='12' r='3'/><line x1='3' y1='3' x2='21' y2='21'/></svg>`;
  return `<div style="display:block;width:44px;height:32px;border-radius:6px;background:#fdecec;background-image:repeating-linear-gradient(135deg,#fdecec 0,#fdecec 6px,#fbe0e0 6px,#fbe0e0 12px);text-align:center;line-height:32px;font-size:0;">
    <img src="data:image/svg+xml;utf8,${svg}" width="18" height="18" alt="" style="vertical-align:middle;border:0;outline:none;" />
  </div>`;
};

// Builds the bottom "Vehicles needing attention" card for both templates.
// Returns "" when there are no rows (hide-on-empty per design).
//
//   vins             : array of {vin, dealer_vin_id, stock_number, make, model,
//                       year, trim, days_on_lot, rooftop_id, rooftop_name}
//   vinUrl           : (dealerVinId, rooftopId) => href|null
//   viewAllHref      : header "View all →" link target
//   includeRooftopCol: true → 6-column layout with Rooftop column (group view)
//   titleSuffix      : "" for rooftop, " (group)" for group
const buildNeedsAttentionSection = ({ vins, vinUrl, viewAllHref, includeRooftopCol, titleSuffix = "", showCondition = false, avgAgeing = null }) => {
  if (!vins || vins.length === 0) return "";

  const rowsHtml = vins.slice(0, 5).map((v) => {
    const vehicleName = [clean(v.year), clean(v.make), clean(v.model)].filter(Boolean).join(" ") || "—";
    const trimLine    = showCondition ? condLabel(v.condition) : clean(v.trim);
    const stockLine   = clean(v.stock_number);
    const days        = v.days_on_lot != null ? Number(v.days_on_lot) : null;
    const ageLabel    = days != null ? `${days} day${days === 1 ? "" : "s"}` : "—";
    const vUrl        = (includeRooftopCol ? vinUrl(v.dealer_vin_id, v.rooftop_id) : vinUrl(v.dealer_vin_id)) || "#";
    const rowBorder   = "border-top:1px solid #e7e9ee;";
    const rooftopCell = includeRooftopCol
      ? `<td style="padding:10px 10px 10px 0;vertical-align:middle;${rowBorder}font-size:11.5px;color:#5b6577;font-weight:500;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${v.rooftop_name || ""}</td>`
      : "";
    return `
      <tr>
        <td class="rv-cell" style="padding:10px 10px 10px 0;vertical-align:middle;${rowBorder}">${noPhotoThumb()}</td>
        <td class="rv-cell" style="padding:10px 10px 10px 0;vertical-align:middle;${rowBorder}font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;overflow:hidden;">
          <div class="rv-name" style="font-size:12.5px;font-weight:600;color:#0c1322;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${vehicleName}${trimLine ? ` <span style="color:#98a0ad;font-weight:500;">&middot; ${trimLine}</span>` : ""}</div>
          <div class="rv-sub" style="font-size:10.5px;color:#98a0ad;margin-top:1px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${v.vin || ""}${stockLine ? ` &middot; #${stockLine}` : ""}</div>
        </td>
        ${rooftopCell}
        <td class="rv-cell" style="padding:10px 10px 10px 0;vertical-align:middle;${rowBorder}white-space:nowrap;">
          <span class="rv-pill" style="display:inline-block;padding:3px 8px;border-radius:999px;background:#fdecec;color:#dc2626;font-size:11px;font-weight:700;letter-spacing:0.2px;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">${ageLabel}</span>
        </td>
        <td class="rv-cell" style="padding:10px 10px 10px 0;vertical-align:middle;${rowBorder}white-space:nowrap;">
          <span class="rv-pill" style="display:inline-block;padding:3px 8px 3px 7px;border-radius:999px;background:#fdecec;color:#dc2626;font-size:11px;font-weight:700;letter-spacing:0.2px;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">&#9679;&nbsp;No photos</span>
        </td>
        <td style="padding:10px 0;vertical-align:middle;${rowBorder}text-align:right;white-space:nowrap;">
          <a href="${vUrl}" style="font-size:11px;font-weight:600;color:#2f6bff;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">View &rarr;</a>
        </td>
      </tr>`;
  }).join("\n");

  // Column widths live on the header cells (not the colgroup) so the mobile @media
  // can shrink the metric columns reliably (Gmail honors cell-width overrides; it
  // renders <col>-width overrides unreliably). With table-layout:fixed the first
  // row's cell widths define the columns, so desktop is unchanged.
  const cols = includeRooftopCol
    ? `<col /><col /><col /><col /><col /><col />`
    : `<col /><col /><col /><col /><col />`;
  const HFONT = "font-size:9.5px;letter-spacing:0.8px;text-transform:uppercase;color:#98a0ad;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;";
  const headerCells = `
    <td class="rv-th-thumb" style="width:56px;padding:4px 10px 8px 0;border-bottom:1px solid #e7e9ee;"></td>
    <td class="rv-hdr" style="padding:4px 10px 8px 0;border-bottom:1px solid #e7e9ee;${HFONT}">Vehicle</td>
    ${includeRooftopCol ? `<td class="rv-hdr" style="width:24%;padding:4px 10px 8px 0;border-bottom:1px solid #e7e9ee;${HFONT}">Rooftop</td>` : ""}
    <td class="rv-hdr rv-th-age" style="width:90px;padding:4px 10px 8px 0;border-bottom:1px solid #e7e9ee;${HFONT}">Ageing</td>
    <td class="rv-hdr rv-th-status" style="width:130px;padding:4px 10px 8px 0;border-bottom:1px solid #e7e9ee;${HFONT}">Status</td>
    <td class="rv-th-view" style="width:60px;padding:4px 0 8px;border-bottom:1px solid #e7e9ee;"></td>`;

  return `
    <tr><td style="height:14px;font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr>
      <td style="background:#FFFFFF;border:1px solid #e7e9ee;border-radius:14px;padding:14px 16px 8px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;margin-bottom:8px;">
          <tr>
            <td valign="middle" style="vertical-align:middle;font-size:11px;letter-spacing:0.8px;text-transform:uppercase;color:#5b6577;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">Vehicles Needing Attention &middot; Highest risk${titleSuffix}</td>
            <td align="right" valign="middle" style="vertical-align:middle;text-align:right;white-space:nowrap;">
              ${avgAgeing != null ? `<span style="display:inline-block;background:#fdecec;border:1px solid #f5c5c5;color:#b91c1c;padding:3px 10px;border-radius:999px;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;margin-right:10px;vertical-align:middle;"><span style="font-size:9px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;">Avg ageing</span> <span style="font-size:12.5px;font-weight:800;letter-spacing:-0.2px;">${Math.round(avgAgeing)}<span style="font-size:10px;font-weight:600;">d</span></span></span>` : ""}
              <a href="${viewAllHref}" style="font-size:11px;font-weight:600;color:#2f6bff;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;vertical-align:middle;">View all &rarr;</a>
            </td>
          </tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;table-layout:fixed;">
          <colgroup>${cols}</colgroup>
          <thead><tr>${headerCells}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </td>
    </tr>`;
};

// ─── Rooftop Report ───────────────────────────────────────────────────────────

/**
 * @param {object} data      – return value of computeRooftopDailyReport()
 * @param {string} dateLabel – "16 Apr 2026 (EDT)"
 * @param {string} timezone  – IANA timezone string (e.g. "America/New_York")
 */
// ─── KPI cards + glossary (shared by rooftop + group templates) ──────────────
const FONT = "-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif";

// Mobile-responsive <style> injected into both report heads. Desktop is never
// affected — every rule lives inside the max-width:600px media query, so on
// laptops/desktops the original inline/table layout renders unchanged. On phones:
// the 3 KPI cells stack full-width, and the By Location table compacts (incl.
// abbreviated headers). Kept simple (class selectors + one media query) so Gmail
// keeps the block. NOTE: these mobile tweaks require the client to honor <style>
// (Apple Mail, iOS Mail, Outlook mobile, Gmail for Google-Workspace accounts).
const RESPONSIVE_STYLE = `<style type="text/css">
@media only screen and (max-width:600px) {
  .kpi-cell { display:block !important; width:100% !important; box-sizing:border-box !important; margin:0 0 14px !important; }
  .kpi-gap  { display:none !important; }
  .body-pad { padding:14px 4px 24px !important; }
  /* Group By Location — shrink hard so all 7 columns fit a phone */
  .byloc-card { padding:12px 4px 8px !important; }
  .byloc-hdr  { padding:4px 0 6px !important; font-size:7.5px !important; letter-spacing:0 !important; }
  .byloc-cell { padding:6px 0 !important; }
  .byloc-name { font-size:10px !important; }
  .byloc-total{ font-size:10px !important; min-width:16px !important; padding:2px 3px !important; }
  .byloc-chip { width:15px !important; font-size:9px !important; padding:4px 0 !important; }
  .byloc-pill { font-size:8px !important; padding:1px 3px !important; letter-spacing:0 !important; }
  /* Rooftop Recent + Needs — shrink the metric header columns so the flex Vehicle column widens */
  .rv-hdr  { font-size:8px !important; letter-spacing:0 !important; padding:4px 4px 6px 0 !important; }
  .rv-cell { padding:8px 4px 8px 0 !important; }
  .rv-name { font-size:11px !important; }
  .rv-sub  { font-size:9.5px !important; }
  .rv-pill { font-size:9px !important; padding:2px 5px !important; letter-spacing:0 !important; }
  .rv-th-thumb  { width:44px !important; }
  .rv-th-spyne  { width:56px !important; }
  .rv-th-status { width:80px !important; }
  .rv-th-age    { width:60px !important; }
  .rv-th-view   { width:38px !important; }
}
</style>`;

const centerImg = (img) =>
  `<table align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;"><tr><td>${img}</td></tr></table>`;
const sup = (sym) => `<sup style="color:#6d4aff;font-weight:700;font-size:0.7em;vertical-align:super;">${sym}</sup>`;
const dot = (color) =>
  `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:7px;vertical-align:middle;font-size:0;line-height:0;">&nbsp;</span>`;
const kpiPill = (bg, fg, text) =>
  `<span style="display:inline-block;background:${bg};color:${fg};padding:3px 9px;border-radius:999px;font-size:9.5px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;white-space:nowrap;">${text}</span>`;
const ZONE = { g: ["#e7f5ec", "#15803d"], a: ["#fef3e0", "#b45309"], r: ["#fdecec", "#b91c1c"], n: ["#eef0f4", "#98a0ad"] };
const zonePill = (z, labels) => { const [bg, fg] = ZONE[z || "n"]; return kpiPill(bg, fg, labels[z || "n"]); };

// Chip styles shared by the Inventory legend + the group's By Location table.
const CHIP_STYLE = {
  has:   "background:#e7f5ec;color:#15803d;border:1px solid #bfe1cc;",
  no:    "background:#fdecec;color:#b91c1c;border:1px solid #f5c5c5;",
  blue:  "background:#eaf0ff;color:#1a4ad6;border:1px solid #c7d7ff;",
  empty: "background:#fafbfd;color:#c2c8d0;border:1px solid #eef0f4;",
};

// KPI card shell — title + pill (centered), graphic, then a body block.
// Desktop keeps the original fixed 3-column table (unchanged). The `kpi-cell`
// class lets the media query flip the cells to full-width stacked blocks on
// phones; desktop is never touched because that rule only fires ≤600px.
const kpiCard = ({ title, marker, pill, graphic, body, valign = "top" }) => `
    <td class="kpi-cell" valign="${valign}" width="33%" style="width:33%;background:#FFFFFF;border:1px solid #e7e9ee;border-radius:14px;padding:12px 14px;font-family:${FONT};">
      <div style="text-align:center;font-size:11px;letter-spacing:0.7px;text-transform:uppercase;color:#5b6577;font-weight:700;line-height:1.3;">${title}${marker ? sup(marker) : ""}</div>
      <div style="text-align:center;padding:5px 0 0;">${pill}</div>
      <div style="padding:6px 0 2px;">${centerImg(graphic)}</div>
      ${body}
    </td>`;

const subRow = (dotColor, label, marker, value) => `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;margin-top:8px;border-top:1px solid #e7e9ee;">
      <tr>
        <td valign="middle" style="padding-top:8px;font-size:12px;font-weight:600;color:#5b6577;line-height:1.25;">${dot(dotColor)}${label}${marker ? sup(marker) : ""}</td>
        <td align="right" valign="middle" style="padding-top:8px;font-size:13px;font-weight:700;color:#0c1322;letter-spacing:-0.2px;white-space:nowrap;">${value}</td>
      </tr>
    </table>`;

// Three KPI cards (Inventory donut + Time to Market gauge + Photo Score gauge).
// Rendered byte-identically for the rooftop and the group reports.
function buildKpiCardsRow({ inventoryByCondition, hasUnmarked, avgTtlDaysInventory, avgTatHrsInventory, avgScoreInventory, websiteScore, publishingOff = false }) {
  // ── Inventory card ──
  const ibc = inventoryByCondition || {
    withPhotos: { New: 0, Used: 0, Unmarked: 0 },
    pending:    { New: 0, Used: 0, Unmarked: 0 },
    noPhotos:   { New: 0, Used: 0, Unmarked: 0 },
  };
  const sum3 = (o) => (o.New || 0) + (o.Used || 0) + (o.Unmarked || 0);
  const wpTotal  = sum3(ibc.withPhotos);
  const pdTotal  = sum3(ibc.pending);
  const npTotal  = sum3(ibc.noPhotos);
  const invTotal = wpTotal + pdTotal + npTotal;            // donut total (all inventory)
  // "Photos delivered" = delivered-with-photos as a share of *photographed*
  // vehicles only (With Photos + Pending). No-photos VINs are excluded.
  const photographed = wpTotal + pdTotal;
  const pctDelivered = photographed > 0 ? Math.round((wpTotal / photographed) * 100) : 0;
  const invZone = photographed === 0 ? "n" : (pctDelivered >= 90 ? "g" : (pctDelivered >= 60 ? "a" : "r"));
  let conds = hasUnmarked ? ["New", "Used", "Unmarked"] : ["New", "Used"];
  // Publishing-OFF: condition isn't tracked (all NA) — drop the New/Used columns.
  if (publishingOff) conds = conds.filter((c) => c === "Unmarked");

  const invChip = (val, kind) => {
    const st = val ? CHIP_STYLE[kind] : CHIP_STYLE.empty;
    return `<td align="center" style="padding:3px 1px;"><span style="display:inline-block;min-width:24px;padding:3px 3px;border-radius:5px;font-size:11.5px;font-weight:700;letter-spacing:-0.2px;${st}">${val ? n(val) : "&mdash;"}</span></td>`;
  };
  const invRow = (dotColor, label, bucket, kind) => `
    <tr>
      <td style="padding:4px 4px 4px 0;font-size:11px;font-weight:600;color:#5b6577;white-space:nowrap;overflow:hidden;">${dot(dotColor)}${label}</td>
      ${conds.map((c) => invChip(bucket[c] || 0, kind)).join("")}
    </tr>`;
  // Short display label per condition. "Unmarked" is rendered as "NA" — the full
  // word forces the chip column wider and crops the row labels.
  const condHeader = (c) => (c === "Unmarked" ? "NA" : c);
  const invHeaderCells = conds
    .map((c) => `<td align="center" style="font-size:9px;font-weight:800;letter-spacing:0.3px;text-transform:uppercase;color:#98a0ad;padding:0 1px 4px;">${condHeader(c)}</td>`)
    .join("");
  const invCols = `<col />${conds.map(() => `<col style="width:36px;" />`).join("")}`;

  const inventoryBody = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;table-layout:fixed;margin-top:6px;border-top:1px solid #e7e9ee;padding-top:8px;">
      <colgroup>${invCols}</colgroup>
      <tr><td style="padding:0 4px 4px 0;"></td>${invHeaderCells}</tr>
      ${invRow("#16a34a", "With Photos", ibc.withPhotos, "has")}
      ${invRow("#d97706", "No Photos",   ibc.noPhotos,   "no")}
      ${invRow("#2f6bff", "Pending",     ibc.pending,    "blue")}
    </table>`;

  const inventoryCard = kpiCard({
    title: "Inventory",
    pill: kpiPill(ZONE[invZone][0], ZONE[invZone][1], `${pctDelivered}% Photos Delivered`),
    graphic: donutImg({ green: wpTotal, blue: pdTotal, amber: npTotal, total: Math.max(invTotal, 1), center: n(invTotal), label: "TOTAL" }, 120),
    body: inventoryBody,
  });

  // ── Time to Market card ──
  const ttmDays   = avgTtlDaysInventory;
  const ttmZone   = ttmDays == null ? "n" : (ttmDays <= 7 ? "g" : (ttmDays <= 12 ? "a" : "r"));
  const ttmCenter = formatTtl(ttmDays) || "—";
  const sptVal    = formatTat(avgTatHrsInventory);
  const ttmCard = kpiCard({
    title: "Time to Market",
    marker: "*",
    pill: zonePill(ttmZone, { g: "Excellent", a: "Good", r: "Poor", n: "No data" }),
    graphic: gaugeImg({ value: ttmDays, min: 0, max: 20, t1: 7, t2: 12, dir: "desc", center: ttmCenter, scale: "0d,7d,12d,20d" }, 150),
    body: subRow("#16a34a", "Spyne Processing Time", "†", sptVal),
  });

  // ── Publishing-OFF variant: Spyne Processing Time gauge replaces Time to Market ──
  // TTM (IMS entry → website publish) is meaningless when the rooftop isn't published.
  // Gauge is hour-scaled: <12h green, 12–24h amber, 24h+ red. The "†" glossary entry stays.
  const ptHrs  = avgTatHrsInventory;
  const ptZone = ptHrs == null ? "n" : (ptHrs < 12 ? "g" : (ptHrs < 24 ? "a" : "r"));
  const ptCard = kpiCard({
    title: "Spyne Processing Time",
    marker: "†",
    pill: zonePill(ptZone, { g: "Excellent", a: "Good", r: "Poor", n: "No data" }),
    graphic: gaugeImg({ value: ptHrs, min: 0, max: 48, t1: 12, t2: 24, dir: "desc", center: formatTat(ptHrs), scale: "0h,12h,24h,48h" }, 150),
    body: "",
    valign: "middle",  // gauge vertically centered (card has no sub-row for publishing-off)
  });
  const middleCard = publishingOff ? ptCard : ttmCard;

  // ── Photo Score card ──
  const photoScore = avgScoreInventory;
  const scoreZone  = photoScore == null ? "n" : (photoScore >= 8 ? "g" : (photoScore >= 6 ? "a" : "r"));
  const photoCard = kpiCard({
    title: "Photo Score",
    marker: "‡",
    pill: zonePill(scoreZone, { g: "Excellent", a: "Good", r: "Poor", n: "No data" }),
    graphic: gaugeImg({ value: photoScore, min: 0, max: 10, t1: 6, t2: 8, dir: "asc", center: formatScore(photoScore), scale: "0,6,8,10" }, 150),
    body: subRow(scoreColor(websiteScore), "Website Score", "§", `${formatScore(websiteScore)}<span style="color:#98a0ad;font-weight:600;font-size:10.5px;">/10</span>`),
  });

  // Original fixed 3-column row (desktop unchanged). On mobile the media query
  // turns .kpi-cell into full-width blocks and hides the .kpi-gap spacers.
  const spacerCell = `<td class="kpi-gap" width="14" style="width:14px;min-width:14px;font-size:0;line-height:0;">&nbsp;</td>`;
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;table-layout:fixed;"><tr>${inventoryCard}${spacerCell}${middleCard}${spacerCell}${photoCard}</tr></table>`;
}

// Static Glossary card (4 entries; no Merchandising Score). Shared by both reports.
function buildGlossaryCard(publishingOff = false) {
  const glossItem = (marker, title, desc, ideal) => `
    <td valign="top" width="50%" style="width:50%;padding:8px 10px;font-family:${FONT};">
      <div style="font-size:11.5px;font-weight:700;color:#0c1322;letter-spacing:-0.1px;">${title}${sup(marker)}</div>
      <div style="font-size:10.5px;color:#98a0ad;line-height:1.4;margin-top:2px;">${desc}</div>
      <div style="font-size:10px;color:#5b6577;line-height:1.4;margin-top:3px;"><b style="font-weight:700;">Ideal:</b> ${ideal}</div>
    </td>`;
  // Time to Market is omitted for publishing-OFF reports (it isn't shown there).
  const items = [];
  if (!publishingOff) items.push(glossItem("*", "Time to Market (TTM)", "Days from IMS/DMS entry to photos published.", "&lt; 5d"));
  items.push(glossItem("†", "Spyne Processing Time (PT)",  "Spyne turnaround from photo capture to publish.", "&lt; 6h"));
  items.push(glossItem("‡", "Photo Score",   "Photo quality 0&ndash;10. Dealers at 8+ sell 2&times; faster.", "8+"));
  items.push(glossItem("§", "Website Score", "Listing quality based on consistency, background, hero angle, etc. Scored 0&ndash;10.", "8+"));
  const emptyCell = `<td width="50%" style="width:50%;"></td>`;
  let glossRows = "";
  for (let i = 0; i < items.length; i += 2) {
    glossRows += `<tr>${items[i]}${items[i + 1] || emptyCell}</tr>`;
  }
  return `
    <tr><td style="height:14px;font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr>
      <td style="background:#FFFFFF;border:1px solid #e7e9ee;border-radius:14px;padding:12px 14px 14px;">
        <div style="font-size:11px;letter-spacing:0.8px;text-transform:uppercase;color:#5b6577;font-weight:600;font-family:${FONT};margin-bottom:4px;">Glossary &middot; How to read this report</div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;table-layout:fixed;">
          ${glossRows}
        </table>
      </td>
    </tr>`;
}

export function buildRooftopReportHtml(data, dateLabel, timezone = "America/New_York") {
  void timezone;
  const {
    rooftopId,
    enterpriseId,
    rooftopName,
    websiteScore,
    avgTtlDaysInventory,
    avgScoreInventory,
    avgTatHrsInventory,
    inventoryByCondition,
    hasUnmarked,
    avgAgeingNoPhotos,
    recentVins,
    needsAttentionVins,
  } = data;

  const inventoryBaseUrl = `https://console.spyne.ai/inventory/v2/listings?enterprise_id=${enterpriseId || ""}${rooftopId ? `&team_id=${rooftopId}` : ""}`;
  const vinUrl = (dealerVinId) =>
    dealerVinId
      ? `https://console.spyne.ai/inventory/v2/listings/${dealerVinId}?enterprise_id=${enterpriseId || ""}${rooftopId ? `&team_id=${rooftopId}` : ""}`
      : null;

  const cardsRow = buildKpiCardsRow({ inventoryByCondition, hasUnmarked, avgTtlDaysInventory, avgTatHrsInventory, avgScoreInventory, websiteScore, publishingOff: data.publishingOff });

  // ── Recent Vehicles rows ─────────────────────────────────────────────────────
  const recentRowsHtml = recentVins.length === 0
    ? `<tr><td colspan="5" style="padding:20px 0;text-align:center;font-size:12px;color:#9CA3AF;font-family:${FONT};">No vehicles delivered in the last 90 days.</td></tr>`
    : recentVins.slice(0, 5).map((v, i) => {
        const vehicleName = [clean(v.year), clean(v.make), clean(v.model)].filter(Boolean).join(" ") || "—";
        const condLine    = condLabel(v.condition);
        const stockLine   = clean(v.stock_number);
        const vUrl        = vinUrl(v.dealer_vin_id) || "#";
        const tatLabel    = v.ttd_hrs != null ? formatTat(v.ttd_hrs) : "—";
        const tatSlow     = v.ttd_hrs != null && Number(v.ttd_hrs) > 6;
        const tatBg       = tatSlow ? "#fff2dc" : "#e7f7ee";
        const tatFg       = tatSlow ? "#d97706" : "#16a34a";
        const thumb = v.thumbnail_url
          ? `<img src="${v.thumbnail_url}" width="44" height="32" alt="" style="display:block;width:44px;height:32px;border-radius:6px;border:0;outline:none;object-fit:cover;background:#eef0f4;" />`
          : `<div style="display:block;width:44px;height:32px;border-radius:6px;background:#eef0f4;line-height:32px;font-size:0;">&nbsp;</div>`;
        const rowBorder = i === 0 ? "" : "border-top:1px solid #e7e9ee;";
        return `
        <tr>
          <td class="rv-cell" style="padding:10px 12px 10px 0;vertical-align:middle;${rowBorder}">${thumb}</td>
          <td class="rv-cell" style="padding:10px 12px 10px 0;vertical-align:middle;${rowBorder}font-family:${FONT};overflow:hidden;">
            <div class="rv-name" style="font-size:12.5px;font-weight:600;color:#0c1322;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${vehicleName}${condLine ? ` <span style="color:#98a0ad;font-weight:500;">&middot; ${condLine}</span>` : ""}</div>
            <div class="rv-sub" style="font-size:10.5px;color:#98a0ad;margin-top:1px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${v.vin || ""}${stockLine ? ` &middot; Stock #${stockLine}` : ""}</div>
          </td>
          <td class="rv-cell" style="padding:10px 12px 10px 0;vertical-align:middle;${rowBorder}white-space:nowrap;">
            <span class="rv-pill" style="display:inline-block;padding:3px 8px;border-radius:999px;background:${tatBg};color:${tatFg};font-size:11px;font-weight:700;letter-spacing:0.2px;font-family:${FONT};">${tatLabel}</span>
          </td>
          <td class="rv-cell" style="padding:10px 12px 10px 0;vertical-align:middle;${rowBorder}white-space:nowrap;">
            <span class="rv-pill" style="display:inline-block;padding:3px 8px 3px 7px;border-radius:999px;background:#e7f7ee;color:#16a34a;font-size:11px;font-weight:700;letter-spacing:0.2px;font-family:${FONT};">&#9679;&nbsp;Published</span>
          </td>
          <td class="rv-cell" style="padding:10px 0 10px 0;vertical-align:middle;${rowBorder}text-align:right;white-space:nowrap;">
            <a href="${vUrl}" style="font-size:11px;font-weight:600;color:#2f6bff;text-decoration:none;font-family:${FONT};">View &rarr;</a>
          </td>
        </tr>`;
      }).join("\n");

  // Recent Vehicles header pill — same "avg Spyne processing" metric as the KPI
  // card's Spyne Processing Time (avgTatHrsInventory): active inventory when IMS
  // is on, last-90-day cohort when IMS is off. Kept identical so the two never
  // disagree.
  const recentPill = avgTatHrsInventory != null
    ? `<span style="display:inline-block;background:${avgTatHrsInventory <= 6 ? "#e7f5ec" : "#fff2dc"};border:1px solid ${avgTatHrsInventory <= 6 ? "#bfe1cc" : "#f3dca0"};color:${avgTatHrsInventory <= 6 ? "#15803d" : "#b45309"};padding:3px 10px;border-radius:999px;font-family:${FONT};vertical-align:middle;margin-right:10px;"><span style="font-size:9px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;">Avg Spyne processing</span> <span style="font-size:12.5px;font-weight:800;letter-spacing:-0.2px;">${formatTat(avgTatHrsInventory)}</span></span>`
    : "";

  // ── Vehicles needing attention (top-5 no-photos VINs, oldest first) ──────────
  const needsAttentionUrl = `${inventoryBaseUrl}&filter=no-photos`;
  const needsAttentionHtml = buildNeedsAttentionSection({
    vins: needsAttentionVins,
    vinUrl,
    viewAllHref: needsAttentionUrl,
    includeRooftopCol: false,
    showCondition: true,
    avgAgeing: avgAgeingNoPhotos,
  });

  // ── Glossary card ───────────────────────────────────────────────────────────
  const glossaryHtml = buildGlossaryCard(data.publishingOff);

  // ── Full HTML ─────────────────────────────────────────────────────────────
  // Email-safe: 100% inline styles, table-based layout, hosted images for the
  // donut and gauges. No <style> block, no CSS variables, no grid/flex.

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Studio AI Rooftop Report — ${rooftopName}</title>
${RESPONSIVE_STYLE}
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:${FONT};color:#0c1322;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;background:#f4f5f7;">
  <tr>
    <td align="center" class="body-pad" style="padding:24px 16px 40px;">
      <!--[if mso]><table width="760" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table width="760" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;max-width:760px;width:100%;">

        <!-- ══ HEADER CARD ═════════════════════════════════════════════════════ -->
        <tr>
          <td style="background:#FFFFFF;border:1px solid #e7e9ee;border-radius:14px;padding:18px 22px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
              <tr>
                <td valign="middle" style="vertical-align:middle;">
                  <img src="${SPYNE_LOGO_SRC}" alt="Spyne" width="96" style="display:block;height:28px;width:auto;border:0;" />
                </td>
                <td align="right" valign="middle" style="vertical-align:middle;text-align:right;line-height:1.25;">
                  <div style="font-size:13px;font-weight:700;letter-spacing:0.4px;color:#0c1322;">${rooftopName}</div>
                  <div style="font-size:11.5px;color:#5b6577;margin-top:2px;">Studio AI &middot; Rooftop Report</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr><td style="height:14px;font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- ══ GREETING ════════════════════════════════════════════════════════ -->
        <tr>
          <td style="padding:4px 4px 16px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
              <tr>
                <td valign="middle" style="vertical-align:middle;">
                  <span style="font-size:20px;font-weight:700;color:#0c1322;letter-spacing:-0.2px;">Inventory</span>
                  <span style="font-size:20px;font-weight:500;color:#5b6577;letter-spacing:-0.2px;">&nbsp;at this rooftop</span>
                  <span style="display:inline-block;background:#e7f7ee;color:#16a34a;padding:4px 9px;border-radius:999px;font-size:11px;font-weight:600;margin-left:8px;vertical-align:middle;">&#9679;&nbsp;On track</span>
                </td>
                <td align="right" valign="middle" style="vertical-align:middle;text-align:right;font-size:12px;color:#5b6577;white-space:nowrap;">${dateLabel}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ══ THREE KPI CARDS ═════════════════════════════════════════════════ -->
        <tr>
          <td style="padding:0;">${cardsRow}</td>
        </tr>

        <tr><td style="height:14px;font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- ══ VEHICLES NEEDING ATTENTION ══════════════════════════════════════ -->
        ${needsAttentionHtml}

        ${needsAttentionHtml ? `<tr><td style="height:14px;font-size:0;line-height:0;">&nbsp;</td></tr>` : ""}

        <!-- ══ RECENT VEHICLES ═════════════════════════════════════════════════ -->
        <tr>
          <td style="background:#FFFFFF;border:1px solid #e7e9ee;border-radius:14px;padding:14px 16px 8px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;margin-bottom:8px;">
              <tr>
                <td valign="middle" style="vertical-align:middle;font-size:11px;letter-spacing:0.8px;text-transform:uppercase;color:#5b6577;font-weight:600;font-family:${FONT};">Recent Vehicles &middot; Latest published</td>
                <td align="right" valign="middle" style="vertical-align:middle;text-align:right;white-space:nowrap;">
                  ${recentPill}
                  <a href="${inventoryBaseUrl}" style="font-size:11px;font-weight:600;color:#2f6bff;text-decoration:none;font-family:${FONT};vertical-align:middle;">View all &rarr;</a>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;table-layout:fixed;">
              <colgroup><col /><col /><col /><col /><col /></colgroup>
              <thead>
                <tr>
                  <th class="rv-th-thumb" style="width:56px;padding:4px 12px 8px 0;border-bottom:1px solid #e7e9ee;text-align:left;font-size:9.5px;letter-spacing:0.8px;text-transform:uppercase;color:#98a0ad;font-weight:700;font-family:${FONT};"></th>
                  <th class="rv-hdr" style="padding:4px 12px 8px 0;border-bottom:1px solid #e7e9ee;text-align:left;font-size:9.5px;letter-spacing:0.8px;text-transform:uppercase;color:#98a0ad;font-weight:700;font-family:${FONT};">Vehicle</th>
                  <th class="rv-hdr rv-th-spyne" style="width:90px;padding:4px 12px 8px 0;border-bottom:1px solid #e7e9ee;text-align:left;font-size:9.5px;letter-spacing:0.8px;text-transform:uppercase;color:#98a0ad;font-weight:700;font-family:${FONT};">PT</th>
                  <th class="rv-hdr rv-th-status" style="width:110px;padding:4px 12px 8px 0;border-bottom:1px solid #e7e9ee;text-align:left;font-size:9.5px;letter-spacing:0.8px;text-transform:uppercase;color:#98a0ad;font-weight:700;font-family:${FONT};">Status</th>
                  <th class="rv-th-view" style="width:50px;padding:4px 0 8px 0;border-bottom:1px solid #e7e9ee;text-align:right;font-size:9.5px;letter-spacing:0.8px;text-transform:uppercase;color:#98a0ad;font-weight:700;font-family:${FONT};"></th>
                </tr>
              </thead>
              <tbody>${recentRowsHtml}</tbody>
            </table>
          </td>
        </tr>

        <!-- ══ GLOSSARY ════════════════════════════════════════════════════════ -->
        ${glossaryHtml}

        <tr><td style="height:16px;font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- ══ FOOTER CTA ══════════════════════════════════════════════════════ -->
        <tr>
          <td style="background:#FFFFFF;border:1px solid #e7e9ee;border-radius:14px;padding:14px 18px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
              <tr>
                <td valign="middle" style="vertical-align:middle;font-size:12.5px;color:#5b6577;line-height:1.5;font-family:${FONT};">
                  Want the full breakdown? <b style="color:#0c1322;">Vehicle-level history, photos &amp; all other info</b> live in the console.
                </td>
                <td align="right" valign="middle" style="vertical-align:middle;padding-left:16px;">
                  <a href="${inventoryBaseUrl}" style="display:inline-block;background:#0c1322;color:#FFFFFF;font-size:12.5px;font-weight:600;padding:9px 14px;border-radius:9px;text-decoration:none;font-family:${FONT};mso-padding-alt:9px 14px;">Open console &rarr;</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td>
  </tr>
</table>
</body>
</html>`;
}

// Group-only: per-rooftop ("By Location") inventory table. Each row is a
// team/rooftop with a New / Used [/ NA] condition split (a With-Photos + No-Photos
// chip pair per condition), plus per-rooftop Time to Market & Spyne Processing
// Time. The NA column appears only when null-condition VINs exist (hasUnmarked).
// Pending VINs are intentionally not charted here, so the chips need not sum to
// Total. Lists every rooftop in the enterprise (ordered by inventory size).
function buildByLocationTable(inventoryByRooftop, hasUnmarked, { enterpriseId, allImsIntegrated, publishingOff = false }) {
  let conds = hasUnmarked ? ["New", "Used", "Unmarked"] : ["New", "Used"];
  // Publishing-OFF: condition isn't tracked (all NA) — drop the New/Used columns.
  if (publishingOff) conds = conds.filter((c) => c === "Unmarked");
  const condHeader = (c) => (c === "Unmarked" ? "NA" : c);
  const enterpriseConsoleUrl = `https://console.spyne.ai/inventory/v2/listings?enterprise_id=${enterpriseId}`;

  const totalChip = (val) =>
    `<span class="byloc-total" style="display:inline-block;min-width:28px;padding:3px 6px;border-radius:5px;background:#f4f5f7;border:1px solid #e7e9ee;font-size:12.5px;font-weight:700;color:#0c1322;letter-spacing:-0.2px;font-family:${FONT};white-space:nowrap;">${n(val)}</span>`;

  // Two joined chips (With Photos | No Photos) for one condition column.
  const condPair = (bucket) => {
    const wp = bucket?.wp || 0;
    const np = bucket?.np || 0;
    const leftSt  = wp ? CHIP_STYLE.has : CHIP_STYLE.empty;
    const rightSt = np ? CHIP_STYLE.no  : CHIP_STYLE.empty;
    const base = `padding:5px 0;font-size:12px;font-weight:700;letter-spacing:-0.2px;line-height:1.1;font-family:${FONT};`;
    return `<table align="center" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;margin:0 auto;">
      <tr>
        <td class="byloc-chip" align="center" width="34" style="width:34px;${base}${leftSt}border-right-width:0;border-radius:4px 0 0 4px;">${wp ? n(wp) : "&mdash;"}</td>
        <td class="byloc-chip" align="center" width="34" style="width:34px;${base}${rightSt}border-radius:0 4px 4px 0;">${np ? n(np) : "&mdash;"}</td>
      </tr>
    </table>`;
  };

  const ttmChip = (days) => {
    if (days == null) return `<span style="font-size:13px;color:#98a0ad;font-weight:700;font-family:${FONT};">&mdash;</span>`;
    const [bg, fg] = days <= 7 ? ["#e7f7ee", "#16a34a"] : days <= 12 ? ["#fff2dc", "#d97706"] : ["#fdecec", "#dc2626"];
    return `<span class="byloc-pill" style="display:inline-block;padding:3px 8px;border-radius:999px;background:${bg};color:${fg};font-size:11px;font-weight:700;letter-spacing:0.2px;font-family:${FONT};white-space:nowrap;">${formatTtl(days)}</span>`;
  };

  const spyneChip = (hrs) => {
    if (hrs == null) return `<span style="font-size:13px;color:#98a0ad;font-weight:700;font-family:${FONT};">&mdash;</span>`;
    const slow = Number(hrs) > 6;
    const bg = slow ? "#fff2dc" : "#e7f7ee";
    const fg = slow ? "#d97706" : "#16a34a";
    return `<span class="byloc-pill" style="display:inline-block;padding:3px 8px;border-radius:999px;background:${bg};color:${fg};font-size:11px;font-weight:700;letter-spacing:0.2px;font-family:${FONT};white-space:nowrap;">${formatTat(hrs)}</span>`;
  };

  const HCELL = `padding:4px 6px 8px;border-bottom:1px solid #e7e9ee;font-size:9px;letter-spacing:0.4px;text-transform:uppercase;color:#98a0ad;font-weight:800;font-family:${FONT};`;
  const condHeaderCells = conds.map((c) => `<td class="byloc-hdr" align="center" style="${HCELL}text-align:center;">${condHeader(c)}</td>`).join("");
  // Percentage widths that always sum to 100% so columns spread evenly and fill
  // the card. Location flexed before, so a short name + no NA column dumped all
  // the slack into Location, leaving a large dead gap before the data. Giving
  // every column a share (and a narrower Location when there's no NA column)
  // keeps the row balanced regardless of name length or NA presence.
  let colgroupHtml;
  if (publishingOff) {
    // publishing-off: Location, Total, [NA], PT — New/Used and TTM removed
    colgroupHtml =
      `<col style="width:54%;" />` +                                                        // Location
      `<col style="width:14%;" />` +                                                        // Total
      conds.map(() => `<col style="width:16%;" />`).join("") +                              // NA
      `<col style="width:16%;" />`;                                                          // PT
  } else {
    colgroupHtml =
      `<col style="width:${hasUnmarked ? "32%" : "39%"};" />` +                              // Location
      `<col style="width:${hasUnmarked ? "10%" : "11%"};" />` +                              // Total
      conds.map(() => `<col style="width:${hasUnmarked ? "12%" : "14%"};" />`).join("") +    // New / Used / NA
      `<col style="width:11%;" />` +                                                          // TTM
      `<col style="width:11%;" />`;                                                           // PT
  }
  const ncols = conds.length + (publishingOff ? 3 : 4);

  const rows = !inventoryByRooftop || inventoryByRooftop.length === 0
    ? `<tr><td colspan="${ncols}" style="padding:20px 0;text-align:center;font-size:12px;color:#9CA3AF;font-family:${FONT};">No inventory data available.</td></tr>`
    : inventoryByRooftop.map((r) => {
        const rowTotal = allImsIntegrated
          ? (Number(r.total_active) || 0)
          : ((Number(r.received) || 0) + (Number(r.no_photos_count) || 0));
        const consoleUrl = `https://console.spyne.ai/home?enterprise_id=${enterpriseId}&team_id=${r.rooftop_id}`;
        const bc = r.byCondition || {};
        const condCells = conds.map((c) =>
          `<td class="byloc-cell" align="center" style="padding:9px 4px;border-top:1px solid #e7e9ee;vertical-align:middle;">${condPair(bc[c])}</td>`
        ).join("");
        return `<tr>
          <td class="byloc-cell" style="padding:9px 10px 9px 0;border-top:1px solid #e7e9ee;vertical-align:middle;overflow:hidden;">
            <a class="byloc-name" href="${consoleUrl}" style="font-size:12.5px;font-weight:600;color:#0c1322;text-decoration:none;font-family:${FONT};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${r.rooftop_name || r.rooftop_id}</a>
          </td>
          <td class="byloc-cell" align="center" style="padding:9px 4px;border-top:1px solid #e7e9ee;vertical-align:middle;">${totalChip(rowTotal)}</td>
          ${condCells}
          ${publishingOff ? "" : `<td class="byloc-cell" align="center" style="padding:9px 4px;border-top:1px solid #e7e9ee;vertical-align:middle;white-space:nowrap;">${ttmChip(r.ttlDays)}</td>`}
          <td class="byloc-cell" align="center" style="padding:9px 0 9px 4px;border-top:1px solid #e7e9ee;vertical-align:middle;white-space:nowrap;">${spyneChip(r.avg_ttd_hrs)}</td>
        </tr>`;
      }).join("\n");

  return `
    <tr>
      <td class="byloc-card" style="background:#FFFFFF;border:1px solid #e7e9ee;border-radius:14px;padding:14px 16px 10px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;margin-bottom:8px;">
          <tr>
            <td valign="middle" style="vertical-align:middle;font-size:11px;letter-spacing:0.8px;text-transform:uppercase;color:#5b6577;font-weight:600;font-family:${FONT};">Inventory &middot; Till Yesterday</td>
            <td align="right" valign="middle" style="vertical-align:middle;text-align:right;white-space:nowrap;">
              <span style="display:inline-block;padding:3px 9px;border-radius:999px;background:#e7f5ec;color:#15803d;border:1px solid #bfe1cc;font-size:10px;font-weight:700;letter-spacing:0.3px;font-family:${FONT};vertical-align:middle;">With Photos</span>
              <span style="display:inline-block;padding:3px 9px;border-radius:999px;background:#fdecec;color:#b91c1c;border:1px solid #f5c5c5;font-size:10px;font-weight:700;letter-spacing:0.3px;font-family:${FONT};vertical-align:middle;margin-left:6px;">No Photos</span>
              <a href="${enterpriseConsoleUrl}" style="font-size:11px;font-weight:600;color:#2f6bff;text-decoration:none;font-family:${FONT};vertical-align:middle;margin-left:10px;">View all &rarr;</a>
            </td>
          </tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;table-layout:fixed;">
          <colgroup>${colgroupHtml}</colgroup>
          <thead>
            <tr>
              <td class="byloc-hdr" style="${HCELL}text-align:left;">Location</td>
              <td class="byloc-hdr" align="center" style="${HCELL}text-align:center;">Total</td>
              ${condHeaderCells}
              ${publishingOff ? "" : `<td class="byloc-hdr" align="center" style="${HCELL}text-align:center;">TTM</td>`}
              <td class="byloc-hdr" align="center" style="${HCELL}text-align:center;">PT</td>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </td>
    </tr>`;
}

export function buildGroupReportHtml(data, dateLabel) {
  const {
    enterpriseId,
    enterpriseName,
    rooftopCount,
    allImsIntegrated,
    inventoryByCondition,
    hasUnmarked,
    websiteScore,
    avgTtlDaysInventory,
    avgScoreInventory,
    avgTatHrsInventory,
    inventoryByRooftop,
  } = data;

  const enterpriseConsoleUrl = `https://console.spyne.ai/inventory/v2/listings?enterprise_id=${enterpriseId}`;

  const cardsRow        = buildKpiCardsRow({ inventoryByCondition, hasUnmarked, avgTtlDaysInventory, avgTatHrsInventory, avgScoreInventory, websiteScore, publishingOff: data.publishingOff });
  const byLocationTable = buildByLocationTable(inventoryByRooftop, hasUnmarked, { enterpriseId, allImsIntegrated, publishingOff: data.publishingOff });
  const glossaryHtml    = buildGlossaryCard(data.publishingOff);

  // ── Full HTML ─────────────────────────────────────────────────────────────
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Studio AI Dealer Report — ${enterpriseName}</title>
${RESPONSIVE_STYLE}
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;color:#0c1322;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;background:#f4f5f7;">
  <tr>
    <td align="center" class="body-pad" style="padding:24px 16px 40px;">
      <!--[if mso]><table width="760" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table width="760" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;max-width:760px;width:100%;">

        <!-- HEADER -->
        <tr>
          <td style="background:#FFFFFF;border:1px solid #e7e9ee;border-radius:14px;padding:18px 22px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
              <tr>
                <td valign="middle" style="vertical-align:middle;">
                  <img src="${SPYNE_LOGO_SRC}" alt="Spyne" width="96" style="display:block;height:28px;width:auto;border:0;" />
                </td>
                <td align="right" valign="middle" style="vertical-align:middle;text-align:right;line-height:1.25;">
                  <div style="font-size:13px;font-weight:700;letter-spacing:0.4px;color:#0c1322;">${enterpriseName}</div>
                  <div style="font-size:11.5px;color:#5b6577;margin-top:2px;">Studio AI &middot; Dealer Report &middot; ${rooftopCount} location${rooftopCount !== 1 ? "s" : ""}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr><td style="height:14px;font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- GREETING -->
        <tr>
          <td style="padding:4px 4px 16px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
              <tr>
                <td valign="middle" style="vertical-align:middle;">
                  <span style="font-size:20px;font-weight:700;color:#0c1322;letter-spacing:-0.2px;">Inventory</span>
                  <span style="font-size:20px;font-weight:500;color:#5b6577;letter-spacing:-0.2px;">&nbsp;across the group</span>
                  <span style="display:inline-block;background:#e7f7ee;color:#16a34a;padding:4px 9px;border-radius:999px;font-size:11px;font-weight:600;margin-left:8px;vertical-align:middle;">&#9679;&nbsp;On track</span>
                </td>
                <td align="right" valign="middle" style="vertical-align:middle;text-align:right;font-size:12px;color:#5b6577;white-space:nowrap;">${dateLabel}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- THREE KPI CARDS -->
        <tr>
          <td style="padding:0;">${cardsRow}</td>
        </tr>

        <tr><td style="height:14px;font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- BY LOCATION · INVENTORY -->
        ${byLocationTable}

        <!-- GLOSSARY -->
        ${glossaryHtml}

        <tr><td style="height:14px;font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- FOOTER CTA -->
        <tr>
          <td style="background:#FFFFFF;border:1px solid #e7e9ee;border-radius:14px;padding:14px 18px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
              <tr>
                <td valign="middle" style="vertical-align:middle;font-size:12.5px;color:#5b6577;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;line-height:1.5;">
                  Want the full breakdown? <strong style="color:#0c1322;">Vehicle-level history, photos &amp; all other info</strong> live in the console.
                </td>
                <td align="right" valign="middle" style="vertical-align:middle;padding-left:16px;white-space:nowrap;">
                  <a href="${enterpriseConsoleUrl}" style="display:inline-block;background:#0c1322;color:#FFFFFF;font-size:12.5px;font-weight:600;padding:9px 14px;border-radius:9px;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;mso-padding-alt:9px 14px;">Open console &rarr;</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td>
  </tr>
</table>
</body>
</html>`;
}

