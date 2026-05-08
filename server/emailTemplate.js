// ─── Email HTML Template ──────────────────────────────────────────────────────
// Builds a self-contained HTML email from a computeSummary() payload.
//
// Usage:
//   import { buildEmailHtml } from "./emailTemplate.js";
//   const html = buildEmailHtml(summary, "12:00 PM IST");

const BRAND_COLOR  = "#1a1a2e";
const ACCENT_COLOR = "#4f46e5";
const GREEN        = "#16a34a";
const RED          = "#dc2626";
const AMBER        = "#d97706";
const GRAY_BG      = "#f8f9fa";
const BORDER_COLOR = "#e2e8f0";
const TEXT_MAIN    = "#1e293b";
const TEXT_MUTED   = "#64748b";

// Strip @spyne.ai (or any domain) from CSM email to get a display name
function csmLabel(email) {
  if (!email) return "—";
  const local = email.split("@")[0];
  // Convert dot/underscore separators to Title Case
  return local
    .split(/[._]/)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function fmt(n) {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-IN");
}

function score(val) {
  if (val == null) return "—";
  return Number(val).toFixed(1);
}

function scoreColor(val) {
  if (val == null) return TEXT_MUTED;
  if (val >= 8) return "#166534";
  if (val >= 6) return "#92400e";
  return "#991b1b";
}

const REPORT_REASONS = [
  { key: "reasonNoRecipient",       label: "No Recipient"        },
  { key: "reasonImsOff",            label: "IMS Off"             },
  { key: "reasonNoActiveInventory", label: "No Active Inventory" },
  { key: "reasonNoVehicles90Days",  label: "No Vehicles 90 Days" },
  { key: "reasonPendingVins",       label: "Pending VINs"        },
  { key: "reasonNegativeTat",       label: "Negative TAT"        },
  { key: "reasonLowPhotoCoverage",  label: "Low Photo Coverage"  },
  { key: "reasonAlreadySent",       label: "Already Sent"        },
  { key: "reasonTimedOut",          label: "Timed Out"           },
];

// ─── Partial builders ─────────────────────────────────────────────────────────

function kpiCard(label, value, color, width) {
  const borderTop = color ? `border-top: 3px solid ${color};` : "";
  const w = width || "20%";
  return `
    <td style="width:${w}; padding:6px;" valign="top">
      <div style="background:#fff; border:1px solid ${BORDER_COLOR}; border-radius:8px; padding:10px 14px; ${borderTop}">
        <div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:${TEXT_MUTED}; margin-bottom:3px;">${label}</div>
        <div style="font-size:24px; font-weight:700; color:${TEXT_MAIN}; line-height:1;">${fmt(value)}</div>
      </div>
    </td>`;
}


function tableRow(cells, zebra) {
  const bg = zebra ? "#fff" : "#f8fafc";
  const tds = cells.map(c => {
    const color = c.color || (c.muted ? TEXT_MUTED : TEXT_MAIN);
    const fw = c.color ? "font-weight:600;" : "";
    return `<td style="padding:9px 12px; font-size:13px; color:${color}; ${fw} text-align:${c.align || "right"}; border-bottom:1px solid ${BORDER_COLOR}; white-space:nowrap;">${c.value}</td>`;
  }).join("");
  return `<tr style="background:${bg};">${tds}</tr>`;
}


function reportKpiCard(label, value, sub, color) {
  return `
    <td style="width:25%; padding:4px;" valign="top">
      <div style="background:#fff; border:1px solid ${BORDER_COLOR}; border-radius:8px; padding:8px 12px; border-top:3px solid ${color};">
        <div style="font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:${TEXT_MUTED}; margin-bottom:2px;">${label}</div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="left" valign="bottom" style="font-size:20px; font-weight:700; color:${color}; line-height:1;">${value}</td>
            ${sub ? `<td align="right" valign="bottom" style="font-size:11px; color:${TEXT_MUTED}; line-height:1;">${sub}</td>` : ""}
          </tr>
        </table>
      </div>
    </td>`;
}

function sentPctColor(pct) {
  if (pct >= 80) return "#15803d";
  if (pct >= 50) return "#b45309";
  return "#b91c1c";
}

function fmtReportDay(d) {
  return new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function sectionTitle(title) {
  return `
    <tr>
      <td style="padding:14px 0 6px;">
        <div style="font-size:14px; font-weight:700; color:${TEXT_MAIN}; text-transform:uppercase; letter-spacing:0.06em; border-left:3px solid ${ACCENT_COLOR}; padding-left:10px;">${title}</div>
      </td>
    </tr>`;
}

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * @param {object} summary  - return value of computeSummary()
 * @param {string} timeLabel - e.g. "12:00 PM IST"
 * @param {string} dashboardUrl - link for the CTA button
 * @returns {string} full HTML email string
 */
export function buildEmailHtml(summary, timeLabel, dashboardUrl, reportCovData = [], totalActiveRooftops = 0) {
  const { totals, byCSM, byType, byBucket, byRooftop, byRooftopLowestInventory, scoreBuckets, lastSync } = summary;

  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric", month: "long", year: "numeric",
  });

  const syncLabel = lastSync
    ? new Date(lastSync).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "N/A";

  // ── Reason buckets ────────────────────────────────────────────────────────
  const bucketMap = Object.fromEntries((byBucket || []).map(b => [b.label, b.count]));
  const buckets = [
    { label: "Upload Pending",     count: bucketMap["Upload Pending"]     ?? totals.bucketUploadPending,     color: "#2563eb" },
    { label: "Processing Pending", count: bucketMap["Processing Pending"] ?? totals.bucketProcessingPending, color: AMBER },
    { label: "Publishing Pending", count: bucketMap["Publishing Pending"] ?? totals.bucketPublishingPending, color: "#7c3aed" },
    { label: "QC Pending",         count: bucketMap["QC Pending"]         ?? totals.bucketQcPending,         color: "#0891b2" },
    { label: "QC Hold",            count: bucketMap["QC Hold"]            ?? 0,                              color: RED },
    { label: "Sold",               count: bucketMap["Sold"]               ?? totals.bucketSold,              color: GREEN },
    { label: "Others",             count: bucketMap["Others"]             ?? totals.bucketOthers,            color: TEXT_MUTED },
  ];

  // ── KPI rows ──────────────────────────────────────────────────────────────
  const activeBuckets = buckets.filter(b => b.count > 0);
  const bucketPills = activeBuckets.map(b =>
    `<span style="display:inline-block; background:${b.color}18; border:1px solid ${b.color}40; border-radius:999px; padding:2px 10px; font-size:11px; font-weight:600; color:${b.color}; margin-right:5px; margin-bottom:4px; white-space:nowrap;">${b.label}&nbsp;&nbsp;<strong>${fmt(b.count)}</strong></span>`
  ).join("");

  const pendingRow = `
    <tr>
      <td style="padding-bottom:6px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:14px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle" style="white-space:nowrap; padding-right:24px; border-right:1px solid #fde68a; width:1%;">
                    <div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:#92400e; margin-bottom:4px;">Pending VINs &gt; 12hr</div>
                    <div style="font-size:32px; font-weight:700; color:${RED}; line-height:1;">${fmt(totals.notProcessedAfter24)}</div>
                  </td>
                  <td valign="middle" style="padding-left:20px;">
                    ${activeBuckets.length > 0 ? `<div style="font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:#9ca3af; margin-bottom:6px;">By Reason</div><div>${bucketPills}</div>` : ""}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;

  // Inventory-score bucket counts (computed in SQL over all rooftops; null → lowest bucket)
  const scoreBucketCounts = scoreBuckets || { poor: 0, average: 0, good: 0 };

  // Single row — all 4 cards at 25% width
  const kpiRow = `
    <tr>
      ${kpiCard("Total Inventory",  totals.total,               ACCENT_COLOR, "25%")}
      ${kpiCard("With Photos",      totals.withPhotos,          "#0891b2",    "25%")}
      ${kpiCard("VIN Delivered",    totals.deliveredWithPhotos, GREEN,        "25%")}
      ${kpiCard("Pending VINs",     totals.pendingWithPhotos,   AMBER,        "25%")}
    </tr>`;

  const scoreBucketRow = `
    <tr>
      ${kpiCard("Rooftops · Inv Score <6",  scoreBucketCounts.poor,    RED,   "33.33%")}
      ${kpiCard("Rooftops · Inv Score 6–8", scoreBucketCounts.average, AMBER, "33.34%")}
      ${kpiCard("Rooftops · Inv Score 8+",  scoreBucketCounts.good,    GREEN, "33.33%")}
    </tr>`;

  // Lavender highlight for Website Score + Inventory Score header cells —
  // visually groups the two score columns the same way the (now-removed)
  // amber "Pending Reasons" group used to highlight bucket columns.
  const LAVENDER_BG    = "#f5f3ff";
  const LAVENDER_TEXT  = "#6d28d9";

  // ── By Rooftop Type table ─────────────────────────────────────────────────
  // Dedicated header/row builders: 5 columns (no "Pending >12hr %") with a
  // 2px vertical divider between the pending group and the score group.
  const typeDivider = `border-right:2px solid ${BORDER_COLOR};`;
  const typeThBase = `padding:9px 12px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; color:${TEXT_MUTED}; white-space:nowrap; border-bottom:2px solid ${BORDER_COLOR};`;
  const typeThScore = `padding:9px 12px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; color:${LAVENDER_TEXT}; white-space:nowrap; border-bottom:2px solid ${BORDER_COLOR}; background:${LAVENDER_BG};`;
  const typeHeaders = `<tr style="background:${GRAY_BG};">
    <th style="${typeThBase} text-align:left;">Type</th>
    <th style="${typeThBase} text-align:right;">Pending &gt;24hr</th>
    <th style="${typeThBase} text-align:right; ${typeDivider}">Total Pending</th>
    <th style="${typeThScore} text-align:right;">Website Score</th>
    <th style="${typeThScore} text-align:right;">Inventory Score</th>
  </tr>`;

  const typeBodyCell = (value, color, align, extra = "") => {
    const c = color || TEXT_MAIN;
    const fw = color ? "font-weight:600;" : "";
    return `<td style="padding:9px 12px; font-size:13px; color:${c}; ${fw} text-align:${align}; border-bottom:1px solid ${BORDER_COLOR}; white-space:nowrap; ${extra}">${value}</td>`;
  };
  const typeRows = (byType || []).map((r, i) => {
    const bg = (i % 2 === 0) ? "#fff" : "#f8fafc";
    const label = r.label || "—";
    return `<tr style="background:${bg};">
      ${typeBodyCell(label, null, "left")}
      ${typeBodyCell(fmt(r.notProcessedAfter24), r.notProcessedAfter24 > 0 ? RED : null, "right")}
      ${typeBodyCell(fmt(r.pendingWithPhotos),   r.pendingWithPhotos > 0 ? AMBER : null, "right", typeDivider)}
      ${typeBodyCell(score(r.avgWebsiteScore),   scoreColor(r.avgWebsiteScore), "right")}
      ${typeBodyCell(score(r.avgInventoryScore), scoreColor(r.avgInventoryScore), "right")}
    </tr>`;
  }).join("");

  // ── By CSM table ──────────────────────────────────────────────────────────
  // Same shape as the "By Rooftop Type" table: 5 columns (no "Pending >24hr %"),
  // a 2px divider between the pending group and the score group, lavender wash
  // on the two score header cells.
  const csmDivider = `border-right:2px solid ${BORDER_COLOR};`;
  const csmThBase  = `padding:9px 12px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; color:${TEXT_MUTED}; white-space:nowrap; border-bottom:2px solid ${BORDER_COLOR};`;
  const csmThScore = `padding:9px 12px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; color:${LAVENDER_TEXT}; white-space:nowrap; border-bottom:2px solid ${BORDER_COLOR}; background:${LAVENDER_BG};`;
  const csmHeaders = `<tr style="background:${GRAY_BG};">
    <th style="${csmThBase} text-align:left;">CSM</th>
    <th style="${csmThBase} text-align:right;">Pending &gt;24hr</th>
    <th style="${csmThBase} text-align:right; ${csmDivider}">Total Pending</th>
    <th style="${csmThScore} text-align:right;">Website Score</th>
    <th style="${csmThScore} text-align:right;">Inventory Score</th>
  </tr>`;

  const csmBodyCell = (value, color, align, extra = "") => {
    const c = color || TEXT_MAIN;
    const fw = color ? "font-weight:600;" : "";
    return `<td style="padding:9px 12px; font-size:13px; color:${c}; ${fw} text-align:${align}; border-bottom:1px solid ${BORDER_COLOR}; white-space:nowrap; ${extra}">${value}</td>`;
  };
  // Only show CSMs with Pending >24hr > 0; sort by that count desc.
  const sortedByCSM = (byCSM || [])
    .filter(r => (r.notProcessedAfter24 ?? 0) > 0)
    .sort((a, b) => (b.notProcessedAfter24 ?? 0) - (a.notProcessedAfter24 ?? 0));
  const csmRows = sortedByCSM.map((r, i) => {
    const bg = (i % 2 === 0) ? "#fff" : "#f8fafc";
    return `<tr style="background:${bg};">
      ${csmBodyCell(csmLabel(r.name), null, "left")}
      ${csmBodyCell(fmt(r.notProcessedAfter24), r.notProcessedAfter24 > 0 ? RED : null, "right")}
      ${csmBodyCell(fmt(r.pendingWithPhotos),   r.pendingWithPhotos > 0 ? AMBER : null, "right", csmDivider)}
      ${csmBodyCell(score(r.avgWebsiteScore),   scoreColor(r.avgWebsiteScore),   "right")}
      ${csmBodyCell(score(r.avgInventoryScore), scoreColor(r.avgInventoryScore), "right")}
    </tr>`;
  }).join("");

  // ── By Rooftop table (pending >24hr, sorted desc, max 20, >0 only) ───────
  // Columns: # | Rooftop (with inline Console + Website icons) | CSM | Pending >24h | Website Score | Inventory Score
  const rooftopData = byRooftop || [];

  const thFixed = `padding:9px 12px; text-align:left; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; color:${TEXT_MUTED}; white-space:nowrap; border-bottom:2px solid ${BORDER_COLOR}; background:${GRAY_BG}; vertical-align:bottom;`;
  const thCount = `padding:9px 12px; text-align:right; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; color:${TEXT_MUTED}; white-space:nowrap; border-bottom:2px solid ${BORDER_COLOR}; background:${GRAY_BG}; vertical-align:bottom;`;
  const thSNo   = `padding:9px 8px; text-align:center; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; color:${TEXT_MUTED}; white-space:nowrap; border-bottom:2px solid ${BORDER_COLOR}; background:${GRAY_BG}; vertical-align:bottom; width:32px;`;

  const rooftopDivider = `border-right:2px solid ${BORDER_COLOR};`;
  const thScore = `padding:9px 12px; text-align:right; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; color:${LAVENDER_TEXT}; white-space:nowrap; border-bottom:2px solid ${BORDER_COLOR}; background:${LAVENDER_BG}; vertical-align:bottom;`;
  const rooftopHeaders = `<tr style="background:${GRAY_BG};">
    <th style="${thSNo}">#</th>
    <th style="${thFixed}">Rooftop</th>
    <th style="${thFixed} ${rooftopDivider}">CSM</th>
    <th style="${thCount} ${rooftopDivider}">Pending &gt;24h</th>
    <th style="${thScore}">Website Score</th>
    <th style="${thScore}">Inventory Score</th>
  </tr>`;

  // Hosted PNG icons rendered via <img> — universal across Gmail / Apple Mail /
  // Outlook (desktop + web) / mobile, unlike inline SVG (stripped) or emoji
  // (platform-styled). PNGs live in public/icons and are served at the same
  // origin as the dashboard.
  const iconOrigin = (dashboardUrl || "").replace(/\/$/, "");
  const iconImg = (kind, alt) => iconOrigin
    ? `<img src="${iconOrigin}/icons/${kind}.png" width="12" height="12" alt="${alt}" style="display:inline-block; vertical-align:middle; border:0; outline:none;">`
    : (kind === "external-link" ? "&#x2197;" : "&#x1F310;");
  const inlineIconLink = (href, kind, alt, title) =>
    `<a href="${href}" target="_blank" rel="noreferrer" title="${title}" style="display:inline-block; margin-left:6px; padding:2px 4px; line-height:1; border-radius:4px; text-decoration:none; vertical-align:middle;">${iconImg(kind, alt)}</a>`;

  const rooftopRows = rooftopData.map((r, i) => {
    const bg = (i % 2 === 0) ? "#fff" : "#f8fafc";
    const consoleHref = r.enterpriseId
      ? `https://console.spyne.ai/home?enterprise_id=${encodeURIComponent(r.enterpriseId)}${r.rooftopId ? `&team_id=${encodeURIComponent(r.rooftopId)}` : ""}`
      : null;
    const consoleLink = consoleHref ? inlineIconLink(consoleHref, "external-link", "Open", "Open in Console") : "";
    const websiteLink = r.websiteListingUrl ? inlineIconLink(r.websiteListingUrl, "globe", "Web", "Open Website") : "";
    const rooftopCell = `${r.name}${consoleLink}${websiteLink}`;

    const td = (value, color, align, extra = "") => {
      const c = color || TEXT_MAIN;
      const fw = color ? "font-weight:600;" : "";
      return `<td style="padding:9px 12px; font-size:13px; color:${c}; ${fw} text-align:${align}; border-bottom:1px solid ${BORDER_COLOR}; white-space:nowrap; ${extra}">${value}</td>`;
    };

    return `<tr style="background:${bg};">
      ${td(i + 1, TEXT_MUTED, "center")}
      ${td(rooftopCell, null, "left")}
      ${td(csmLabel(r.csm), TEXT_MUTED, "left", rooftopDivider)}
      ${td(fmt(r.pendingAfter24),         r.pendingAfter24 > 0 ? RED : null, "right", rooftopDivider)}
      ${td(score(r.avgWebsiteScore),      scoreColor(r.avgWebsiteScore),     "right")}
      ${td(score(r.avgInventoryScore),    scoreColor(r.avgInventoryScore),   "right")}
    </tr>`;
  }).join("");

  // ── Top 20 Rooftops with Lowest Inventory Score ──────────────────────────
  // Same row shape and icons as the table above, minus the Pending >24h column.
  const lowInvHeaders = `<tr style="background:${GRAY_BG};">
    <th style="${thSNo}">#</th>
    <th style="${thFixed}">Rooftop</th>
    <th style="${thFixed} ${rooftopDivider}">CSM</th>
    <th style="${thScore}">Website Score</th>
    <th style="${thScore}">Inventory Score</th>
  </tr>`;

  const lowInvRows = (byRooftopLowestInventory || []).map((r, i) => {
    const bg = (i % 2 === 0) ? "#fff" : "#f8fafc";
    const consoleHref = r.enterpriseId
      ? `https://console.spyne.ai/home?enterprise_id=${encodeURIComponent(r.enterpriseId)}${r.rooftopId ? `&team_id=${encodeURIComponent(r.rooftopId)}` : ""}`
      : null;
    const consoleLink = consoleHref ? inlineIconLink(consoleHref, "external-link", "Open", "Open in Console") : "";
    const websiteLink = r.websiteListingUrl ? inlineIconLink(r.websiteListingUrl, "globe", "Web", "Open Website") : "";
    const rooftopCell = `${r.name}${consoleLink}${websiteLink}`;

    const td = (value, color, align, extra = "") => {
      const c = color || TEXT_MAIN;
      const fw = color ? "font-weight:600;" : "";
      return `<td style="padding:9px 12px; font-size:13px; color:${c}; ${fw} text-align:${align}; border-bottom:1px solid ${BORDER_COLOR}; white-space:nowrap; ${extra}">${value}</td>`;
    };

    return `<tr style="background:${bg};">
      ${td(i + 1, TEXT_MUTED, "center")}
      ${td(rooftopCell, null, "left")}
      ${td(csmLabel(r.csm), TEXT_MUTED, "left", rooftopDivider)}
      ${td(score(r.avgWebsiteScore),   scoreColor(r.avgWebsiteScore),   "right")}
      ${td(score(r.avgInventoryScore), scoreColor(r.avgInventoryScore), "right")}
    </tr>`;
  }).join("");

  // ── Report Status section ─────────────────────────────────────────────────
  const activeReasons = REPORT_REASONS.filter(r => reportCovData.some(row => (row[r.key] ?? 0) > 0));
  const ystRow = reportCovData[0];
  const ystAttempted   = ystRow?.attemptedRooftops ?? 0;
  const ystSent        = ystRow?.sent ?? 0;
  const ystSentPct     = totalActiveRooftops > 0 ? Math.round((ystSent / totalActiveRooftops) * 100) : 0;
  const ystNoRecipient = totalActiveRooftops - ystAttempted;

  const reportKpiRow = `
    <tr>
      ${reportKpiCard("Active Rooftops", fmt(totalActiveRooftops), null,                              "#6366f1")}
      ${reportKpiCard("Attempted",       fmt(ystAttempted),        null,                              "#0891b2")}
      ${reportKpiCard("Sent",            fmt(ystSent),             `${ystSentPct}% of total`,         GREEN    )}
      ${reportKpiCard("No Recipients",   fmt(ystNoRecipient),      null,                              RED      )}
    </tr>`;

  const thRptFixed = `padding:9px 12px; text-align:left;  font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; color:${TEXT_MUTED}; white-space:nowrap; border-bottom:2px solid ${BORDER_COLOR}; background:${GRAY_BG}; vertical-align:bottom;`;
  const thRptCount = `padding:9px 12px; text-align:right; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; color:${TEXT_MUTED}; white-space:nowrap; border-bottom:2px solid ${BORDER_COLOR}; background:${GRAY_BG}; vertical-align:bottom;`;
  const thRptGroup = `padding:9px 12px; text-align:center; font-size:11px; font-weight:700; letter-spacing:0.04em; color:#991b1b; background:#fef2f2; border-left:2px solid #fca5a5; border-right:2px solid #fca5a5; border-bottom:1px solid #fca5a5; white-space:nowrap;`;
  const thRptSub   = (first, last) => `padding:7px 12px; text-align:right; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; color:#991b1b; background:#fef2f2; border-bottom:2px solid #fca5a5; white-space:nowrap;${first ? " border-left:2px solid #fca5a5;" : ""}${last ? " border-right:2px solid #fca5a5;" : ""}`;

  const reportTableHeaders = activeReasons.length === 0
    ? `<tr style="background:${GRAY_BG};">
        <th style="${thRptFixed}">Report Date</th>
        <th style="${thRptCount}">Attempted</th>
        <th style="${thRptCount}">Sent</th>
        <th style="${thRptCount}">Sent %</th>
        <th style="${thRptCount}">Not Sent</th>
      </tr>`
    : `<tr style="background:${GRAY_BG};">
        <th rowspan="2" style="${thRptFixed}">Report Date</th>
        <th rowspan="2" style="${thRptCount}">Attempted</th>
        <th rowspan="2" style="${thRptCount}">Sent</th>
        <th rowspan="2" style="${thRptCount}">Sent %</th>
        <th rowspan="2" style="${thRptCount}">Not Sent</th>
        <th colspan="${activeReasons.length}" style="${thRptGroup}">Not Sent Reasons</th>
      </tr>
      <tr>
        ${activeReasons.map((r, idx) =>
          `<th style="${thRptSub(idx === 0, idx === activeReasons.length - 1)}">${r.label}</th>`
        ).join("")}
      </tr>`;

  const reportTableRows = reportCovData.map((r, i) => {
    const pctVal = r.sentPct != null ? `${r.sentPct}%` : "—";
    return tableRow([
      { value: fmtReportDay(r.reportDay),  align: "left"                                                             },
      { value: fmt(r.attemptedRooftops)                                                                              },
      { value: fmt(r.sent),               color: r.sent > 0 ? GREEN : null                                          },
      { value: pctVal,                    color: r.sentPct != null ? sentPctColor(Number(r.sentPct)) : null         },
      { value: fmt(r.notSent),            color: r.notSent > 0 ? RED : null                                         },
      ...activeReasons.map(ar => ({ value: fmt(r[ar.key] ?? 0), color: (r[ar.key] ?? 0) > 0 ? RED : null })),
    ], i % 2 === 0);
  }).join("");

  // ── CTA button ────────────────────────────────────────────────────────────
  const ctaHtml = dashboardUrl ? `
    <tr>
      <td style="padding:28px 0 8px; text-align:center;">
        <a href="${dashboardUrl}"
           style="display:inline-block; background:${ACCENT_COLOR}; color:#fff; font-size:14px; font-weight:600;
                  text-decoration:none; padding:12px 32px; border-radius:6px; letter-spacing:0.02em;">
          View Full Dashboard →
        </a>
      </td>
    </tr>` : "";

  // ── Full HTML ─────────────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VIN Tracker Snapshot — ${timeLabel}</title>
