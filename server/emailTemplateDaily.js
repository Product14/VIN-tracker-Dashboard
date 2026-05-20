// ─── Daily Email Template Builder ────────────────────────────────────────────
// buildRooftopReportHtml(data, dateLabel) — per-rooftop daily delivery report
//
// Gmail-safe: all styles inline, table-based layout, no flex/grid,
// no CSS custom properties. 600px container width.

import { SPYNE_LOGO_SRC } from "./spyneLogo.js";

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

// "1h 56m"
function formatTat(hrs) {
  if (hrs == null) return "—";
  const h = Math.floor(Number(hrs));
  const m = Math.round((Number(hrs) - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
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

// Format Time to Line as "Xd Yh" / "Yh" / "Zm" — never shows fractional days.
const formatTtl = (days) => {
  if (days == null) return null;
  const totalMins = Math.max(0, Math.round(Number(days) * 24 * 60));
  if (totalMins < 60) return `${totalMins}m`;
  const totalHrs = Math.round(totalMins / 60);
  if (totalHrs < 24) return `${totalHrs}h`;
  const d = Math.floor(totalHrs / 24);
  const h = totalHrs - d * 24;
  return h === 0 ? `${d}d` : `${d}d ${h}h`;
};

// Email-safe chip with optional hover tooltip via the `title` attribute.
// Gmail strips <style> blocks, so CSS-only ::after tooltips don't render —
// `title` produces a native browser tooltip on hover in webmail clients.
// A small "?" badge inside the chip signals the tooltip is available.
const chip = (bg, fg, lblColor, label, value, tip = "") => {
  const titleAttr = tip ? ` title="${String(tip).replace(/"/g, "&quot;")}"` : "";
  const infoBadge = tip
    ? `<td valign="middle" align="center" style="padding:0 0 0 6px;vertical-align:middle;">
         <span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:${fg};opacity:0.55;color:#ffffff;font-size:11px;font-weight:800;text-align:center;line-height:16px;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;vertical-align:middle;">?</span>
       </td>`
    : "";
  return `
  <td valign="middle"${titleAttr} style="background:${bg};padding:6px 10px;border-radius:999px;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;${tip ? "cursor:help;" : ""}">
    <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
      <tr>
        <td valign="middle" style="padding:0 8px 0 0;">
          <span style="display:inline-block;font-size:9px;font-weight:700;letter-spacing:0.3px;text-transform:uppercase;color:${lblColor};opacity:0.85;">${label}</span>
        </td>
        <td valign="middle" style="padding:0;">
          <span style="font-size:12.5px;font-weight:700;color:${fg};letter-spacing:-0.2px;">${value}</span>
        </td>
        ${infoBadge}
      </tr>
    </table>
  </td>`;
};

const buildChipsRow = (ttlDays, avgTatHrs, { centered = false, score = null } = {}) => {
  const cells = [];
  const ttlStr = formatTtl(ttlDays);
  const ttlTip = "Average Time taken from VIN received to VIN Live on lot";
  const tatTip = "Average Time taken by Spyne to process and deliver VIN";
  if (ttlStr != null)      cells.push(chip("#efeaff", "#5b3ce8", "#5b3ce8", "Days to Frontline", ttlStr,            ttlTip));
  if (avgTatHrs != null)   cells.push(chip("#eaf0ff", "#1a4ad6", "#1a4ad6", "Avg TAT",        formatTat(avgTatHrs), tatTip));
  // TODO: re-enable Media Score chip once scoring is finalized.
  // if (score != null)    cells.push(chip("#eaf0ff", "#1a4ad6", "#1a4ad6", "Media Score",    Number(score).toFixed(1)));
  void score;
  if (cells.length === 0) return "";
  const sep = `<td width="6" style="width:6px;font-size:0;line-height:0;">&nbsp;</td>`;
  const innerAlign = centered
    ? `<table align="center" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;margin:0 auto;"><tr>${cells.join(sep)}</tr></table>`
    : `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;"><tr>${cells.join(sep)}</tr></table>`;
  return `
    <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;margin-top:12px;border-top:1px solid #e7e9ee;padding-top:12px;width:100%;">
      <tr><td align="${centered ? "center" : "left"}" style="padding:12px 0 0;text-align:${centered ? "center" : "left"};">
        ${innerAlign}
      </td></tr>
    </table>`;
};

// ─── Quiet-day "No vehicles received yesterday" placeholders ─────────────────
// Used inside the Yesterday card when no VINs arrived the previous day, so the
// card stays side-by-side with the Inventory card instead of being hidden.

// Calendar icon used in the empty state. Inline SVG via data URI (same pattern
// as noPhotoThumb) — Gmail strips inline <svg> but renders <img src="data:...">.
const quietDayCalendarIcon = () => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238b7cc8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><rect x='3' y='4' width='18' height='18' rx='2'/><path d='M16 2v4M8 2v4M3 10h18'/><line x1='9' y1='16' x2='15' y2='16'/></svg>`;
  return `<table cellpadding="0" cellspacing="0" border="0" align="center" style="border-collapse:collapse;margin:0 auto 8px;">
    <tr><td width="44" height="44" align="center" valign="middle" style="width:44px;height:44px;background:#f3f1fa;border-radius:22px;line-height:0;">
      <img src="data:image/svg+xml;utf8,${svg}" width="20" height="20" alt="" style="display:block;border:0;outline:none;" />
    </td></tr>
  </table>`;
};

// Empty-state body for the Yesterday card. Caller supplies the dateLabel that's
// already passed to the report; we strip a trailing "(TZ)" suffix for cleanliness.
const buildQuietDayContent = (dateLabel) => {
  const cleanDate = String(dateLabel || "").replace(/\s*\([^)]+\)\s*$/, "").trim() || "yesterday";
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
      <tr><td align="center" style="padding:24px 16px 20px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">
        ${quietDayCalendarIcon()}
        <div style="font-size:13.5px;font-weight:700;color:#0c1322;line-height:1.35;">No vehicles received yesterday</div>
        <div style="font-size:11.5px;color:#98a0ad;line-height:1.45;margin:6px auto 0;max-width:280px;">Zero vehicles shot &amp; received on ${cleanDate}. Daily report metrics resume when new vehicles arrive.</div>
      </td></tr>
    </table>`;
};

// Disabled chip pair (Time to Line —, Media Score —) for the empty Yesterday
// card. Mirrors the chip() / buildChipsRow() shape but with em-dash values and
// dimmed styling so the row visually echoes the populated state. Labels match
// the mockup; populated chips elsewhere keep their existing names.
const buildQuietDayChips = () => {
  const disabledChip = (bg, fg, label) => `
    <td valign="middle" style="background:${bg};padding:6px 10px;border-radius:999px;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;opacity:0.55;">
      <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
        <tr>
          <td valign="middle" style="padding:0 8px 0 0;">
            <span style="display:inline-block;font-size:9px;font-weight:700;letter-spacing:0.3px;text-transform:uppercase;color:${fg};opacity:0.85;">${label}</span>
          </td>
          <td valign="middle" style="padding:0;">
            <span style="font-size:12.5px;font-weight:700;color:#98a0ad;letter-spacing:-0.2px;">&mdash;</span>
          </td>
        </tr>
      </table>
    </td>`;
  const sep = `<td width="6" style="width:6px;font-size:0;line-height:0;">&nbsp;</td>`;
  return `
    <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;margin-top:12px;border-top:1px solid #e7e9ee;padding-top:12px;width:100%;">
      <tr><td align="left" style="padding:12px 0 0;text-align:left;">
        <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
          <tr>
            ${disabledChip("#efeaff", "#5b3ce8", "Days to Frontline")}
            ${sep}
            ${disabledChip("#eaf0ff", "#1a4ad6", "Media Score")}
          </tr>
        </table>
      </td></tr>
    </table>`;
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
const buildNeedsAttentionSection = ({ vins, vinUrl, viewAllHref, includeRooftopCol, titleSuffix = "" }) => {
  if (!vins || vins.length === 0) return "";

  const rowsHtml = vins.slice(0, 5).map((v) => {
    const vehicleName = [clean(v.year), clean(v.make), clean(v.model)].filter(Boolean).join(" ") || "—";
    const trimLine    = clean(v.trim);
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
        <td style="padding:10px 10px 10px 0;vertical-align:middle;${rowBorder}">${noPhotoThumb()}</td>
        <td style="padding:10px 10px 10px 0;vertical-align:middle;${rowBorder}font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;overflow:hidden;">
          <div style="font-size:12.5px;font-weight:600;color:#0c1322;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${vehicleName}${trimLine ? ` <span style="color:#98a0ad;font-weight:500;">&middot; ${trimLine}</span>` : ""}</div>
          <div style="font-size:10.5px;color:#98a0ad;margin-top:1px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${v.vin || ""}${stockLine ? ` &middot; #${stockLine}` : ""}</div>
        </td>
        ${rooftopCell}
        <td style="padding:10px 10px 10px 0;vertical-align:middle;${rowBorder}white-space:nowrap;">
          <span style="display:inline-block;padding:3px 8px;border-radius:999px;background:#fdecec;color:#dc2626;font-size:11px;font-weight:700;letter-spacing:0.2px;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">${ageLabel}</span>
        </td>
        <td style="padding:10px 10px 10px 0;vertical-align:middle;${rowBorder}white-space:nowrap;">
          <span style="display:inline-block;padding:3px 8px 3px 7px;border-radius:999px;background:#fdecec;color:#dc2626;font-size:11px;font-weight:700;letter-spacing:0.2px;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">&#9679;&nbsp;No photos</span>
        </td>
        <td style="padding:10px 0;vertical-align:middle;${rowBorder}text-align:right;white-space:nowrap;">
          <a href="${vUrl}" style="font-size:11px;font-weight:600;color:#2f6bff;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">View &rarr;</a>
        </td>
      </tr>`;
  }).join("\n");

  // Colgroup widths: 56 (thumb) / flex (vehicle) / [28% rooftop, optional] / 90 (ageing) / 130 (status) / 60 (view)
  const cols = includeRooftopCol
    ? `<col style="width:56px;" /><col /><col style="width:28%;" /><col style="width:90px;" /><col style="width:130px;" /><col style="width:60px;" />`
    : `<col style="width:56px;" /><col /><col style="width:90px;" /><col style="width:130px;" /><col style="width:60px;" />`;
  const headerCells = `
    <td style="padding:4px 10px 8px 0;border-bottom:1px solid #e7e9ee;"></td>
    <td style="padding:4px 10px 8px 0;border-bottom:1px solid #e7e9ee;font-size:9.5px;letter-spacing:0.8px;text-transform:uppercase;color:#98a0ad;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">Vehicle</td>
    ${includeRooftopCol ? `<td style="padding:4px 10px 8px 0;border-bottom:1px solid #e7e9ee;font-size:9.5px;letter-spacing:0.8px;text-transform:uppercase;color:#98a0ad;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">Rooftop</td>` : ""}
    <td style="padding:4px 10px 8px 0;border-bottom:1px solid #e7e9ee;font-size:9.5px;letter-spacing:0.8px;text-transform:uppercase;color:#98a0ad;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">Ageing</td>
    <td style="padding:4px 10px 8px 0;border-bottom:1px solid #e7e9ee;font-size:9.5px;letter-spacing:0.8px;text-transform:uppercase;color:#98a0ad;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">Status</td>
    <td style="padding:4px 0 8px;border-bottom:1px solid #e7e9ee;"></td>`;

  return `
    <tr><td style="height:14px;font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr>
      <td style="background:#FFFFFF;border:1px solid #e7e9ee;border-radius:14px;padding:14px 16px 8px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;margin-bottom:8px;">
          <tr>
            <td valign="middle" style="vertical-align:middle;font-size:11px;letter-spacing:0.8px;text-transform:uppercase;color:#5b6577;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">Vehicles Needing Attention &middot; Highest risk${titleSuffix}</td>
            <td align="right" valign="middle" style="vertical-align:middle;text-align:right;">
              <a href="${viewAllHref}" style="font-size:11px;font-weight:600;color:#2f6bff;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">View all &rarr;</a>
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
export function buildRooftopReportHtml(data, dateLabel, timezone = "America/New_York") {
  const {
    rooftopId,
    enterpriseId,
    rooftopName,
    imsOff,
    inv90,
    // Yesterday
    newVins,
    vinsDelivered,
    vinsPending,
    avgTtdHrs,
    avgTtlDaysYesterday,
    avgScoreYesterday,
    // Inventory totals (IMS-on) / inv90 fields populated when IMS-off
    totalActive, withPhotos,
    totalDelivered,
    noImagesTotal,
    avgTtlDaysInventory,
    avgScoreInventory,
    avgTatHrsInventory,
    // Tables
    recentVins,
    recentVinsTotal,
    needsAttentionVins,
  } = data;

  const inventoryBaseUrl = `https://console.spyne.ai/inventory/v2/listings?enterprise_id=${enterpriseId || ""}${rooftopId ? `&team_id=${rooftopId}` : ""}`;
  const vinUrl = (dealerVinId) =>
    dealerVinId
      ? `https://console.spyne.ai/inventory/v2/listings/${dealerVinId}?enterprise_id=${enterpriseId || ""}${rooftopId ? `&team_id=${rooftopId}` : ""}`
      : null;

  // True when no vehicles were received yesterday at all — drives zero-state layout.
  const quietDay = !newVins || newVins === 0;

  // DASHBOARD_URL, donutImg, formatTtl, chip, buildChipsRow are module-level.

  // ── Card-level numbers ─────────────────────────────────────────────────────
  // Yesterday donut: single green arc = % delivered of vehicles shot.
  const yPct      = newVins > 0 ? Math.round((vinsDelivered / newVins) * 100) : 0;
  const yCenter   = `${yPct}%`;
  const yLabel    = "DELIVERED";

  // Inventory cohort: IMS-on = all-time delivered-with-photos, IMS-off = 90-day delivered.
  const invTotal      = imsOff ? (inv90?.received      || 0) : (totalActive    || 0);
  const invDelivered  = imsOff ? (inv90?.invDelivered  || 0) : (totalDelivered || 0);
  const invWithPhotos = imsOff ? (inv90?.received      || 0) : (withPhotos     || 0);
  const invNoPhotos   = noImagesTotal || 0;
  // Pending = has-photos-but-not-delivered. Donut and legend show this so the
  // three counts (delivered + pending + no-photos) reconcile to invTotal.
  const invPending    = Math.max(0, invTotal - invDelivered - invNoPhotos);

  // ── Recent Vehicles rows ───────────────────────────────────────────────────
  const recentRowsHtml = recentVins.length === 0
    ? `<tr><td colspan="5" style="padding:20px 0;text-align:center;font-size:12px;color:#9CA3AF;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">No vehicles delivered in the last 90 days.</td></tr>`
    : recentVins.slice(0, 5).map((v, i) => {
        const vehicleName = [clean(v.year), clean(v.make), clean(v.model)].filter(Boolean).join(" ") || "—";
        const trimLine    = clean(v.trim);
        const stockLine   = clean(v.stock_number);
        const vUrl        = vinUrl(v.dealer_vin_id) || "#";
        const tatLabel    = v.ttd_hrs != null ? formatTat(v.ttd_hrs) : "—";
        const tatSlow     = v.ttd_hrs != null && Number(v.ttd_hrs) > 8;
        const tatBg       = tatSlow ? "#fff2dc" : "#e7f7ee";
        const tatFg       = tatSlow ? "#d97706" : "#16a34a";
        const thumb = v.thumbnail_url
          ? `<img src="${v.thumbnail_url}" width="44" height="32" alt="" style="display:block;width:44px;height:32px;border-radius:6px;border:0;outline:none;object-fit:cover;background:#eef0f4;" />`
          : `<div style="display:block;width:44px;height:32px;border-radius:6px;background:#eef0f4;line-height:32px;font-size:0;">&nbsp;</div>`;
        const rowBorder = i === 0 ? "" : "border-top:1px solid #e7e9ee;";
        return `
        <tr>
          <td style="padding:10px 12px 10px 0;vertical-align:middle;${rowBorder}width:56px;">${thumb}</td>
          <td style="padding:10px 12px 10px 0;vertical-align:middle;${rowBorder}font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">
            <div style="font-size:12.5px;font-weight:600;color:#0c1322;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${vehicleName}${trimLine ? ` <span style="color:#98a0ad;font-weight:500;">· ${trimLine}</span>` : ""}</div>
            <div style="font-size:10.5px;color:#98a0ad;margin-top:1px;line-height:1.25;">${v.vin || ""}${stockLine ? ` · Stock #${stockLine}` : ""}</div>
          </td>
          <td style="padding:10px 12px 10px 0;vertical-align:middle;${rowBorder}width:80px;white-space:nowrap;">
            <span style="display:inline-block;padding:3px 8px;border-radius:999px;background:${tatBg};color:${tatFg};font-size:11px;font-weight:700;letter-spacing:0.2px;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">${tatLabel}</span>
          </td>
          <td style="padding:10px 12px 10px 0;vertical-align:middle;${rowBorder}width:110px;white-space:nowrap;">
            <span style="display:inline-block;padding:3px 8px 3px 7px;border-radius:999px;background:#e7f7ee;color:#16a34a;font-size:11px;font-weight:700;letter-spacing:0.2px;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">&#9679;&nbsp;Delivered</span>
          </td>
          <td style="padding:10px 0 10px 0;vertical-align:middle;${rowBorder}width:50px;text-align:right;white-space:nowrap;">
            <a href="${vUrl}" style="font-size:11px;font-weight:600;color:#2f6bff;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">View &rarr;</a>
          </td>
        </tr>`;
      }).join("\n");

  // ── Vehicles needing attention (top-5 no-photos VINs, oldest first) ────────
  // Hidden when there are no such VINs (per design).
  const needsAttentionUrl = `${inventoryBaseUrl}&filter=no-photos`;
  const needsAttentionHtml = buildNeedsAttentionSection({
    vins: needsAttentionVins,
    vinUrl,
    viewAllHref: needsAttentionUrl,
    includeRooftopCol: false,
  });

  // ── Card builder (Yesterday and Inventory share the same shell) ────────────
  // Layout per card: 2-column table (donut left, legend right). The donut is an
  // <img> pointing at /api/donut.svg so Gmail renders it via image proxy.
  // When `centered` is true, the inner donut+legend table is rendered as a
  // shrink-to-fit table with align="center" so the content sits in the middle
  // of the (now full-width) card. Chips below are also centered.
  const buildCard = ({ title, donut, legend, content, chipsHtml, widthPct = "50%", centered = false }) => {
    const innerTable = content !== undefined
      ? content
      : (centered
        ? `<table align="center" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;margin:0 auto;">
           <tr>
             <td valign="middle" width="150" style="width:150px;padding-right:10px;">${donut}</td>
             <td valign="middle" style="border-left:1px solid #e7e9ee;padding-left:14px;">${legend}</td>
           </tr>
         </table>`
        : `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
           <tr>
             <td valign="middle" width="150" style="width:150px;padding-right:10px;">${donut}</td>
             <td valign="middle" width="100%" style="width:100%;border-left:1px solid #e7e9ee;padding-left:14px;">${legend}</td>
           </tr>
         </table>`);
    const widthAttr  = widthPct === "100%" ? ` width="100%"` : "";
    const widthStyle = widthPct === "auto" ? "" : `width:${widthPct};`;
    return `
    <td valign="top" align="${centered ? "center" : "left"}"${widthAttr} style="${widthStyle}background:#FFFFFF;border:1px solid #e7e9ee;border-radius:14px;padding:14px 16px;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;text-align:${centered ? "center" : "left"};">
      <div style="font-size:11px;letter-spacing:0.8px;text-transform:uppercase;color:#5b6577;font-weight:600;margin-bottom:6px;line-height:1.4;text-align:${centered ? "center" : "left"};">${title}</div>
      ${innerTable}
      ${chipsHtml}
    </td>`;
  };

  // dotColor accepts either a hex string (solid dot) or [colorA, colorB] (diagonal
  // split dot, rendered via /api/split-dot.svg so Gmail's image proxy handles it).
  const legendRow = (dotColor, label, primary, secondary) => {
    const dotHtml = Array.isArray(dotColor)
      ? `<img src="${DASHBOARD_URL}/api/split-dot.svg?a=${encodeURIComponent(String(dotColor[0]).replace(/^#/, ""))}&b=${encodeURIComponent(String(dotColor[1]).replace(/^#/, ""))}&w=30" width="10" height="10" alt="" style="display:block;width:10px;height:10px;border:0;outline:none;" />`
      : `<div style="width:10px;height:10px;border-radius:3px;background:${dotColor};font-size:0;line-height:10px;">&nbsp;</div>`;
    return `
    <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;margin-bottom:12px;">
      <tr>
        <td valign="middle" style="padding-right:10px;">
          ${dotHtml}
        </td>
        <td valign="middle">
          <div style="font-size:10.5px;color:#98a0ad;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;line-height:1.3;white-space:nowrap;">${label}</div>
          <div style="margin-top:2px;line-height:1;">
            <span style="font-size:18px;font-weight:700;color:#0c1322;letter-spacing:-0.3px;">${primary}</span>${secondary ? `<span style="font-size:18px;font-weight:500;color:#98a0ad;letter-spacing:-0.3px;">${secondary}</span>` : ""}
          </div>
        </td>
      </tr>
    </table>`;
  };

  // Yesterday card stays side-by-side with the Inventory card even on quiet days
  // — when no VINs arrived, we render an empty-state body (calendar icon +
  // message + disabled chips) instead of the donut.
  const yesterdayCard = quietDay
    ? buildCard({
        title: "Yesterday",
        content: buildQuietDayContent(dateLabel),
        chipsHtml: buildQuietDayChips(),
      })
    : buildCard({
        title: "Yesterday",
        donut: donutImg({ green: vinsDelivered, blue: vinsPending || 0, total: Math.max(newVins, 1), center: yCenter, label: yLabel }),
        legend: `
          ${legendRow(["#16a34a", "#2f6bff"], "Vehicles Shot",      n(newVins),       "")}
          ${legendRow("#16a34a", "Vehicles Delivered", n(vinsDelivered), "")}
        `.trim(),
        chipsHtml: buildChipsRow(avgTtlDaysYesterday, avgTtdHrs, { score: avgScoreYesterday }),
      });

  const inventoryCard = buildCard({
    title: "Inventory &middot; Till Yesterday",
    donut: donutImg({ green: invDelivered, blue: invPending, amber: invNoPhotos, total: Math.max(invTotal, 1), center: n(invTotal), label: "INVENTORY" }),
    legend: `
      ${legendRow("#16a34a", "Delivered", n(invDelivered), `/${n(invWithPhotos)}`)}
      ${invPending > 0 ? legendRow("#2f6bff", "Pending", n(invPending), "") : ""}
      ${legendRow("#d97706", "No Photos", n(invNoPhotos),  "")}
    `.trim(),
    chipsHtml: buildChipsRow(avgTtlDaysInventory, avgTatHrsInventory, { score: avgScoreInventory }),
  });

  const cardsRow = `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;"><tr>${yesterdayCard}<td width="14" style="width:14px;min-width:14px;font-size:0;line-height:0;">&nbsp;</td>${inventoryCard}</tr></table>`;

  // ── Full HTML ─────────────────────────────────────────────────────────────
  // Email-safe: 100% inline styles, table-based layout, hosted images for
  // donuts. No <style> block, no CSS variables, no grid/flex.

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Studio AI Rooftop Report — ${rooftopName}</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;color:#0c1322;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;background:#f4f5f7;">
  <tr>
    <td align="center" style="padding:24px 16px 40px;">
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
                  <span style="font-size:20px;font-weight:500;color:#5b6577;letter-spacing:-0.2px;">&nbsp;across Rooftop</span>
                  <span style="display:inline-block;background:#e7f7ee;color:#16a34a;padding:4px 9px;border-radius:999px;font-size:11px;font-weight:600;margin-left:8px;vertical-align:middle;">&#9679;&nbsp;On track</span>
                </td>
                <td align="right" valign="middle" style="vertical-align:middle;text-align:right;font-size:12px;color:#5b6577;white-space:nowrap;">${dateLabel}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ══ TWO CARDS ═══════════════════════════════════════════════════════ -->
        <tr>
          <td style="padding:0;">${cardsRow}</td>
        </tr>

        <tr><td style="height:14px;font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- ══ RECENT VEHICLES ═════════════════════════════════════════════════ -->
        <tr>
          <td style="background:#FFFFFF;border:1px solid #e7e9ee;border-radius:14px;padding:14px 16px 8px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;margin-bottom:8px;">
              <tr>
                <td valign="middle" style="vertical-align:middle;font-size:11px;letter-spacing:0.8px;text-transform:uppercase;color:#5b6577;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">Recent Vehicles &middot; Latest activity</td>
                <td align="right" valign="middle" style="vertical-align:middle;text-align:right;">
                  <a href="${inventoryBaseUrl}" style="font-size:11px;font-weight:600;color:#2f6bff;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">View all &rarr;</a>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;table-layout:fixed;">
              <colgroup>
                <col style="width:56px;" />
                <col />
                <col style="width:90px;" />
                <col style="width:130px;" />
                <col style="width:60px;" />
              </colgroup>
              <thead>
                <tr>
                  <th style="padding:4px 12px 8px 0;border-bottom:1px solid #e7e9ee;text-align:left;font-size:9.5px;letter-spacing:0.8px;text-transform:uppercase;color:#98a0ad;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;"></th>
                  <th style="padding:4px 12px 8px 0;border-bottom:1px solid #e7e9ee;text-align:left;font-size:9.5px;letter-spacing:0.8px;text-transform:uppercase;color:#98a0ad;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">Vehicle</th>
                  <th style="padding:4px 12px 8px 0;border-bottom:1px solid #e7e9ee;text-align:left;font-size:9.5px;letter-spacing:0.8px;text-transform:uppercase;color:#98a0ad;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">TAT</th>
                  <th style="padding:4px 12px 8px 0;border-bottom:1px solid #e7e9ee;text-align:left;font-size:9.5px;letter-spacing:0.8px;text-transform:uppercase;color:#98a0ad;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">Status</th>
                  <th style="padding:4px 0 8px 0;border-bottom:1px solid #e7e9ee;text-align:right;font-size:9.5px;letter-spacing:0.8px;text-transform:uppercase;color:#98a0ad;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;"></th>
                </tr>
              </thead>
              <tbody>${recentRowsHtml}</tbody>
            </table>
          </td>
        </tr>

        <!-- ══ VEHICLES NEEDING ATTENTION ══════════════════════════════════════ -->
        ${needsAttentionHtml}

        <tr><td style="height:16px;font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- ══ FOOTER CTA ══════════════════════════════════════════════════════ -->
        <tr>
          <td style="background:#FFFFFF;border:1px solid #e7e9ee;border-radius:14px;padding:14px 18px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
              <tr>
                <td valign="middle" style="vertical-align:middle;font-size:12.5px;color:#5b6577;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">
                  Want the full breakdown? <b style="color:#0c1322;">Vehicle-level history, photos &amp; all other info</b> live in the console.
                </td>
                <td align="right" valign="middle" style="vertical-align:middle;padding-left:16px;">
                  <a href="${inventoryBaseUrl}" style="display:inline-block;background:#0c1322;color:#FFFFFF;font-size:12.5px;font-weight:600;padding:9px 14px;border-radius:9px;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;mso-padding-alt:9px 14px;">Open console &rarr;</a>
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

export function buildGroupReportHtml(data, dateLabel) {
  const {
    enterpriseId,
    enterpriseName,
    rooftopCount,
    newVins,
    vinsDelivered,
    vinsPending,
    allImsIntegrated,
    invKpis,
    inventoryByRooftop,
    processedVins,
    recentPublishedVins,
    avgTtdHrs,
    avgTtlDaysYesterday,
    avgScoreYesterday,
    avgTtlDaysInventory,
    avgScoreInventory,
    avgTatHrsInventory,
    noPhotosGroup,
    needsAttentionVins,
  } = data;

  const quietDay = !newVins || newVins === 0;

  const enterpriseConsoleUrl = `https://console.spyne.ai/inventory/v2/listings?enterprise_id=${enterpriseId}`;
  const vinUrl = (dealerVinId, rooftopId) =>
    dealerVinId
      ? `https://console.spyne.ai/inventory/v2/listings/${dealerVinId}?enterprise_id=${enterpriseId}&team_id=${rooftopId}`
      : null;

  // ── Yesterday donut ───────────────────────────────────────────────────────
  const yPct    = newVins > 0 ? Math.round((vinsDelivered / newVins) * 100) : 0;
  const yCenter = `${yPct}%`;

  // ── Inventory donut ───────────────────────────────────────────────────────
  const invTotal     = allImsIntegrated
    ? (invKpis.totalActive || 0)
    : ((invKpis.received || 0) + (noPhotosGroup || 0));
  const invDelivered = invKpis.invDelivered || 0;
  const invPending   = invKpis.invPending   || 0;
  const invNoPhotos  = noPhotosGroup || 0;
  const invWithPh    = allImsIntegrated ? (invKpis.withPhotos || 0) : invDelivered;

  // ── Card builder ──────────────────────────────────────────────────────────
  // When `centered` is true, the inner donut+legend table is rendered as a
  // shrink-to-fit table aligned with align="center" so the content sits in
  // the middle of the (now full-width) card. Chips below are also centered.
  const buildCard = ({ title, donut, legend, content, chipsHtml, widthPct = "50%", centered = false }) => {
    const innerTable = content !== undefined
      ? content
      : (centered
        ? `<table align="center" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;margin:0 auto;">
           <tr>
             <td valign="middle" width="150" style="width:150px;padding-right:10px;">${donut}</td>
             <td valign="middle" style="border-left:1px solid #e7e9ee;padding-left:14px;">${legend}</td>
           </tr>
         </table>`
        : `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
           <tr>
             <td valign="middle" width="150" style="width:150px;padding-right:10px;">${donut}</td>
             <td valign="middle" width="100%" style="width:100%;border-left:1px solid #e7e9ee;padding-left:14px;">${legend}</td>
           </tr>
         </table>`);
    const widthAttr  = widthPct === "100%" ? ` width="100%"` : "";
    const widthStyle = widthPct === "auto" ? "" : `width:${widthPct};`;
    return `
    <td valign="top" align="${centered ? "center" : "left"}"${widthAttr} style="${widthStyle}background:#FFFFFF;border:1px solid #e7e9ee;border-radius:14px;padding:14px 16px;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;text-align:${centered ? "center" : "left"};">
      <div style="font-size:11px;letter-spacing:0.8px;text-transform:uppercase;color:#5b6577;font-weight:600;margin-bottom:6px;line-height:1.4;text-align:${centered ? "center" : "left"};">${title}</div>
      ${innerTable}
      ${chipsHtml}
    </td>`;
  };

  // dotColor accepts either a hex string (solid dot) or [colorA, colorB] (diagonal
  // split dot, rendered via /api/split-dot.svg so Gmail's image proxy handles it).
  const legendRow = (dotColor, label, primary, secondary) => {
    const dotHtml = Array.isArray(dotColor)
      ? `<img src="${DASHBOARD_URL}/api/split-dot.svg?a=${encodeURIComponent(String(dotColor[0]).replace(/^#/, ""))}&b=${encodeURIComponent(String(dotColor[1]).replace(/^#/, ""))}&w=30" width="10" height="10" alt="" style="display:block;width:10px;height:10px;border:0;outline:none;" />`
      : `<div style="width:10px;height:10px;border-radius:3px;background:${dotColor};font-size:0;line-height:10px;">&nbsp;</div>`;
    return `
    <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;margin-bottom:12px;">
      <tr>
        <td valign="middle" style="padding-right:10px;">
          ${dotHtml}
        </td>
        <td valign="middle">
          <div style="font-size:10.5px;color:#98a0ad;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;line-height:1.3;white-space:nowrap;">${label}</div>
          <div style="font-size:17px;font-weight:700;color:#0c1322;letter-spacing:-0.3px;line-height:1.15;margin-top:2px;">${primary}${secondary ? `<span style="font-size:17px;color:#98a0ad;font-weight:500;">${secondary}</span>` : ""}</div>
        </td>
      </tr>
    </table>`;
  };

  // Yesterday card stays side-by-side with the Inventory card even on quiet days
  // — when no VINs arrived, we render an empty-state body (calendar icon +
  // message + disabled chips) instead of the donut.
  const yesterdayCard = quietDay
    ? buildCard({
        title: "Yesterday",
        content: buildQuietDayContent(dateLabel),
        chipsHtml: buildQuietDayChips(),
      })
    : buildCard({
        title: "Yesterday",
        donut: donutImg({ green: vinsDelivered, blue: vinsPending || 0, total: Math.max(newVins, 1), center: yCenter, label: "DELIVERED" }),
        legend: legendRow(["#16a34a", "#2f6bff"], "Vehicles Shot",      String(newVins),      "") +
                legendRow("#16a34a", "Vehicles Delivered", String(vinsDelivered), ""),
        chipsHtml: buildChipsRow(avgTtlDaysYesterday, avgTtdHrs, { score: avgScoreYesterday }),
      });

  const inventoryCard = buildCard({
    title: "Inventory \xb7 Till Yesterday",
    donut: donutImg({ green: invDelivered, blue: invPending, amber: invNoPhotos, total: Math.max(invTotal, 1), center: String(invTotal), label: "INVENTORY" }),
    legend: legendRow("#16a34a", "Delivered",  String(invDelivered), `/${invWithPh}`) +
            (invPending > 0 ? legendRow("#2f6bff", "Pending", String(invPending), "") : "") +
            legendRow("#d97706", "No Photos",  String(invNoPhotos),  ""),
    chipsHtml: buildChipsRow(avgTtlDaysInventory, avgTatHrsInventory, { score: avgScoreInventory }),
  });

  const cardsRow = `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;"><tr>${yesterdayCard}<td width="14" style="width:14px;min-width:14px;font-size:0;line-height:0;">&nbsp;</td>${inventoryCard}</tr></table>`;

  // ── By Rooftop · Inventory bar chart ──────────────────────────────────────
  const BAR_W = 200;
  const tatChip = (hrs) => {
    if (hrs == null) return `<span style="font-size:13px;color:#98a0ad;font-weight:700;padding-left:4px;">&mdash;</span>`;
    // Threshold: > 8 hrs → amber (slow); ≤ 8 hrs → green (on-track).
    const slow = Number(hrs) > 8;
    const bg   = slow ? "#fff2dc" : "#e7f7ee";
    const fg   = slow ? "#d97706" : "#16a34a";
    return `<span style="display:inline-block;padding:3px 8px;border-radius:999px;background:${bg};color:${fg};font-size:11px;font-weight:700;letter-spacing:0.2px;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">${formatTat(hrs)}</span>`;
  };

  const rooftopBarRows = !inventoryByRooftop || inventoryByRooftop.length === 0
    ? `<tr><td colspan="4" style="padding:20px 0;text-align:center;font-size:12px;color:#9CA3AF;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">No inventory data available.</td></tr>`
    : inventoryByRooftop.map((r) => {
        const rowTotal = allImsIntegrated
          ? (Number(r.total_active) || 0)
          : ((Number(r.received) || 0) + (Number(r.no_photos_count) || 0));
        const deli   = Number(r.inv_delivered)   || 0;
        const pend   = Number(r.inv_pending)     || 0;
        const noph   = Number(r.no_photos_count) || 0;
        const denom  = Math.max(1, rowTotal);
        const deliW  = Math.round((deli / denom) * BAR_W);
        const pendW  = Math.round((pend / denom) * BAR_W);
        const nophW  = Math.round((noph / denom) * BAR_W);
        const grayW  = Math.max(0, BAR_W - deliW - pendW - nophW);
        const consoleUrl = `https://console.spyne.ai/home?enterprise_id=${enterpriseId}&team_id=${r.rooftop_id}`;
        const border = "border-top:1px solid #e7e9ee;";
        // Identify the leftmost and rightmost non-zero segments so the bar
        // gets a rounded left corner on the first segment and rounded right
        // corner on the last segment regardless of which colors are present.
        const segs = [
          { key: "deli", w: deliW, color: "#16a34a" },
          { key: "pend", w: pendW, color: "#2f6bff" },
          { key: "noph", w: nophW, color: "#d97706" },
          { key: "gray", w: grayW, color: "#eef0f4" },
        ].filter(s => s.w > 0);
        const barCells = segs.map((s, idx) => {
          const isFirst = idx === 0;
          const isLast  = idx === segs.length - 1;
          const radius  = isFirst && isLast ? "4px"
                        : isFirst ? "4px 0 0 4px"
                        : isLast  ? "0 4px 4px 0"
                        : "0";
          return `<td width="${s.w}" height="8" bgcolor="${s.color}" style="width:${s.w}px;height:8px;font-size:0;line-height:0;border-radius:${radius};"></td>`;
        }).join("");
        return `<tr>
          <td style="padding:10px 10px 10px 0;${border}vertical-align:middle;">
            <a href="${consoleUrl}" style="font-size:12.5px;font-weight:600;color:#0c1322;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">${r.rooftop_name || r.rooftop_id}</a>
          </td>
          <td style="padding:10px;${border}vertical-align:middle;white-space:nowrap;font-size:13px;font-weight:700;color:#0c1322;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">
            ${n(rowTotal)} <span style="font-size:10.5px;color:#98a0ad;font-weight:500;">vehicles</span>
          </td>
          <td style="padding:10px;${border}vertical-align:middle;">
            <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
              <tr>${barCells}</tr>
            </table>
          </td>
          <td style="padding:10px 0 10px 10px;${border}vertical-align:middle;white-space:nowrap;text-align:right;">${tatChip(r.avg_ttd_hrs)}</td>
        </tr>`;
      }).join("\n");

  // ── Recent Vehicles rows ───────────────────────────────────────────────────
  const vinSource = processedVins && processedVins.length > 0
    ? processedVins
    : (recentPublishedVins && recentPublishedVins.length > 0 ? recentPublishedVins : []);

  const recentRowsHtml = vinSource.length === 0
    ? `<tr><td colspan="6" style="padding:20px 0;text-align:center;font-size:12px;color:#9CA3AF;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">No vehicles delivered recently.</td></tr>`
    : vinSource.slice(0, 5).map((v) => {
        const vehicleName = [clean(v.year), clean(v.make), clean(v.model)].filter(Boolean).join(" ") || "—";
        const trimLine    = clean(v.trim);
        const stockLine   = clean(v.stock_number);
        const vUrl        = vinUrl(v.dealer_vin_id, v.rooftop_id) || "#";
        const tatLabel    = v.ttd_hrs != null ? formatTat(v.ttd_hrs) : "—";
        const tatSlow     = v.ttd_hrs != null && Number(v.ttd_hrs) > 8;
        const tatBg       = tatSlow ? "#fff2dc" : "#e7f7ee";
        const tatFg       = tatSlow ? "#d97706" : "#16a34a";
        const thumb       = v.thumbnail_url
          ? `<img src="${v.thumbnail_url}" width="44" height="32" alt="" style="display:block;width:44px;height:32px;border-radius:6px;border:0;outline:none;object-fit:cover;background:#eef0f4;" />`
          : `<div style="display:block;width:44px;height:32px;border-radius:6px;background:#eef0f4;line-height:32px;font-size:0;">&nbsp;</div>`;
        const rowBorder = "border-top:1px solid #e7e9ee;";
        return `
        <tr>
          <td style="padding:10px 10px 10px 0;vertical-align:middle;${rowBorder}">${thumb}</td>
          <td style="padding:10px 10px 10px 0;vertical-align:middle;${rowBorder}font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;overflow:hidden;">
            <div style="font-size:12.5px;font-weight:600;color:#0c1322;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${vehicleName}${trimLine ? ` <span style="color:#98a0ad;font-weight:500;">&middot; ${trimLine}</span>` : ""}</div>
            <div style="font-size:10.5px;color:#98a0ad;margin-top:1px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${v.vin || ""}${stockLine ? ` &middot; Stock #${stockLine}` : ""}</div>
          </td>
          <td style="padding:10px 10px 10px 0;vertical-align:middle;${rowBorder}font-size:11.5px;color:#5b6577;font-weight:500;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${v.rooftop_name || ""}</td>
          <td style="padding:10px 10px 10px 0;vertical-align:middle;${rowBorder}white-space:nowrap;">
            <span style="display:inline-block;padding:3px 8px;border-radius:999px;background:${tatBg};color:${tatFg};font-size:11px;font-weight:700;letter-spacing:0.2px;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">${tatLabel}</span>
          </td>
          <td style="padding:10px 10px 10px 0;vertical-align:middle;${rowBorder}white-space:nowrap;">
            <span style="display:inline-block;padding:3px 8px 3px 7px;border-radius:999px;background:#e7f7ee;color:#16a34a;font-size:11px;font-weight:700;letter-spacing:0.2px;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">&#9679;&nbsp;Delivered</span>
          </td>
          <td style="padding:10px 0;vertical-align:middle;${rowBorder}text-align:right;white-space:nowrap;">
            <a href="${vUrl}" style="font-size:11px;font-weight:600;color:#2f6bff;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">View &rarr;</a>
          </td>
        </tr>`;
      }).join("\n");

  // ── Vehicles needing attention (top-5 no-photos VINs across the group) ─────
  const needsAttentionUrl = `${enterpriseConsoleUrl}&filter=no-photos`;
  const needsAttentionHtml = buildNeedsAttentionSection({
    vins: needsAttentionVins,
    vinUrl,
    viewAllHref: needsAttentionUrl,
    includeRooftopCol: true,
    titleSuffix: " (group)",
  });

  // ── Full HTML ─────────────────────────────────────────────────────────────
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Studio AI Dealer Report — ${enterpriseName}</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;color:#0c1322;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;background:#f4f5f7;">
  <tr>
    <td align="center" style="padding:24px 16px 40px;">
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
                  <div style="font-size:11.5px;color:#5b6577;margin-top:2px;">Studio AI &middot; Dealer Report &middot; ${rooftopCount} rooftop${rooftopCount !== 1 ? "s" : ""}</div>
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
                  <span style="font-size:20px;font-weight:500;color:#5b6577;letter-spacing:-0.2px;">&nbsp;across Group</span>
                  <span style="display:inline-block;background:#e7f7ee;color:#16a34a;padding:4px 9px;border-radius:999px;font-size:11px;font-weight:600;margin-left:8px;vertical-align:middle;">&#9679;&nbsp;On track</span>
                </td>
                <td align="right" valign="middle" style="vertical-align:middle;text-align:right;font-size:12px;color:#5b6577;white-space:nowrap;">${dateLabel}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- TWO DONUT CARDS -->
        <tr>
          <td style="padding:0;">${cardsRow}</td>
        </tr>

        <tr><td style="height:14px;font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- BY ROOFTOP INVENTORY -->
        <tr>
          <td style="background:#FFFFFF;border:1px solid #e7e9ee;border-radius:14px;padding:14px 16px 8px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;margin-bottom:8px;">
              <tr>
                <td valign="middle" style="vertical-align:middle;font-size:11px;letter-spacing:0.8px;text-transform:uppercase;color:#5b6577;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">By Rooftop &middot; Inventory</td>
                <td align="right" valign="middle" style="vertical-align:middle;text-align:right;">
                  <a href="${enterpriseConsoleUrl}" style="font-size:11px;font-weight:600;color:#2f6bff;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">View all &rarr;</a>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;table-layout:fixed;">
              <colgroup>
                <col style="width:34%;" />
                <col style="width:18%;" />
                <col />
                <col style="width:72px;" />
              </colgroup>
              <thead>
                <tr>
                  <td style="padding:4px 10px 8px 0;border-bottom:1px solid #e7e9ee;font-size:9.5px;letter-spacing:0.8px;text-transform:uppercase;color:#98a0ad;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">Rooftop</td>
                  <td style="padding:4px 10px 8px;border-bottom:1px solid #e7e9ee;font-size:9.5px;letter-spacing:0.8px;text-transform:uppercase;color:#98a0ad;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">Inventory</td>
                  <td style="padding:4px 10px 8px;border-bottom:1px solid #e7e9ee;">
                    <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
                      <tr>
                        <td style="padding-right:10px;white-space:nowrap;font-size:9px;letter-spacing:0.5px;text-transform:uppercase;color:#98a0ad;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#16a34a;vertical-align:middle;margin-right:3px;"></span>Delivered</td>
                        <td style="padding-right:10px;white-space:nowrap;font-size:9px;letter-spacing:0.5px;text-transform:uppercase;color:#98a0ad;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#2f6bff;vertical-align:middle;margin-right:3px;"></span>Pending</td>
                        <td style="white-space:nowrap;font-size:9px;letter-spacing:0.5px;text-transform:uppercase;color:#98a0ad;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#d97706;vertical-align:middle;margin-right:3px;"></span>No Photos</td>
                      </tr>
                    </table>
                  </td>
                  <td style="padding:4px 0 8px 10px;border-bottom:1px solid #e7e9ee;text-align:right;font-size:9.5px;letter-spacing:0.8px;text-transform:uppercase;color:#98a0ad;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;white-space:nowrap;">Avg TAT</td>
                </tr>
              </thead>
              <tbody>
                ${rooftopBarRows}
              </tbody>
            </table>
          </td>
        </tr>

        <tr><td style="height:14px;font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- RECENT VEHICLES -->
        <tr>
          <td style="background:#FFFFFF;border:1px solid #e7e9ee;border-radius:14px;padding:14px 16px 8px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;margin-bottom:8px;">
              <tr>
                <td valign="middle" style="vertical-align:middle;font-size:11px;letter-spacing:0.8px;text-transform:uppercase;color:#5b6577;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">Recent Vehicles &middot; Latest activity (group)</td>
                <td align="right" valign="middle" style="vertical-align:middle;text-align:right;">
                  <a href="${enterpriseConsoleUrl}" style="font-size:11px;font-weight:600;color:#2f6bff;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">View all &rarr;</a>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;table-layout:fixed;">
              <colgroup>
                <col style="width:56px;" />
                <col />
                <col style="width:28%;" />
                <col style="width:90px;" />
                <col style="width:130px;" />
                <col style="width:60px;" />
              </colgroup>
              <thead>
                <tr>
                  <td style="padding:4px 10px 8px 0;border-bottom:1px solid #e7e9ee;"></td>
                  <td style="padding:4px 10px 8px 0;border-bottom:1px solid #e7e9ee;font-size:9.5px;letter-spacing:0.8px;text-transform:uppercase;color:#98a0ad;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">Vehicle</td>
                  <td style="padding:4px 10px 8px 0;border-bottom:1px solid #e7e9ee;font-size:9.5px;letter-spacing:0.8px;text-transform:uppercase;color:#98a0ad;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">Rooftop</td>
                  <td style="padding:4px 10px 8px 0;border-bottom:1px solid #e7e9ee;font-size:9.5px;letter-spacing:0.8px;text-transform:uppercase;color:#98a0ad;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">TAT</td>
                  <td style="padding:4px 10px 8px 0;border-bottom:1px solid #e7e9ee;font-size:9.5px;letter-spacing:0.8px;text-transform:uppercase;color:#98a0ad;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,Helvetica,sans-serif;">Status</td>
                  <td style="padding:4px 0 8px;border-bottom:1px solid #e7e9ee;"></td>
                </tr>
              </thead>
              <tbody>
                ${recentRowsHtml}
              </tbody>
            </table>
          </td>
        </tr>

        <!-- VEHICLES NEEDING ATTENTION -->
        ${needsAttentionHtml}

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

