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

// 1-px horizontal rule, Outlook-safe
function rule(color = "#E5E7EB") {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;"><tr><td height="1" style="height:1px;font-size:0;line-height:0;background:${color};">&nbsp;</td></tr></table>`;
}

// Vertical spacer
function spacer(px) {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;"><tr><td height="${px}" style="height:${px}px;font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
}

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
    newVins, imagesReceived,
    vinsDelivered, imagesProcessed,
    vinsPending,
    // Inventory totals
    totalActive, withPhotos,
    totalDelivered,
    // Tables
    processedVins,
    processedVinsTotal,
    noImageVins,
    recentVins,
    recentVinsTotal,
  } = data;

  const inventoryBaseUrl = `https://console.spyne.ai/inventory/v2/listings?enterprise_id=${enterpriseId || ""}${rooftopId ? `&team_id=${rooftopId}` : ""}`;
  const inventoryUrl = `${inventoryBaseUrl}&scoreAttributes=NO_PHOTOS`;
  const vinUrl = (dealerVinId) =>
    dealerVinId
      ? `https://console.spyne.ai/inventory/v2/listings/${dealerVinId}?enterprise_id=${enterpriseId || ""}${rooftopId ? `&team_id=${rooftopId}` : ""}`
      : null;

  // True when no vehicles were received yesterday at all — drives zero-state layout.
  const quietDay = !newVins || newVins === 0;

  // ── Section header ──────────────────────────────────────────────────────────
  const secHead = (eyebrow, title, sub, eyebrowColor = "#9CA3AF") => `
    ${eyebrow ? `<div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${eyebrowColor};line-height:1.4;margin-bottom:3px;">${eyebrow}</div>` : ""}
    <div style="font-size:17px;font-weight:700;color:#111827;line-height:1.3;margin-bottom:${sub ? "4" : "20"}px;">${title}</div>
    ${sub ? `<div style="font-size:12px;color:#6B7280;line-height:1.5;margin-bottom:20px;">${sub}</div>` : ""}`;

  // ── Yesterday's KPI cards (3 across) ───────────────────────────────────────
  // Inner content width: 600px - 56px padding = 544px
  // 3 cards × 174px + 2 gaps × 11px = 522 + 22 = 544px

  const kpiCard = (accentColor, label, bigNum, imgCount) => `
    <td width="174" valign="top" class="card-cell" style="width:174px;background:#FFFFFF;border:1px solid #E5E7EB;border-top:3px solid ${accentColor};">
      <div style="padding:16px 16px 18px;">
        <div style="font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9CA3AF;line-height:1.4;margin-bottom:10px;">${label}</div>
        <div style="font-size:32px;font-weight:700;color:#111827;line-height:1;font-family:Arial,Helvetica,sans-serif;margin-bottom:6px;">${n(bigNum)}</div>
        <div style="font-size:11px;color:#6B7280;line-height:1.4;">${imgCount != null ? `${n(imgCount)}&thinsp;images` : "vehicles"}</div>
      </div>
    </td>`;

  const kpiGap = `<td width="11" class="card-gap" style="width:11px;font-size:0;line-height:0;">&nbsp;</td>`;

  const yesterdayCards = `
    <table width="544" class="card-row" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
      <tr>
        ${kpiCard("#2563EB", "Vehicles Shot",      newVins,      imagesReceived)}
        ${kpiGap}
        ${kpiCard("#059669", "Vehicles Published", vinsDelivered, imagesProcessed)}
        ${kpiGap}
        ${kpiCard("#F59E0B", "Vehicles Pending",   vinsPending,   null)}
      </tr>
    </table>`;

  // ── Inventory snapshot — hero row + 3 metric cards ────────────────────────
  // Hero: full-width card, section title left / total count right.
  // Cards: 3 × 174px + 2 gaps × 11px = 544px

  const pct = (v) => (v != null && !isNaN(v) ? `${Number(v).toFixed(1)}%` : "—");

  // With Photos: % of total vehicles
  const withPhotosPctCalc = totalActive > 0 ? (withPhotos / totalActive * 100) : 0;
  // Published: % of vehicles with photos
  const deliveredPct      = withPhotos > 0  ? (totalDelivered / withPhotos * 100) : 0;
  // Pending: vehicles with photos that haven't been published yet
  const pendingWithPhotos = Math.max(0, withPhotos - totalDelivered);
  const pendingPct        = withPhotos > 0  ? (pendingWithPhotos / withPhotos * 100) : 0;

  const invCard = (label, count, pctVal, pctLabel, accentColor) => `
    <td width="174" valign="top" class="card-cell" style="width:174px;background:#F9FAFB;border:1px solid #E5E7EB;border-top:3px solid ${accentColor};">
      <div style="padding:16px 16px 18px;">
        <div style="font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9CA3AF;line-height:1.4;margin-bottom:10px;">${label}</div>
        <div style="font-size:28px;font-weight:700;color:#111827;line-height:1;font-family:Arial,Helvetica,sans-serif;margin-bottom:6px;">${n(count)}</div>
        <div style="font-size:11px;color:${accentColor};font-weight:600;line-height:1.4;">${pct(pctVal)}${pctLabel ? ` ${pctLabel}` : ""}</div>
      </div>
    </td>`;

  const invGap = `<td width="11" class="card-gap" style="width:11px;font-size:0;line-height:0;">&nbsp;</td>`;

  // Simplified card for the 90-day rolling section (no percentage sub-label)
  const invCard90 = (accentColor, label, bigNum) => `
    <td width="174" valign="top" class="card-cell" style="width:174px;background:#F9FAFB;border:1px solid #E5E7EB;border-top:3px solid ${accentColor};">
      <div style="padding:16px 16px 18px;">
        <div style="font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9CA3AF;line-height:1.4;margin-bottom:10px;">${label}</div>
        <div style="font-size:28px;font-weight:700;color:#111827;line-height:1;font-family:Arial,Helvetica,sans-serif;margin-bottom:6px;">${n(bigNum)}</div>
        <div style="font-size:11px;color:${accentColor};font-weight:600;line-height:1.4;">last 90 days</div>
      </div>
    </td>`;

  const inventorySnapshot = imsOff ? `
    <table width="544" class="card-row" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
      <tr>
        <td style="background:#F9FAFB;border:1px solid #E5E7EB;padding:18px 20px;">
          <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9CA3AF;line-height:1.4;margin-bottom:3px;">Last 3 Months</div>
          <div style="font-size:17px;font-weight:700;color:#111827;line-height:1.3;">Snapshot</div>
        </td>
      </tr>
    </table>
    ${spacer(12)}
    <table width="544" class="card-row" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
      <tr>
        ${invCard90("#2563EB", "Active Vehicles",    inv90.received)}
        ${invGap}
        ${invCard90("#059669", "Vehicles Published", inv90.invDelivered)}
        ${invGap}
        ${invCard90("#F59E0B", "Vehicles Pending",   inv90.invPending)}
      </tr>
    </table>` : `
    <table width="544" class="card-row" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
      <tr>
        <td style="background:#F9FAFB;border:1px solid #E5E7EB;padding:18px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
            <tr>
              <td style="vertical-align:middle;">
                <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9CA3AF;line-height:1.4;margin-bottom:3px;">Inventory Snapshot</div>
                <div style="font-size:17px;font-weight:700;color:#111827;line-height:1.3;">Your inventory as of yesterday</div>
              </td>
              <td align="right" style="vertical-align:middle;">
                <div style="font-size:36px;font-weight:700;color:#111827;line-height:1;font-family:Arial,Helvetica,sans-serif;">${n(totalActive)}</div>
                <div style="font-size:10px;color:#6B7280;margin-top:4px;text-align:right;line-height:1.4;">Total Vehicles</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    ${spacer(12)}
    <table width="544" class="card-row" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
      <tr>
        ${invCard("Vehicles with Photos", withPhotos,      withPhotosPctCalc, "of total vehicles",       "#2563EB")}
        ${invGap}
        ${invCard("Vehicles Published",  totalDelivered,  deliveredPct,      "", "#059669")}
        ${invGap}
        ${invCard("Vehicles Pending",    pendingWithPhotos, pendingPct,      "", "#F59E0B")}
      </tr>
    </table>`;

  // ── Published VINs table (max 5 rows) ──────────────────────────────────────
  const thStyle = `padding:9px 10px;border-bottom:2px solid #E5E7EB;text-align:left;font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9CA3AF;line-height:1.4;white-space:nowrap;`;

  const processedRows = processedVins.length === 0
    ? `<tr><td colspan="4" style="padding:24px 0;text-align:center;font-size:12px;color:#9CA3AF;line-height:1.4;">No vehicles received.</td></tr>`
    : processedVins.slice(0, 5).map(v => {
        const thumb = v.thumbnail_url
          ? `<img src="${v.thumbnail_url}" alt="" width="80" style="display:block;width:80px;height:auto;border:0;">`
          : `<div style="width:80px;height:56px;background:#F3F4F6;font-size:0;line-height:0;">&nbsp;</div>`;
        // Vehicle name: "2023 Chevrolet Silverado 1500"
        const vehicleName = [clean(v.year), clean(v.make), clean(v.model)].filter(Boolean).join(" ") || null;
        const trimLine    = clean(v.trim);
        const stockLine   = clean(v.stock_number);
        const vUrl        = vinUrl(v.dealer_vin_id);
        const nameHtml    = vehicleName
          ? `<div style="font-size:12px;font-weight:700;line-height:1.3;margin-bottom:2px;"><span style="color:#111827;">${vehicleName}</span></div>`
          : `<div style="font-size:12px;font-weight:700;color:#6B7280;line-height:1.3;margin-bottom:2px;">—</div>`;
        return `<tr>
          <td style="padding:10px 10px 10px 0;border-bottom:1px solid #F3F4F6;vertical-align:middle;">${thumb}</td>
          <td style="padding:10px;border-bottom:1px solid #F3F4F6;vertical-align:middle;">
            ${nameHtml}
            ${trimLine ? `<div style="font-size:10.5px;color:#6B7280;line-height:1.3;margin-bottom:3px;">${trimLine}</div>` : ""}
            <div style="font-size:10px;color:#9CA3AF;line-height:1.4;">${v.vin}</div>
            ${stockLine ? `<div style="font-size:10px;color:#9CA3AF;line-height:1.4;">Stock&nbsp;#${stockLine}</div>` : ""}
          </td>
          <td style="padding:10px 0 10px 10px;border-bottom:1px solid #F3F4F6;vertical-align:middle;text-align:right;white-space:nowrap;">
            <div style="font-size:10px;color:#9CA3AF;line-height:1.6;">Received&nbsp;&nbsp;${formatDt(v.received_at, timezone)}</div>
            <div style="font-size:10px;color:#9CA3AF;line-height:1.6;">Published&nbsp;&nbsp;${formatDt(v.processed_at, timezone)}</div>
            <div style="font-size:11px;font-weight:700;color:#059669;line-height:1.6;margin-top:1px;">TAT&nbsp;&nbsp;${formatTat(v.ttd_hrs)}</div>
          </td>
          <td style="padding:10px 0 10px 10px;border-bottom:1px solid #F3F4F6;vertical-align:middle;text-align:center;white-space:nowrap;">
            ${vUrl ? `<a href="${vUrl}" style="display:inline-block;padding:4px 8px;color:#2563EB;font-size:10px;font-weight:600;text-decoration:none;font-family:Arial,Helvetica,sans-serif;letter-spacing:0.01em;">View &rarr;</a>` : ""}
          </td>
        </tr>`;
      }).join("\n");

  const receivedMore = Math.max(0, (processedVinsTotal || 0) - processedVins.slice(0, 5).length);
  const receivedCta = receivedMore === 0 ? "" :
    `<div style="margin-top:14px;text-align:center;">
       <a href="${inventoryBaseUrl}" style="display:inline-block;padding:8px 20px;background:#ffffff;border:1px solid #D1D5DB;color:#374151;font-size:12px;font-weight:600;text-decoration:none;border-radius:4px;font-family:Arial,Helvetica,sans-serif;">+${receivedMore} more vehicle${receivedMore !== 1 ? "s" : ""} received</a>
     </div>`;

  // ── No-photo VINs table ───────────────────────────────────────────────────
  const noImagesMore = (data.noImagesTotal || 0) - noImageVins.length;

  const noPhotoRows = noImageVins.length === 0
    ? `<tr><td colspan="3" style="padding:20px 0;text-align:center;font-size:12px;color:#059669;line-height:1.4;">All vehicles have photos — great job!</td></tr>`
    : noImageVins.map(v => {
        const days      = v.days_on_lot != null ? Number(v.days_on_lot) : null;
        const ageColor  = days == null ? "#6B7280" : days >= 7 ? "#DC2626" : days >= 3 ? "#F59E0B" : "#6B7280";
        const ageLabel  = days != null ? `${days}&thinsp;day${days !== 1 ? "s" : ""}` : "—";
        const vehicle   = [clean(v.year), clean(v.make), clean(v.model)].filter(Boolean).join(" ") || v.vin;
        const trimLine2 = clean(v.trim);
        const vUrl2     = vinUrl(v.dealer_vin_id);
        return `<tr>
          <td style="padding:10px 10px 10px 0;border-bottom:1px solid #F3F4F6;vertical-align:middle;">
            <div style="font-size:12px;font-weight:700;line-height:1.3;margin-bottom:2px;"><span style="color:#111827;">${vehicle}</span></div>
            ${trimLine2 ? `<div style="font-size:10.5px;color:#6B7280;line-height:1.3;margin-bottom:3px;">${trimLine2}</div>` : ""}
            <div style="font-size:10px;color:#9CA3AF;line-height:1.3;">${v.vin}${v.stock_number ? `&nbsp;&middot;&nbsp;Stock&nbsp;#${v.stock_number}` : ""}</div>
          </td>
          <td style="padding:10px 0 10px 10px;border-bottom:1px solid #F3F4F6;vertical-align:middle;text-align:right;font-size:12px;font-weight:700;color:${ageColor};white-space:nowrap;line-height:1.4;">${ageLabel}</td>
          <td style="padding:10px 0 10px 10px;border-bottom:1px solid #F3F4F6;vertical-align:middle;text-align:center;white-space:nowrap;">
            ${vUrl2 ? `<a href="${vUrl2}" style="display:inline-block;padding:4px 8px;color:#2563EB;font-size:10px;font-weight:600;text-decoration:none;font-family:Arial,Helvetica,sans-serif;letter-spacing:0.01em;">View &rarr;</a>` : ""}
          </td>
        </tr>`;
      }).join("\n");

  const noPhotosCta = noImageVins.length === 0 ? "" :
    noImagesMore > 0
      ? `<div style="margin-top:14px;text-align:center;">
           <a href="${inventoryUrl}" style="display:inline-block;padding:8px 20px;background:#ffffff;border:1px solid #D1D5DB;color:#374151;font-size:12px;font-weight:600;text-decoration:none;border-radius:4px;font-family:Arial,Helvetica,sans-serif;">+${noImagesMore} more vehicle${noImagesMore !== 1 ? "s" : ""} without photos</a>
         </div>`
      : `<div style="margin-top:14px;text-align:center;">
           <a href="${inventoryUrl}" style="display:inline-block;padding:8px 20px;background:#ffffff;border:1px solid #D1D5DB;color:#374151;font-size:12px;font-weight:600;text-decoration:none;border-radius:4px;font-family:Arial,Helvetica,sans-serif;">View Details</a>
         </div>`;

  // ── Recent Vehicles (IMS off, quiet day only) ────────────────────────────
  const recentRows = recentVins.length === 0
    ? `<tr><td colspan="4" style="padding:24px 0;text-align:center;font-size:12px;color:#9CA3AF;line-height:1.4;">No vehicles published in the last 90 days.</td></tr>`
    : recentVins.map(v => {
        const thumb = v.thumbnail_url
          ? `<img src="${v.thumbnail_url}" alt="" width="80" style="display:block;width:80px;height:auto;border:0;">`
          : `<div style="width:80px;height:56px;background:#F3F4F6;font-size:0;line-height:0;">&nbsp;</div>`;
        const vehicleName = [clean(v.year), clean(v.make), clean(v.model)].filter(Boolean).join(" ") || null;
        const trimLine    = clean(v.trim);
        const stockLine   = clean(v.stock_number);
        const vUrl        = vinUrl(v.dealer_vin_id);
        const nameHtml    = vehicleName
          ? `<div style="font-size:12px;font-weight:700;line-height:1.3;margin-bottom:2px;"><span style="color:#111827;">${vehicleName}</span></div>`
          : `<div style="font-size:12px;font-weight:700;color:#6B7280;line-height:1.3;margin-bottom:2px;">—</div>`;
        return `<tr>
          <td style="padding:10px 10px 10px 0;border-bottom:1px solid #F3F4F6;vertical-align:middle;">${thumb}</td>
          <td style="padding:10px;border-bottom:1px solid #F3F4F6;vertical-align:middle;">
            ${nameHtml}
            ${trimLine ? `<div style="font-size:10.5px;color:#6B7280;line-height:1.3;margin-bottom:3px;">${trimLine}</div>` : ""}
            <div style="font-size:10px;color:#9CA3AF;line-height:1.4;">${v.vin}</div>
            ${stockLine ? `<div style="font-size:10px;color:#9CA3AF;line-height:1.4;">Stock&nbsp;#${stockLine}</div>` : ""}
          </td>
          <td style="padding:10px 0 10px 10px;border-bottom:1px solid #F3F4F6;vertical-align:middle;text-align:right;white-space:nowrap;">
            <div style="font-size:10px;color:#9CA3AF;line-height:1.6;">Received&nbsp;&nbsp;${formatDt(v.received_at, timezone)}</div>
            <div style="font-size:10px;color:#9CA3AF;line-height:1.6;">Published&nbsp;&nbsp;${formatDt(v.processed_at, timezone)}</div>
            <div style="font-size:11px;font-weight:700;color:#059669;line-height:1.6;margin-top:1px;">TAT&nbsp;&nbsp;${formatTat(v.ttd_hrs)}</div>
          </td>
          <td style="padding:10px 0 10px 10px;border-bottom:1px solid #F3F4F6;vertical-align:middle;text-align:center;white-space:nowrap;">
            ${vUrl ? `<a href="${vUrl}" style="display:inline-block;padding:4px 8px;color:#2563EB;font-size:10px;font-weight:600;text-decoration:none;font-family:Arial,Helvetica,sans-serif;letter-spacing:0.01em;">View &rarr;</a>` : ""}
          </td>
        </tr>`;
      }).join("\n");

  const recentMore = Math.max(0, recentVinsTotal - recentVins.length);
  const recentCta = recentMore === 0 ? "" :
    `<div style="margin-top:14px;text-align:center;">
       <a href="${inventoryBaseUrl}" style="display:inline-block;padding:8px 20px;background:#ffffff;border:1px solid #D1D5DB;color:#374151;font-size:12px;font-weight:600;text-decoration:none;border-radius:4px;font-family:Arial,Helvetica,sans-serif;">+${recentMore} more vehicle${recentMore !== 1 ? "s" : ""}</a>
     </div>`;

  // ── Full HTML ─────────────────────────────────────────────────────────────

  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<!--[if mso]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<title>Studio AI Daily Report — ${rooftopName}</title>
<style>
  @media screen and (max-width:600px) {
    /* Reduce horizontal padding on all major sections */
    .sec-pad { padding-left:16px !important; padding-right:16px !important; }
    /* Make card grid tables fluid so cards share the available width proportionally */
    .card-row { width:100% !important; }
    /* Each card takes 32% of the row; gap cells take 2% — 3×32 + 2×2 = 100 */
    .card-cell { width:32% !important; }
    .card-gap  { width:2%  !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#EBEBEB;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;background:#EBEBEB;">
  <tr>
    <td align="center" style="padding:32px 16px 48px;">
      <!--[if mso]><table width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;max-width:600px;width:100%;background:#FFFFFF;">

        <!-- ══ HEADER ══════════════════════════════════════════════════════════ -->
        <tr>
          <td style="padding:20px 28px;background:#FFFFFF;border-bottom:2px solid #E5E7EB;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
              <tr>
                <td style="vertical-align:middle;">
                  <img src="${SPYNE_LOGO_SRC}" alt="Spyne" width="80" style="display:block;width:80px;height:auto;border:0;">
                </td>
                <td align="right" style="vertical-align:middle;">
                  <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#111827;line-height:1.3;">${rooftopName}</div>
                  <div style="font-size:10px;color:#6B7280;margin-top:3px;line-height:1.3;letter-spacing:0.04em;">Studio AI &middot; Daily Report</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ══ DATE STRIP ══════════════════════════════════════════════════════ -->
        <tr>
          <td style="padding:10px 28px;background:#F9FAFB;border-bottom:1px solid #E5E7EB;">
            <div style="font-size:11.5px;color:#6B7280;line-height:1.4;">
              Reporting date:&nbsp;<strong style="color:#111827;">${dateLabel}</strong>
            </div>
          </td>
        </tr>

        <!-- ══ INTRO ════════════════════════════════════════════════════════ -->
        <tr>
          <td style="padding:28px 28px 24px;">
            <div style="font-size:19px;font-weight:700;color:#111827;line-height:1.3;margin-bottom:8px;">Hi ${rooftopName},</div>
            <div style="font-size:13px;color:#6B7280;line-height:1.7;">${quietDay
              ? `No new vehicles were received on <strong style="color:#111827;">${dateLabel}</strong>. Here&rsquo;s a snapshot of your current inventory.`
              : `Here&rsquo;s your Studio AI delivery summary for <strong style="color:#111827;">${dateLabel}</strong>. We published <strong style="color:#111827;">${n(vinsDelivered)}&thinsp;vehicle${vinsDelivered !== 1 ? "s" : ""}</strong> &mdash; here&rsquo;s the full breakdown.`
            }</div>
          </td>
        </tr>

        ${rule()}

        <!-- ══ YESTERDAY'S PERFORMANCE — hidden on quiet days ════════════════ -->
        ${!quietDay ? `
        <tr>
          <td class="sec-pad" style="padding:28px 28px 0;">
            ${secHead("Performance", "How did we do?", "Vehicles shot, published, and pending for the day")}
            ${yesterdayCards}
          </td>
        </tr>
        ${spacer(28)}
        ` : ""}
        ${rule()}

        <!-- ══ INVENTORY SNAPSHOT ══════════════════════════════════════════════ -->
        <tr>
          <td class="sec-pad" style="padding:28px 28px 0;">
            ${inventorySnapshot}
          </td>
        </tr>

        ${spacer(28)}
        ${rule()}

        <!-- ══ PUBLISHED VINs — hidden on quiet days ═══════════════════════════ -->
        ${!quietDay ? `
        <tr>
          <td class="sec-pad" style="padding:28px 28px 24px;background:#F9FAFB;">
            ${secHead("", "Vehicles Received", "")}
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
              <thead>
                <tr>
                  <th style="${thStyle}padding-left:0;">Photo</th>
                  <th style="${thStyle}">Vehicle</th>
                  <th style="${thStyle}text-align:right;">Timeline</th>
                  <th style="${thStyle}padding-right:0;text-align:center;"></th>
                </tr>
              </thead>
              <tbody>${processedRows}</tbody>
            </table>
            ${receivedCta}
          </td>
        </tr>
        ` : ""}

        ${noImageVins.length > 0 ? `
        ${rule()}

        <!-- ══ VEHICLES WITHOUT PHOTOS ════════════════════════════════════════ -->
        <tr>
          <td class="sec-pad" style="padding:28px 28px 24px;">
            ${secHead("Needs Attention", "Vehicles without photos", "Live inventory missing media — potential buyers cannot see these listings", "#DC2626")}
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
              <thead>
                <tr>
                  <th style="${thStyle}padding-left:0;">Vehicle</th>
                  <th style="${thStyle}text-align:right;">Ageing</th>
                  <th style="${thStyle}padding-right:0;text-align:center;"></th>
                </tr>
              </thead>
              <tbody>${noPhotoRows}</tbody>
            </table>
            ${noPhotosCta}
          </td>
        </tr>
        ` : ""}

        ${imsOff && quietDay ? `
        ${rule()}

        <!-- ══ RECENT VEHICLES (IMS off, quiet day) ════════════════════════════ -->
        <tr>
          <td class="sec-pad" style="padding:28px 28px 24px;background:#F9FAFB;">
            ${secHead("", "Recent Vehicles", "Most recently published vehicles from the last 90 days")}
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
              <thead>
                <tr>
                  <th style="${thStyle}padding-left:0;">Photo</th>
                  <th style="${thStyle}">Vehicle</th>
                  <th style="${thStyle}text-align:right;">Timeline</th>
                  <th style="${thStyle}padding-right:0;text-align:center;"></th>
                </tr>
              </thead>
              <tbody>${recentRows}</tbody>
            </table>
            ${recentCta}
          </td>
        </tr>
        ` : ""}

        ${rule()}

        <!-- ══ CONTACT SUPPORT ════════════════════════════════════════════════ -->
        <tr>
          <td style="padding:28px 28px;background:#F9FAFB;text-align:center;">
            <div style="font-size:15px;font-weight:700;color:#111827;line-height:1.3;margin-bottom:6px;">Have questions about your report?</div>
            <div style="font-size:12px;color:#6B7280;line-height:1.6;margin-bottom:20px;">Our team is available to help with any queries about your Studio AI deliveries.</div>
            <a href="mailto:support@spyne.ai" style="display:inline-block;background:#2563EB;color:#FFFFFF;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:12px 28px;text-decoration:none;mso-padding-alt:12px 28px;">Contact Support</a>
          </td>
        </tr>

        ${rule()}

        <!-- ══ FOOTER ══════════════════════════════════════════════════════════ -->
        <tr>
          <td style="padding:16px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
              <tr>
                <td style="font-size:10px;color:#9CA3AF;line-height:1.7;vertical-align:middle;">
                  Spyne Inc.&nbsp;&middot;&nbsp;1013 Centre Road, Suite 403-B, Wilmington, DE 19805
                </td>
                <td align="right" style="vertical-align:middle;padding-left:16px;">
                  <img src="${SPYNE_LOGO_SRC}" alt="Spyne" width="48" style="display:block;width:48px;height:auto;border:0;">
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

/**
 * @param {object} data      – return value of computeGroupDailyReport()
 * @param {string} dateLabel – "16 Apr 2026 (EDT)"
 */
export function buildGroupReportHtml(data, dateLabel) {
  const {
    enterpriseId,
    enterpriseName,
    rooftopCount,
    newVins,
    vinsDelivered,
    vinsPending,
    imagesReceived,
    imagesProcessed,
    imagesPending,
    topProcessed,
    allImsIntegrated,
    invKpis,
    inventoryByRooftop,
    processedVins,
    processedVinsTotal,
    recentPublishedVins,
  } = data;

  // True when no vehicles were received yesterday — drives quiet-day layout.
  const quietDay = !newVins || newVins === 0;

  // ── Section header ────────────────────────────────────────────────────────
  const secHead = (eyebrow, title, sub, eyebrowColor = "#9CA3AF") => `
    ${eyebrow ? `<div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${eyebrowColor};line-height:1.4;margin-bottom:3px;">${eyebrow}</div>` : ""}
    <div style="font-size:17px;font-weight:700;color:#111827;line-height:1.3;margin-bottom:${sub ? "4" : "20"}px;">${title}</div>
    ${sub ? `<div style="font-size:12px;color:#6B7280;line-height:1.5;margin-bottom:20px;">${sub}</div>` : ""}`;

  // ── KPI cards (3 across, identical to rooftop template) ───────────────────
  const kpiCard = (accentColor, label, bigNum, imgCount) => `
    <td width="174" valign="top" class="card-cell" style="width:174px;background:#FFFFFF;border:1px solid #E5E7EB;border-top:3px solid ${accentColor};">
      <div style="padding:16px 16px 18px;">
        <div style="font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9CA3AF;line-height:1.4;margin-bottom:10px;">${label}</div>
        <div style="font-size:32px;font-weight:700;color:#111827;line-height:1;font-family:Arial,Helvetica,sans-serif;margin-bottom:6px;">${n(bigNum)}</div>
        <div style="font-size:11px;color:#6B7280;line-height:1.4;">${imgCount != null ? `${n(imgCount)}&thinsp;images` : "vehicles"}</div>
      </div>
    </td>`;

  const kpiGap = `<td width="11" class="card-gap" style="width:11px;font-size:0;line-height:0;">&nbsp;</td>`;

  const yesterdayCards = `
    <table width="544" class="card-row" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
      <tr>
        ${kpiCard("#2563EB", "Vehicles Received",  newVins,      imagesReceived)}
        ${kpiGap}
        ${kpiCard("#059669", "Vehicles Published", vinsDelivered, imagesProcessed)}
        ${kpiGap}
        ${kpiCard("#F59E0B", "Vehicles Pending",   vinsPending,   imagesPending)}
      </tr>
    </table>`;

  // ── Inventory snapshot ────────────────────────────────────────────────────
  const pct = (v) => (v != null && !isNaN(v) ? `${Number(v).toFixed(1)}%` : "—");

  const invCard = (accentColor, label, bigNum, sub) => `
    <td width="174" valign="top" class="card-cell" style="width:174px;background:#F9FAFB;border:1px solid #E5E7EB;border-top:3px solid ${accentColor};">
      <div style="padding:16px 16px 18px;">
        <div style="font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9CA3AF;line-height:1.4;margin-bottom:10px;">${label}</div>
        <div style="font-size:28px;font-weight:700;color:#111827;line-height:1;font-family:Arial,Helvetica,sans-serif;margin-bottom:6px;">${n(bigNum)}</div>
        <div style="font-size:11px;color:${accentColor};font-weight:600;line-height:1.4;">${sub || ""}</div>
      </div>
    </td>`;
  const invGap = `<td width="11" class="card-gap" style="width:11px;font-size:0;line-height:0;">&nbsp;</td>`;

  // Mode A: IMS integrated — full inventory snapshot
  // Mode B: rolling 90-day snapshot
  let inventorySection;
  if (allImsIntegrated) {
    const { totalActive, withPhotos, withPhotosPct, invDelivered, invPending } = invKpis;
    const invByRooftopRows = !inventoryByRooftop || inventoryByRooftop.length === 0
      ? `<tr><td colspan="5" style="padding:24px 0;text-align:center;font-size:12px;color:#9CA3AF;line-height:1.4;">No inventory data available.</td></tr>`
      : inventoryByRooftop.map(r => {
          const consoleUrl = `https://console.spyne.ai/home?enterprise_id=${enterpriseId}&team_id=${r.rooftop_id}`;
          return `<tr>
            <td style="padding:10px 10px 10px 0;border-bottom:1px solid #F3F4F6;vertical-align:middle;">
              <a href="${consoleUrl}" style="font-size:12px;font-weight:700;color:#2563EB;text-decoration:none;line-height:1.3;">${r.rooftop_name || r.rooftop_id}</a>
            </td>
            <td style="padding:10px;border-bottom:1px solid #F3F4F6;vertical-align:middle;text-align:right;font-size:12px;font-weight:700;color:#111827;white-space:nowrap;">${n(r.total_active)}</td>
            <td style="padding:10px;border-bottom:1px solid #F3F4F6;vertical-align:middle;text-align:right;font-size:12px;font-weight:700;color:#2563EB;white-space:nowrap;">${n(r.with_photos)}<span style="font-size:10px;font-weight:400;color:#6B7280;margin-left:4px;">${pct(r.with_photos_pct)}</span></td>
            <td style="padding:10px;border-bottom:1px solid #F3F4F6;vertical-align:middle;text-align:right;font-size:12px;font-weight:700;color:${r.inv_delivered > 0 ? "#059669" : "#111827"};white-space:nowrap;">${n(r.inv_delivered)}</td>
            <td style="padding:10px 0 10px 10px;border-bottom:1px solid #F3F4F6;vertical-align:middle;text-align:right;font-size:12px;font-weight:700;color:${r.inv_pending > 0 ? "#F59E0B" : "#111827"};white-space:nowrap;">${n(r.inv_pending)}</td>
          </tr>`;
        }).join("\n");

    inventorySection = `
      <!-- ══ INVENTORY SNAPSHOT (IMS MODE) ══════════════════════════════════════ -->
      <tr>
        <td class="sec-pad" style="padding:28px 28px 0;">
          ${secHead("Inventory", "Inventory Snapshot", "", "#6B7280")}
          <table width="544" class="card-row" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
            <tr>
              <td style="background:#F9FAFB;border:1px solid #E5E7EB;padding:18px 20px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
                  <tr>
                    <td style="vertical-align:middle;">
                      <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9CA3AF;line-height:1.4;margin-bottom:3px;">Inventory Snapshot</div>
                      <div style="font-size:17px;font-weight:700;color:#111827;line-height:1.3;">Your inventory as of yesterday</div>
                    </td>
                    <td align="right" style="vertical-align:middle;">
                      <div style="font-size:36px;font-weight:700;color:#111827;line-height:1;font-family:Arial,Helvetica,sans-serif;">${n(totalActive)}</div>
                      <div style="font-size:10px;color:#6B7280;margin-top:4px;text-align:right;line-height:1.4;">Total Vehicles</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          ${spacer(12)}
          <table width="544" class="card-row" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
            <tr>
              ${invCard("#2563EB", "Vehicles with Photos", withPhotos,   pct(withPhotosPct) + " of total")}
              ${invGap}
              ${invCard("#059669", "Vehicles Published",   invDelivered, "")}
              ${invGap}
              ${invCard("#F59E0B", "Vehicles Pending",     invPending,   "")}
            </tr>
          </table>
        </td>
      </tr>
      ${spacer(20)}
      <tr>
        <td class="sec-pad" style="padding:0 28px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
            <thead>
              <tr>
                <th style="padding:9px 10px 9px 0;border-bottom:2px solid #E5E7EB;text-align:left;font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9CA3AF;line-height:1.4;white-space:nowrap;">Rooftop</th>
                <th style="padding:9px 10px;border-bottom:2px solid #E5E7EB;text-align:right;font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9CA3AF;line-height:1.4;white-space:nowrap;">Total</th>
                <th style="padding:9px 10px;border-bottom:2px solid #E5E7EB;text-align:right;font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9CA3AF;line-height:1.4;white-space:nowrap;">With Photos</th>
                <th style="padding:9px 10px;border-bottom:2px solid #E5E7EB;text-align:right;font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9CA3AF;line-height:1.4;white-space:nowrap;">Published</th>
                <th style="padding:9px 0 9px 10px;border-bottom:2px solid #E5E7EB;text-align:right;font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9CA3AF;line-height:1.4;white-space:nowrap;">Pending</th>
              </tr>
            </thead>
            <tbody>${invByRooftopRows}</tbody>
          </table>
        </td>
      </tr>`;

  } else {
    const { received, invDelivered, invPending } = invKpis;
    const invByRooftopRows = !inventoryByRooftop || inventoryByRooftop.length === 0
      ? `<tr><td colspan="4" style="padding:24px 0;text-align:center;font-size:12px;color:#9CA3AF;line-height:1.4;">No data in the last 90 days.</td></tr>`
      : inventoryByRooftop.map(r => {
          const consoleUrl = `https://console.spyne.ai/home?enterprise_id=${enterpriseId}&team_id=${r.rooftop_id}`;
          return `<tr>
            <td style="padding:10px 10px 10px 0;border-bottom:1px solid #F3F4F6;vertical-align:middle;">
              <a href="${consoleUrl}" style="font-size:12px;font-weight:700;color:#2563EB;text-decoration:none;line-height:1.3;">${r.rooftop_name || r.rooftop_id}</a>
            </td>
            <td style="padding:10px;border-bottom:1px solid #F3F4F6;vertical-align:middle;text-align:right;font-size:12px;font-weight:700;color:#111827;white-space:nowrap;">${n(r.received)}</td>
            <td style="padding:10px;border-bottom:1px solid #F3F4F6;vertical-align:middle;text-align:right;font-size:12px;font-weight:700;color:${r.inv_delivered > 0 ? "#059669" : "#111827"};white-space:nowrap;">${n(r.inv_delivered)}</td>
            <td style="padding:10px 0 10px 10px;border-bottom:1px solid #F3F4F6;vertical-align:middle;text-align:right;font-size:12px;font-weight:700;color:${r.inv_pending > 0 ? "#F59E0B" : "#111827"};white-space:nowrap;">${n(r.inv_pending)}</td>
          </tr>`;
        }).join("\n");

    inventorySection = `
      <!-- ══ INVENTORY SNAPSHOT (ROLLING 90-DAY MODE) ═══════════════════════════ -->
      <tr>
        <td class="sec-pad" style="padding:28px 28px 0;">
          ${secHead("Last 3 Months", "Snapshot", "", "#6B7280")}
          <table width="544" class="card-row" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
            <tr>
              ${invCard("#2563EB", "Vehicles Received",  received,     "")}
              ${invGap}
              ${invCard("#059669", "Vehicles Published", invDelivered, "")}
              ${invGap}
              ${invCard("#F59E0B", "Vehicles Pending",   invPending,   "")}
            </tr>
          </table>
        </td>
      </tr>
      ${spacer(20)}
      <tr>
        <td class="sec-pad" style="padding:0 28px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
            <thead>
              <tr>
                <th style="padding:9px 10px 9px 0;border-bottom:2px solid #E5E7EB;text-align:left;font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9CA3AF;line-height:1.4;white-space:nowrap;">Rooftop</th>
                <th style="padding:9px 10px;border-bottom:2px solid #E5E7EB;text-align:right;font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9CA3AF;line-height:1.4;white-space:nowrap;">Received</th>
                <th style="padding:9px 10px;border-bottom:2px solid #E5E7EB;text-align:right;font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9CA3AF;line-height:1.4;white-space:nowrap;">Published</th>
                <th style="padding:9px 0 9px 10px;border-bottom:2px solid #E5E7EB;text-align:right;font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9CA3AF;line-height:1.4;white-space:nowrap;">Pending</th>
              </tr>
            </thead>
            <tbody>${invByRooftopRows}</tbody>
          </table>
        </td>
      </tr>`;
  }

  // ── Recent delivered VINs table (TAT asc, max 5) ─────────────────────────
  // processedVins is null when any vehicle has negative TAT — hide section entirely.
  const thStyle2 = `padding:9px 10px;border-bottom:2px solid #E5E7EB;text-align:left;font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9CA3AF;line-height:1.4;white-space:nowrap;`;
  const enterpriseInventoryUrl = `https://console.spyne.ai/inventory/v2/listings?enterprise_id=${enterpriseId}`;
  const vinUrl = (dealerVinId, rooftopId) =>
    dealerVinId
      ? `https://console.spyne.ai/inventory/v2/listings/${dealerVinId}?enterprise_id=${enterpriseId}&team_id=${rooftopId}`
      : null;

  let recentVinsSection = "";
  if (processedVins && processedVins.length > 0) {
    const receivedMore = Math.max(0, (processedVinsTotal || 0) - processedVins.length);
    const recentRows = processedVins.map(v => {
      const vehicleName = [clean(v.year), clean(v.make), clean(v.model)].filter(Boolean).join(" ") || null;
      const trimLine    = clean(v.trim);
      const stockLine   = clean(v.stock_number);
      const vUrl        = vinUrl(v.dealer_vin_id, v.rooftop_id);
      const thumb       = v.thumbnail_url
        ? `<img src="${v.thumbnail_url}" alt="" width="80" style="display:block;width:80px;height:auto;border:0;">`
        : `<div style="width:80px;height:56px;background:#F3F4F6;font-size:0;line-height:0;">&nbsp;</div>`;
      return `<tr>
        <td style="padding:10px 10px 10px 0;border-bottom:1px solid #F3F4F6;vertical-align:middle;">${thumb}</td>
        <td style="padding:10px;border-bottom:1px solid #F3F4F6;vertical-align:middle;">
          ${vehicleName ? `<div style="font-size:12px;font-weight:700;color:#111827;line-height:1.3;margin-bottom:2px;">${vehicleName}</div>` : `<div style="font-size:12px;font-weight:700;color:#6B7280;line-height:1.3;margin-bottom:2px;">—</div>`}
          ${trimLine ? `<div style="font-size:10.5px;color:#6B7280;line-height:1.3;margin-bottom:3px;">${trimLine}</div>` : ""}
          <div style="font-size:10px;color:#9CA3AF;line-height:1.4;">${v.vin}</div>
          ${stockLine ? `<div style="font-size:10px;color:#9CA3AF;line-height:1.4;">Stock&nbsp;#${stockLine}</div>` : ""}
          ${v.rooftop_name ? `<div style="font-size:10px;color:#6B7280;line-height:1.4;margin-top:2px;">${v.rooftop_name}</div>` : ""}
        </td>
        <td style="padding:10px 0 10px 10px;border-bottom:1px solid #F3F4F6;vertical-align:middle;text-align:right;white-space:nowrap;">
          <div style="font-size:10px;color:#9CA3AF;line-height:1.6;">Received&nbsp;&nbsp;${formatDt(v.received_at)}</div>
          <div style="font-size:10px;color:#9CA3AF;line-height:1.6;">Published&nbsp;&nbsp;${formatDt(v.processed_at)}</div>
          <div style="font-size:11px;font-weight:700;color:#059669;line-height:1.6;margin-top:1px;">TAT&nbsp;&nbsp;${formatTat(v.ttd_hrs)}</div>
        </td>
        <td style="padding:10px 0 10px 10px;border-bottom:1px solid #F3F4F6;vertical-align:middle;text-align:center;white-space:nowrap;">
          ${vUrl ? `<a href="${vUrl}" style="display:inline-block;padding:4px 8px;color:#2563EB;font-size:10px;font-weight:600;text-decoration:none;font-family:Arial,Helvetica,sans-serif;letter-spacing:0.01em;">View &rarr;</a>` : ""}
        </td>
      </tr>`;
    }).join("\n");

    const showMoreCta = receivedMore === 0 ? "" :
      `<div style="margin-top:14px;text-align:center;">
         <a href="${enterpriseInventoryUrl}" style="display:inline-block;padding:8px 20px;background:#ffffff;border:1px solid #D1D5DB;color:#374151;font-size:12px;font-weight:600;text-decoration:none;border-radius:4px;font-family:Arial,Helvetica,sans-serif;">+${receivedMore} more vehicle${receivedMore !== 1 ? "s" : ""} received</a>
       </div>`;

    recentVinsSection = `
      <!-- ══ RECENT VEHICLES ═════════════════════════════════════════════════════ -->
      <tr>
        <td class="sec-pad" style="padding:28px 28px 24px;background:#F9FAFB;">
          ${secHead("", "Recent Vehicles", "")}
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
            <thead>
              <tr>
                <th style="${thStyle2}padding-left:0;">Photo</th>
                <th style="${thStyle2}">Vehicle</th>
                <th style="${thStyle2}text-align:right;">Timeline</th>
                <th style="${thStyle2}padding-right:0;text-align:center;"></th>
              </tr>
            </thead>
            <tbody>${recentRows}</tbody>
          </table>
          ${showMoreCta}
        </td>
      </tr>`;
  }

  // ── Recent published VINs section (quiet days only) ──────────────────────
  let recentPublishedSection = "";
  if (quietDay && recentPublishedVins && recentPublishedVins.length > 0) {
    const recentPubRows = recentPublishedVins.map(v => {
      const vehicleName = [clean(v.year), clean(v.make), clean(v.model)].filter(Boolean).join(" ") || null;
      const trimLine    = clean(v.trim);
      const stockLine   = clean(v.stock_number);
      const vUrl        = vinUrl(v.dealer_vin_id, v.rooftop_id);
      const thumb       = v.thumbnail_url
        ? `<img src="${v.thumbnail_url}" alt="" width="80" style="display:block;width:80px;height:auto;border:0;">`
        : `<div style="width:80px;height:56px;background:#F3F4F6;font-size:0;line-height:0;">&nbsp;</div>`;
      return `<tr>
        <td style="padding:10px 10px 10px 0;border-bottom:1px solid #F3F4F6;vertical-align:middle;">${thumb}</td>
        <td style="padding:10px;border-bottom:1px solid #F3F4F6;vertical-align:middle;">
          ${vehicleName ? `<div style="font-size:12px;font-weight:700;color:#111827;line-height:1.3;margin-bottom:2px;">${vehicleName}</div>` : `<div style="font-size:12px;font-weight:700;color:#6B7280;line-height:1.3;margin-bottom:2px;">—</div>`}
          ${trimLine ? `<div style="font-size:10.5px;color:#6B7280;line-height:1.3;margin-bottom:3px;">${trimLine}</div>` : ""}
          <div style="font-size:10px;color:#9CA3AF;line-height:1.4;">${v.vin}</div>
          ${stockLine ? `<div style="font-size:10px;color:#9CA3AF;line-height:1.4;">Stock&nbsp;#${stockLine}</div>` : ""}
          ${v.rooftop_name ? `<div style="font-size:10px;color:#6B7280;line-height:1.4;margin-top:2px;">${v.rooftop_name}</div>` : ""}
        </td>
        <td style="padding:10px 0 10px 10px;border-bottom:1px solid #F3F4F6;vertical-align:middle;text-align:right;white-space:nowrap;">
          <div style="font-size:10px;color:#9CA3AF;line-height:1.6;">Received&nbsp;&nbsp;${formatDt(v.received_at)}</div>
          <div style="font-size:10px;color:#9CA3AF;line-height:1.6;">Published&nbsp;&nbsp;${formatDt(v.processed_at)}</div>
          <div style="font-size:11px;font-weight:700;color:#059669;line-height:1.6;margin-top:1px;">TAT&nbsp;&nbsp;${formatTat(v.ttd_hrs)}</div>
        </td>
        <td style="padding:10px 0 10px 10px;border-bottom:1px solid #F3F4F6;vertical-align:middle;text-align:center;white-space:nowrap;">
          ${vUrl ? `<a href="${vUrl}" style="display:inline-block;padding:4px 8px;color:#2563EB;font-size:10px;font-weight:600;text-decoration:none;font-family:Arial,Helvetica,sans-serif;letter-spacing:0.01em;">View &rarr;</a>` : ""}
        </td>
      </tr>`;
    }).join("\n");

    recentPublishedSection = `
      <!-- ══ RECENT VEHICLES (quiet day) ═══════════════════════════════════════ -->
      <tr>
        <td class="sec-pad" style="padding:28px 28px 24px;background:#F9FAFB;">
          ${secHead("", "Recent Vehicles", "Most recently published vehicles across all rooftops")}
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
            <thead>
              <tr>
                <th style="${thStyle2}padding-left:0;">Photo</th>
                <th style="${thStyle2}">Vehicle</th>
                <th style="${thStyle2}text-align:right;">Timeline</th>
                <th style="${thStyle2}padding-right:0;text-align:center;"></th>
              </tr>
            </thead>
            <tbody>${recentPubRows}</tbody>
          </table>
        </td>
      </tr>`;
  }

  // ── Per-rooftop breakdown table ───────────────────────────────────────────
  const thStyle = `padding:9px 10px;border-bottom:2px solid #E5E7EB;text-align:left;font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9CA3AF;line-height:1.4;white-space:nowrap;`;

  // Only show the Avg TAT column if at least one rooftop has a computable TAT value.
  const showTat = Array.isArray(topProcessed) && topProcessed.some(r => r.avg_ttd_hrs != null);
  const colSpan = showTat ? 5 : 4;

  const rooftopRows = !topProcessed || topProcessed.length === 0
    ? `<tr><td colspan="${colSpan}" style="padding:24px 0;text-align:center;font-size:12px;color:#9CA3AF;line-height:1.4;">No vehicles were received yesterday.</td></tr>`
    : topProcessed.map(r => {
        const consoleUrl = `https://console.spyne.ai/home?enterprise_id=${enterpriseId}&team_id=${r.rooftop_id}`;
        return `<tr>
          <td style="padding:10px 10px 10px 0;border-bottom:1px solid #F3F4F6;vertical-align:middle;">
            <a href="${consoleUrl}" style="font-size:12px;font-weight:700;color:#2563EB;text-decoration:none;line-height:1.3;">${r.rooftop_name || r.rooftop_id}</a>
          </td>
          <td style="padding:10px;border-bottom:1px solid #F3F4F6;vertical-align:middle;text-align:right;font-size:12px;font-weight:700;color:#111827;white-space:nowrap;">${n(r.new_vins)}</td>
          <td style="padding:10px;border-bottom:1px solid #F3F4F6;vertical-align:middle;text-align:right;font-size:12px;font-weight:700;color:${Number(r.vins_delivered) > 0 ? "#059669" : "#111827"};white-space:nowrap;">${n(r.vins_delivered)}</td>
          <td style="padding:10px;border-bottom:1px solid #F3F4F6;vertical-align:middle;text-align:right;font-size:12px;font-weight:700;color:${Number(r.vins_pending) > 0 ? "#F59E0B" : "#111827"};white-space:nowrap;">${n(r.vins_pending)}</td>
          ${showTat ? `<td style="padding:10px 0 10px 10px;border-bottom:1px solid #F3F4F6;vertical-align:middle;text-align:right;font-size:12px;font-weight:700;color:${r.avg_ttd_hrs != null ? "#059669" : "#9CA3AF"};white-space:nowrap;">${formatTat(r.avg_ttd_hrs)}</td>` : ""}
        </tr>`;
      }).join("\n");

  // ── Full HTML ─────────────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<!--[if mso]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<title>Studio AI Group Report — ${enterpriseName}</title>
<style>
  @media screen and (max-width:600px) {
    .sec-pad { padding-left:16px !important; padding-right:16px !important; }
    .card-row { width:100% !important; }
    .card-cell { width:32% !important; }
    .card-gap  { width:2%  !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#EBEBEB;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;background:#EBEBEB;">
  <tr>
    <td align="center" style="padding:32px 16px 48px;">
      <!--[if mso]><table width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;max-width:600px;width:100%;background:#FFFFFF;">

        <!-- ══ HEADER ══════════════════════════════════════════════════════════ -->
        <tr>
          <td style="padding:20px 28px;background:#FFFFFF;border-bottom:2px solid #E5E7EB;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
              <tr>
                <td style="vertical-align:middle;">
                  <img src="${SPYNE_LOGO_SRC}" alt="Spyne" width="80" style="display:block;width:80px;height:auto;border:0;">
                </td>
                <td align="right" style="vertical-align:middle;">
                  <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#111827;line-height:1.3;">${enterpriseName}</div>
                  <div style="font-size:10px;color:#6B7280;margin-top:3px;line-height:1.3;letter-spacing:0.04em;">Studio AI &middot; Group Report</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ══ DATE STRIP ══════════════════════════════════════════════════════ -->
        <tr>
          <td style="padding:10px 28px;background:#F9FAFB;border-bottom:1px solid #E5E7EB;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
              <tr>
                <td style="font-size:11.5px;color:#6B7280;line-height:1.4;">
                  Reporting date:&nbsp;<strong style="color:#111827;">${dateLabel}</strong>
                </td>
                <td align="right" style="font-size:11px;color:#6B7280;line-height:1.4;white-space:nowrap;">
                  <strong style="color:#111827;">${n(rooftopCount)}</strong>&nbsp;active rooftop${rooftopCount !== 1 ? "s" : ""}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ══ INTRO ════════════════════════════════════════════════════════════ -->
        <tr>
          <td style="padding:28px 28px 24px;">
            <div style="font-size:19px;font-weight:700;color:#111827;line-height:1.3;margin-bottom:8px;">Hi ${enterpriseName},</div>
            <div style="font-size:13px;color:#6B7280;line-height:1.7;">${quietDay
              ? `No new vehicles were received on <strong style="color:#111827;">${dateLabel}</strong>. Here&rsquo;s a snapshot of your current inventory.`
              : `Here&rsquo;s your Studio AI group delivery summary for <strong style="color:#111827;">${dateLabel}</strong>. We received <strong style="color:#111827;">${n(newVins)}&thinsp;vehicle${newVins !== 1 ? "s" : ""}</strong> across <strong style="color:#111827;">${topProcessed.length}&thinsp;rooftop${topProcessed.length !== 1 ? "s" : ""}</strong> yesterday.`
            }</div>
          </td>
        </tr>

        ${rule()}

        <!-- ══ YESTERDAY'S SNAPSHOT — hidden on quiet days ═════════════════════ -->
        ${!quietDay ? `
        <tr>
          <td class="sec-pad" style="padding:28px 28px 0;">
            ${secHead("Yesterday", "Performance Snapshot", "Vehicles and images received, published, and pending across all rooftops", "#2563EB")}
            ${yesterdayCards}
          </td>
        </tr>

        ${spacer(28)}
        ${rule()}

        <!-- ══ ROOFTOP BREAKDOWN — hidden on quiet days ════════════════════════ -->
        <tr>
          <td class="sec-pad" style="padding:28px 28px 24px;background:#F9FAFB;">
            ${secHead("Yesterday", "Rooftop Breakdown", "", "#2563EB")}
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
              <thead>
                <tr>
                  <th style="${thStyle}padding-left:0;">Rooftop</th>
                  <th style="${thStyle}text-align:right;">Received</th>
                  <th style="${thStyle}text-align:right;">Published</th>
                  <th style="${thStyle}text-align:right;">Pending</th>
                  ${showTat ? `<th style="${thStyle}padding-right:0;text-align:right;">Avg TAT</th>` : ""}
                </tr>
              </thead>
              <tbody>${rooftopRows}</tbody>
            </table>
          </td>
        </tr>

        ${rule()}

        ${recentVinsSection}

        ${recentVinsSection ? rule() : ""}
        ` : ""}

        ${inventorySection}

        ${recentPublishedSection ? `${rule()}${recentPublishedSection}` : ""}

        ${rule()}

        <!-- ══ CONTACT SUPPORT ═════════════════════════════════════════════════ -->
        <tr>
          <td style="padding:28px 28px;background:#F9FAFB;text-align:center;">
            <div style="font-size:15px;font-weight:700;color:#111827;line-height:1.3;margin-bottom:6px;">Have questions about your report?</div>
            <div style="font-size:12px;color:#6B7280;line-height:1.6;margin-bottom:20px;">Our team is available to help with any queries about your Studio AI deliveries.</div>
            <a href="mailto:support@spyne.ai" style="display:inline-block;background:#2563EB;color:#FFFFFF;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:12px 28px;text-decoration:none;mso-padding-alt:12px 28px;">Contact Support</a>
          </td>
        </tr>

        ${rule()}

        <!-- ══ FOOTER ══════════════════════════════════════════════════════════ -->
        <tr>
          <td style="padding:16px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
              <tr>
                <td style="font-size:10px;color:#9CA3AF;line-height:1.7;vertical-align:middle;">
                  Spyne Inc.&nbsp;&middot;&nbsp;1013 Centre Road, Suite 403-B, Wilmington, DE 19805
                </td>
                <td align="right" style="vertical-align:middle;padding-left:16px;">
                  <img src="${SPYNE_LOGO_SRC}" alt="Spyne" width="48" style="display:block;width:48px;height:auto;border:0;">
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