</head>
<body style="margin:0; padding:0; background:${GRAY_BG}; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${GRAY_BG}; padding:24px 0;">
    <tr>
      <td align="center">

        <!-- Email card -->
        <table width="720" cellpadding="0" cellspacing="0" border="0"
               style="max-width:720px; width:100%; background:#fff; border-radius:10px; overflow:hidden;
                      box-shadow:0 2px 12px rgba(0,0,0,0.08);">

          <!-- ── Header ── -->
          <tr>
            <td style="background:${BRAND_COLOR}; padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <div style="font-size:20px; font-weight:700; color:#fff; letter-spacing:0.02em;">
                      VIN Tracker
                      <span style="font-size:13px; font-weight:400; color:#94a3b8; margin-left:8px;">Dashboard Snapshot</span>
                    </div>
                    <div style="font-size:13px; color:#94a3b8; margin-top:4px;">${dateLabel} &nbsp;·&nbsp; ${timeLabel}</div>
                  </td>
                  <td align="right" valign="middle">
                    <div style="font-size:11px; color:#64748b; text-align:right;">
                      Last sync<br>
                      <span style="color:#94a3b8;">${syncLabel}</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Body ── -->
          <tr>
            <td style="padding:24px 32px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">

                <!-- Pending >24hr + reason buckets -->
                ${pendingRow}

                <!-- KPI row -->
                <tr><td style="padding-bottom:6px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    ${kpiRow}
                  </table>
                </td></tr>

                <!-- Score bucket row -->
                <tr><td style="padding-bottom:6px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    ${scoreBucketRow}
                  </table>
                </td></tr>
                </td></tr>

                <!-- Report Status KPIs -->
                ${sectionTitle("Report Status")}
                <tr><td style="padding-bottom:12px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    ${reportKpiRow}
                  </table>
                </td></tr>

                <!-- By Rooftop Type section -->
                ${sectionTitle("By Rooftop Type")}
                <tr><td>
                  <table width="100%" cellpadding="0" cellspacing="0" border="0"
                         style="border:1px solid ${BORDER_COLOR}; border-radius:8px; overflow:hidden; border-collapse:separate; border-spacing:0;">
                    ${typeHeaders}
                    ${typeRows || `<tr><td colspan="5" style="padding:16px; text-align:center; color:${TEXT_MUTED}; font-size:13px;">No data</td></tr>`}
                  </table>
                </td></tr>

                <!-- By Rooftop section -->
                ${sectionTitle("Pending >24hr by Rooftop")}
                <tr><td>
                  <table width="100%" cellpadding="0" cellspacing="0" border="0"
                         style="border:1px solid ${BORDER_COLOR}; border-radius:8px; overflow:hidden; border-collapse:separate; border-spacing:0;">
                    ${rooftopHeaders}
                    ${rooftopRows || `<tr><td colspan="6" style="padding:16px; text-align:center; color:${TEXT_MUTED}; font-size:13px;">No rooftops with pending >24hr</td></tr>`}
                  </table>
                </td></tr>

                <!-- By CSM section -->
                ${sectionTitle("By CSM")}
                <tr><td>
                  <table width="100%" cellpadding="0" cellspacing="0" border="0"
                         style="border:1px solid ${BORDER_COLOR}; border-radius:8px; overflow:hidden; border-collapse:separate; border-spacing:0;">
                    ${csmHeaders}
                    ${csmRows || `<tr><td colspan="5" style="padding:16px; text-align:center; color:${TEXT_MUTED}; font-size:13px;">No CSMs with pending &gt;24hr</td></tr>`}
                  </table>
                </td></tr>

                <!-- Breakline -->
                <tr><td style="padding:24px 0 0;">
                  <div style="border-top:2px solid ${BORDER_COLOR};"></div>
                </td></tr>

                <!-- Rooftops with Lowest Inventory Score -->
                ${sectionTitle("Rooftops with Lowest Inventory Score")}
                <tr><td>
                  <table width="100%" cellpadding="0" cellspacing="0" border="0"
                         style="border:1px solid ${BORDER_COLOR}; border-radius:8px; overflow:hidden; border-collapse:separate; border-spacing:0;">
                    ${lowInvHeaders}
                    ${lowInvRows || `<tr><td colspan="5" style="padding:16px; text-align:center; color:${TEXT_MUTED}; font-size:13px;">No rooftops with inventory scores</td></tr>`}
                  </table>
                </td></tr>

                <!-- Report Status 7-day table -->
                ${sectionTitle("Last 7 Days")}
                <tr><td>
                  <table width="100%" cellpadding="0" cellspacing="0" border="0"
                         style="border:1px solid ${BORDER_COLOR}; border-radius:8px; overflow:hidden; border-collapse:separate; border-spacing:0;">
                    ${reportTableHeaders}
                    ${reportTableRows || `<tr><td colspan="${5 + activeReasons.length}" style="padding:16px; text-align:center; color:${TEXT_MUTED}; font-size:13px;">No report data found.</td></tr>`}
                  </table>
                </td></tr>

                <!-- CTA -->
                ${ctaHtml}

              </table>
            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td style="background:${GRAY_BG}; border-top:1px solid ${BORDER_COLOR}; padding:16px 32px; text-align:center;">
              <div style="font-size:11px; color:${TEXT_MUTED};">
                This is an automated report from VIN Tracker. Sent at ${timeLabel}.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}
