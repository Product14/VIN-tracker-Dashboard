import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import ReactDOM from "react-dom";

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

function InfoTooltip({ text }: { text: string }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const iconRef = useRef<HTMLSpanElement>(null);
  return (
    <>
      <span ref={iconRef}
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 14, height: 14, borderRadius: "50%", background: "#e5e7eb", color: "#6b7280", fontSize: 10, fontWeight: 700, cursor: "default", flexShrink: 0 }}
        onMouseEnter={() => { const r = iconRef.current?.getBoundingClientRect(); if (r) setPos({ top: r.bottom + 6, left: r.left + r.width / 2 }); }}
        onMouseLeave={() => setPos(null)}>
        i
      </span>
      {pos && ReactDOM.createPortal(
        <div style={{ position: "fixed", top: pos.top, left: pos.left, transform: "translateX(-50%)", background: "#1f2937", color: "#fff", fontSize: 11, fontWeight: 400, padding: "6px 10px", borderRadius: 6, width: 230, lineHeight: 1.4, zIndex: 99999, pointerEvents: "none", boxShadow: "0 2px 8px rgba(0,0,0,0.25)", whiteSpace: "normal" }}>
          {text}
        </div>,
        document.body
      )}
    </>
  );
}

const SAMPLE_DATA = [
  { vin: "1HGCM82633A004352", enterpriseId: "ENT-001", enterprise: "Metro Auto Group", rooftopId: "RT-001", rooftop: "Downtown Auto", rooftopType: "Franchise", csm: "Sarah Miller", status: "Delivered", processedAt: "2026-04-06T10:30:00", receivedAt: "2026-04-06T08:00:00" },
  { vin: "2T1BURHE0JC123456", enterpriseId: "ENT-001", enterprise: "Metro Auto Group", rooftopId: "RT-001", rooftop: "Downtown Auto", rooftopType: "Franchise", csm: "Sarah Miller", status: "Delivered", processedAt: "2026-04-05T14:00:00", receivedAt: "2026-04-04T09:00:00" },
  { vin: "3VWDX7AJ5DM654321", enterpriseId: "ENT-002", enterprise: "Westside Holdings", rooftopId: "RT-002", rooftop: "Westside Motors", rooftopType: "Independent", csm: "James Cooper", status: "Not Delivered", processedAt: null, receivedAt: "2026-04-06T11:00:00" },
  { vin: "5YFBURHE4JP789012", enterpriseId: "ENT-002", enterprise: "Westside Holdings", rooftopId: "RT-002", rooftop: "Westside Motors", rooftopType: "Independent", csm: "James Cooper", status: "Delivered", processedAt: "2026-04-06T16:00:00", receivedAt: "2026-04-06T07:00:00" },
  { vin: "1G1YY22G965109876", enterpriseId: "ENT-002", enterprise: "Westside Holdings", rooftopId: "RT-002", rooftop: "Westside Motors", rooftopType: "Independent", csm: "James Cooper", status: "Not Delivered", processedAt: null, receivedAt: "2026-04-05T06:00:00" },
  { vin: "JH4KA8260MC543210", enterpriseId: "ENT-001", enterprise: "Metro Auto Group", rooftopId: "RT-003", rooftop: "Northgate Dealers", rooftopType: "Franchise", csm: "Sarah Miller", status: "Delivered", processedAt: "2026-04-07T02:00:00", receivedAt: "2026-04-06T01:00:00" },
  { vin: "WVWZZZ3CZWE112233", enterpriseId: "ENT-001", enterprise: "Metro Auto Group", rooftopId: "RT-003", rooftop: "Northgate Dealers", rooftopType: "Franchise", csm: "Sarah Miller", status: "Not Delivered", processedAt: null, receivedAt: "2026-04-07T08:00:00" },
  { vin: "1FTFW1ET5DFA44556", enterpriseId: "ENT-003", enterprise: "Southpark Automotive LLC", rooftopId: "RT-004", rooftop: "Southpark Auto", rooftopType: "Independent", csm: "Lisa Chang", status: "Delivered", processedAt: "2026-04-06T20:00:00", receivedAt: "2026-04-06T09:00:00" },
  { vin: "2GCEC19T441778899", enterpriseId: "ENT-003", enterprise: "Southpark Automotive LLC", rooftopId: "RT-004", rooftop: "Southpark Auto", rooftopType: "Independent", csm: "Lisa Chang", status: "Not Delivered", processedAt: null, receivedAt: "2026-04-05T14:00:00" },
  { vin: "3N1AB7AP4GY990011", enterpriseId: "ENT-003", enterprise: "Southpark Automotive LLC", rooftopId: "RT-004", rooftop: "Southpark Auto", rooftopType: "Independent", csm: "Lisa Chang", status: "Delivered", processedAt: "2026-04-07T06:00:00", receivedAt: "2026-04-07T04:00:00" },
  { vin: "KNDJP3A56H7223344", enterpriseId: "ENT-004", enterprise: "Eastend Motor Corp", rooftopId: "RT-005", rooftop: "Eastend Cars", rooftopType: "Franchise", csm: "Lisa Chang", status: "Not Delivered", processedAt: null, receivedAt: "2026-04-06T05:00:00" },
  { vin: "4T1BF1FK5CU556677", enterpriseId: "ENT-004", enterprise: "Eastend Motor Corp", rooftopId: "RT-005", rooftop: "Eastend Cars", rooftopType: "Franchise", csm: "Lisa Chang", status: "Delivered", processedAt: "2026-04-06T12:00:00", receivedAt: "2026-04-06T06:00:00" },
  { vin: "1N4AL3AP8DC889900", enterpriseId: "ENT-005", enterprise: "Central Auto Group", rooftopId: "RT-006", rooftop: "Central Auto Group", rooftopType: "Franchise", csm: "James Cooper", status: "Delivered", processedAt: "2026-04-05T22:00:00", receivedAt: "2026-04-05T08:00:00" },
  { vin: "5XYZUDLA1DG112244", enterpriseId: "ENT-005", enterprise: "Central Auto Group", rooftopId: "RT-006", rooftop: "Central Auto Group", rooftopType: "Franchise", csm: "James Cooper", status: "Not Delivered", processedAt: null, receivedAt: "2026-04-04T10:00:00" },
  { vin: "JM1BK32F781335566", enterpriseId: "ENT-005", enterprise: "Central Auto Group", rooftopId: "RT-006", rooftop: "Central Auto Group", rooftopType: "Franchise", csm: "James Cooper", status: "Delivered", processedAt: "2026-04-06T09:00:00", receivedAt: "2026-04-06T07:30:00" },
  { vin: "WBAPH5C55BA778899", enterpriseId: "ENT-002", enterprise: "Westside Holdings", rooftopId: "RT-007", rooftop: "Valley Rides", rooftopType: "Independent", csm: "Sarah Miller", status: "Not Delivered", processedAt: null, receivedAt: "2026-04-07T07:00:00" },
  { vin: "1ZVBP8AM7D5990011", enterpriseId: "ENT-002", enterprise: "Westside Holdings", rooftopId: "RT-007", rooftop: "Valley Rides", rooftopType: "Independent", csm: "Sarah Miller", status: "Delivered", processedAt: "2026-04-06T18:00:00", receivedAt: "2026-04-05T10:00:00" },
  { vin: "2C3CDXCT1EH223344", enterpriseId: "ENT-002", enterprise: "Westside Holdings", rooftopId: "RT-007", rooftop: "Valley Rides", rooftopType: "Independent", csm: "Sarah Miller", status: "Delivered", processedAt: "2026-04-07T01:00:00", receivedAt: "2026-04-06T22:00:00" },
];

const NOW = new Date("2026-04-07T12:00:00");
const H24 = 24 * 60 * 60 * 1000;

function isAfter24h(item) {
  if ("after24h" in item && item.after24h !== null && item.after24h !== undefined) return Boolean(item.after24h);
  if (item.status === "Delivered") return (new Date(item.processedAt).getTime() - new Date(item.receivedAt).getTime()) > H24;
  return (NOW.getTime() - new Date(item.receivedAt).getTime()) > H24;
}

function applyRawFilters(data, filters) {
  return data.filter(d => {
    if (filters.rooftopId && d.rooftopId !== filters.rooftopId) return false;
    if (filters.rooftopType && d.rooftopType !== filters.rooftopType) return false;
    if (filters.csm && d.csm !== filters.csm) return false;
    if (filters.status && d.status !== filters.status) return false;
    if (filters.after24h === true && !isAfter24h(d)) return false;
    if (filters.after24h === false && isAfter24h(d)) return false;
    if (filters.search) {
      const s = filters.search.toLowerCase();
      if (!d.vin.toLowerCase().includes(s) && !d.rooftop.toLowerCase().includes(s) && !d.csm.toLowerCase().includes(s)) return false;
    }
    return true;
  });
}

function Badge({ label, color }) {
  const colors = {
    green: { bg: "#dcfce7", text: "#166534", border: "#bbf7d0" },
    red: { bg: "#fef2f2", text: "#991b1b", border: "#fecaca" },
    amber: { bg: "#fffbeb", text: "#92400e", border: "#fde68a" },
    blue: { bg: "#eff6ff", text: "#1e40af", border: "#bfdbfe" },
    gray: { bg: "#f3f4f6", text: "#374151", border: "#e5e7eb" },
  };
  const c = colors[color] || colors.gray;
  return <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>{typeof label === "number" ? label.toLocaleString() : label}</span>;
}


// Shows a colored status pill for boolean-like string values
function StatusBadge({ value }: { value: string | null | undefined }) {
  if (value == null) return <span style={{ color: "#9ca3af" }}>—</span>;
  const positive = value === "true";
  const label = positive ? "Yes" : "No";
  const color  = positive ? "#166534" : "#6b7280";
  const bg     = positive ? "#dcfce7" : "#f3f4f6";
  const border = positive ? "#bbf7d0" : "#e5e7eb";
  return <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: bg, color, border: `1px solid ${border}` }}>{label}</span>;
}

// Strip @spyne.ai domain from CSM emails for display; show full email as tooltip
function fmtCsm(email: string | null | undefined): string {
  if (!email) return "—";
  return email.replace(/@spyne\.ai$/i, "");
}

const REPORT_REASON_LABEL_MAP: Record<string, string> = {
  no_recipient:       "No Recipient",
  not_triggered:      "Not Triggered",
  ims_off:            "IMS Disabled",
  pending_vins:       "Pending VINs",
  negative_tat:       "Negative TAT",
  low_photo_coverage: "Low Photo Coverage",
  already_sent:       "Already Sent",
  timed_out:          "Timed Out",
};
function fmtSkipReason(r: string | null | undefined): string | null {
  if (!r) return null;
  return REPORT_REASON_LABEL_MAP[r] ?? r;
}
function fmtReportDayLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
function fmtSentDate(isoTs: string | null | undefined): string | null {
  if (!isoTs) return null;
  return new Date(isoTs).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function fmtReportDate(isoTs: string | null | undefined, tz: string | null | undefined): string | null {
  if (!isoTs) return null;
  const d = new Date(isoTs);
  const zone = tz || "UTC";
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: zone });
  const tzAbbr = d.toLocaleString("en-US", { timeZone: zone, timeZoneName: "short" }).split(" ").pop();
  return `${date} ${tzAbbr}`;
}

function ReportStatusCell({ status, reason, lastSentAt, dateLabel: dateLabelProp }: { status: string | null, reason?: string | null, lastSentAt: string | null, dateLabel?: string | null }) {
  if (status === "sent") return <span style={{ color: "#166534", fontWeight: 600, fontSize: 12 }}>Sent</span>;
  const reasonLabel = fmtSkipReason(reason);
  if (reasonLabel) {
    const color = reason === "no_recipient" || reason === "not_triggered" ? "#6b7280" : "#92400e";
    return <span style={{ color, fontSize: 12 }}>{reasonLabel}</span>;
  }
  if (status === "not_sent") return <span style={{ color: "#991b1b", fontSize: 12 }}>Not Sent</span>;
  return <span style={{ color: "#9ca3af", fontSize: 12 }}>—</span>;
}

function ReportReasonCell({ reason }: { reason: string | null }) {
  const label = fmtSkipReason(reason);
  if (!label) return <span style={{ color: "#9ca3af", fontSize: 12 }}>—</span>;
  const color = reason === "no_recipient" ? "#6b7280" : "#92400e";
  return <span style={{ color, fontSize: 12 }}>{label}</span>;
}

