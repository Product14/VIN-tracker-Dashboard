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
  const { totals, byCSM, byType, byBucket, lastSync } = summary;

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

  const kpiRow = `
    <tr>
      ${kpiCard("Total Inventory",  totals.total,               ACCENT_COLOR, "25%")}
      ${kpiCard("With Photos",      totals.withPhotos,          "#0891b2",    "25%")}
      ${kpiCard("VIN Delivered",    totals.deliveredWithPhotos, GREEN,        "25%")}
      ${kpiCard("Pending VINs",     totals.pendingWithPhotos,   AMBER,        "25%")}
    </tr>`;

  // Shared column headers for both tables
  const sharedHeaders = (firstColLabel) => tableHeader([
    { label: firstColLabel,        align: "left" },
    { label: "Pending >24hr"                     },
    { label: "Enterprises"                       },
    { label: "Rooftops"                          },
    { label: "Inventory"                         },
    { label: "With Photos"                       },
    { label: "Delivered"                         },
    { label: "Pending"                           },
    { label: "Pending >24hr %"                   },
    { label: "Avg Score"                         },
  ]);

  const sharedRow = (firstCol, r, zebra) => tableRow([
    { value: firstCol,                                        align: "left"                                                         },
    { value: fmt(r.notProcessedAfter24),                      color: r.notProcessedAfter24 > 0 ? RED : null                         },
    { value: fmt(r.enterpriseCount)                                                                                                  },
    { value: fmt(r.rooftopCount)                                                                                                     },
    { value: fmt(r.total)                                                                                                            },
    { value: fmt(r.withPhotos)                                                                                                       },
    { value: fmt(r.deliveredWithPhotos)                                                                                               },
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
                    ${typeRows || `<tr><td colspan="10" style="padding:16px; text-align:center; color:${TEXT_MUTED}; font-size:13px;">No data</td></tr>`}
                  </table>
                </td></tr>

                <!-- By CSM section -->
                ${sectionTitle("By CSM")}
                <tr><td>
                  <table width="100%" cellpadding="0" cellspacing="0" border="0"
                         style="border:1px solid ${BORDER_COLOR}; border-radius:8px; overflow:hidden; border-collapse:separate; border-spacing:0;">
                    ${csmHeaders}
                    ${csmRows || `<tr><td colspan="10" style="padding:16px; text-align:center; color:${TEXT_MUTED}; font-size:13px;">No data</td></tr>`}
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
