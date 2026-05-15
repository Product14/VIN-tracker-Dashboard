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
    avgTtlDaysYesterday,
    avgScoreYesterday,
    // Inventory totals (IMS-on) / inv90 fields populated when IMS-off
    totalActive, withPhotos,
    totalDelivered,
    noImagesTotal,
    avgTtlDaysInventory,
    avgScoreInventory,
    // Tables
    recentVins,
    recentVinsTotal,
  } = data;

  const inventoryBaseUrl = `https://console.spyne.ai/inventory/v2/listings?enterprise_id=${enterpriseId || ""}${rooftopId ? `&team_id=${rooftopId}` : ""}`;
  const vinUrl = (dealerVinId) =>
    dealerVinId
      ? `https://console.spyne.ai/inventory/v2/listings/${dealerVinId}?enterprise_id=${enterpriseId || ""}${rooftopId ? `&team_id=${rooftopId}` : ""}`
      : null;

  // True when no vehicles were received yesterday at all — drives zero-state layout.
  const quietDay = !newVins || newVins === 0;

  // ── Public base URL ────────────────────────────────────────────────────────
  // Donut graphic is served from /api/donut.svg on this app's own server. Reuses
  // DASHBOARD_URL (already set in Vercel and used elsewhere in the codebase as
  // the canonical public hostname). Falls back to Vercel's auto-injected
  // VERCEL_URL for preview deploys, then empty for local dev.
  const DASHBOARD_URL = process.env.DASHBOARD_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  const donutImg = ({ green = 0, amber = 0, total = 100, center = "", label = "" }, size = 150) => {
    const qs = new URLSearchParams({
      green: String(green), amber: String(amber), total: String(total),
      center, label, w: String(size),
    }).toString();
    return `<img src="${DASHBOARD_URL}/api/donut.svg?${qs}" width="${size}" height="${size}" alt="" style="display:block;width:${size}px;height:${size}px;border:0;outline:none;text-decoration:none;" />`;
  };

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

  // ── Recent Vehicles rows ───────────────────────────────────────────────────
  const recentRowsHtml = recentVins.length === 0
    ? `<tr><td colspan="5" style="padding:20px 0;text-align:center;font-size:12px;color:#9CA3AF;font-family:Arial,Helvetica,sans-serif;">No vehicles delivered in the last 90 days.</td></tr>`
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
          <td style="padding:10px 12px 10px 0;vertical-align:middle;${rowBorder}font-family:-apple-system,BlinkMacSystemFont,Arial,Helvetica,sans-serif;">
            <div style="font-size:12.5px;font-weight:600;color:#0c1322;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${vehicleName}${trimLine ? ` <span style="color:#98a0ad;font-weight:500;">· ${trimLine}</span>` : ""}</div>
            <div style="font-size:10.5px;color:#98a0ad;margin-top:1px;line-height:1.25;">${v.vin || ""}${stockLine ? ` · Stock #${stockLine}` : ""}</div>
          </td>
          <td style="padding:10px 12px 10px 0;vertical-align:middle;${rowBorder}width:80px;white-space:nowrap;">
            <span style="display:inline-block;padding:3px 8px;border-radius:999px;background:${tatBg};color:${tatFg};font-size:11px;font-weight:700;letter-spacing:0.2px;font-family:Arial,Helvetica,sans-serif;">${tatLabel}</span>
          </td>
          <td style="padding:10px 12px 10px 0;vertical-align:middle;${rowBorder}width:110px;white-space:nowrap;">
            <span style="display:inline-block;padding:3px 8px 3px 7px;border-radius:999px;background:#e7f7ee;color:#16a34a;font-size:11px;font-weight:700;letter-spacing:0.2px;font-family:Arial,Helvetica,sans-serif;">&#9679;&nbsp;Delivered</span>
          </td>
          <td style="padding:10px 0 10px 0;vertical-align:middle;${rowBorder}width:50px;text-align:right;white-space:nowrap;">
            <a href="${vUrl}" style="font-size:11px;font-weight:600;color:#2f6bff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">View &rarr;</a>
          </td>
        </tr>`;
      }).join("\n");

  // ── Pill / chip helpers ────────────────────────────────────────────────────
  // Each chip is its own <td> in a 2-cell table — survives Gmail without flex.
  const chip = (bg, fg, lblColor, label, value) => `
    <td valign="middle" style="background:${bg};padding:6px 10px;border-radius:999px;font-family:-apple-system,BlinkMacSystemFont,Arial,Helvetica,sans-serif;">
      <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
        <tr>
          <td valign="middle" style="padding:0 8px 0 0;">
            <span style="display:inline-block;font-size:9px;font-weight:700;letter-spacing:0.3px;text-transform:uppercase;color:${lblColor};opacity:0.85;">${label}</span>
          </td>
          <td valign="middle" style="padding:0;">
            <span style="font-size:12.5px;font-weight:700;color:${fg};letter-spacing:-0.2px;">${value}</span>
          </td>
        </tr>
      </table>
    </td>`;

  // Format Time to Line as "Xd Yh" / "Yh" / "Zm" — never shows fractional days.
  // Input is a number of days (e.g. 0.2, 1.5, 12.0). Returns null if input is null.
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

  const buildChipsRow = (ttlDays, score) => {
    const cells = [];
    const ttlStr = formatTtl(ttlDays);
    if (ttlStr != null) cells.push(chip("#efeaff", "#5b3ce8", "#5b3ce8", "Time to Line", ttlStr));
    if (score  != null) cells.push(chip("#eaf0ff", "#1a4ad6", "#1a4ad6", "Media Score",  Number(score).toFixed(1)));
    if (cells.length === 0) return "";
    const sep = `<td width="6" style="width:6px;font-size:0;line-height:0;">&nbsp;</td>`;
    return `
      <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;margin-top:12px;border-top:1px solid #e7e9ee;padding-top:12px;width:100%;">
        <tr><td style="padding:12px 0 0;">
          <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
            <tr>${cells.join(sep)}</tr>
          </table>
        </td></tr>
      </table>`;
  };

  // ── Card builder (Yesterday and Inventory share the same shell) ────────────
  // Layout per card: 2-column table (donut left, legend right). The donut is an
  // <img> pointing at /api/donut.svg so Gmail renders it via image proxy.
  const buildCard = ({ title, donut, legend, chipsHtml, widthPct = "50%" }) => `
    <td valign="top" style="width:${widthPct};background:#FFFFFF;border:1px solid #e7e9ee;border-radius:14px;padding:14px 16px;font-family:-apple-system,BlinkMacSystemFont,Arial,Helvetica,sans-serif;">
      <div style="font-size:11px;letter-spacing:0.8px;text-transform:uppercase;color:#5b6577;font-weight:600;margin-bottom:6px;line-height:1.4;">${title}</div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
        <tr>
          <td valign="middle" width="150" style="width:150px;padding-right:10px;">${donut}</td>
          <td valign="middle" style="border-left:1px solid #e7e9ee;padding-left:14px;">${legend}</td>
        </tr>
      </table>
      ${chipsHtml}
    </td>`;

  const legendRow = (dotColor, label, primary, secondary) => `
    <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;margin-bottom:12px;">
      <tr>
        <td valign="middle" style="padding-right:10px;">
          <div style="width:10px;height:10px;border-radius:3px;background:${dotColor};font-size:0;line-height:10px;">&nbsp;</div>
        </td>
        <td valign="middle">
          <div style="font-size:10.5px;color:#98a0ad;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;line-height:1.3;white-space:nowrap;">${label}</div>
          <div style="margin-top:2px;line-height:1;">
            <span style="font-size:18px;font-weight:700;color:#0c1322;letter-spacing:-0.3px;">${primary}</span>${secondary ? `<span style="font-size:18px;font-weight:500;color:#98a0ad;letter-spacing:-0.3px;">${secondary}</span>` : ""}
          </div>
        </td>
      </tr>
    </table>`;

  // Yesterday card is hidden on quiet days (no vehicles received yesterday) —
  // the Inventory card then expands to full width.
  const yesterdayCard = quietDay ? "" : buildCard({
    title: "Yesterday",
    donut: donutImg({ green: vinsDelivered, amber: vinsPending || 0, total: Math.max(newVins, 1), center: yCenter, label: yLabel }),
    legend: `
      ${legendRow("#16a34a", "Vehicles Shot",      n(newVins),       "")}
      ${legendRow("#16a34a", "Vehicles Delivered", n(vinsDelivered), "")}
    `.trim(),
    chipsHtml: buildChipsRow(avgTtlDaysYesterday, avgScoreYesterday),
  });

  const inventoryCard = buildCard({
    title: "Inventory &middot; Till Yesterday",
    donut: donutImg({ green: invDelivered, amber: invNoPhotos, total: Math.max(invTotal, 1), center: n(invTotal), label: "INVENTORY" }),
    legend: `
      ${legendRow("#16a34a", "Delivered", n(invDelivered), `/${n(invWithPhotos)}`)}
      ${legendRow("#d97706", "No Photos", n(invNoPhotos),  "")}
    `.trim(),
    chipsHtml: buildChipsRow(avgTtlDaysInventory, avgScoreInventory),
    widthPct: quietDay ? "100%" : "50%",
  });

  const cardsRow = quietDay
    ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;"><tr>${inventoryCard}</tr></table>`
    : `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;"><tr>${yesterdayCard}<td width="14" style="width:14px;min-width:14px;font-size:0;line-height:0;">&nbsp;</td>${inventoryCard}</tr></table>`;

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
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,Arial,Helvetica,sans-serif;color:#0c1322;">
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
                  <span style="font-size:20px;font-weight:500;color:#5b6577;letter-spacing:-0.2px;">&nbsp;across the rooftop</span>
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
                <td valign="middle" style="vertical-align:middle;font-size:11px;letter-spacing:0.8px;text-transform:uppercase;color:#5b6577;font-weight:600;font-family:Arial,Helvetica,sans-serif;">Recent Vehicles &middot; Latest activity</td>
                <td align="right" valign="middle" style="vertical-align:middle;text-align:right;">
                  <a href="${inventoryBaseUrl}" style="font-size:11px;font-weight:600;color:#2f6bff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">View all &rarr;</a>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
              <thead>
                <tr>
                  <th style="padding:4px 12px 8px 0;border-bottom:1px solid #e7e9ee;text-align:left;font-size:9.5px;letter-spacing:0.8px;text-transform:uppercase;color:#98a0ad;font-weight:700;font-family:Arial,Helvetica,sans-serif;"></th>
                  <th style="padding:4px 12px 8px 0;border-bottom:1px solid #e7e9ee;text-align:left;font-size:9.5px;letter-spacing:0.8px;text-transform:uppercase;color:#98a0ad;font-weight:700;font-family:Arial,Helvetica,sans-serif;">Vehicle</th>
                  <th style="padding:4px 12px 8px 0;border-bottom:1px solid #e7e9ee;text-align:left;font-size:9.5px;letter-spacing:0.8px;text-transform:uppercase;color:#98a0ad;font-weight:700;font-family:Arial,Helvetica,sans-serif;">TAT</th>
                  <th style="padding:4px 12px 8px 0;border-bottom:1px solid #e7e9ee;text-align:left;font-size:9.5px;letter-spacing:0.8px;text-transform:uppercase;color:#98a0ad;font-weight:700;font-family:Arial,Helvetica,sans-serif;">Status</th>
                  <th style="padding:4px 0 8px 0;border-bottom:1px solid #e7e9ee;text-align:right;font-size:9.5px;letter-spacing:0.8px;text-transform:uppercase;color:#98a0ad;font-weight:700;font-family:Arial,Helvetica,sans-serif;"></th>
                </tr>
              </thead>
              <tbody>${recentRowsHtml}</tbody>
            </table>
          </td>
        </tr>

        <tr><td style="height:16px;font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- ══ FOOTER CTA ══════════════════════════════════════════════════════ -->
        <tr>
          <td style="background:#FFFFFF;border:1px solid #e7e9ee;border-radius:14px;padding:14px 18px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
              <tr>
                <td valign="middle" style="vertical-align:middle;font-size:12.5px;color:#5b6577;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,Arial,Helvetica,sans-serif;">
                  Want the full breakdown? <b style="color:#0c1322;">Vehicle-level history, photos &amp; all other info</b> live in the console.
                </td>
                <td align="right" valign="middle" style="vertical-align:middle;padding-left:16px;">
                  <a href="${inventoryBaseUrl}" style="display:inline-block;background:#0c1322;color:#FFFFFF;font-size:12.5px;font-weight:600;padding:9px 14px;border-radius:9px;text-decoration:none;font-family:Arial,Helvetica,sans-serif;mso-padding-alt:9px 14px;">Open console &rarr;</a>
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
        ${kpiCard("#059669", "Vehicles Delivered", vinsDelivered, imagesProcessed)}
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
              ${invCard("#059669", "Vehicles Delivered",   invDelivered, "")}
              ${invGap}
              ${invCard("#F59E0B", "Vehicles Pending",     invPending,   "")}
            </tr>
          </table>
        </td>
      </tr>
      ${spacerRow(20)}
      <tr>
        <td class="sec-pad" style="padding:0 28px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
            <thead>
              <tr>
                <th style="padding:9px 10px 9px 0;border-bottom:2px solid #E5E7EB;text-align:left;font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9CA3AF;line-height:1.4;white-space:nowrap;">Rooftop</th>
                <th style="padding:9px 10px;border-bottom:2px solid #E5E7EB;text-align:right;font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9CA3AF;line-height:1.4;white-space:nowrap;">Total</th>
                <th style="padding:9px 10px;border-bottom:2px solid #E5E7EB;text-align:right;font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9CA3AF;line-height:1.4;white-space:nowrap;">With Photos</th>
                <th style="padding:9px 10px;border-bottom:2px solid #E5E7EB;text-align:right;font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9CA3AF;line-height:1.4;white-space:nowrap;">Delivered</th>
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
              ${invCard("#059669", "Vehicles Delivered", invDelivered, "")}
              ${invGap}
              ${invCard("#F59E0B", "Vehicles Pending",   invPending,   "")}
            </tr>
          </table>
        </td>
      </tr>
      ${spacerRow(20)}
      <tr>
        <td class="sec-pad" style="padding:0 28px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
            <thead>
              <tr>
                <th style="padding:9px 10px 9px 0;border-bottom:2px solid #E5E7EB;text-align:left;font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9CA3AF;line-height:1.4;white-space:nowrap;">Rooftop</th>
                <th style="padding:9px 10px;border-bottom:2px solid #E5E7EB;text-align:right;font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9CA3AF;line-height:1.4;white-space:nowrap;">Received</th>
                <th style="padding:9px 10px;border-bottom:2px solid #E5E7EB;text-align:right;font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9CA3AF;line-height:1.4;white-space:nowrap;">Delivered</th>
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
    const groupRecentUseTat = processedVins.every(v => v.ttd_hrs == null || Number(v.ttd_hrs) <= 8);
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
          <div style="font-size:10px;color:#9CA3AF;line-height:1.6;">Delivered&nbsp;&nbsp;${formatDt(v.processed_at)}</div>
          ${groupRecentUseTat
            ? `<div style="font-size:11px;font-weight:700;color:#059669;line-height:1.6;margin-top:1px;">TAT&nbsp;&nbsp;${formatTat(v.ttd_hrs)}</div>`
            : `<div style="font-size:11px;font-weight:700;color:#059669;line-height:1.6;margin-top:1px;">Delivered</div>`}
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
    const groupQuietUseTat = recentPublishedVins.every(v => v.ttd_hrs == null || Number(v.ttd_hrs) <= 8);
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
          <div style="font-size:10px;color:#9CA3AF;line-height:1.6;">Delivered&nbsp;&nbsp;${formatDt(v.processed_at)}</div>
          ${groupQuietUseTat
            ? `<div style="font-size:11px;font-weight:700;color:#059669;line-height:1.6;margin-top:1px;">TAT&nbsp;&nbsp;${formatTat(v.ttd_hrs)}</div>`
            : `<div style="font-size:11px;font-weight:700;color:#059669;line-height:1.6;margin-top:1px;">Delivered</div>`}
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
          ${secHead("", "Recent Vehicles", "Most recently delivered vehicles across all rooftops")}
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
            <div style="font-size:19px;font-weight:700;color:#111827;line-height:1.3;margin-bottom:8px;">${enterpriseName}</div>
            <div style="font-size:13px;color:#6B7280;line-height:1.7;">${quietDay
              ? `No new vehicles were received on <strong style="color:#111827;">${dateLabel}</strong>. Here&rsquo;s a snapshot of your current inventory.`
              : `Here&rsquo;s your Studio AI group delivery summary for <strong style="color:#111827;">${dateLabel}</strong>. We received <strong style="color:#111827;">${n(newVins)}&thinsp;vehicle${newVins !== 1 ? "s" : ""}</strong> across <strong style="color:#111827;">${topProcessed.length}&thinsp;rooftop${topProcessed.length !== 1 ? "s" : ""}</strong> yesterday.`
            }</div>
          </td>
        </tr>

        ${ruleRow()}

        <!-- ══ YESTERDAY'S SNAPSHOT — hidden on quiet days ═════════════════════ -->
        ${!quietDay ? `
        <tr>
          <td class="sec-pad" style="padding:28px 28px 0;">
            ${secHead("Yesterday", "Performance Snapshot", "Vehicles and images received, delivered, and pending across all rooftops", "#2563EB")}
            ${yesterdayCards}
          </td>
        </tr>

        ${spacerRow(28)}
        ${ruleRow()}

        <!-- ══ ROOFTOP BREAKDOWN — hidden on quiet days ════════════════════════ -->
        <tr>
          <td class="sec-pad" style="padding:28px 28px 24px;background:#F9FAFB;">
            ${secHead("Yesterday", "Rooftop Breakdown", "", "#2563EB")}
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
              <thead>
                <tr>
                  <th style="${thStyle}padding-left:0;">Rooftop</th>
                  <th style="${thStyle}text-align:right;">Received</th>
                  <th style="${thStyle}text-align:right;">Delivered</th>
                  <th style="${thStyle}text-align:right;">Pending</th>
                  ${showTat ? `<th style="${thStyle}padding-right:0;text-align:right;">Avg TAT</th>` : ""}
                </tr>
              </thead>
              <tbody>${rooftopRows}</tbody>
            </table>
          </td>
        </tr>

        ${ruleRow()}

        ${recentVinsSection}

        ${recentVinsSection ? ruleRow() : ""}
        ` : ""}

        ${inventorySection}

        ${recentPublishedSection ? `${ruleRow()}${recentPublishedSection}` : ""}

        ${ruleRow()}

        <!-- ══ CONTACT SUPPORT ═════════════════════════════════════════════════ -->
        <tr>
          <td style="padding:28px 28px;background:#F9FAFB;text-align:center;">
            <div style="font-size:15px;font-weight:700;color:#111827;line-height:1.3;margin-bottom:6px;">Have questions about your report?</div>
            <div style="font-size:12px;color:#6B7280;line-height:1.6;margin-bottom:20px;">Our team is available to help with any queries about your Studio AI deliveries.</div>
            <a href="mailto:support@spyne.ai" style="display:inline-block;background:#2563EB;color:#FFFFFF;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:12px 28px;text-decoration:none;mso-padding-alt:12px 28px;">Contact Support</a>
          </td>
        </tr>

        ${ruleRow()}

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