function RooftopReportHoverCell({ status, reason, lastSentAt, lastReportDate, timezone, rooftopId, enterpriseId }: {
  status: string | null, reason: string | null, lastSentAt: string | null,
  lastReportDate: string | null, timezone: string | null,
  rooftopId: string, enterpriseId: string | null,
}) {
  const [hovered, setHovered] = useState(false);
  const [pos, setPos]         = useState<{ top: number; left: number } | null>(null);
  const [history, setHistory] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const cellRef    = useRef<HTMLDivElement>(null);
  const fetchedRef = useRef(false);

  const handleMouseEnter = () => {
    const r = cellRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.top, left: r.left + r.width / 2 });
    setHovered(true);
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      setLoading(true);
      fetch(`${API_BASE}/api/rooftops/${encodeURIComponent(rooftopId)}/report-history?enterpriseId=${encodeURIComponent(enterpriseId ?? "")}`)
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(({ history: h }) => { setHistory(h); setLoading(false); })
        .catch(() => { setHistory([]); setLoading(false); });
    }
  };

  return (
    <div ref={cellRef} style={{ display: "inline-block", cursor: "default" }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setHovered(false)}>
      <ReportStatusCell status={status} reason={reason} lastSentAt={lastSentAt} dateLabel={fmtReportDate(lastReportDate, timezone)} />
      {hovered && pos && ReactDOM.createPortal(
        <div style={{
          position: "fixed",
          top: pos.top - 10,
          left: pos.left,
          transform: "translateX(-50%) translateY(-100%)",
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
          padding: "12px 16px",
          minWidth: 240,
          maxWidth: 320,
          zIndex: 99999,
          pointerEvents: "none",
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 10 }}>
            Sent History
          </div>
          {loading ? (
            <div style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", padding: "4px 0" }}>Loading…</div>
          ) : !history || history.length === 0 ? (
            <div style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", padding: "4px 0" }}>No sends yet</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {history.map((h, i) => {
                const label = fmtReportDate(h.report_date, h.timezone) ?? fmtSentDate(h.processed_at) ?? "—";
                const isGroup = h.report_type === "Group";
                const toList: string[] = Array.isArray(h.to_emails) ? h.to_emails : [];
                const ccList: string[] = Array.isArray(h.cc_emails) ? h.cc_emails : [];
                return (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    {/* Stem + dot */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 12, flexShrink: 0 }}>
                      {i > 0 && <div style={{ width: 2, height: 8, background: "#d1d5db" }} />}
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#16a34a", flexShrink: 0, marginTop: i === 0 ? 2 : 0 }} />
                      {i < history.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 8, background: "#d1d5db" }} />}
                    </div>
                    {/* Content */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingBottom: 10, flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 12, color: "#111827", fontWeight: 500 }}>{label}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4, flexShrink: 0,
                          background: isGroup ? "#ede9fe" : "#e0f2fe",
                          color: isGroup ? "#6d28d9" : "#0369a1",
                        }}>{isGroup ? "Group" : "Rooftop"}</span>
                      </div>
                      {toList.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                          <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>To</span>
                          {toList.map((e, j) => (
                            <span key={j} style={{ fontSize: 11, color: "#374151", wordBreak: "break-all" }}>{e}</span>
                          ))}
                        </div>
                      )}
                      {ccList.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                          <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>CC</span>
                          {ccList.map((e, j) => (
                            <span key={j} style={{ fontSize: 11, color: "#374151", wordBreak: "break-all" }}>{e}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

// Inline truncation span — shows ellipsis when content overflows, full value on hover
function Truncated({ value, maxWidth }: { value: string | null | undefined, maxWidth: number }) {
  const text = value ?? "—";
  return (
    <span title={text} style={{ display: "block", maxWidth, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {text}
    </span>
  );
}

function downloadCSV(filename, headers, rows) {
  const escape = v => {
    const s = v === null || v === undefined ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.map(escape).join(","), ...rows.map(r => r.map(escape).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const BUCKETS = [
  { key: "bucketUploadPending",     label: "Upload Pending" },
  { key: "bucketProcessingPending", label: "Processing Pending" },
  { key: "bucketPublishingPending", label: "Publishing Pending" },
  { key: "bucketQcPending",         label: "QC Pending" },
  { key: "bucketQcHold",            label: "QC Hold" },
  { key: "bucketSold",              label: "Sold" },
  { key: "bucketOthers",            label: "Others" },
];

const REPORT_REASONS = [
  { key: "reasonNotTriggered",     label: "Not Triggered",      reasonCode: "not_triggered" },
  { key: "reasonNoRecipient",      label: "No Recipient",       reasonCode: "no_recipient" },
  { key: "reasonImsOff",           label: "IMS Disabled",       reasonCode: "ims_off" },
  { key: "reasonPendingVins",      label: "Pending VINs",       reasonCode: "pending_vins" },
  { key: "reasonNegativeTat",      label: "Negative TAT",       reasonCode: "negative_tat" },
  { key: "reasonLowPhotoCoverage", label: "Low Photo Coverage", reasonCode: "low_photo_coverage" },
  { key: "reasonAlreadySent",      label: "Already Sent",       reasonCode: "already_sent" },
  { key: "reasonTimedOut",         label: "Timed Out",          reasonCode: "timed_out" },
];

function DownloadButton({ onClick }) {
  return (
    <button onClick={onClick} title="Download as CSV"
      style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151", transition: "all 0.15s" }}
      onMouseEnter={e => { e.currentTarget.style.background = "#f9fafb"; e.currentTarget.style.borderColor = "#9ca3af"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#d1d5db"; }}>
      ↓ Download CSV
    </button>
  );
}

function ClickableNum({ value, color, onClick, title = "" }) {
  return (
    <span onClick={onClick} title={title || "Click to view in Raw tab"} style={{ color, fontWeight: 700, cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 3, transition: "opacity 0.15s" }}
      onMouseEnter={e => e.target.style.opacity = 0.7} onMouseLeave={e => e.target.style.opacity = 1}>
      {typeof value === "number" ? value.toLocaleString() : value}
    </span>
  );
}

function StatCard({ label, value, sub, color = "#6366f1", onClick, loading = false, compact = false }: { label: string; value: any; sub?: string; color?: string; onClick?: any; loading?: boolean; compact?: boolean }) {
  const interactive = !!onClick;
  return (
    <div onClick={!loading ? onClick : undefined} style={{ background: "#fff", borderRadius: 12, padding: compact ? "12px 16px" : "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", border: "1px solid #e5e7eb", flex: 1, minWidth: 160, cursor: interactive && !loading ? "pointer" : "default", transition: "all 0.15s" }}
      onMouseEnter={e => { if (interactive && !loading) { e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.12)"; e.currentTarget.style.transform = "translateY(-2px)"; } }}
      onMouseLeave={e => { if (interactive && !loading) { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)"; e.currentTarget.style.transform = "translateY(0)"; } }}>
      <div style={{ fontSize: compact ? 12 : 13, color: "#6b7280", fontWeight: 500, marginBottom: 4 }}>{label}</div>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
          <div className="shimmer-cell" style={{ height: compact ? 24 : 32, borderRadius: 6, width: "60%" }} />
          {sub !== undefined && <div className="shimmer-cell" style={{ height: 14, borderRadius: 4, width: "45%" }} />}
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <div style={{ fontSize: compact ? 22 : 28, fontWeight: 700, color }}>{typeof value === "number" ? value.toLocaleString() : value}</div>
          {sub && <div style={{ fontSize: compact ? 12 : 13, color: "#9ca3af", fontWeight: 500 }}>({sub})</div>}
        </div>
      )}
      {interactive && !loading && <div style={{ fontSize: 11, color: "#a5b4fc", marginTop: compact ? 4 : 6 }}>Click to view details →</div>}
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button onClick={handleCopy} title={copied ? "Copied!" : `Copy: ${value}`}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 6, border: `1px solid ${copied ? "#bbf7d0" : "#e5e7eb"}`, background: copied ? "#dcfce7" : "#f9fafb", cursor: "pointer", color: copied ? "#166534" : "#9ca3af", transition: "all 0.15s", flexShrink: 0 }}
      onMouseEnter={e => { if (!copied) e.currentTarget.style.borderColor = "#9ca3af"; }}
      onMouseLeave={e => { if (!copied) e.currentTarget.style.borderColor = "#e5e7eb"; }}>
      {copied
        ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>}
    </button>
  );
}

function SearchableSelect({ value, onChange, options, placeholder = "All" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const filtered = useMemo(() => {
    const unique = [...new Set(options)];
    if (!query) return unique;
    const q = query.toLowerCase();
    const tokens = q.split(/\s+/).filter(Boolean);
    return unique
      .filter(o => {
        const ol = o.toLowerCase();
        return tokens.every(t => ol.includes(t));
      })
      .sort((a, b) => {
        const al = a.toLowerCase(), bl = b.toLowerCase();
        const aStarts = al.startsWith(q), bStarts = bl.startsWith(q);
        if (aStarts !== bStarts) return aStarts ? -1 : 1;
        return al.localeCompare(bl);
      });
  }, [options, query]);

  const baseStyle = {
    padding: "7px 12px", borderRadius: 8, border: "1px solid #d1d5db",
    fontSize: 13, background: "#fff", minWidth: 130, outline: "none",
    cursor: "pointer", display: "flex", alignItems: "center",
    justifyContent: "space-between", gap: 6, userSelect: "none" as const,
  };
  const activeStyle = value ? { ...baseStyle, borderColor: "#818cf8", background: "#eef2ff" } : baseStyle;

  return (
    <div ref={ref} style={{ position: "relative", minWidth: 130 }}>
      <div onClick={() => { setOpen(o => !o); setQuery(""); }} style={activeStyle}>
        <span style={{ color: value ? "#111827" : "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
          {value || placeholder}
        </span>
        <span style={{ fontSize: 10, color: "#6b7280", flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div onClick={e => e.stopPropagation()} style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 50,
          background: "#fff", border: "1px solid #d1d5db", borderRadius: 8,
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)", minWidth: "100%", maxWidth: 280,
          overflow: "hidden",
        }}>
          <div style={{ padding: "8px 10px", borderBottom: "1px solid #e5e7eb" }}>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search..."
              onClick={e => e.stopPropagation()}
              style={{ width: "100%", padding: "5px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, outline: "none", boxSizing: "border-box" as const }}
            />
          </div>
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            <div
              onClick={() => { onChange(null); setOpen(false); setQuery(""); }}
              style={{ padding: "8px 14px", cursor: "pointer", fontSize: 13, color: value ? "#6b7280" : "#374151", fontWeight: value ? 400 : 600, background: value ? "#fff" : "#f9fafb" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f3f4f6")}
              onMouseLeave={e => (e.currentTarget.style.background = value ? "#fff" : "#f9fafb")}
            >
              {placeholder}
            </div>
            {filtered.length === 0 && (
              <div style={{ padding: "8px 14px", fontSize: 13, color: "#9ca3af" }}>No results</div>
            )}
            {filtered.map(o => (
              <div
                key={o}
                onClick={() => { onChange(o); setOpen(false); setQuery(""); }}
                style={{ padding: "8px 14px", cursor: "pointer", fontSize: 13, color: "#374151", background: value === o ? "#eef2ff" : "#fff", fontWeight: value === o ? 600 : 400 }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f3f4f6")}
                onMouseLeave={e => (e.currentTarget.style.background = value === o ? "#eef2ff" : "#fff")}
              >
                {o}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FilterBar({ filters, setFilters, rooftopOptions = [], typeOptions = [], csmOptions = [], enterpriseObjects = [] }) {
  // Build id→name and name→id maps for display vs filter
  const enterpriseIdToName = useMemo(() => Object.fromEntries(enterpriseObjects.map(e => [e.id, e.name])), [enterpriseObjects]);
  const enterpriseNameToId = useMemo(() => Object.fromEntries(enterpriseObjects.map(e => [e.name, e.id])), [enterpriseObjects]);
  const enterpriseNames = useMemo(() => [...new Set(enterpriseObjects.map(e => e.name).filter(Boolean))].sort(), [enterpriseObjects]);
  const selectedEnterpriseName = filters.enterpriseId ? (enterpriseIdToName[filters.enterpriseId] ?? filters.enterpriseId) : null;

  // When an enterprise is selected, narrow the rooftop dropdown to that enterprise's rooftops only.
  const availableRooftops = useMemo(
    () => filters.enterpriseId ? rooftopOptions.filter(r => r.enterprise_id === filters.enterpriseId) : rooftopOptions,
    [rooftopOptions, filters.enterpriseId]
  );
  const rooftopIdToName = useMemo(() => Object.fromEntries(availableRooftops.map(r => [r.id, r.name])), [availableRooftops]);
  const rooftopNameToId = useMemo(() => Object.fromEntries(availableRooftops.map(r => [r.name, r.id])), [availableRooftops]);
  const rooftopNames = useMemo(() => [...new Set(availableRooftops.map(r => r.name).filter(Boolean))].sort(), [availableRooftops]);
  const selectedRooftopName = filters.rooftopId ? (rooftopIdToName[filters.rooftopId] ?? filters.rooftopId) : null;

  const activeCount = [filters.enterpriseId, filters.rooftopId, filters.rooftopType, filters.csm, filters.status, filters.after24h !== null ? "x" : null, filters.hasPhotos !== null && filters.hasPhotos !== undefined ? "x" : null, filters.hasVin !== null && filters.hasVin !== undefined ? "x" : null, filters.reasonBucket].filter(Boolean).length;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input placeholder="Search VIN, Rooftop, CSM..." value={filters.search || ""} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
          style={{ flex: 1, minWidth: 180, padding: "7px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, outline: "none" }} />
        <SearchableSelect
          value={selectedEnterpriseName}
          onChange={v => setFilters(f => ({ ...f, enterpriseId: v ? (enterpriseNameToId[v] ?? null) : null, rooftopId: null }))}
          options={enterpriseNames}
          placeholder="All Enterprises"
        />
        <SearchableSelect
          value={selectedRooftopName}
          onChange={v => setFilters(f => ({ ...f, rooftopId: v ? (rooftopNameToId[v] ?? null) : null }))}
          options={rooftopNames}
          placeholder="All Rooftops"
        />
        <SearchableSelect
          value={filters.rooftopType}
          onChange={v => setFilters(f => ({ ...f, rooftopType: v }))}
          options={typeOptions}
          placeholder="All Types"
        />
        <SearchableSelect
          value={filters.csm}
          onChange={v => setFilters(f => ({ ...f, csm: v }))}
          options={csmOptions}
          placeholder="All CSMs"
        />
        <SearchableSelect
          value={filters.status}
          onChange={v => setFilters(f => ({ ...f, status: v }))}
          options={["Delivered", "Not Delivered"]}
          placeholder="All Statuses"
        />
        <SearchableSelect
          value={filters.after24h === null ? null : filters.after24h ? "After 24h" : "Within 24h"}
          onChange={v => setFilters(f => ({ ...f, after24h: v === null ? null : v === "After 24h" }))}
          options={["After 24h", "Within 24h"]}
          placeholder="24h: Any"
        />
        <SearchableSelect
          value={filters.hasPhotos === null || filters.hasPhotos === undefined ? null : filters.hasPhotos ? "Has Photos" : "No Photos"}
          onChange={v => setFilters(f => ({ ...f, hasPhotos: v === null ? null : v === "Has Photos" }))}
          options={["Has Photos", "No Photos"]}
          placeholder="All Photos"
        />
        <SearchableSelect
          value={filters.hasVin === null || filters.hasVin === undefined ? null : filters.hasVin ? "Has VIN" : "No VIN"}
          onChange={v => setFilters(f => ({ ...f, hasVin: v === null ? null : v === "Has VIN" }))}
          options={["Has VIN", "No VIN"]}
          placeholder="All VINs"
        />
        <SearchableSelect
          value={filters.reasonBucket}
          onChange={v => setFilters(f => ({ ...f, reasonBucket: v }))}
          options={BUCKETS.map(b => b.label)}
          placeholder="All Buckets"
        />
        {activeCount > 0 && (
          <button onClick={() => setFilters({ search: "", enterpriseId: null, rooftopId: null, rooftopType: null, csm: null, status: null, after24h: null, hasPhotos: null, hasVin: null, reasonBucket: null })}
            style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #fca5a5", background: "#fef2f2", color: "#dc2626", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
            Clear {activeCount} filter{activeCount > 1 ? "s" : ""}
          </button>
        )}
      </div>
      {activeCount > 0 && (
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          {filters.enterpriseId && <Badge label={`Enterprise: ${selectedEnterpriseName}`} color="blue" />}
          {filters.rooftopId && <Badge label={`Rooftop: ${rooftopIdToName[filters.rooftopId] ?? filters.rooftopId}`} color="blue" />}
          {filters.rooftopType && <Badge label={`Type: ${filters.rooftopType}`} color="blue" />}
          {filters.csm && <Badge label={`CSM: ${filters.csm}`} color="blue" />}
          {filters.status && <Badge label={`Status: ${filters.status}`} color={filters.status === "Delivered" ? "green" : "red"} />}
          {filters.after24h !== null && <Badge label={filters.after24h ? "After 24h" : "Within 24h"} color="amber" />}
          {filters.hasPhotos !== null && filters.hasPhotos !== undefined && <Badge label={filters.hasPhotos ? "Has Photos" : "No Photos"} color="blue" />}
          {filters.hasVin !== null && filters.hasVin !== undefined && <Badge label={filters.hasVin ? "Has VIN" : "No VIN"} color="blue" />}
          {filters.reasonBucket && <Badge label={`Bucket: ${filters.reasonBucket}`} color="amber" />}
        </div>
      )}
    </div>
  );
}

function TableShimmer({ cols, rows = 10 }: { cols: number; rows?: number }) {
  const widths = [55, 80, 40, 65, 50, 45, 70, 35, 60, 75, 48, 42];
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6" }}>
              <div className="shimmer-cell" style={{ height: 13, borderRadius: 4, width: `${widths[j % widths.length]}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function RawTab({ data, loading, filters, setFilters, total, page, pageCount, onPageChange, rooftopOptions, typeOptions, csmOptions, enterpriseObjects = [], sortCol, sortDir, onSortChange }) {
  const [downloading, setDownloading] = useState(false);

  const handleSort = (col) => {
    if (sortCol !== col) { onSortChange(col, "desc"); }
    else if (sortDir === "desc") { onSortChange(col, "asc"); }
    else { onSortChange(null, "asc"); }
  };

  const cols = [
    { key: "enterprise",  label: "Enterprise Name" },
    { key: "rooftop",     label: "Rooftop Name" },
    { key: "rooftopType", label: "Type" },
    { key: "csm",         label: "CSM" },
    { key: "vin",         label: "VIN" },
    { key: "dealerVinId", label: "Dealer VIN ID", numeric: true },
    { key: "hasPhotos",   label: "Has Photos",    numeric: true },
    { key: "status",      label: "Status" },
    { key: "after24h",    label: "After 24h?", numeric: true },
    { key: "receivedAt",  label: "Received" },
    { key: "processedAt",  label: "Delivered" },
    { key: "reasonBucket", label: "Reason Bucket" },
    { key: "holdReason",   label: "Hold Reason" },
  ];

  const handleDownload = async () => {
    setDownloading(true);
    const params = new URLSearchParams();
    if (filters.search)       params.set("search",       filters.search);
    if (filters.enterpriseId) params.set("enterpriseId", filters.enterpriseId);
    if (filters.rooftopId)    params.set("rooftopId",    filters.rooftopId);
    if (filters.rooftopType)  params.set("rooftopType",  filters.rooftopType);
    if (filters.csm)          params.set("csm",          filters.csm);
    if (filters.status)       params.set("status",       filters.status);
    if (filters.after24h !== null) params.set("after24h", filters.after24h ? "true" : "false");
    if (filters.hasPhotos !== null && filters.hasPhotos !== undefined) params.set("hasPhotos", filters.hasPhotos ? "true" : "false");
    if (filters.hasVin !== null && filters.hasVin !== undefined) params.set("hasVin", filters.hasVin ? "true" : "false");
    if (filters.reasonBucket)      params.set("reasonBucket", filters.reasonBucket);
    if (sortCol) { params.set("sortBy", sortCol); params.set("sortDir", sortDir); }
    try {
      const res = await fetch(`${API_BASE}/api/vins/export?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { data } = await res.json();
      const headers = ["Enterprise ID", "Enterprise Name", "Team ID", "Rooftop Name", "Type", "CSM", "VIN", "Dealer VIN ID", "Has Photos", "Status", "After 24h?", "Received", "Delivered", "Reason Bucket", "Hold Reason"];
      const rows = data.map(d => [d.enterpriseId, d.enterprise, d.rooftopId, d.rooftop, d.rooftopType, d.csm, d.vin, d.dealerVinId ?? "", d.hasPhotos ? "Yes" : "No", d.status, isAfter24h(d) ? "Yes" : "No", d.receivedAt ? new Date(d.receivedAt).toLocaleString() : "", d.processedAt ? new Date(d.processedAt).toLocaleString() : "", d.reasonBucket || "", d.holdReason || ""]);
      downloadCSV("vin-data.csv", headers, rows);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <button onClick={handleDownload} disabled={downloading} title="Download as CSV"
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: downloading ? "#f3f4f6" : "#fff", fontSize: 13, fontWeight: 600, cursor: downloading ? "not-allowed" : "pointer", color: downloading ? "#9ca3af" : "#374151", transition: "all 0.15s" }}
          onMouseEnter={e => { if (!downloading) { e.currentTarget.style.background = "#f9fafb"; e.currentTarget.style.borderColor = "#9ca3af"; } }}
          onMouseLeave={e => { if (!downloading) { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#d1d5db"; } }}>
          {downloading ? "⟳ Downloading…" : "↓ Download CSV"}
        </button>
      </div>
      <FilterBar filters={filters} setFilters={setFilters} rooftopOptions={rooftopOptions} typeOptions={typeOptions} csmOptions={csmOptions} enterpriseObjects={enterpriseObjects} />
      <div style={{ maxHeight: "calc(100vh - 260px)", overflow: "auto", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600, color: "#374151", borderBottom: "2px solid #e5e7eb", background: "#f9fafb", position: "sticky", top: 0, zIndex: 2, width: 48, whiteSpace: "nowrap" }}>S. No.</th>
              {cols.map(c => (
                <th key={c.key} onClick={() => handleSort(c.key)} style={{ padding: "10px 14px", textAlign: c.numeric ? "center" : "left", fontWeight: 600, color: "#374151", borderBottom: "2px solid #e5e7eb", whiteSpace: "normal", cursor: "pointer", userSelect: "none", background: "#f9fafb", position: "sticky", top: 0, zIndex: 2 }}>
                  {c.label} {sortCol === c.key ? (sortDir === "asc" ? "↑" : "↓") : <span style={{ color: "#d1d5db" }}>↕</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={loading && data.length > 0 ? "tbody-loading" : ""}>
            {loading && data.length === 0 && <TableShimmer cols={14} />}
            {!loading && data.length === 0 && (
              <tr><td colSpan={14} style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>No records match the current filters.</td></tr>
            )}
            {data.map((d, i) => (
              <tr key={d.vin} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6", textAlign: "center", color: "#9ca3af", fontSize: 12 }}>{(page - 1) * 50 + i + 1}</td>
                <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6" }}><Truncated value={d.enterprise} maxWidth={180} /></td>
                <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6" }}><Truncated value={d.rooftop} maxWidth={150} /></td>
                <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6" }}><Badge label={d.rooftopType} color={d.rooftopType === "Franchise" ? "blue" : "gray"} /></td>
                <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6" }}><Truncated value={fmtCsm(d.csm)} maxWidth={130} /></td>
                <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 12, borderBottom: "1px solid #f3f4f6" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {d.vin || <span style={{ color: "#9ca3af" }}>—</span>}
                    {d.vin && <CopyButton value={d.vin} />}
                    {d.dealerVinId
                      ? <a href={`https://console.spyne.ai/inventory/v2/listings/${d.dealerVinId}?enterprise_id=${d.enterpriseId}&team_id=${d.rooftopId}`} target="_blank" rel="noreferrer" title="Open in Console"
                          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, border: "1px solid #e5e7eb", background: "#f9fafb", color: "#6b7280", textDecoration: "none", transition: "all 0.15s" }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = "#818cf8"; e.currentTarget.style.color = "#4f46e5"; e.currentTarget.style.background = "#eef2ff"; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.color = "#6b7280"; e.currentTarget.style.background = "#f9fafb"; }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        </a>
                      : null}
                  </div>
                </td>
                <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6", textAlign: "center" }}>
                  {d.dealerVinId
                    ? <CopyButton value={d.dealerVinId} />
                    : <span style={{ color: "#9ca3af" }}>—</span>}
                </td>
                <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6", textAlign: "center" }}>{d.hasPhotos ? <Badge label="Yes" color="green" /> : <Badge label="No" color="gray" />}</td>
                <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6" }}><Badge label={d.status} color={d.status === "Delivered" ? "green" : "red"} /></td>
                <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6", textAlign: "center" }}>{isAfter24h(d) ? <Badge label="Yes" color="amber" /> : <Badge label="No" color="green" />}</td>
                <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap", fontSize: 12 }}>{new Date(d.receivedAt).toLocaleString()}</td>
                <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap", fontSize: 12 }}>{d.processedAt ? new Date(d.processedAt).toLocaleString() : "—"}</td>
                <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6" }}>{d.reasonBucket ? <Badge label={d.reasonBucket} color="amber" /> : <span style={{ color: "#9ca3af" }}>—</span>}</td>
                <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6" }}>{d.holdReason ? <Truncated value={d.holdReason} maxWidth={180} /> : <span style={{ color: "#9ca3af" }}>—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: 12, color: "#9ca3af" }}>Showing {data.length} of {total.toLocaleString()} records</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => onPageChange(page - 1)} disabled={page <= 1}
            style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid #d1d5db", background: page <= 1 ? "#f3f4f6" : "#fff", fontSize: 13, fontWeight: 600, cursor: page <= 1 ? "not-allowed" : "pointer", color: page <= 1 ? "#9ca3af" : "#374151" }}>
            ← Prev
          </button>
          <span style={{ fontSize: 12, color: "#6b7280" }}>Page {page} of {pageCount}</span>
          <button onClick={() => onPageChange(page + 1)} disabled={page >= pageCount}
            style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid #d1d5db", background: page >= pageCount ? "#f3f4f6" : "#fff", fontSize: 13, fontWeight: 600, cursor: page >= pageCount ? "not-allowed" : "pointer", color: page >= pageCount ? "#9ca3af" : "#374151" }}>
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

function RooftopTab({ typeOptions: types = [], csmOptions: csms = [], enterpriseOptions = [], bucketFlags = {}, rows, total, page, pageCount, loading, onPageChange, onDrillDown, filters, setFilters, sortCol, sortDir, onSortChange, reportDates = [] }: any) {
  const [downloading, setDownloading] = useState(false);
  const [reportDatesExpanded, setReportDatesExpanded] = useState(false);
  const row1Ref = useRef<HTMLTableRowElement>(null);
  const [row1H, setRow1H] = useState(0);
  useEffect(() => { if (row1Ref.current) setRow1H(row1Ref.current.getBoundingClientRect().height); });

  const SCORE_OPTIONS = ["Poor (<6)", "Average (6–8)", "Good (8+)"];

  const handleSort = col => {
    if (sortCol !== col) { onSortChange(col, "desc"); }
    else if (sortDir === "desc") { onSortChange(col, "asc"); }
    else { onSortChange(null, "asc"); }
  };

  const activeBuckets = BUCKETS
    .filter(b => bucketFlags[b.key])
    .sort((a, b) => rows.reduce((s, r) => s + (r[b.key] ?? 0), 0) - rows.reduce((s, r) => s + (r[a.key] ?? 0), 0));
  const pendencyColSpan = 1 + activeBuckets.length;
  const visibleDates: string[] = reportDatesExpanded ? reportDates : reportDates.slice(0, 1);
  const showDateToggle = reportDates.length > 1;
  const activeCount = [filters.rooftopType, filters.csm, filters.enterprise, filters.websiteScore, filters.imsIntegration, filters.publishingStatus, !!(filters.reportStatus || filters.reportReason)].filter(Boolean).length;
  const cols = [
    { key: "enterprise",             label: "Enterprise Name" },
    { key: "name",                   label: "Rooftop Name" },
    { key: "type",                   label: "Type" },
    { key: "csm",                    label: "CSM" },
    { key: "imsIntegrationStatus",   label: "IMS Integration",  numeric: true, noSort: true },
    { key: "publishingStatus",       label: "Publishing",       numeric: true, noSort: true },
    { key: "total",                  label: "Total Inventory",  numeric: true },
    { key: "withPhotos",             label: "With Photos",      numeric: true },
    { key: "deliveredWithPhotos",    label: "Delivered",        numeric: true },
    { key: "pendingWithPhotos",      label: "Pending",          numeric: true },
    { key: "notProcessedAfter24",    label: "Pending VINs >24h",   numeric: true },
    ...activeBuckets.map(b => ({ key: b.key, label: b.label, numeric: true })),
    { key: "websiteScore",           label: "Website Score",       numeric: true },
    { key: "_links",                 label: "Links",               numeric: true, noSort: true },
  ];

  const tdStyle = { padding: "10px 14px", borderBottom: "1px solid #f3f4f6" };

  const handleDownload = async () => {
    setDownloading(true);
    const params = new URLSearchParams();
    if (filters.search)           params.set("search",          filters.search);
    if (filters.rooftopType)      params.set("type",            filters.rooftopType);
    if (filters.csm)              params.set("csm",             filters.csm);
    if (filters.enterprise)       params.set("enterprise",      filters.enterprise);
    if (filters.imsIntegration)   params.set("imsIntegration",  filters.imsIntegration);
    if (filters.publishingStatus) params.set("publishingStatus", filters.publishingStatus);
    if (filters.websiteScore)     params.set("websiteScore",    filters.websiteScore);
    if (filters.reportStatus)     params.set("reportStatus",    filters.reportStatus);
    if (filters.reportReason)     params.set("reportReason",    filters.reportReason);
    if (filters.reportDay)        params.set("reportDay",       filters.reportDay);
    if (sortCol) { params.set("sortBy", sortCol); params.set("sortDir", sortDir); }
    try {
      const res = await fetch(`${API_BASE}/api/rooftops/export?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { data } = await res.json();
      const headers = ["Enterprise ID", "Enterprise Name", "Team ID", "Rooftop Name", "Type", "CSM", "IMS Integration", "Publishing", "Total Inventory", "With Photos", "Delivered", "Pending", "Pending VINs >24h", "Pending VINs >24h %", "Website Score", ...activeBuckets.map(b => b.label), ...reportDates.map((d: string) => fmtReportDayLabel(d))];
      const csvRows = data.map(r => {
        const rate = r.total === 0 ? 0 : ((r.notProcessedAfter24 / r.total) * 100).toFixed(0);
        const reportCols = reportDates.map((d: string) => {
          const entry = (r.reportHistory ?? []).find((h: any) => h.date === d);
          if (!entry) return "—";
          if (entry.status === "sent") return "Sent";
          return fmtSkipReason(entry.reason) ?? entry.reason ?? "Not Sent";
        });
        return [r.enterpriseId, r.enterprise, r.rooftopId, r.name, r.type, r.csm, r.imsIntegrationStatus ?? "", r.publishingStatus ?? "", r.total, r.withPhotos ?? 0, r.deliveredWithPhotos ?? 0, r.pendingWithPhotos ?? 0, r.notProcessedAfter24, rate, r.websiteScore !== null && r.websiteScore !== undefined ? Number(r.websiteScore).toFixed(1) : "", ...activeBuckets.map(b => r[b.key] ?? 0), ...reportCols];
      });
      downloadCSV("rooftop-view.csv", headers, csvRows);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <button onClick={handleDownload} disabled={downloading} title="Download as CSV"
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: downloading ? "#f3f4f6" : "#fff", fontSize: 13, fontWeight: 600, cursor: downloading ? "not-allowed" : "pointer", color: downloading ? "#9ca3af" : "#374151", transition: "all 0.15s" }}
          onMouseEnter={e => { if (!downloading) { e.currentTarget.style.background = "#f9fafb"; e.currentTarget.style.borderColor = "#9ca3af"; } }}
          onMouseLeave={e => { if (!downloading) { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#d1d5db"; } }}>
          {downloading ? "⟳ Downloading…" : "↓ Download CSV"}
        </button>
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input placeholder="Search Rooftop, CSM..." value={filters.search || ""} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            style={{ flex: 1, minWidth: 200, padding: "7px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, outline: "none" }} />
          <SearchableSelect
            value={filters.rooftopType}
            onChange={v => setFilters(f => ({ ...f, rooftopType: v }))}
            options={types}
            placeholder="All Types"
          />
          <SearchableSelect
            value={filters.csm}
            onChange={v => setFilters(f => ({ ...f, csm: v }))}
            options={csms}
            placeholder="All CSMs"
          />
          <SearchableSelect
            value={filters.enterprise}
            onChange={v => setFilters(f => ({ ...f, enterprise: v }))}
            options={enterpriseOptions}
            placeholder="All Enterprises"
          />
          <SearchableSelect
            value={filters.websiteScore}
            onChange={v => setFilters(f => ({ ...f, websiteScore: v }))}
            options={SCORE_OPTIONS}
            placeholder="All Scores"
          />
          <SearchableSelect
            value={filters.imsIntegration}
            onChange={v => setFilters(f => ({ ...f, imsIntegration: v }))}
            options={["Yes", "No"]}
            placeholder="IMS Integration"
          />
          <SearchableSelect
            value={filters.publishingStatus}
            onChange={v => setFilters(f => ({ ...f, publishingStatus: v }))}
            options={["Yes", "No"]}
            placeholder="Publishing"
          />
          <SearchableSelect
            value={filters.reportStatus ? REPORT_FILTER_DISPLAY[filters.reportStatus] : filters.reportReason ? REPORT_FILTER_DISPLAY[filters.reportReason] : null}
            onChange={v => {
              if (!v) { setFilters(f => ({ ...f, reportStatus: null, reportReason: null })); return; }
              const m = REPORT_FILTER_API[v];
              setFilters(f => ({ ...f, reportStatus: m.type === "status" ? m.value : null, reportReason: m.type === "reason" ? m.value : null }));
            }}
            options={REPORT_FILTER_OPTIONS}
            placeholder="Report Status"
          />
          {activeCount > 0 && (
            <button onClick={() => setFilters(DEFAULT_ROOFTOP_FILTERS)}
              style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #fca5a5", background: "#fef2f2", color: "#dc2626", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
              Clear {activeCount} filter{activeCount > 1 ? "s" : ""}
            </button>
          )}
        </div>
        {activeCount > 0 && (
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {filters.rooftopType && <Badge label={`Type: ${filters.rooftopType}`} color="blue" />}
            {filters.csm && <Badge label={`CSM: ${filters.csm}`} color="blue" />}
            {filters.enterprise && <Badge label={`Enterprise: ${filters.enterprise}`} color="blue" />}
            {filters.websiteScore && <Badge label={`Score: ${filters.websiteScore}`} color="blue" />}
            {filters.imsIntegration && <Badge label={`IMS: ${filters.imsIntegration}`} color="blue" />}
            {filters.publishingStatus && <Badge label={`Publishing: ${filters.publishingStatus}`} color="blue" />}
          </div>
        )}
      </div>
      <div style={{ maxHeight: "calc(100vh - 260px)", overflow: "auto", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            {/* Row 1 — main column headers (rowSpan=2) + pendency group label */}
            <tr ref={row1Ref} style={{ background: "#f9fafb" }}>
              <th rowSpan={2} style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600, color: "#374151", borderBottom: "2px solid #e5e7eb", background: "#f9fafb", position: "sticky", top: 0, zIndex: 2, width: 48, whiteSpace: "nowrap" }}>S. No.</th>
              {[
                { key: "enterprise", label: "Enterprise Name" },
                { key: "name", label: "Rooftop Name" },
                { key: "type", label: "Type" },
                { key: "csm", label: "CSM" },
              ].map(c => (
                <th key={c.key} rowSpan={2} onClick={() => handleSort(c.key)} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "#374151", borderBottom: "2px solid #e5e7eb", whiteSpace: "normal", cursor: "pointer", userSelect: "none", background: "#f9fafb", position: "sticky", top: 0, zIndex: 2 }}>
                  {c.label} {sortCol === c.key ? (sortDir === "asc" ? "↑" : "↓") : <span style={{ color: "#d1d5db" }}>↕</span>}
                </th>
              ))}
              {[
                { key: "imsIntegrationStatus", label: "IMS Integration" },
                { key: "publishingStatus", label: "Publishing" },
              ].map(c => (
                <th key={c.key} rowSpan={2} style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600, color: "#374151", borderBottom: "2px solid #e5e7eb", whiteSpace: "normal", cursor: "default", background: "#f9fafb", position: "sticky", top: 0, zIndex: 2 }}>
                  {c.label}
                </th>
              ))}
              {visibleDates.map((d: string) => (
                <th key={d} rowSpan={2} style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600, color: "#374151", borderBottom: "2px solid #e5e7eb", whiteSpace: "nowrap", cursor: "default", background: "#f9fafb", position: "sticky", top: 0, zIndex: 2, minWidth: 80 }}>
                  {fmtReportDayLabel(d)}
                </th>
              ))}
              {showDateToggle && (
                <th rowSpan={2} onClick={() => setReportDatesExpanded(v => !v)}
                  title={reportDatesExpanded ? "Collapse report history" : "Expand report history"}
                  style={{ padding: "4px 8px", textAlign: "center", fontWeight: 700, color: "#6b7280", borderBottom: "2px solid #e5e7eb", whiteSpace: "nowrap", cursor: "pointer", background: "#f9fafb", position: "sticky", top: 0, zIndex: 2, fontSize: 16, userSelect: "none" }}>
                  {reportDatesExpanded ? "−" : "+"}
                </th>
              )}
              {[
                { key: "total", label: "Total Inventory" },
                { key: "withPhotos", label: "With Photos" },
                { key: "deliveredWithPhotos", label: "Delivered" },
                { key: "pendingWithPhotos", label: "Pending" },
              ].map(c => (
                <th key={c.key} rowSpan={2} onClick={() => handleSort(c.key)} style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600, color: "#374151", borderBottom: "2px solid #e5e7eb", whiteSpace: "normal", cursor: "pointer", userSelect: "none", background: "#f9fafb", position: "sticky", top: 0, zIndex: 2 }}>
                  {c.label} {sortCol === c.key ? (sortDir === "asc" ? "↑" : "↓") : <span style={{ color: "#d1d5db" }}>↕</span>}
                </th>
              ))}
              {/* Pendency group header */}
              <th colSpan={pendencyColSpan} style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600, color: "#92400e", background: "#fffbeb", position: "sticky", top: 0, zIndex: 2, borderLeft: "2px solid #fcd34d", borderRight: "2px solid #fcd34d", boxShadow: "inset 0 -1px 0 #fde68a", whiteSpace: "nowrap" }}>
                Pendency &gt;24h
              </th>
              <th rowSpan={2} onClick={() => handleSort("websiteScore")} style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600, color: "#374151", borderBottom: "2px solid #e5e7eb", whiteSpace: "normal", cursor: "pointer", userSelect: "none", background: "#f9fafb", position: "sticky", top: 0, zIndex: 2 }}>
                Website Score {sortCol === "websiteScore" ? (sortDir === "asc" ? "↑" : "↓") : <span style={{ color: "#d1d5db" }}>↕</span>}
              </th>
              <th rowSpan={2} style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600, color: "#374151", borderBottom: "2px solid #e5e7eb", whiteSpace: "normal", cursor: "default", background: "#f9fafb", position: "sticky", top: 0, zIndex: 2 }}>
                Links
              </th>
            </tr>
            {/* Row 2 — pendency sub-headers */}
            <tr style={{ background: "#fffbeb" }}>
              <th onClick={() => handleSort("notProcessedAfter24")} style={{ padding: "5px 8px", fontSize: 11, fontWeight: 600, color: "#92400e", background: "#fffbeb", position: "sticky", top: row1H, zIndex: 3, whiteSpace: "nowrap", cursor: "pointer", userSelect: "none", textAlign: "center", borderLeft: "2px solid #fcd34d", boxShadow: "inset 0 -2px 0 #e5e7eb", ...(activeBuckets.length === 0 ? { borderRight: "2px solid #fcd34d" } : {}) }}>
                Total {sortCol === "notProcessedAfter24" ? (sortDir === "asc" ? "↑" : "↓") : <span style={{ color: "#d1d5db" }}>↕</span>}
              </th>
              {activeBuckets.map((b, idx) => (
                <th key={b.key} onClick={() => handleSort(b.key)} style={{ padding: "5px 8px", fontSize: 11, fontWeight: 600, color: "#92400e", background: "#fffbeb", position: "sticky", top: row1H, zIndex: 3, whiteSpace: "nowrap", cursor: "pointer", userSelect: "none", textAlign: "center", boxShadow: "inset 0 -2px 0 #e5e7eb", ...(idx === activeBuckets.length - 1 ? { borderRight: "2px solid #fcd34d" } : {}) }}>
                  {b.label.replace(" Pending", "").replace("Others", "Other")} {sortCol === b.key ? (sortDir === "asc" ? "↑" : "↓") : <span style={{ color: "#d1d5db" }}>↕</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={loading && rows.length > 0 ? "tbody-loading" : ""}>
            {loading && rows.length === 0 && <TableShimmer cols={cols.length + 1 + visibleDates.length + (showDateToggle ? 1 : 0)} />}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={cols.length + 1 + visibleDates.length + (showDateToggle ? 1 : 0)} style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>No records match the current filters.</td></tr>
            )}
            {rows.map((r, i) => {
              const rate = r.total === 0 ? 0 : (r.notProcessedAfter24 / r.total) * 100;
              return (
                <tr key={r.rooftopId || r.name} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                  <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af", fontSize: 12 }}>{(page - 1) * 50 + i + 1}</td>
                  <td style={tdStyle}><Truncated value={r.enterprise} maxWidth={180} /></td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}><Truncated value={r.name} maxWidth={150} /></td>
                  <td style={tdStyle}><Badge label={r.type} color={r.type === "Franchise" ? "blue" : "gray"} /></td>
                  <td style={tdStyle}><Truncated value={fmtCsm(r.csm)} maxWidth={130} /></td>
                  <td style={{ ...tdStyle, textAlign: "center" }}><StatusBadge value={r.imsIntegrationStatus} /></td>
                  <td style={{ ...tdStyle, textAlign: "center" }}><StatusBadge value={r.publishingStatus} /></td>
                  {visibleDates.map((d: string) => {
                    const entry = (r.reportHistory ?? []).find((h: any) => h.date === d);
                    if (!entry) return <td key={d} style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }}>—</td>;
                    if (entry.status === "sent") return (
                      <td key={d} style={{ ...tdStyle, textAlign: "center" }}>
                        <span style={{ background: "#dcfce7", color: "#166534", borderRadius: 4, padding: "2px 7px", fontSize: 12, fontWeight: 500 }}>Sent</span>
                      </td>
                    );
                    return (
                      <td key={d} style={{ ...tdStyle, textAlign: "center" }}>
                        <span style={{ background: "#fef3c7", color: "#92400e", borderRadius: 4, padding: "2px 7px", fontSize: 12, fontWeight: 500 }}>
                          {fmtSkipReason(entry.reason) ?? entry.reason ?? "Not Sent"}
                        </span>
                      </td>
                    );
                  })}
                  {showDateToggle && <td style={{ ...tdStyle }} />}
                  <td style={{ ...tdStyle, textAlign: "center" }}><ClickableNum value={r.total} color="#4f46e5" onClick={() => onDrillDown({ rooftopId: r.rooftopId })} /></td>
                  <td style={{ ...tdStyle, textAlign: "center" }}><ClickableNum value={r.withPhotos ?? 0} color="#0ea5e9" onClick={() => onDrillDown({ rooftopId: r.rooftopId, hasPhotos: true })} /></td>
                  <td style={{ ...tdStyle, textAlign: "center" }}><ClickableNum value={r.deliveredWithPhotos ?? 0} color="#166534" onClick={() => onDrillDown({ rooftopId: r.rooftopId, status: "Delivered", hasPhotos: true })} /></td>
                  <td style={{ ...tdStyle, textAlign: "center" }}><ClickableNum value={r.pendingWithPhotos ?? 0} color="#991b1b" onClick={() => onDrillDown({ rooftopId: r.rooftopId, status: "Not Delivered", hasPhotos: true })} /></td>
                  {/* Pendency group: Total (count + %) */}
                  <td style={{ ...tdStyle, textAlign: "center", borderLeft: "2px solid #fcd34d", ...(activeBuckets.length === 0 ? { borderRight: "2px solid #fcd34d" } : {}) }}>
                    <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 }}>
                      {r.notProcessedAfter24 > 0
                        ? <span onClick={() => onDrillDown({ rooftopId: r.rooftopId, status: "Not Delivered", after24h: true, hasPhotos: true })} style={{ cursor: "pointer" }}><Badge label={r.notProcessedAfter24} color="red" /></span>
                        : <span style={{ color: "#9ca3af" }}>0</span>}
                      <span style={{ fontSize: 11, color: "#6b7280" }}>{rate.toFixed(0)}%</span>
                    </div>
                  </td>
                  {/* Pendency group: bucket split columns */}
                  {activeBuckets.map((b, idx) => (
                    <td key={b.key} style={{ ...tdStyle, textAlign: "center", ...(idx === activeBuckets.length - 1 ? { borderRight: "2px solid #fcd34d" } : {}) }}>
                      {(r[b.key] ?? 0) > 0 ? <Badge label={r[b.key]} color="amber" /> : <span style={{ color: "#9ca3af" }}>0</span>}
                    </td>
                  ))}
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    {r.websiteScore !== null && r.websiteScore !== undefined
                      ? <span style={{ fontWeight: 700, color: r.websiteScore >= 8 ? "#166534" : r.websiteScore >= 6 ? "#92400e" : "#991b1b" }}>
                          {Number(r.websiteScore).toFixed(1)}
                        </span>
                      : <span style={{ color: "#9ca3af" }}>—</span>}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <a href={`https://console.spyne.ai/home?enterprise_id=${r.enterpriseId}&team_id=${r.rooftopId}`} target="_blank" rel="noreferrer" title="Open in Console"
                        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, border: "1px solid #e5e7eb", background: "#f9fafb", color: "#6b7280", textDecoration: "none", transition: "all 0.15s" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "#818cf8"; e.currentTarget.style.color = "#4f46e5"; e.currentTarget.style.background = "#eef2ff"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.color = "#6b7280"; e.currentTarget.style.background = "#f9fafb"; }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      </a>
                      {r.websiteListingUrl
                        ? <a href={r.websiteListingUrl} target="_blank" rel="noreferrer" title="Open Website"
                            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, border: "1px solid #e5e7eb", background: "#f9fafb", color: "#6b7280", textDecoration: "none", transition: "all 0.15s" }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = "#6ee7b7"; e.currentTarget.style.color = "#059669"; e.currentTarget.style.background = "#ecfdf5"; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.color = "#6b7280"; e.currentTarget.style.background = "#f9fafb"; }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                          </a>
                        : <span title="Website URL not available"
                            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, border: "1px dashed #e5e7eb", background: "#fafafa", color: "#d1d5db", cursor: "not-allowed" }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                          </span>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: 12, color: "#9ca3af" }}>Showing {rows.length} of {total.toLocaleString()} rooftops</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => onPageChange(page - 1)} disabled={page <= 1}
            style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid #d1d5db", background: page <= 1 ? "#f3f4f6" : "#fff", fontSize: 13, fontWeight: 600, cursor: page <= 1 ? "not-allowed" : "pointer", color: page <= 1 ? "#9ca3af" : "#374151" }}>
            ← Prev
          </button>
          <span style={{ fontSize: 12, color: "#6b7280" }}>Page {page} of {pageCount}</span>
          <button onClick={() => onPageChange(page + 1)} disabled={page >= pageCount}
            style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid #d1d5db", background: page >= pageCount ? "#f3f4f6" : "#fff", fontSize: 13, fontWeight: 600, cursor: page >= pageCount ? "not-allowed" : "pointer", color: page >= pageCount ? "#9ca3af" : "#374151" }}>
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

function EnterpriseTab({ csmOptions = [], typeOptions = [], hasNotIntegrated = false, hasPublishingDisabled = false, bucketFlags = {}, rows, total, page, pageCount, loading, onPageChange, onDrillDown, filters = DEFAULT_ENTERPRISE_FILTERS, setFilters = (_f) => {}, sortCol, sortDir, onSortChange }) {
  const [downloading, setDownloading] = useState(false);
  const row1Ref = useRef<HTMLTableRowElement>(null);
  const [row1H, setRow1H] = useState(0);
  useEffect(() => { if (row1Ref.current) setRow1H(row1Ref.current.getBoundingClientRect().height); });

  const tdStyle = { padding: "10px 14px", borderBottom: "1px solid #f3f4f6" };

  const SCORE_OPTIONS = ["Poor (<6)", "Average (6–8)", "Good (8+)"];

  const activeBuckets = BUCKETS
    .filter(b => bucketFlags[b.key])
    .sort((a, b) => rows.reduce((s, r) => s + (r[b.key] ?? 0), 0) - rows.reduce((s, r) => s + (r[a.key] ?? 0), 0));
  const pendencyColSpan = 1 + activeBuckets.length;
  const showNotIntegrated      = hasNotIntegrated;
  const showPublishingDisabled = hasPublishingDisabled;
  const cols = [
    { key: "id",                  label: "Enterprise ID" },
    { key: "name",                label: "Enterprise Name" },
    { key: "accountType",         label: "Account Type" },
    { key: "csm",                 label: "CSM" },
    { key: "rooftopCount",        label: "Rooftops",            numeric: true },
    ...(showNotIntegrated      ? [{ key: "notIntegratedCount",      label: "Not Integrated",      numeric: true }] : []),
    ...(showPublishingDisabled ? [{ key: "publishingDisabledCount", label: "Publishing Disabled", numeric: true }] : []),
    { key: "total",               label: "Total Inventory",     numeric: true },
    { key: "withPhotos",          label: "With Photos",         numeric: true },
    { key: "deliveredWithPhotos", label: "Delivered",           numeric: true },
    { key: "pendingWithPhotos",   label: "Pending",             numeric: true },
    { key: "notProcessedAfter24", label: "Pending VINs >24h",   numeric: true },
    ...activeBuckets.map(b => ({ key: b.key, label: b.label, numeric: true })),
    { key: "avgWebsiteScore",     label: "Avg Website Score",   numeric: true },
    { key: "_links",              label: "Links",               numeric: true, noSort: true },
  ];

  const handleSort = col => {
    if (sortCol !== col) { onSortChange(col, "desc"); }
    else if (sortDir === "desc") { onSortChange(col, "asc"); }
    else { onSortChange(null, "asc"); }
  };

  const activeCount = [filters.csm, filters.accountType, filters.websiteScore, !!(filters.reportStatus || filters.reportReason)].filter(Boolean).length;

  const handleDownload = async () => {
    setDownloading(true);
    const params = new URLSearchParams();
    if (filters.search)       params.set("search",        filters.search);
    if (filters.csm)          params.set("csm",           filters.csm);
    if (filters.accountType)  params.set("accountType",   filters.accountType);
    if (filters.websiteScore) params.set("websiteScore",  filters.websiteScore);
    if (filters.reportStatus) params.set("reportStatus",  filters.reportStatus);
    if (filters.reportReason) params.set("reportReason",  filters.reportReason);
    if (sortCol) { params.set("sortBy", sortCol); params.set("sortDir", sortDir); }
    try {
      const res = await fetch(`${API_BASE}/api/enterprises/export?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { data } = await res.json();
      const headers = ["Enterprise ID", "Enterprise Name", "Account Type", "CSM", "Rooftops", ...(showNotIntegrated ? ["Not Integrated"] : []), ...(showPublishingDisabled ? ["Publishing Disabled"] : []), "Total Inventory", "With Photos", "Delivered", "Pending", "Pending VINs >24h", "Pending VINs >24h %", "Avg Website Score", ...activeBuckets.map(b => b.label), "Report Status"];
      const csvRows = data.map((r: any) => {
        const reportStatusLabel = r.reportStatus === "sent" ? "Sent" : (fmtSkipReason(r.reportReason) ?? "Not Sent");
        return [r.id, r.name, r.accountType ?? "", r.csm ?? "", r.rooftopCount ?? 0, ...(showNotIntegrated ? [r.notIntegratedCount ?? 0] : []), ...(showPublishingDisabled ? [r.publishingDisabledCount ?? 0] : []), r.total, r.withPhotos ?? 0, r.deliveredWithPhotos ?? 0, r.pendingWithPhotos ?? 0, r.notProcessedAfter24, r.total === 0 ? 0 : ((r.notProcessedAfter24 / r.total) * 100).toFixed(0), r.avgWebsiteScore !== null && r.avgWebsiteScore !== undefined ? Number(r.avgWebsiteScore).toFixed(1) : "", ...activeBuckets.map(b => r[b.key] ?? 0), reportStatusLabel];
      });
      downloadCSV("enterprise-view.csv", headers, csvRows);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 10 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", flex: 1 }}>
          <input
            placeholder="Search Enterprise, CSM..."
            value={filters.search || ""}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            style={{ flex: 1, minWidth: 220, padding: "7px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, outline: "none" }}
          />
          <SearchableSelect
            value={filters.csm}
            onChange={v => setFilters(f => ({ ...f, csm: v }))}
            options={csmOptions}
            placeholder="All CSMs"
          />
          <SearchableSelect
            value={filters.accountType}
            onChange={v => setFilters(f => ({ ...f, accountType: v }))}
            options={typeOptions}
            placeholder="All Types"
          />
          <SearchableSelect
            value={filters.websiteScore}
            onChange={v => setFilters(f => ({ ...f, websiteScore: v }))}
            options={SCORE_OPTIONS}
            placeholder="All Scores"
          />
          <SearchableSelect
            value={filters.reportStatus ? REPORT_FILTER_DISPLAY[filters.reportStatus] : filters.reportReason ? REPORT_FILTER_DISPLAY[filters.reportReason] : null}
            onChange={v => {
              if (!v) { setFilters(f => ({ ...f, reportStatus: null, reportReason: null })); return; }
              const m = REPORT_FILTER_API[v];
              setFilters(f => ({ ...f, reportStatus: m.type === "status" ? m.value : null, reportReason: m.type === "reason" ? m.value : null }));
            }}
            options={REPORT_FILTER_OPTIONS}
            placeholder="Report Status"
          />
          {(filters.search || activeCount > 0) && (
            <button onClick={() => setFilters(DEFAULT_ENTERPRISE_FILTERS)}
              style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #fca5a5", background: "#fef2f2", color: "#dc2626", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
              Clear {activeCount > 0 ? `${activeCount} filter${activeCount > 1 ? "s" : ""}` : "filters"}
            </button>
          )}
        </div>
        <button onClick={handleDownload} disabled={downloading} title="Download as CSV"
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: downloading ? "#f3f4f6" : "#fff", fontSize: 13, fontWeight: 600, cursor: downloading ? "not-allowed" : "pointer", color: downloading ? "#9ca3af" : "#374151", transition: "all 0.15s" }}
          onMouseEnter={e => { if (!downloading) { e.currentTarget.style.background = "#f9fafb"; e.currentTarget.style.borderColor = "#9ca3af"; } }}
          onMouseLeave={e => { if (!downloading) { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#d1d5db"; } }}>
          {downloading ? "⟳ Downloading…" : "↓ Download CSV"}
        </button>
      </div>
      {(filters.csm || filters.accountType || filters.websiteScore) && (
        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
          {filters.csm         && <Badge label={`CSM: ${fmtCsm(filters.csm)}`} color="blue" />}
          {filters.accountType && <Badge label={`Type: ${filters.accountType}`} color="blue" />}
          {filters.websiteScore && <Badge label={`Score: ${filters.websiteScore}`} color="blue" />}
        </div>
      )}
      <div style={{ maxHeight: "calc(100vh - 260px)", overflow: "auto", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            {/* Row 1 — main column headers (rowSpan=2) + pendency group label */}
            <tr ref={row1Ref} style={{ background: "#f9fafb" }}>
              <th rowSpan={2} style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600, color: "#374151", borderBottom: "2px solid #e5e7eb", background: "#f9fafb", position: "sticky", top: 0, zIndex: 2, width: 48, whiteSpace: "nowrap" }}>S. No.</th>
              {[
                { key: "id", label: "Enterprise ID", numeric: false },
                { key: "name", label: "Enterprise Name", numeric: false },
                { key: "accountType", label: "Account Type", numeric: false },
                { key: "csm", label: "CSM", numeric: false },
              ].map(c => (
                <th key={c.key} rowSpan={2} onClick={() => handleSort(c.key)} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "#374151", borderBottom: "2px solid #e5e7eb", whiteSpace: "normal", cursor: "pointer", userSelect: "none", background: "#f9fafb", position: "sticky", top: 0, zIndex: 2 }}>
                  {c.label} {sortCol === c.key ? (sortDir === "asc" ? "↑" : "↓") : <span style={{ color: "#d1d5db" }}>↕</span>}
                </th>
              ))}
              {[
                { key: "rooftopCount", label: "Rooftops" },
                ...(showNotIntegrated      ? [{ key: "notIntegratedCount",      label: "Not Integrated" }]      : []),
                ...(showPublishingDisabled ? [{ key: "publishingDisabledCount", label: "Publishing Disabled" }] : []),
              ].map(c => (
                <th key={c.key} rowSpan={2} onClick={() => handleSort(c.key)} style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600, color: "#374151", borderBottom: "2px solid #e5e7eb", whiteSpace: "normal", cursor: "pointer", userSelect: "none", background: "#f9fafb", position: "sticky", top: 0, zIndex: 2 }}>
                  {c.label} {sortCol === c.key ? (sortDir === "asc" ? "↑" : "↓") : <span style={{ color: "#d1d5db" }}>↕</span>}
                </th>
              ))}
              <th rowSpan={2} onClick={() => handleSort("reportStatus")} style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600, color: "#374151", borderBottom: "2px solid #e5e7eb", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none", background: "#f9fafb", position: "sticky", top: 0, zIndex: 2 }}>
                Report Status {sortCol === "reportStatus" ? (sortDir === "asc" ? "↑" : "↓") : <span style={{ color: "#d1d5db" }}>↕</span>}
              </th>
              {[
                { key: "total",               label: "Total Inventory" },
                { key: "withPhotos",          label: "With Photos" },
                { key: "deliveredWithPhotos", label: "Delivered" },
                { key: "pendingWithPhotos",   label: "Pending" },
              ].map(c => (
                <th key={c.key} rowSpan={2} onClick={() => handleSort(c.key)} style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600, color: "#374151", borderBottom: "2px solid #e5e7eb", whiteSpace: "normal", cursor: "pointer", userSelect: "none", background: "#f9fafb", position: "sticky", top: 0, zIndex: 2 }}>
                  {c.label} {sortCol === c.key ? (sortDir === "asc" ? "↑" : "↓") : <span style={{ color: "#d1d5db" }}>↕</span>}
                </th>
              ))}
              {/* Pendency group header */}
              <th colSpan={pendencyColSpan} style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600, color: "#92400e", background: "#fffbeb", position: "sticky", top: 0, zIndex: 2, borderLeft: "2px solid #fcd34d", borderRight: "2px solid #fcd34d", boxShadow: "inset 0 -1px 0 #fde68a", whiteSpace: "nowrap" }}>
                Pendency &gt;24h
              </th>
              <th rowSpan={2} onClick={() => handleSort("avgWebsiteScore")} style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600, color: "#374151", borderBottom: "2px solid #e5e7eb", whiteSpace: "normal", cursor: "pointer", userSelect: "none", background: "#f9fafb", position: "sticky", top: 0, zIndex: 2 }}>
                Avg Website Score {sortCol === "avgWebsiteScore" ? (sortDir === "asc" ? "↑" : "↓") : <span style={{ color: "#d1d5db" }}>↕</span>}
              </th>
              <th rowSpan={2} style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600, color: "#374151", borderBottom: "2px solid #e5e7eb", whiteSpace: "normal", cursor: "default", background: "#f9fafb", position: "sticky", top: 0, zIndex: 2 }}>
                Links
              </th>
            </tr>
            {/* Row 2 — pendency sub-headers */}
            <tr style={{ background: "#fffbeb" }}>
              <th onClick={() => handleSort("notProcessedAfter24")} style={{ padding: "5px 8px", fontSize: 11, fontWeight: 600, color: "#92400e", background: "#fffbeb", position: "sticky", top: row1H, zIndex: 3, whiteSpace: "nowrap", cursor: "pointer", userSelect: "none", textAlign: "center", borderLeft: "2px solid #fcd34d", boxShadow: "inset 0 -2px 0 #e5e7eb", ...(activeBuckets.length === 0 ? { borderRight: "2px solid #fcd34d" } : {}) }}>
                Total {sortCol === "notProcessedAfter24" ? (sortDir === "asc" ? "↑" : "↓") : <span style={{ color: "#d1d5db" }}>↕</span>}
              </th>
              {activeBuckets.map((b, idx) => (
                <th key={b.key} onClick={() => handleSort(b.key)} style={{ padding: "5px 8px", fontSize: 11, fontWeight: 600, color: "#92400e", background: "#fffbeb", position: "sticky", top: row1H, zIndex: 3, whiteSpace: "nowrap", cursor: "pointer", userSelect: "none", textAlign: "center", boxShadow: "inset 0 -2px 0 #e5e7eb", ...(idx === activeBuckets.length - 1 ? { borderRight: "2px solid #fcd34d" } : {}) }}>
                  {b.label.replace(" Pending", "").replace("Others", "Other")} {sortCol === b.key ? (sortDir === "asc" ? "↑" : "↓") : <span style={{ color: "#d1d5db" }}>↕</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={loading && rows.length > 0 ? "tbody-loading" : ""}>
            {loading && rows.length === 0 && <TableShimmer cols={cols.length + 1} />}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={cols.length + 1} style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>No records match the current filters.</td></tr>
            )}
            {rows.map((r, i) => {
              const rate = r.total === 0 ? 0 : (r.notProcessedAfter24 / r.total) * 100;
              return (
                <tr key={r.id} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                  <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af", fontSize: 12 }}>{(page - 1) * 50 + i + 1}</td>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12, color: "#0ea5e9", fontWeight: 600 }}><Truncated value={r.id} maxWidth={90} /></td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}><Truncated value={r.name} maxWidth={180} /></td>
                  <td style={tdStyle}>{r.accountType ? <Badge label={r.accountType} color="blue" /> : <span style={{ color: "#9ca3af" }}>—</span>}</td>
                  <td style={tdStyle}><Truncated value={fmtCsm(r.csm)} maxWidth={130} /></td>
                  <td style={{ ...tdStyle, textAlign: "center" }}><ClickableNum value={r.rooftopCount} color="#6b7280" onClick={() => onDrillDown({ enterpriseId: r.id })} /></td>
                  {showNotIntegrated && (
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      {(r.notIntegratedCount ?? 0) > 0
                        ? <ClickableNum value={r.notIntegratedCount} color="#991b1b" onClick={() => onDrillDown({ enterpriseId: r.id })} title="Rooftops not integrated" />
                        : <span style={{ color: "#9ca3af" }}>0</span>}
                    </td>
                  )}
                  {showPublishingDisabled && (
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      {(r.publishingDisabledCount ?? 0) > 0
                        ? <ClickableNum value={r.publishingDisabledCount} color="#991b1b" onClick={() => onDrillDown({ enterpriseId: r.id })} title="Rooftops with publishing disabled" />
                        : <span style={{ color: "#9ca3af" }}>0</span>}
                    </td>
                  )}
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <ReportStatusCell status={r.reportStatus} reason={r.reportReason} lastSentAt={r.lastSentAt} dateLabel={fmtReportDate(r.lastReportDate, r.timezone)} />
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}><ClickableNum value={r.total} color="#4f46e5" onClick={() => onDrillDown({ enterpriseId: r.id })} /></td>
                  <td style={{ ...tdStyle, textAlign: "center" }}><ClickableNum value={r.withPhotos ?? 0} color="#0ea5e9" onClick={() => onDrillDown({ enterpriseId: r.id, hasPhotos: true })} /></td>
                  <td style={{ ...tdStyle, textAlign: "center" }}><ClickableNum value={r.deliveredWithPhotos ?? 0} color="#166534" onClick={() => onDrillDown({ enterpriseId: r.id, status: "Delivered", hasPhotos: true })} /></td>
                  <td style={{ ...tdStyle, textAlign: "center" }}><ClickableNum value={r.pendingWithPhotos ?? 0} color="#991b1b" onClick={() => onDrillDown({ enterpriseId: r.id, status: "Not Delivered", hasPhotos: true })} /></td>
                  {/* Pendency group: Total (count + %) */}
                  <td style={{ ...tdStyle, textAlign: "center", borderLeft: "2px solid #fcd34d", ...(activeBuckets.length === 0 ? { borderRight: "2px solid #fcd34d" } : {}) }}>
                    <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 }}>
                      {r.notProcessedAfter24 > 0
                        ? <span onClick={() => onDrillDown({ enterpriseId: r.id, status: "Not Delivered", after24h: true, hasPhotos: true })} style={{ cursor: "pointer" }}><Badge label={r.notProcessedAfter24} color="red" /></span>
                        : <span style={{ color: "#9ca3af" }}>0</span>}
                      <span style={{ fontSize: 11, color: "#6b7280" }}>{rate.toFixed(0)}%</span>
                    </div>
                  </td>
                  {/* Pendency group: bucket split columns */}
                  {activeBuckets.map((b, idx) => (
                    <td key={b.key} style={{ ...tdStyle, textAlign: "center", ...(idx === activeBuckets.length - 1 ? { borderRight: "2px solid #fcd34d" } : {}) }}>
                      {(r[b.key] ?? 0) > 0 ? <Badge label={r[b.key]} color="amber" /> : <span style={{ color: "#9ca3af" }}>0</span>}
                    </td>
                  ))}
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    {r.avgWebsiteScore !== null && r.avgWebsiteScore !== undefined
                      ? <span style={{ fontWeight: 700, color: r.avgWebsiteScore >= 8 ? "#166534" : r.avgWebsiteScore >= 6 ? "#92400e" : "#991b1b" }}>
                          {Number(r.avgWebsiteScore).toFixed(1)}
                        </span>
                      : <span style={{ color: "#9ca3af" }}>—</span>}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <a href={`https://console.spyne.ai/home?enterprise_id=${r.id}`} target="_blank" rel="noreferrer" title="Open in Console"
                        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, border: "1px solid #e5e7eb", background: "#f9fafb", color: "#6b7280", textDecoration: "none", transition: "all 0.15s" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "#818cf8"; e.currentTarget.style.color = "#4f46e5"; e.currentTarget.style.background = "#eef2ff"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.color = "#6b7280"; e.currentTarget.style.background = "#f9fafb"; }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      </a>
                      {r.websiteUrl
                        ? <a href={r.websiteUrl} target="_blank" rel="noreferrer" title="Open Website"
                            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, border: "1px solid #e5e7eb", background: "#f9fafb", color: "#6b7280", textDecoration: "none", transition: "all 0.15s" }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = "#6ee7b7"; e.currentTarget.style.color = "#059669"; e.currentTarget.style.background = "#ecfdf5"; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.color = "#6b7280"; e.currentTarget.style.background = "#f9fafb"; }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                          </a>
                        : <span title="Website URL not available"
                            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, border: "1px dashed #e5e7eb", background: "#fafafa", color: "#d1d5db", cursor: "not-allowed" }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                          </span>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: 12, color: "#9ca3af" }}>Showing {rows.length} of {total.toLocaleString()} enterprises</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => onPageChange(page - 1)} disabled={page <= 1}
            style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid #d1d5db", background: page <= 1 ? "#f3f4f6" : "#fff", fontSize: 13, fontWeight: 600, cursor: page <= 1 ? "not-allowed" : "pointer", color: page <= 1 ? "#9ca3af" : "#374151" }}>
            ← Prev
          </button>
          <span style={{ fontSize: 12, color: "#6b7280" }}>Page {page} of {pageCount}</span>
          <button onClick={() => onPageChange(page + 1)} disabled={page >= pageCount}
            style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid #d1d5db", background: page >= pageCount ? "#f3f4f6" : "#fff", fontSize: 13, fontWeight: 600, cursor: page >= pageCount ? "not-allowed" : "pointer", color: page >= pageCount ? "#9ca3af" : "#374151" }}>
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

function CSMTab({ csms, onDrillDown }) {
  const tdStyle = { padding: "10px 14px", borderBottom: "1px solid #f3f4f6" };
  const activeBuckets = BUCKETS
    .filter(b => csms.some(r => (r[b.key] ?? 0) > 0))
    .sort((a, b) => csms.reduce((s, r) => s + (r[b.key] ?? 0), 0) - csms.reduce((s, r) => s + (r[a.key] ?? 0), 0));

  const [imsFilter, setImsFilter] = useState(null);
  const [pubFilter, setPubFilter] = useState(null);

  const filtered = useMemo(() => csms.filter(r => {
    if (imsFilter === "Has Integrated" && (r.integratedCount ?? 0) === 0) return false;
    if (imsFilter === "None Integrated" && (r.integratedCount ?? 0) > 0) return false;
    if (pubFilter === "Has Publishing" && (r.publishingCount ?? 0) === 0) return false;
    if (pubFilter === "None Publishing" && (r.publishingCount ?? 0) > 0) return false;
    return true;
  }), [csms, imsFilter, pubFilter]);

  const activeCount = [imsFilter, pubFilter].filter(Boolean).length;

  const handleDownload = () => {
    const headers = ["CSM Name", "Not Integrated Rooftops", "Publishing Disabled Rooftops", "Total Inventory", "VIN Delivered", "Delivered VINs >24h", "Pending VINs", "Pending VINs >24h", "Pending VINs >24h %", ...activeBuckets.map(b => b.label)];
    const rows = filtered.map(r => [r.name, r.integratedCount ?? 0, r.publishingCount ?? 0, r.total, r.processed, r.processedAfter24, r.notProcessed, r.notProcessedAfter24, r.total === 0 ? 0 : ((r.notProcessedAfter24 / r.total) * 100).toFixed(0), ...activeBuckets.map(b => r[b.key] ?? 0)]);
    downloadCSV("csm-view.csv", headers, rows);
  };

  const baseHeaders = ["CSM Name", "Not Integrated", "Publishing Disabled", "Total Inventory", "VIN Delivered", "Delivered VINs >24h", "Pending VINs", "Pending VINs >24h", "Pending VINs >24h %"];
  const allHeaders = [...baseHeaders, ...activeBuckets.map(b => b.label)];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <SearchableSelect value={imsFilter} onChange={setImsFilter} options={["Has Integrated", "None Integrated"]} placeholder="IMS Integration" />
          <SearchableSelect value={pubFilter} onChange={setPubFilter} options={["Has Publishing", "None Publishing"]} placeholder="Publishing" />
          {activeCount > 0 && (
            <button onClick={() => { setImsFilter(null); setPubFilter(null); }}
              style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #fca5a5", background: "#fef2f2", color: "#dc2626", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
              Clear {activeCount} filter{activeCount > 1 ? "s" : ""}
            </button>
          )}
          {activeCount > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {imsFilter && <Badge label={`IMS: ${imsFilter}`} color="blue" />}
              {pubFilter && <Badge label={`Publishing: ${pubFilter}`} color="blue" />}
            </div>
          )}
        </div>
        <DownloadButton onClick={handleDownload} />
      </div>
      <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid #e5e7eb" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#f9fafb" }}>
            {allHeaders.map((h, idx) => (
              <th key={h} style={{ padding: "10px 14px", textAlign: idx >= 1 ? "center" : "left", fontWeight: 600, color: "#374151", borderBottom: "2px solid #e5e7eb", whiteSpace: "normal" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map((r, i) => {
            const rate = r.total === 0 ? 0 : (r.notProcessedAfter24 / r.total) * 100;
            return (
              <tr key={r.name} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                <td style={{ ...tdStyle, fontWeight: 600 }}><Truncated value={fmtCsm(r.name)} maxWidth={160} /></td>
                <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700, color: (r.integratedCount ?? 0) > 0 ? "#991b1b" : "#9ca3af" }}>{(r.integratedCount ?? 0).toLocaleString()}</td>
                <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700, color: (r.publishingCount ?? 0) > 0 ? "#991b1b" : "#9ca3af" }}>{(r.publishingCount ?? 0).toLocaleString()}</td>
                <td style={{ ...tdStyle, textAlign: "center" }}><ClickableNum value={r.total} color="#4f46e5" onClick={() => onDrillDown({ csm: r.name })} /></td>
                <td style={{ ...tdStyle, textAlign: "center" }}><ClickableNum value={r.processed} color="#166534" onClick={() => onDrillDown({ csm: r.name, status: "Delivered" })} /></td>
                <td style={{ ...tdStyle, textAlign: "center" }}>
                  {r.processedAfter24 > 0
                    ? <span onClick={() => onDrillDown({ csm: r.name, status: "Delivered", after24h: true })} style={{ cursor: "pointer" }}><Badge label={r.processedAfter24} color="amber" /></span>
                    : <span style={{ color: "#9ca3af" }}>0</span>}
                </td>
                <td style={{ ...tdStyle, textAlign: "center" }}><ClickableNum value={r.notProcessed} color="#991b1b" onClick={() => onDrillDown({ csm: r.name, status: "Not Delivered" })} /></td>
                <td style={{ ...tdStyle, textAlign: "center" }}>
                  {r.notProcessedAfter24 > 0
                    ? <span onClick={() => onDrillDown({ csm: r.name, status: "Not Delivered", after24h: true })} style={{ cursor: "pointer" }}><Badge label={r.notProcessedAfter24} color="red" /></span>
                    : <span style={{ color: "#9ca3af" }}>0</span>}
                </td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <div style={{ width: 80, height: 8, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${rate}%`, height: "100%", background: rate >= 30 ? "#ef4444" : rate >= 15 ? "#eab308" : "#22c55e", borderRadius: 4 }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{rate.toFixed(0)}%</span>
                  </div>
                </td>
                {activeBuckets.map(b => (
                  <td key={b.key} style={{ ...tdStyle, textAlign: "center" }}>
                    {(r[b.key] ?? 0) > 0 ? <Badge label={r[b.key]} color="amber" /> : <span style={{ color: "#9ca3af" }}>0</span>}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </div>
  );
}


function SummaryTable({ title, rows, colorHeader, filterKey, onDrillDown, onRooftopDrillDown, loading = false, defaultSortCol = "notProcessedAfter24" }) {
  const [sortCol, setSortCol] = useState(defaultSortCol);
  const [sortDir, setSortDir] = useState("desc");

  const handleSort = col => {
    if (sortCol !== col) { setSortCol(col); setSortDir("desc"); }
    else if (sortDir === "desc") { setSortDir("asc"); }
    else { setSortCol(null); setSortDir("asc"); }
  };

  const activeBuckets = BUCKETS
    .filter(b => rows.some(r => (r[b.key] ?? 0) > 0))
    .sort((a, b) => rows.reduce((s, r) => s + (r[b.key] ?? 0), 0) - rows.reduce((s, r) => s + (r[a.key] ?? 0), 0));
  const showIntegrated  = rows.some(r => (r.integratedCount ?? 0) > 0);
  const showPublishing  = rows.some(r => (r.publishingCount ?? 0) > 0);
  const pendencyColSpan = activeBuckets.length;
  const row1Ref = useRef<HTMLTableRowElement>(null);
  const [row1H, setRow1H] = useState(0);
  useEffect(() => {
    if (row1Ref.current) setRow1H(row1Ref.current.getBoundingClientRect().height);
  });

  const sorted = useMemo(() => {
    if (!sortCol) return [...rows];
    return [...rows].sort((a, b) => {
      const va = a[sortCol];
      const vb = b[sortCol];
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === "asc" ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
  }, [rows, sortCol, sortDir]);

  const totRow = rows.reduce((t, r) => {
    const obj: any = {
      total: t.total + r.total,
      enterpriseCount: (t.enterpriseCount ?? 0) + (r.enterpriseCount ?? 0),
      withPhotos: (t.withPhotos ?? 0) + (r.withPhotos ?? 0),
      deliveredWithPhotos: (t.deliveredWithPhotos ?? 0) + (r.deliveredWithPhotos ?? 0),
      pendingWithPhotos: (t.pendingWithPhotos ?? 0) + (r.pendingWithPhotos ?? 0),
      processed: t.processed + r.processed, processedAfter24: t.processedAfter24 + r.processedAfter24,
      notProcessed: t.notProcessed + r.notProcessed, notProcessedAfter24: t.notProcessedAfter24 + r.notProcessedAfter24,
      rooftopCount: t.rooftopCount + r.rooftopCount,
      integratedCount: (t.integratedCount ?? 0) + (r.integratedCount ?? 0),
      publishingCount: (t.publishingCount ?? 0) + (r.publishingCount ?? 0),
      missingWebsiteCount: (t.missingWebsiteCount ?? 0) + (r.missingWebsiteCount ?? 0),
      avgWebsiteScore: null,
    };
    BUCKETS.forEach(b => { obj[b.key] = (t[b.key] ?? 0) + (r[b.key] ?? 0); });
    return obj;
  }, { total: 0, enterpriseCount: 0, withPhotos: 0, deliveredWithPhotos: 0, pendingWithPhotos: 0, processed: 0, processedAfter24: 0, notProcessed: 0, notProcessedAfter24: 0, rooftopCount: 0, integratedCount: 0, publishingCount: 0, missingWebsiteCount: 0 } as any);
  const totRate = totRow.total === 0 ? 0 : (totRow.notProcessedAfter24 / totRow.total) * 100;
  const nameCol = filterKey === "rooftopType" ? "Rooftop Type" : "CSM";
  const td = { padding: "8px 10px", borderBottom: "1px solid #f3f4f6" };
  const totTd = { padding: "8px 10px", background: "#f9fafb", fontWeight: 700, borderTop: "2px solid #e5e7eb" };

  const thBase: React.CSSProperties = { padding: "5px 8px", fontSize: 11, fontWeight: 600, color: "#374151", boxShadow: "inset 0 -2px 0 #e5e7eb", background: "#f9fafb", position: "sticky", top: 0, zIndex: 3, whiteSpace: "nowrap" };
  const thPend: React.CSSProperties = { padding: "5px 8px", fontSize: 11, fontWeight: 600, color: "#92400e", boxShadow: "inset 0 -2px 0 #e5e7eb", background: "#fffbeb", position: "sticky", top: row1H, zIndex: 3, whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" };
  const si = (key: string) => sortCol === key ? (sortDir === "asc" ? " ↑" : " ↓") : <span style={{ color: "#d1d5db" }}> ↕</span>;

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1f2937", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 4, height: 20, borderRadius: 2, background: colorHeader, display: "inline-block" }} />
          {title}
        </h3>
        <DownloadButton onClick={() => {
          const headers = [nameCol, "Enterprises", "Rooftops", "Inventory", "With Photos", "Delivered", "Pending", "Pending VINs >24h", "Pending VINs >24h %", "Avg Website Score", ...activeBuckets.map(b => b.label), ...(showPublishing ? ["Publishing Disabled"] : []), "Missing Website", ...(showIntegrated ? ["Not Integrated"] : [])];
          const csvRows = sorted.map(r => [r.label, r.enterpriseCount ?? 0, r.rooftopCount, r.total, r.withPhotos ?? 0, r.deliveredWithPhotos ?? 0, r.pendingWithPhotos ?? 0, r.notProcessedAfter24, r.total === 0 ? 0 : ((r.notProcessedAfter24 / r.total) * 100).toFixed(0), r.avgWebsiteScore !== null && r.avgWebsiteScore !== undefined ? Number(r.avgWebsiteScore).toFixed(1) : "", ...activeBuckets.map(b => r[b.key] ?? 0), ...(showPublishing ? [r.publishingCount ?? 0] : []), r.missingWebsiteCount ?? 0, ...(showIntegrated ? [r.integratedCount ?? 0] : [])]);
          downloadCSV(`overview-${filterKey}.csv`, headers, csvRows);
        }} />
      </div>
      <div style={{ borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden" }}>
        <div style={{ maxHeight: "calc(100vh - 260px)", overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              {/* Row 1 — main column headers (rowSpan=2) + group label for pendency */}
              <tr ref={row1Ref} style={{ background: "#f9fafb" }}>
                <th rowSpan={2} style={{ ...thBase, textAlign: "center", width: 36 }}>#</th>
                <th rowSpan={2} style={{ ...thBase, textAlign: "left", cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("label")}>{nameCol}{si("label")}</th>
                <th rowSpan={2} style={{ ...thBase, textAlign: "center", cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("notProcessedAfter24")}>Pending &gt;24h{si("notProcessedAfter24")}</th>
                <th rowSpan={2} style={{ ...thBase, textAlign: "center", cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("enterpriseCount")}>Enterprises{si("enterpriseCount")}</th>
                <th rowSpan={2} style={{ ...thBase, textAlign: "center", cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("rooftopCount")}>Rooftops{si("rooftopCount")}</th>
                <th rowSpan={2} style={{ ...thBase, textAlign: "center", cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("total")}>Inventory{si("total")}</th>
                <th rowSpan={2} style={{ ...thBase, textAlign: "center", cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("withPhotos")}>With Photos{si("withPhotos")}</th>
                <th rowSpan={2} style={{ ...thBase, textAlign: "center", cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("deliveredWithPhotos")}>Delivered{si("deliveredWithPhotos")}</th>
                <th rowSpan={2} style={{ ...thBase, textAlign: "center", cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("pendingWithPhotos")}>Pending{si("pendingWithPhotos")}</th>
                <th rowSpan={2} style={{ ...thBase, textAlign: "center" }}>Pending &gt;24h %</th>
                <th rowSpan={2} style={{ ...thBase, textAlign: "center", cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("avgWebsiteScore")}>Avg Score{si("avgWebsiteScore")}</th>
                {activeBuckets.length > 0 && (
                  <th colSpan={pendencyColSpan} style={{ ...thBase, textAlign: "center", background: "#fffbeb", color: "#92400e", boxShadow: "inset 0 -1px 0 #fde68a", borderLeft: "2px solid #fcd34d", borderRight: "2px solid #fcd34d" }}>
                    Pending &gt;24h Breakdown
                  </th>
                )}
                {showPublishing && <th rowSpan={2} style={{ ...thBase, textAlign: "center", cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("publishingCount")}>Pub. Disabled{si("publishingCount")}</th>}
                <th rowSpan={2} style={{ ...thBase, textAlign: "center", cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("missingWebsiteCount")}>Missing Website{si("missingWebsiteCount")}</th>
                {showIntegrated && (
                  <th rowSpan={2} style={{ ...thBase, textAlign: "center", cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("integratedCount")}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      Not Integrated
                      <span onClick={e => e.stopPropagation()}>
                        <InfoTooltip text="Inventory is not fully synced with IMS. Please enable draft creation in the input workflows." />
                      </span>
                    </span>
                    {si("integratedCount")}
                  </th>
                )}
              </tr>
              {/* Row 2 — pendency breakdown sub-headers (only when buckets exist) */}
              {activeBuckets.length > 0 && (
                <tr style={{ background: "#fffbeb" }}>
                  {activeBuckets.map((b, idx) => (
                    <th key={b.key} style={{ ...thPend, textAlign: "center", ...(idx === 0 ? { borderLeft: "2px solid #fcd34d" } : {}), ...(idx === activeBuckets.length - 1 ? { borderRight: "2px solid #fcd34d" } : {}) }} onClick={() => handleSort(b.key)}>
                      {b.label.replace(" Pending", "").replace("Others", "Other")}{si(b.key)}
                    </th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody className={loading && rows.length > 0 ? "tbody-loading" : ""}>
              {sorted.map((r, i) => {
                const rate = r.total === 0 ? 0 : (r.notProcessedAfter24 / r.total) * 100;
                const base = { [filterKey]: r.label };
                const rowBg = i % 2 === 0 ? "#fff" : "#f9fafb";
                const pendBg = rowBg;
                return (
                  <tr key={r.label} style={{ background: rowBg }}>
                    <td style={{ ...td, textAlign: "center", color: "#9ca3af", fontSize: 12 }}>{i + 1}</td>
                    <td style={{ ...td, fontWeight: 600 }}>
                      <span onClick={() => onRooftopDrillDown({ [filterKey]: r.label })} title={r.label}
                        style={{ cursor: "pointer", color: "#111827", textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 3, display: "block", maxWidth: filterKey === "csm" ? 160 : 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        onMouseEnter={e => (e.currentTarget.style.color = "#4f46e5")} onMouseLeave={e => (e.currentTarget.style.color = "#111827")}>
                        {filterKey === "csm" ? fmtCsm(r.label) : r.label}
                      </span>
                    </td>
                    {/* Standalone: Pending >24h count */}
                    <td style={{ ...td, textAlign: "center" }}>
                      {r.notProcessedAfter24 > 0
                        ? <span onClick={() => onDrillDown({ ...base, status: "Not Delivered", after24h: true, hasPhotos: true })} style={{ cursor: "pointer" }}><Badge label={r.notProcessedAfter24} color="red" /></span>
                        : <span style={{ color: "#9ca3af" }}>0</span>}
                    </td>
                    <td style={{ ...td, textAlign: "center" }}><ClickableNum value={r.enterpriseCount ?? 0} color="#6b7280" onClick={() => onRooftopDrillDown({ [filterKey]: r.label })} /></td>
                    <td style={{ ...td, textAlign: "center" }}><ClickableNum value={r.rooftopCount} color="#6b7280" onClick={() => onRooftopDrillDown({ [filterKey]: r.label })} /></td>
                    <td style={{ ...td, textAlign: "center" }}><ClickableNum value={r.total} color="#4f46e5" onClick={() => onDrillDown(base)} /></td>
                    <td style={{ ...td, textAlign: "center" }}><ClickableNum value={r.withPhotos ?? 0} color="#0ea5e9" onClick={() => onDrillDown({ ...base, hasPhotos: true })} /></td>
                    <td style={{ ...td, textAlign: "center" }}><ClickableNum value={r.deliveredWithPhotos ?? 0} color="#166534" onClick={() => onDrillDown({ ...base, status: "Delivered", hasPhotos: true })} /></td>
                    <td style={{ ...td, textAlign: "center" }}><ClickableNum value={r.pendingWithPhotos ?? 0} color="#991b1b" onClick={() => onDrillDown({ ...base, status: "Not Delivered", hasPhotos: true })} /></td>
                    {/* Standalone: Pending >24h % */}
                    <td style={{ ...td, textAlign: "center", color: "#6b7280", fontSize: 12 }}>{rate.toFixed(0)}%</td>
                    {/* Avg Score */}
                    <td style={{ ...td, textAlign: "center" }}>
                      {r.avgWebsiteScore !== null && r.avgWebsiteScore !== undefined
                        ? <span style={{ fontWeight: 700, color: r.avgWebsiteScore >= 8 ? "#166534" : r.avgWebsiteScore >= 6 ? "#92400e" : "#991b1b" }}>
                            {Number(r.avgWebsiteScore).toFixed(1)}
                          </span>
                        : <span style={{ color: "#9ca3af" }}>—</span>}
                    </td>
                    {/* Pendency breakdown group: bucket sub-columns only */}
                    {activeBuckets.map((b, idx) => (
                      <td key={b.key} style={{ ...td, textAlign: "center", background: pendBg, ...(idx === 0 ? { borderLeft: "2px solid #fcd34d" } : {}), ...(idx === activeBuckets.length - 1 ? { borderRight: "2px solid #fcd34d" } : {}) }}>
                        {(r[b.key] ?? 0) > 0
                          ? <span onClick={() => onDrillDown({ ...base, status: "Not Delivered", after24h: true, hasPhotos: true, reasonBucket: b.label })} style={{ cursor: "pointer" }}><Badge label={r[b.key]} color="amber" /></span>
                          : "0"}
                      </td>
                    ))}
                    {showPublishing && (
                      <td style={{ ...td, textAlign: "center" }}>
                        {(r.publishingCount ?? 0) > 0
                          ? <ClickableNum value={r.publishingCount} color="#991b1b" onClick={() => onRooftopDrillDown({ [filterKey]: r.label, publishingStatus: "No" })} title="View in Rooftop View" />
                          : <span style={{ color: "#9ca3af" }}>0</span>}
                      </td>
                    )}
                    <td style={{ ...td, textAlign: "center" }}>
                      {(r.missingWebsiteCount ?? 0) > 0
                        ? <span style={{ fontWeight: 700, color: "#991b1b" }}>{r.missingWebsiteCount}</span>
                        : <span style={{ color: "#9ca3af" }}>0</span>}
                    </td>
                    {showIntegrated && (
                      <td style={{ ...td, textAlign: "center" }}>
                        {(r.integratedCount ?? 0) > 0
                          ? <ClickableNum value={r.integratedCount} color="#991b1b" onClick={() => onRooftopDrillDown({ [filterKey]: r.label, imsIntegration: "No" })} title="View in Rooftop View" />
                          : <span style={{ color: "#9ca3af" }}>0</span>}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ ...totTd }} />
                <td style={{ ...totTd }}>Total</td>
                {/* Standalone: Pending >24h total count */}
                <td style={{ ...totTd, textAlign: "center" }}>
                  {totRow.notProcessedAfter24 > 0
                    ? <span onClick={() => onDrillDown({ status: "Not Delivered", after24h: true, hasPhotos: true })} style={{ cursor: "pointer" }}><Badge label={totRow.notProcessedAfter24} color="red" /></span>
                    : <span style={{ color: "#9ca3af" }}>0</span>}
                </td>
                <td style={{ ...totTd, textAlign: "center", color: "#6b7280" }}>{(totRow.enterpriseCount ?? 0).toLocaleString()}</td>
                <td style={{ ...totTd, textAlign: "center", color: "#6b7280" }}>{totRow.rooftopCount?.toLocaleString()}</td>
                <td style={{ ...totTd, textAlign: "center" }}><ClickableNum value={totRow.total} color="#4f46e5" onClick={() => onDrillDown({})} /></td>
                <td style={{ ...totTd, textAlign: "center" }}><ClickableNum value={totRow.withPhotos ?? 0} color="#0ea5e9" onClick={() => onDrillDown({ hasPhotos: true })} /></td>
                <td style={{ ...totTd, textAlign: "center" }}><ClickableNum value={totRow.deliveredWithPhotos ?? 0} color="#166534" onClick={() => onDrillDown({ status: "Delivered", hasPhotos: true })} /></td>
                <td style={{ ...totTd, textAlign: "center" }}><ClickableNum value={totRow.pendingWithPhotos ?? 0} color="#991b1b" onClick={() => onDrillDown({ status: "Not Delivered", hasPhotos: true })} /></td>
                {/* Standalone: Pending >24h % */}
                <td style={{ ...totTd, textAlign: "center", color: "#6b7280", fontSize: 12 }}>{totRate.toFixed(0)}%</td>
                {/* Avg Score */}
                <td style={{ ...totTd, textAlign: "center", color: "#9ca3af" }}>—</td>
                {/* Pendency breakdown group: bucket sub-columns only */}
                {activeBuckets.map((b, idx) => (
                  <td key={b.key} style={{ ...totTd, textAlign: "center", ...(idx === 0 ? { borderLeft: "2px solid #fcd34d" } : {}), ...(idx === activeBuckets.length - 1 ? { borderRight: "2px solid #fcd34d" } : {}) }}>
                    {(totRow[b.key] ?? 0) > 0 ? <Badge label={totRow[b.key]} color="amber" /> : "0"}
                  </td>
                ))}
                {showPublishing && <td style={{ ...totTd, textAlign: "center", fontWeight: 700, color: "#991b1b" }}>{(totRow.publishingCount ?? 0).toLocaleString()}</td>}
                <td style={{ ...totTd, textAlign: "center", fontWeight: 700, color: (totRow.missingWebsiteCount ?? 0) > 0 ? "#991b1b" : "#9ca3af" }}>{(totRow.missingWebsiteCount ?? 0).toLocaleString()}</td>
                {showIntegrated && <td style={{ ...totTd, textAlign: "center", fontWeight: 700, color: "#991b1b" }}>{(totRow.integratedCount ?? 0).toLocaleString()}</td>}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ totals, byType, byCSM, byBucket = [], onDrillDown, onRooftopDrillDown, loading = false }) {
  const activeBuckets = byBucket;
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
        {/* Row 1: Pending >24h card with pills directly below */}
        <div style={{ display: "inline-flex", flexDirection: "column", gap: 8, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "10px 16px" }}>
          <div onClick={!loading ? () => onDrillDown({ status: "Not Delivered", after24h: true, hasPhotos: true }) : undefined}
            style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "#fff", borderRadius: 10, padding: "10px 16px", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", cursor: loading ? "default" : "pointer", transition: "all 0.15s" }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.12)"; e.currentTarget.style.transform = "translateY(-2px)"; } }}
            onMouseLeave={e => { if (!loading) { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)"; e.currentTarget.style.transform = "translateY(0)"; } }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>Pending VINs &gt;24h</div>
            {loading
              ? <div className="shimmer-cell" style={{ height: 28, width: 50, borderRadius: 6 }} />
              : <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#f59e0b", lineHeight: 1 }}>{totals.notProcessedAfter24.toLocaleString()}</div>
                  <div style={{ fontSize: 14, color: "#f59e0b" }}>→</div>
                </div>
            }
          </div>
          {activeBuckets.length > 0 && (
            <div style={{ display: "flex", gap: 5, flexWrap: "nowrap", alignItems: "center", opacity: loading ? 0.45 : 1, transition: "opacity 0.2s" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase" as const, letterSpacing: 0.5, whiteSpace: "nowrap", marginRight: 2 }}>By reason:</span>
              {activeBuckets.map((b: { label: string; count: number }) => (
                <span key={b.label} onClick={loading ? undefined : () => onDrillDown({ status: "Not Delivered", after24h: true, reasonBucket: b.label })}
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", cursor: loading ? "default" : "pointer", transition: "all 0.15s", whiteSpace: "nowrap" }}
                  onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = "#fee2e2"; e.currentTarget.style.borderColor = "#fca5a5"; } }}
                  onMouseLeave={e => { if (!loading) { e.currentTarget.style.background = "#fef2f2"; e.currentTarget.style.borderColor = "#fecaca"; } }}>
                  {b.label} <span style={{ fontWeight: 700, color: "#ef4444" }}>{b.count.toLocaleString()}</span>
                </span>
              ))}
            </div>
          )}
        </div>
        {/* Row 2: Remaining KPI cards */}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <StatCard label="Total Inventory" value={totals.total} color="#6366f1" onClick={() => onDrillDown({})} loading={loading} />
          <StatCard label="With Photos" value={totals.withPhotos ?? 0} sub={totals.total > 0 ? `${(((totals.withPhotos ?? 0) / totals.total) * 100).toFixed(0)}% of total` : ""} color="#0ea5e9" onClick={() => onDrillDown({ hasPhotos: true })} loading={loading} />
          <StatCard label="VIN Delivered" value={totals.deliveredWithPhotos ?? 0} sub={totals.withPhotos > 0 ? `${(((totals.deliveredWithPhotos ?? 0) / totals.withPhotos) * 100).toFixed(0)}% of with photos` : ""} color="#22c55e" onClick={() => onDrillDown({ status: "Delivered", hasPhotos: true })} loading={loading} />
          <StatCard label="Pending VINs" value={totals.pendingWithPhotos ?? 0} sub={totals.withPhotos > 0 ? `${(((totals.pendingWithPhotos ?? 0) / totals.withPhotos) * 100).toFixed(0)}% of with photos` : ""} color="#ef4444" onClick={() => onDrillDown({ status: "Not Delivered", hasPhotos: true })} loading={loading} />
        </div>
      </div>
      <SummaryTable title="By Rooftop Type" rows={byType} colorHeader="#6366f1" filterKey="rooftopType" onDrillDown={onDrillDown} onRooftopDrillDown={onRooftopDrillDown} loading={loading} defaultSortCol={null} />
      <SummaryTable title="By CSM" rows={byCSM} colorHeader="#0ea5e9" filterKey="csm" onDrillDown={onDrillDown} onRooftopDrillDown={onRooftopDrillDown} loading={loading} defaultSortCol="notProcessedAfter24" />
    </div>
  );
}

function timeAgo(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60)  return "just now";
  if (diff < 3600) { const m = Math.floor(diff / 60);  return `${m} minute${m > 1 ? "s" : ""} ago`; }
  if (diff < 86400){ const h = Math.floor(diff / 3600); return `${h} hour${h > 1 ? "s" : ""} ago`; }
  const d = Math.floor(diff / 86400); return `${d} day${d > 1 ? "s" : ""} ago`;
}

const DEFAULT_FILTERS = { search: "", enterpriseId: null, rooftopId: null, rooftopType: null, csm: null, status: null, after24h: null, hasPhotos: null, hasVin: null, reasonBucket: null };
const DEFAULT_ROOFTOP_FILTERS = { search: "", rooftopType: null, csm: null, enterprise: null, websiteScore: null, imsIntegration: null, publishingStatus: null, reportStatus: null, reportReason: null as string | null, reportDay: null as string | null };
const DEFAULT_ENTERPRISE_FILTERS = { search: "", csm: null, accountType: null, websiteScore: null, reportStatus: null, reportReason: null as string | null };

// Merged Report Status filter — "Sent" or any not-sent reason
const REPORT_FILTER_OPTIONS = ["Sent", "No Recipient", "Not Triggered", "IMS Disabled", "Pending VINs", "Negative TAT", "Low Photo Coverage", "Already Sent", "Timed Out"];
const REPORT_FILTER_API: Record<string, { type: "status" | "reason"; value: string }> = {
  "Sent":               { type: "status", value: "sent" },
  "No Recipient":       { type: "reason", value: "no_recipient" },
  "Not Triggered":      { type: "reason", value: "not_triggered" },
  "IMS Disabled":       { type: "reason", value: "ims_off" },
  "Pending VINs":       { type: "reason", value: "pending_vins" },
  "Negative TAT":       { type: "reason", value: "negative_tat" },
  "Low Photo Coverage": { type: "reason", value: "low_photo_coverage" },
  "Already Sent":       { type: "reason", value: "already_sent" },
  "Timed Out":          { type: "reason", value: "timed_out" },
};
const REPORT_FILTER_DISPLAY: Record<string, string> = Object.fromEntries(
  Object.entries(REPORT_FILTER_API).map(([k, v]) => [v.value, k])
);

const EMPTY_SUMMARY = {
  totals:   { total: 0, enterpriseCount: 0, withPhotos: 0, deliveredWithPhotos: 0, pendingWithPhotos: 0, processed: 0, notProcessed: 0, processedAfter24: 0, notProcessedAfter24: 0, bucketProcessingPending: 0, bucketPublishingPending: 0, bucketQcPending: 0, bucketSold: 0, bucketOthers: 0 },
  byCSM:    [],
  byType:   [],
  byBucket: [],
};

// ─── Admin View ───────────────────────────────────────────────────────────────

function AdminView({ syncing }: { syncing: boolean }) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<
    | { ok: true; inserted: number; skipped: number }
    | { ok: false; errors: Array<{ row: number; data: string; reason: string }>; validCount: number }
    | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleDownload() {
    const a = document.createElement("a");
    a.href = "/api/email-recipients";
    a.download = "email-recipients.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function handleUpload(skipInvalid = false) {
    if (!selectedFile || uploading || syncing) return;
    const text = await selectedFile.text();
    setUploading(true);
    if (!skipInvalid) setResult(null);
    try {
      const url = skipInvalid
        ? "/api/email-recipients/upload?skipInvalid=true"
        : "/api/email-recipients/upload";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        body: text,
      });
      const json = await res.json();
      if (res.status === 409) {
        setResult({ ok: false, errors: [{ row: 0, data: "", reason: "A data sync is in progress. Try again after it completes." }], validCount: 0 });
      } else {
        setResult(json);
      }
    } catch {
      setResult({ ok: false, errors: [{ row: 0, data: "", reason: "Network error — could not reach the server." }], validCount: 0 });
    } finally {
      setUploading(false);
    }
  }

  const btnBase: React.CSSProperties = {
    padding: "7px 16px", borderRadius: 8, border: "1px solid #d1d5db",
    background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
    color: "#374151", transition: "all 0.15s",
  };

  return (
    <div style={{ padding: "8px 0" }}>

      {/* Info notice */}
      <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#1d4ed8", marginBottom: 28 }}>
        Download the existing list before uploading an updated version — the upload will replace the entire recipient list.
      </div>

      {/* Step 1 — Download */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>Step 1 — Download current list</div>
        <button onClick={handleDownload} style={btnBase}>
          ↓ Download Recipient List
        </button>
      </div>

      {/* Step 2 — Upload */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>Step 2 — Upload updated list</div>

        {syncing && (
          <div style={{ background: "#fef9c3", border: "1px solid #fde047", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#a16207", marginBottom: 12 }}>
            Data refresh is in progress — uploads are not allowed until it completes.
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          style={{ display: "none" }}
          onChange={(e) => { setSelectedFile(e.target.files?.[0] ?? null); setResult(null); }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => fileInputRef.current?.click()} style={btnBase}>
            Choose CSV file
          </button>
          {selectedFile && (
            <span style={{ fontSize: 13, color: "#6b7280" }}>{selectedFile.name}</span>
          )}
          <button
            onClick={() => handleUpload()}
            disabled={!selectedFile || uploading || syncing}
            style={{
              ...btnBase,
              border: "none",
              background: (!selectedFile || uploading || syncing) ? "#e5e7eb" : "#4f46e5",
              color: (!selectedFile || uploading || syncing) ? "#9ca3af" : "#fff",
              cursor: (!selectedFile || uploading || syncing) ? "not-allowed" : "pointer",
            }}
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </div>
      </div>

      {/* Result — success */}
      {result?.ok === true && (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#15803d" }}>
          {result.inserted} recipient{result.inserted !== 1 ? "s" : ""} uploaded successfully.
          {result.skipped > 0 && (
            <span style={{ color: "#b45309" }}> {result.skipped} row{result.skipped !== 1 ? "s" : ""} with errors were skipped.</span>
          )}
        </div>
      )}

      {/* Result — errors */}
      {result?.ok === false && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "12px 16px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#dc2626", marginBottom: 10 }}>
            Upload failed — {result.errors.length} row{result.errors.length !== 1 ? "s" : ""} with errors
          </div>
          <div style={{ maxHeight: 320, overflowY: "auto", overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  {["Row", "Data", "Reason"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "4px 10px", color: "#6b7280", borderBottom: "1px solid #fecaca", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.errors.map((e, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #fef2f2" }}>
                    <td style={{ padding: "5px 10px", color: "#dc2626", fontWeight: 700, whiteSpace: "nowrap" }}>
                      {e.row > 0 ? `Row ${e.row}` : "—"}
                    </td>
                    <td style={{ padding: "5px 10px", color: "#374151", fontFamily: "monospace", whiteSpace: "nowrap" }} title={e.data}>
                      {e.data || "—"}
                    </td>
                    <td style={{ padding: "5px 10px", color: "#374151" }}>{e.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.validCount > 0 && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #fecaca" }}>
              <button
                onClick={() => handleUpload(true)}
                disabled={uploading}
                style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid #d97706", background: "#fffbeb", fontSize: 13, fontWeight: 600, cursor: uploading ? "not-allowed" : "pointer", color: "#b45309", transition: "all 0.15s" }}
              >
                {uploading ? "Uploading…" : `Ignore ${result.errors.length} row${result.errors.length !== 1 ? "s" : ""} and update ${result.validCount} row${result.validCount !== 1 ? "s" : ""}`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReportCoverageTab({ rows, loading, onRooftopDrillDown }: { rows: any[]; loading: boolean; onRooftopDrillDown?: (filters: any) => void }) {
  const activeReasons = REPORT_REASONS.filter(r => rows.some(row => (row[r.key] ?? 0) > 0));
  const reasonColSpan = activeReasons.length;

  const thBase: React.CSSProperties = { padding: "5px 8px", fontSize: 11, fontWeight: 600, color: "#374151", boxShadow: "inset 0 -2px 0 #e5e7eb", background: "#f9fafb", position: "sticky", top: 0, zIndex: 3, whiteSpace: "nowrap" };
  const thRed: React.CSSProperties  = { padding: "5px 8px", fontSize: 11, fontWeight: 600, color: "#991b1b", boxShadow: "inset 0 -2px 0 #e5e7eb", background: "#fef2f2", position: "sticky", zIndex: 3, whiteSpace: "nowrap" };
  const td: React.CSSProperties     = { padding: "10px 12px", borderBottom: "1px solid #f3f4f6", fontSize: 13 };

  function fmtDay(d: string) {
    return new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }

  function sentPctColor(pct: number): string {
    if (pct >= 80) return "#15803d";
    if (pct >= 50) return "#b45309";
    return "#b91c1c";
  }

  function sentPctBg(pct: number): string {
    if (pct >= 80) return "#f0fdf4";
    if (pct >= 50) return "#fffbeb";
    return "#fef2f2";
  }

  const shimmerRows = Array(7).fill(0).map((_, i) => (
    <tr key={i}>
      {Array(5 + reasonColSpan || 5).fill(0).map((__, j) => (
        <td key={j} style={{ ...td, textAlign: "center" }}>
          <div style={{ height: 14, borderRadius: 4, background: "#f3f4f6", width: j === 0 ? 90 : 40, margin: "0 auto" }} />
        </td>
      ))}
    </tr>
  ));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1f2937", margin: 0 }}>Report Status — Last 7 Days</h2>
        <DownloadButton onClick={() => {
          const headers = ["Report Date", "Total Rooftops", "Sent", "Sent %", "Not Sent", ...activeReasons.map(r => r.label)];
          const csvRows = rows.map(r => [
            fmtDay(r.reportDay), r.totalRooftops, r.sent,
            r.sentPct !== null && r.sentPct !== undefined ? r.sentPct : "",
            r.notSent,
            ...activeReasons.map(ar => r[ar.key] ?? 0),
          ]);
          downloadCSV("report-coverage.csv", headers, csvRows);
        }} />
      </div>
      <div style={{ borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              <th rowSpan={2} style={{ ...thBase, textAlign: "left" }}>Report Date</th>
              <th rowSpan={2} style={{ ...thBase, textAlign: "center" }}>Total Rooftops</th>
              <th rowSpan={2} style={{ ...thBase, textAlign: "center" }}>Sent</th>
              <th rowSpan={2} style={{ ...thBase, textAlign: "center" }}>Sent %</th>
              <th rowSpan={2} style={{ ...thBase, textAlign: "center" }}>Not Sent</th>
              {reasonColSpan > 0 && (
                <th colSpan={reasonColSpan} style={{ ...thBase, textAlign: "center", background: "#fef2f2", color: "#991b1b", boxShadow: "inset 0 -1px 0 #fca5a5", borderLeft: "2px solid #fca5a5", borderRight: "2px solid #fca5a5" }}>
                  Not Sent Reasons
                </th>
              )}
            </tr>
            {reasonColSpan > 0 && (
              <tr style={{ background: "#fef2f2" }}>
                {activeReasons.map((r, idx) => (
                  <th key={r.key} style={{ ...thRed, top: 28, textAlign: "center", ...(idx === 0 ? { borderLeft: "2px solid #fca5a5" } : {}), ...(idx === activeReasons.length - 1 ? { borderRight: "2px solid #fca5a5" } : {}) }}>
                    {r.label}
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {loading ? shimmerRows : rows.map((r, i) => {
              return (
              <tr key={r.reportDay} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                <td style={{ ...td, fontWeight: 600, color: "#111827" }}>{fmtDay(r.reportDay)}</td>
                <td style={{ ...td, textAlign: "center", color: "#374151" }}>{r.totalRooftops}</td>
                <td style={{ ...td, textAlign: "center" }}>
                  {onRooftopDrillDown
                    ? <span style={{ cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }} onClick={() => onRooftopDrillDown({ reportStatus: "sent", reportReason: null, reportDay: r.reportDay })}><Badge label={r.sent} color="green" /></span>
                    : <Badge label={r.sent} color="green" />}
                </td>
                <td style={{ ...td, textAlign: "center" }}>
                  {r.sentPct !== null && r.sentPct !== undefined ? (
                    <span style={{ fontWeight: 700, color: sentPctColor(Number(r.sentPct)), background: sentPctBg(Number(r.sentPct)), borderRadius: 6, padding: "2px 8px", fontSize: 12 }}>
                      {r.sentPct}%
                    </span>
                  ) : "—"}
                </td>
                <td style={{ ...td, textAlign: "center" }}>
                  {onRooftopDrillDown
                    ? <span style={{ cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }} onClick={() => onRooftopDrillDown({ reportStatus: "not_sent", reportReason: null, reportDay: r.reportDay })}><Badge label={r.notSent} color="red" /></span>
                    : (r.notSent > 0 ? <Badge label={r.notSent} color="red" /> : <span style={{ color: "#9ca3af" }}>0</span>)}
                </td>
                {activeReasons.map((ar, idx) => (
                  <td key={ar.key} style={{ ...td, textAlign: "center", background: i % 2 === 0 ? "#fff8f8" : "#fef2f2", ...(idx === 0 ? { borderLeft: "2px solid #fca5a5" } : {}), ...(idx === activeReasons.length - 1 ? { borderRight: "2px solid #fca5a5" } : {}) }}>
                    {(r[ar.key] ?? 0) > 0
                      ? onRooftopDrillDown
                        ? <span style={{ cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }} onClick={() => onRooftopDrillDown({ reportStatus: null, reportReason: ar.reasonCode, reportDay: r.reportDay })}><Badge label={r[ar.key]} color="red" /></span>
                        : <Badge label={r[ar.key]} color="red" />
                      : <span style={{ color: "#9ca3af" }}>0</span>}
                  </td>
                ))}
              </tr>
              );
            })}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5 + reasonColSpan} style={{ ...td, textAlign: "center", color: "#9ca3af", padding: "32px 12px" }}>
                  No report data found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [page, setPage] = useState<"dashboard" | "admin">("dashboard");
  const [tab, setTab] = useState("Overview");
  const [dateFilter, setDateFilter] = useState<"post" | "pre" | "all">(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("vin_dateFilter") : null;
    return (saved === "post" || saved === "pre" || saved === "all") ? saved : "post";
  });
  const [rawFilters, setRawFilters] = useState(DEFAULT_FILTERS);
  const [rooftopFilters, setRooftopFilters] = useState(DEFAULT_ROOFTOP_FILTERS);
  const [enterpriseFilters, setEnterpriseFilters] = useState(DEFAULT_ENTERPRISE_FILTERS);
  const [, setTick] = useState(0);

  // Summary data — sourced from /api/summary (DB views, full dataset)
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [filterOptions, setFilterOptions] = useState<any>(null);

  // Abort controller for in-flight /api/vins requests — cancels the previous
  // request when a new one starts so stale responses never overwrite filtered data.
  const rawAbortRef = useRef<AbortController | null>(null);

  // Raw paginated data — sourced from /api/vins, only used in VIN Data tab
  const [rawData, setRawData] = useState<any[]>([]);
  const [rawPage, setRawPage] = useState(1);
  const [rawPageCount, setRawPageCount] = useState(1);
  const [rawTotal, setRawTotal] = useState(0);
  const [rawLoading, setRawLoading] = useState(false);
  const [rawSortCol, setRawSortCol] = useState<string | null>(null);
  const [rawSortDir, setRawSortDir] = useState<"asc" | "desc">("asc");

  // Rooftop paginated data — sourced from /api/rooftops
  const [rooftopRows, setRooftopRows] = useState<any[]>([]);
  const [rooftopPage, setRooftopPage] = useState(1);
  const [rooftopPageCount, setRooftopPageCount] = useState(1);
  const [rooftopTotal, setRooftopTotal] = useState(0);
  const [rooftopLoading, setRooftopLoading] = useState(false);
  const [rooftopSortCol, setRooftopSortCol] = useState<string | null>("notProcessedAfter24");
  const [rooftopSortDir, setRooftopSortDir] = useState<"asc" | "desc">("desc");
  const [reportDates, setReportDates] = useState<string[]>([]);

  // Enterprise paginated data — sourced from /api/enterprises
  const [enterpriseRows, setEnterpriseRows] = useState<any[]>([]);
  const [enterprisePage, setEnterprisePage] = useState(1);
  const [enterprisePageCount, setEnterprisePageCount] = useState(1);
  const [enterpriseTotal, setEnterpriseTotal] = useState(0);
  const [enterpriseLoading, setEnterpriseLoading] = useState(false);
  const [enterpriseSortCol, setEnterpriseSortCol] = useState<string | null>("notProcessedAfter24");
  const [enterpriseSortDir, setEnterpriseSortDir] = useState<"asc" | "desc">("desc");

  // Report coverage data — sourced from /api/report-coverage
  const [reportCovData, setReportCovData] = useState<any[]>([]);
  const [reportCovLoading, setReportCovLoading] = useState(false);

  const tabs = ["Overview", "Enterprise View", "Rooftop View", "VIN Data", "Report Status"];
  // Track whether the initial mount load has completed so the dateFilter
  // effect can safely skip its first run (mount effect handles it).
  const initialLoadDone = useRef(false);

  // Fetch summary data from DB views.
  // showLoader: true when triggered by a user filter toggle (not the initial page load).
  const loadSummary = useCallback((df: string = "post", showLoader = false) => {
    if (showLoader) setSummaryLoading(true);
    return fetch(`${API_BASE}/api/summary?dateFilter=${df}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(json => {
        if (json.totalRows === 0) return null; // DB empty
        setSummary(json);
        setLastSync(json.lastSync);
        setSummaryLoading(false);
        return json;
      })
      .catch(err => { setSummaryLoading(false); throw err; });
  }, [setSummaryLoading]);

  // Fetch lightweight filter dropdown options (distinct values + column flags)
  const loadFilterOptions = useCallback(() => {
    return fetch(`${API_BASE}/api/filter-options`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(json => setFilterOptions(json));
  }, []);

  // Fetch paginated rooftop rows
  const loadRooftopPage = useCallback((page: number, filters: any, sortCol: string | null, sortDir: string, df: string = "post") => {
    setRooftopLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (filters.search)           params.set("search",          filters.search);
    if (filters.rooftopType)      params.set("type",            filters.rooftopType);
    if (filters.csm)              params.set("csm",             filters.csm);
    if (filters.enterprise)       params.set("enterprise",      filters.enterprise);
    if (filters.imsIntegration)   params.set("imsIntegration",  filters.imsIntegration);
    if (filters.publishingStatus) params.set("publishingStatus", filters.publishingStatus);
    if (filters.websiteScore)     params.set("websiteScore",    filters.websiteScore);
    if (filters.reportStatus)     params.set("reportStatus",    filters.reportStatus);
    if (filters.reportReason)     params.set("reportReason",    filters.reportReason);
    if (filters.reportDay)        params.set("reportDay",       filters.reportDay);
    if (sortCol) { params.set("sortBy", sortCol); params.set("sortDir", sortDir); }
    params.set("dateFilter", df);
    fetch(`${API_BASE}/api/rooftops?${params}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(({ data, total, pageCount, reportDates: dates }) => {
        setRooftopRows(data); setRooftopTotal(total); setRooftopPageCount(pageCount); setRooftopPage(page);
        if (dates) setReportDates(dates);
        setRooftopLoading(false);
      })
      .catch(err => { setFetchError(err.message); setRooftopLoading(false); });
  }, []);

  // Fetch paginated enterprise rows
  const loadEnterprisePage = useCallback((page: number, filters: any, sortCol: string | null, sortDir: string, df: string = "post") => {
    setEnterpriseLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (filters.search)       params.set("search",        filters.search);
    if (filters.csm)          params.set("csm",           filters.csm);
    if (filters.accountType)  params.set("accountType",   filters.accountType);
    if (filters.websiteScore) params.set("websiteScore",  filters.websiteScore);
    if (filters.reportStatus) params.set("reportStatus",  filters.reportStatus);
    if (filters.reportReason) params.set("reportReason",  filters.reportReason);
    if (filters.reportDay)    params.set("reportDay",     filters.reportDay);
    if (sortCol) { params.set("sortBy", sortCol); params.set("sortDir", sortDir); }
    params.set("dateFilter", df);
    fetch(`${API_BASE}/api/enterprises?${params}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(({ data, total, pageCount }) => {
        setEnterpriseRows(data); setEnterpriseTotal(total); setEnterprisePageCount(pageCount); setEnterprisePage(page);
        setEnterpriseLoading(false);
      })
      .catch(err => { setFetchError(err.message); setEnterpriseLoading(false); });
  }, []);

  // Fetch paginated raw VIN rows
  const loadRawPage = useCallback((page: number, filters: any, sortCol: string | null = null, sortDir: string = "asc", df: string = "post") => {
    // Cancel any in-flight request so a slow earlier response never overwrites
    // a faster later one (e.g. switching filters quickly).
    if (rawAbortRef.current) rawAbortRef.current.abort();
    rawAbortRef.current = new AbortController();

    // Clear stale data immediately so the shimmer shows instead of old rows
    // bleeding through the loading overlay while the new request is in-flight.
    setRawData([]);
    setRawLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (filters.search)       params.set("search",       filters.search);
    if (filters.enterpriseId) params.set("enterpriseId", filters.enterpriseId);
    if (filters.rooftopId)    params.set("rooftopId",    filters.rooftopId);
    if (filters.rooftopType)  params.set("rooftopType",  filters.rooftopType);
    if (filters.csm)          params.set("csm",          filters.csm);
    if (filters.status)       params.set("status",       filters.status);
    if (filters.after24h !== null) params.set("after24h", filters.after24h ? "true" : "false");
    if (filters.hasPhotos !== null && filters.hasPhotos !== undefined) params.set("hasPhotos", filters.hasPhotos ? "true" : "false");
    if (filters.hasVin !== null && filters.hasVin !== undefined) params.set("hasVin", filters.hasVin ? "true" : "false");
    if (filters.reasonBucket)      params.set("reasonBucket", filters.reasonBucket);
    if (sortCol) { params.set("sortBy", sortCol); params.set("sortDir", sortDir); }
    params.set("dateFilter", df);

    fetch(`${API_BASE}/api/vins?${params}`, { signal: rawAbortRef.current.signal })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(({ data, total, pageCount }) => {
        setRawData(data);
        setRawTotal(total);
        setRawPageCount(pageCount);
        setRawLoading(false);
      })
      .catch(err => {
        if (err.name === "AbortError") return; // superseded by a newer request — ignore
        setFetchError(err.message);
        setRawLoading(false);
      });
  }, []);

  const loadReportCoverage = useCallback(() => {
    setReportCovLoading(true);
    fetch(`${API_BASE}/api/report-coverage`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => { setReportCovData(data); setReportCovLoading(false); })
      .catch(err => { setFetchError(err.message); setReportCovLoading(false); });
  }, []);

  // On mount: load DB. If empty, run a full sync (awaited — POST /api/sync blocks
  // until Metabase fetch + DB insert are complete, then we reload summary).
  useEffect(() => {
    loadFilterOptions().catch(() => {});
    loadSummary(dateFilter)
      .then(data => {
        setLoading(false);
        initialLoadDone.current = true;
        if (!data) {
          setSyncing(true);
          fetch(`${API_BASE}/api/sync`, { method: "POST" })
            .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
            .then(() => Promise.all([loadSummary(dateFilter), loadFilterOptions()]))
            .then(() => setSyncing(false))
            .catch(err => { setFetchError(err.message); setSyncing(false); });
        }
      })
      .catch(err => { setFetchError(err.message); setLoading(false); initialLoadDone.current = true; });
  }, []);

  // Persist dateFilter selection across page refreshes
  useEffect(() => {
    localStorage.setItem("vin_dateFilter", dateFilter);
  }, [dateFilter]);

  // Reload summary when dateFilter changes (skip the initial mount — handled above)
  useEffect(() => {
    if (!initialLoadDone.current) return;
    loadSummary(dateFilter, true).catch(() => {});
  }, [dateFilter]);

  // Load rooftop page when switching to Rooftop View or when filters/sort/dateFilter change
  useEffect(() => {
    if (tab === "Rooftop View") loadRooftopPage(1, rooftopFilters, rooftopSortCol, rooftopSortDir, dateFilter);
  }, [tab, rooftopFilters, rooftopSortCol, rooftopSortDir, dateFilter]);

  // Load enterprise page when switching to Enterprise View or when filters/sort/dateFilter change
  useEffect(() => {
    if (tab === "Enterprise View") loadEnterprisePage(1, enterpriseFilters, enterpriseSortCol, enterpriseSortDir, dateFilter);
  }, [tab, enterpriseFilters, enterpriseSortCol, enterpriseSortDir, dateFilter]);

  // Load raw page when switching to VIN Data tab or when filters/page/sort/dateFilter change
  useEffect(() => {
    if (tab === "VIN Data") loadRawPage(rawPage, rawFilters, rawSortCol, rawSortDir, dateFilter);
  }, [tab, rawPage, rawFilters, rawSortCol, rawSortDir, dateFilter]);

  // Load report coverage when switching to Report Status tab
  useEffect(() => {
    if (tab === "Report Status") loadReportCoverage();
  }, [tab]);

  // Tick every 30s so relative "synced X ago" label stays fresh
  useEffect(() => {
    const id = setInterval(() => setTick(n => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  // Sort change for VIN Data — resets to page 1 and re-fetches from server
  const handleRawSort = useCallback((col: string | null, dir: "asc" | "desc") => {
    setRawSortCol(col);
    setRawSortDir(dir);
    setRawPage(1);
  }, []);

  const handleRooftopSort = useCallback((col: string | null, dir: "asc" | "desc") => {
    setRooftopSortCol(col);
    setRooftopSortDir(dir);
  }, []);

  const handleEnterpriseSort = useCallback((col: string | null, dir: "asc" | "desc") => {
    setEnterpriseSortCol(col);
    setEnterpriseSortDir(dir);
  }, []);

  // Sync from Metabase — awaits full sync, then reloads summary and filter options
  const syncNow = useCallback(() => {
    setSyncing(true);
    setFetchError(null);
    fetch(`${API_BASE}/api/sync`, { method: "POST" })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(() => Promise.all([loadSummary(dateFilter), loadFilterOptions()]))
      .then(() => setSyncing(false))
      .catch(err => { setFetchError(err.message); setSyncing(false); });
  }, [loadSummary, loadFilterOptions, dateFilter]);

  const s = summary ?? EMPTY_SUMMARY;

  // Derive filter dropdown options from /api/filter-options (lightweight distinct-value queries)
  const fo = filterOptions ?? {};
  const rooftopOptions    = (fo.rooftops        ?? []) as { id: string; name: string; enterprise_id: string }[];
  const typeOptions       = (fo.rooftopTypes    ?? []) as string[];
  const csmOptions        = useMemo(() => [...new Set((s.byCSM ?? []).map((r: any) => r.name))].sort() as string[], [s.byCSM]);
  const enterpriseObjects = (fo.enterprises     ?? []) as { id: string; name: string }[];

  const handleDrillDown = useCallback((filters) => {
    setRawFilters({ ...DEFAULT_FILTERS, ...filters });
    setRawPage(1);
    setTab("VIN Data");
  }, []);

  const handleRooftopDrillDown = useCallback((filters) => {
    setRooftopFilters({ ...DEFAULT_ROOFTOP_FILTERS, ...filters });
    setTab("Rooftop View");
  }, []);

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -600px 0; }
          100% { background-position: 600px 0; }
        }
        .sync-banner {
          background: linear-gradient(90deg, #4f46e5 0%, #6366f1 40%, #818cf8 50%, #6366f1 60%, #4f46e5 100%);
          background-size: 600px 100%;
          animation: shimmer 1.6s linear infinite;
        }
        @keyframes shimmerCell {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .shimmer-cell {
          background: linear-gradient(90deg, #f0f0f0 25%, #e4e4e4 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: shimmerCell 1.4s ease-in-out infinite;
        }
        @keyframes cellSweep {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .tbody-loading {
          pointer-events: none;
          user-select: none;
        }
        .tbody-loading td {
          position: relative;
        }
        .tbody-loading td::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent 25%, rgba(255,255,255,0.65) 50%, transparent 75%);
          background-size: 200% 100%;
          animation: cellSweep 1.3s ease-in-out infinite;
        }
      `}</style>
      {(syncing || loading) && (
        <div className="sync-banner" style={{ width: "100%", height: 36, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "#fff", fontSize: 13, fontWeight: 600, letterSpacing: 0.2, marginBottom: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          {loading ? "Loading dashboard…" : "Refreshing data from Metabase…"}
        </div>
      )}
      <div style={{ padding: "20px 32px" }}>
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>VIN Inventory Dashboard</h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>Tracking VIN processing across rooftops and CSMs — click any number to drill down</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 4 }}>
          {!loading && !syncing && fetchError && <span style={{ fontSize: 12, color: "#dc2626" }} title={fetchError}>⚠ {fetchError}</span>}
          {!loading && summary && (
            <span style={{ fontSize: 12, color: "#16a34a" }}>
              ● {(summary?.totalRows ?? 0).toLocaleString()} records
              {lastSync && <span style={{ color: "#9ca3af" }}> · synced {timeAgo(lastSync)}</span>}
            </span>
          )}
          <div style={{ display: "flex", gap: 2, background: "#f3f4f6", borderRadius: 8, padding: 3 }}>
            {([
              { key: "post", label: "Post 1st Apr" },
              { key: "pre",  label: "Pre 1st Apr"  },
              { key: "all",  label: "All"           },
            ] as const).map(({ key, label }) => (
              <button key={key} onClick={() => setDateFilter(key)}
                style={{
                  padding: "5px 14px", borderRadius: 6, border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 600,
                  background: dateFilter === key
                    ? key === "post" ? "#4f46e5" : key === "pre" ? "#d97706" : "#374151"
                    : "transparent",
                  color: dateFilter === key ? "#fff" : "#6b7280",
                  boxShadow: dateFilter === key ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
                  transition: "all 0.15s",
                }}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={syncNow} disabled={loading || syncing}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: (loading || syncing) ? "#f3f4f6" : "#fff", fontSize: 12, fontWeight: 600, cursor: (loading || syncing) ? "not-allowed" : "pointer", color: (loading || syncing) ? "#9ca3af" : "#374151", transition: "all 0.15s" }}
            onMouseEnter={e => { if (!loading && !syncing) e.currentTarget.style.borderColor = "#9ca3af"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#d1d5db"; }}>
            ↻ Refresh
          </button>
          <div style={{ width: 1, height: 20, background: "#e5e7eb", margin: "0 2px" }} />
          <button
            onClick={() => setPage((p) => p === "admin" ? "dashboard" : "admin")}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s", background: page === "admin" ? "#4f46e5" : "#fff", color: page === "admin" ? "#fff" : "#374151", borderColor: page === "admin" ? "#4f46e5" : "#d1d5db" }}>
            {page === "admin" ? "← Dashboard" : "Admin"}
          </button>
        </div>
      </div>

      {page === "admin" ? (
        <AdminView syncing={syncing} />
      ) : (
        <>
          <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "#f3f4f6", borderRadius: 10, padding: 4, width: "fit-content" }}>
            {tabs.map(t => (
              <button key={t} onClick={() => { setTab(t); }} style={{
                padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600,
                background: tab === t ? "#fff" : "transparent", color: tab === t ? "#111827" : "#6b7280",
                boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,0.1)" : "none", transition: "all 0.15s"
              }}>
                {t}
              </button>
            ))}
          </div>

          {tab === "Overview" && <OverviewTab totals={s.totals} byType={s.byType} byCSM={s.byCSM} byBucket={s.byBucket ?? []} onDrillDown={handleDrillDown} onRooftopDrillDown={handleRooftopDrillDown} loading={summaryLoading} />}
          {tab === "Rooftop View" && (
            <RooftopTab
              typeOptions={fo.rooftopTypes ?? []}
              csmOptions={fo.rooftopCSMs ?? []}
              enterpriseOptions={(fo.enterprises ?? []).map((e: any) => e.name)}
              bucketFlags={fo.bucketFlags ?? {}}
              rows={rooftopRows}
              total={rooftopTotal}
              page={rooftopPage}
              pageCount={rooftopPageCount}
              loading={rooftopLoading}
              onPageChange={(p) => loadRooftopPage(Math.max(1, Math.min(p, rooftopPageCount)), rooftopFilters, rooftopSortCol, rooftopSortDir, dateFilter)}
              onDrillDown={handleDrillDown}
              filters={rooftopFilters}
              setFilters={(f) => { setRooftopFilters(f); }}
              sortCol={rooftopSortCol}
              sortDir={rooftopSortDir}
              onSortChange={handleRooftopSort}
              reportDates={reportDates}
            />
          )}
          {tab === "Enterprise View" && (
            <EnterpriseTab
              csmOptions={fo.enterpriseCSMs ?? []}
              typeOptions={fo.enterpriseTypes ?? []}
              hasNotIntegrated={fo.hasNotIntegrated ?? false}
              hasPublishingDisabled={fo.hasPublishingDisabled ?? false}
              bucketFlags={fo.bucketFlags ?? {}}
              rows={enterpriseRows}
              total={enterpriseTotal}
              page={enterprisePage}
              pageCount={enterprisePageCount}
              loading={enterpriseLoading}
              onPageChange={(p) => loadEnterprisePage(Math.max(1, Math.min(p, enterprisePageCount)), enterpriseFilters, enterpriseSortCol, enterpriseSortDir, dateFilter)}
              onDrillDown={handleDrillDown}
              filters={enterpriseFilters}
              setFilters={(f) => { setEnterpriseFilters(f); }}
              sortCol={enterpriseSortCol}
              sortDir={enterpriseSortDir}
              onSortChange={handleEnterpriseSort}
            />
          )}
          {tab === "VIN Data" && (
            <RawTab
              data={rawData}
              loading={rawLoading}
              filters={rawFilters}
              setFilters={(f) => { setRawFilters(f); setRawPage(1); }}
              total={rawTotal}
              page={rawPage}
              pageCount={rawPageCount}
              onPageChange={(p) => setRawPage(Math.max(1, Math.min(p, rawPageCount)))}
              rooftopOptions={rooftopOptions}
              typeOptions={typeOptions}
              csmOptions={csmOptions}
              enterpriseObjects={enterpriseObjects}
              sortCol={rawSortCol}
              sortDir={rawSortDir}
              onSortChange={handleRawSort}
            />
          )}
          {tab === "Report Status" && (
            <ReportCoverageTab
              rows={reportCovData}
              loading={reportCovLoading}
              onRooftopDrillDown={(filters) => {
                setRooftopFilters({ ...DEFAULT_ROOFTOP_FILTERS, ...filters });
                setDateFilter("all");
                setTab("Rooftop View");
              }}
            />
          )}
        </>
      )}
      </div>
    </div>
  );
}
