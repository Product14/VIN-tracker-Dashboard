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

function pct(num, denom) {
  if (!denom) return "—";
  return ((num / denom) * 100).toFixed(1) + "%";
}

function score(val) {
  if (val == null) return "—";
  return Number(val).toFixed(1);
}

// ─── Partial builders ─────────────────────────────────────────────────────────

function kpiCard(label, value, color, width) {
  const borderTop = color ? `border-top: 3px solid ${color};` : "";
  const w = width || "20%";
  return `
    <td style="width:${w}; padding:6px;" valign="top">
      <div style="background:#fff; border:1px solid ${BORDER_COLOR}; border-radius:8px; padding:18px 14px; ${borderTop}">
        <div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:${TEXT_MUTED}; margin-bottom:6px;">${label}</div>
        <div style="font-size:26px; font-weight:700; color:${TEXT_MAIN}; line-height:1;">${fmt(value)}</div>
      </div>
    </td>`;
}


function tableHeader(cols) {
  const cells = cols.map(c =>
    `<th style="padding:9px 12px; text-align:${c.align || "right"}; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; color:${TEXT_MUTED}; white-space:nowrap; border-bottom:2px solid ${BORDER_COLOR};">${c.label}</th>`
  ).join("");
  return `<tr style="background:${GRAY_BG};">${cells}</tr>`;
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


function sectionTitle(title) {
  return `
    <tr>
      <td style="padding:28px 0 12px;">
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
export function buildEmailHtml(summary, timeLabel, dashboardUrl) {
  const { totals, byCSM, byType, byBucket, byRooftop, lastSync } = summary;

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
                    <div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:#92400e; margin-bottom:4px;">Pending VINs &gt; 24hr</div>
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

  // 2×2 grid — each card is 50% wide so it reads comfortably on mobile
  const kpiRow = `
    <tr>
      ${kpiCard("Total Inventory",  totals.total,               ACCENT_COLOR, "50%")}
      ${kpiCard("With Photos",      totals.withPhotos,          "#0891b2",    "50%")}
    </tr>
    <tr>
      ${kpiCard("VIN Delivered",    totals.deliveredWithPhotos, GREEN,        "50%")}
      ${kpiCard("Pending VINs",     totals.pendingWithPhotos,   AMBER,        "50%")}
    </tr>`;

  // Shared column headers for both tables — trimmed to the 3 key metrics
  const sharedHeaders = (firstColLabel) => tableHeader([
    { label: firstColLabel,        align: "left" },
    { label: "Pending >24hr"                     },
    { label: "Total Pending"                     },
    { label: "Pending >24hr %"                   },
    { label: "Website Score"                     },
  ]);

  const sharedRow = (firstCol, r, zebra) => tableRow([
    { value: firstCol,                                        align: "left"                                                         },
    { value: fmt(r.notProcessedAfter24),                      color: r.notProcessedAfter24 > 0 ? RED : null                         },
    { value: fmt(r.pendingWithPhotos),                        color: r.pendingWithPhotos > 0 ? AMBER : null                         },
    { value: pct(r.notProcessedAfter24, r.notProcessed),      color: r.notProcessedAfter24 > 0 ? RED : null                        },
    { value: score(r.avgWebsiteScore),                        muted: true                                                           },
  ], zebra);

  // ── By Rooftop Type table ─────────────────────────────────────────────────
  const typeHeaders = sharedHeaders("Type");
  const typeRows = (byType || []).map((r, i) =>
    sharedRow(r.label || "—", r, i % 2 === 0)
  ).join("");

  // ── By CSM table ──────────────────────────────────────────────────────────
  const csmHeaders = sharedHeaders("CSM");
  const sortedByCSM = (byCSM || []).slice().sort((a, b) => (b.notProcessedAfter24 ?? 0) - (a.notProcessedAfter24 ?? 0));
  const csmRows = sortedByCSM.map((r, i) =>
    sharedRow(csmLabel(r.name), r, i % 2 === 0)
  ).join("");

  // ── By Rooftop table (pending >24hr, sorted desc, max 20, >0 only) ───────
  // Only show a bucket column when at least one rooftop has a non-zero value for it.
  const rooftopData = byRooftop || [];
  const activeBucketCols = [
    { key: "bucketUploadPending",     label: "Upload",     color: "#2563eb"  },
    { key: "bucketProcessingPending", label: "Processing", color: AMBER      },
    { key: "bucketPublishingPending", label: "Publishing", color: "#7c3aed"  },
    { key: "bucketQcPending",         label: "QC Pending", color: "#0891b2"  },
    { key: "bucketQcHold",           label: "QC Hold",    color: RED        },
    { key: "bucketSold",             label: "Sold",       color: GREEN      },
    { key: "bucketOthers",           label: "Others",     color: TEXT_MUTED },
  ].filter(col => rooftopData.some(r => r[col.key] > 0))
   .sort((a, b) => rooftopData.reduce((s, r) => s + (r[b.key] ?? 0), 0) - rooftopData.reduce((s, r) => s + (r[a.key] ?? 0), 0));

  // Two-row grouped header: Rooftop/Type/CSM/Pending>24h are standalone rowspan=2
  // columns; the amber group only covers the reason bucket sub-columns.
  const thFixed   = `padding:9px 12px; text-align:left; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; color:${TEXT_MUTED}; white-space:nowrap; border-bottom:2px solid ${BORDER_COLOR}; background:${GRAY_BG}; vertical-align:bottom;`;
  const thCount   = `padding:9px 12px; text-align:right; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; color:${TEXT_MUTED}; white-space:nowrap; border-bottom:2px solid ${BORDER_COLOR}; background:${GRAY_BG}; vertical-align:bottom;`;
  const thGroup   = `padding:9px 12px; text-align:center; font-size:11px; font-weight:700; letter-spacing:0.04em; color:#92400e; background:#fffbeb; border-left:2px solid #fcd34d; border-right:2px solid #fcd34d; border-bottom:1px solid #fde68a; white-space:nowrap;`;
  const thSub     = (first, last) => `padding:7px 12px; text-align:right; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; color:#92400e; background:#fffbeb; border-bottom:2px solid #fde68a; white-space:nowrap;${first ? " border-left:2px solid #fcd34d;" : ""}${last ? " border-right:2px solid #fcd34d;" : ""}`;

  const rooftopHeaders = activeBucketCols.length === 0
    // No active buckets — single header row, no grouping needed
    ? `<tr style="background:${GRAY_BG};">
        <th style="${thFixed}">Rooftop</th>
        <th style="${thFixed}">Type</th>
        <th style="${thFixed}">CSM</th>
        <th style="${thCount}">Pending &gt;24h</th>
      </tr>`
    // Active buckets — two-row header with amber group over bucket columns only
    : `<tr style="background:${GRAY_BG};">
        <th rowspan="2" style="${thFixed}">Rooftop</th>
        <th rowspan="2" style="${thFixed}">Type</th>
        <th rowspan="2" style="${thFixed}">CSM</th>
        <th rowspan="2" style="${thCount}">Pending &gt;24h</th>
        <th colspan="${activeBucketCols.length}" style="${thGroup}">Pending Reasons</th>
      </tr>
      <tr>
        ${activeBucketCols.map((col, idx) =>
          `<th style="${thSub(idx === 0, idx === activeBucketCols.length - 1)}">${col.label}</th>`
        ).join("")}
      </tr>`;

  const rooftopRows = rooftopData.map((r, i) => tableRow([
    { value: r.name,                align: "left"                                          },
    { value: r.type,                align: "left", muted: true                             },
    { value: csmLabel(r.csm),      align: "left", muted: true                             },
    { value: fmt(r.pendingAfter24), color: r.pendingAfter24 > 0 ? RED : null              },
    ...activeBucketCols.map(col => ({
      value: fmt(r[col.key]),
      color: r[col.key] > 0 ? col.color : null,
    })),
  ], i % 2 === 0)).join("");

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

                <!-- By CSM section -->
                ${sectionTitle("By CSM")}
                <tr><td>
                  <table width="100%" cellpadding="0" cellspacing="0" border="0"
                         style="border:1px solid ${BORDER_COLOR}; border-radius:8px; overflow:hidden; border-collapse:separate; border-spacing:0;">
                    ${csmHeaders}
                    ${csmRows || `<tr><td colspan="5" style="padding:16px; text-align:center; color:${TEXT_MUTED}; font-size:13px;">No data</td></tr>`}
                  </table>
                </td></tr>

                <!-- By Rooftop section -->
                ${sectionTitle("Pending >24hr by Rooftop")}
                <tr><td>
                  <table width="100%" cellpadding="0" cellspacing="0" border="0"
                         style="border:1px solid ${BORDER_COLOR}; border-radius:8px; overflow:hidden; border-collapse:separate; border-spacing:0;">
                    ${rooftopHeaders}
                    ${rooftopRows || `<tr><td colspan="${4 + activeBucketCols.length}" style="padding:16px; text-align:center; color:${TEXT_MUTED}; font-size:13px;">No rooftops with pending >24hr</td></tr>`}
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
