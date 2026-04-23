import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import ViniDashboard from "./src/vini/ViniDashboard.tsx";

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
    if (filters.rooftop && d.rooftop !== filters.rooftop) return false;
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
  { key: "bucketProcessingPending", label: "Processing Pending" },
  { key: "bucketPublishingPending", label: "Publishing Pending" },
  { key: "bucketQcPending",         label: "QC Pending" },
  { key: "bucketQcHold",            label: "QC Hold" },
  { key: "bucketSold",              label: "Sold" },
  { key: "bucketOthers",            label: "Others" },
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

function StatCard({ label, value, sub, color = "#6366f1", onClick, loading = false }: { label: string; value: any; sub?: string; color?: string; onClick?: any; loading?: boolean }) {
  const interactive = !!onClick;
  return (
    <div onClick={!loading ? onClick : undefined} style={{ background: "#fff", borderRadius: 12, padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", border: "1px solid #e5e7eb", flex: 1, minWidth: 160, cursor: interactive && !loading ? "pointer" : "default", transition: "all 0.15s" }}
      onMouseEnter={e => { if (interactive && !loading) { e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.12)"; e.currentTarget.style.transform = "translateY(-2px)"; } }}
      onMouseLeave={e => { if (interactive && !loading) { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)"; e.currentTarget.style.transform = "translateY(0)"; } }}>
      <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 500, marginBottom: 4 }}>{label}</div>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
          <div className="shimmer-cell" style={{ height: 32, borderRadius: 6, width: "60%" }} />
          {sub !== undefined && <div className="shimmer-cell" style={{ height: 14, borderRadius: 4, width: "45%" }} />}
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color }}>{typeof value === "number" ? value.toLocaleString() : value}</div>
          {sub && <div style={{ fontSize: 13, color: "#9ca3af", fontWeight: 500 }}>({sub})</div>}
        </div>
      )}
      {interactive && !loading && <div style={{ fontSize: 11, color: "#a5b4fc", marginTop: 6 }}>Click to view details →</div>}
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

  const filtered = useMemo(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter(o => o.toLowerCase().includes(q));
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
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 50,
          background: "#fff", border: "1px solid #d1d5db", borderRadius: 8,
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)", minWidth: "100%", maxWidth: 280,
          overflow: "hidden",
        }}>
          <div style={{ padding: "8px 10px", borderBottom: "1px solid #e5e7eb" }}>
            <input
              autoFocus
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
  const enterpriseNames = useMemo(() => enterpriseObjects.map(e => e.name).sort(), [enterpriseObjects]);
  const selectedEnterpriseName = filters.enterpriseId ? (enterpriseIdToName[filters.enterpriseId] ?? filters.enterpriseId) : null;

  const activeCount = [filters.enterpriseId, filters.rooftop, filters.rooftopType, filters.csm, filters.status, filters.after24h !== null ? "x" : null, filters.hasPhotos !== null && filters.hasPhotos !== undefined ? "x" : null, filters.reasonBucket].filter(Boolean).length;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input placeholder="Search VIN, Rooftop, CSM..." value={filters.search || ""} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
          style={{ flex: 1, minWidth: 180, padding: "7px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, outline: "none" }} />
        <SearchableSelect
          value={selectedEnterpriseName}
          onChange={v => setFilters(f => ({ ...f, enterpriseId: v ? (enterpriseNameToId[v] ?? null) : null }))}
          options={enterpriseNames}
          placeholder="All Enterprises"
        />
        <SearchableSelect
          value={filters.rooftop}
          onChange={v => setFilters(f => ({ ...f, rooftop: v }))}
          options={rooftopOptions}
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
          value={filters.reasonBucket}
          onChange={v => setFilters(f => ({ ...f, reasonBucket: v }))}
          options={BUCKETS.map(b => b.label)}
          placeholder="All Buckets"
        />
        {activeCount > 0 && (
          <button onClick={() => setFilters({ search: "", enterpriseId: null, rooftop: null, rooftopType: null, csm: null, status: null, after24h: null, hasPhotos: null, reasonBucket: null })}
            style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #fca5a5", background: "#fef2f2", color: "#dc2626", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
            Clear {activeCount} filter{activeCount > 1 ? "s" : ""}
          </button>
        )}
      </div>
      {activeCount > 0 && (
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          {filters.enterpriseId && <Badge label={`Enterprise: ${selectedEnterpriseName}`} color="blue" />}
          {filters.rooftop && <Badge label={`Rooftop: ${filters.rooftop}`} color="blue" />}
          {filters.rooftopType && <Badge label={`Type: ${filters.rooftopType}`} color="blue" />}
          {filters.csm && <Badge label={`CSM: ${filters.csm}`} color="blue" />}
          {filters.status && <Badge label={`Status: ${filters.status}`} color={filters.status === "Delivered" ? "green" : "red"} />}
          {filters.after24h !== null && <Badge label={filters.after24h ? "After 24h" : "Within 24h"} color="amber" />}
          {filters.hasPhotos !== null && filters.hasPhotos !== undefined && <Badge label={filters.hasPhotos ? "Has Photos" : "No Photos"} color="blue" />}
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
    if (filters.rooftop)      params.set("rooftop",      filters.rooftop);
    if (filters.rooftopType)  params.set("rooftopType",  filters.rooftopType);
    if (filters.csm)          params.set("csm",          filters.csm);
    if (filters.status)       params.set("status",       filters.status);
    if (filters.after24h !== null) params.set("after24h", filters.after24h ? "true" : "false");
    if (filters.hasPhotos !== null && filters.hasPhotos !== undefined) params.set("hasPhotos", filters.hasPhotos ? "true" : "false");
    if (filters.reasonBucket)      params.set("reasonBucket", filters.reasonBucket);
    if (sortCol) { params.set("sortBy", sortCol); params.set("sortDir", sortDir); }
    try {
      const res = await fetch(`${API_BASE}/api/vins/export?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { data } = await res.json();
      const headers = ["Enterprise Name", "Rooftop Name", "Type", "CSM", "VIN", "Dealer VIN ID", "Has Photos", "Status", "After 24h?", "Received", "Delivered", "Reason Bucket", "Hold Reason"];
      const rows = data.map(d => [d.enterprise, d.rooftop, d.rooftopType, d.csm, d.vin, d.dealerVinId ?? "", d.hasPhotos ? "Yes" : "No", d.status, isAfter24h(d) ? "Yes" : "No", d.receivedAt ? new Date(d.receivedAt).toLocaleString() : "", d.processedAt ? new Date(d.processedAt).toLocaleString() : "", d.reasonBucket || "", d.holdReason || ""]);
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
                    {d.dealerVinId
                      ? <a href={`https://console.spyne.ai/inventory/v2/listings/${d.dealerVinId}?enterprise_id=${d.enterpriseId}&team_id=${d.rooftopId}`} target="_blank" rel="noreferrer"
                          style={{ color: "#4f46e5", textDecoration: "none", fontWeight: 600 }}
                          onMouseEnter={e => (e.currentTarget.style.textDecoration = "underline")}
                          onMouseLeave={e => (e.currentTarget.style.textDecoration = "none")}>
                          {d.vin}
                        </a>
                      : d.vin}
                    <CopyButton value={d.vin} />
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

function RooftopTab({ typeOptions: types = [], csmOptions: csms = [], enterpriseOptions = [], bucketFlags = {}, rows, total, page, pageCount, loading, onPageChange, onDrillDown, filters, setFilters, sortCol, sortDir, onSortChange }) {
  const [downloading, setDownloading] = useState(false);
  const row1Ref = useRef<HTMLTableRowElement>(null);
  const [row1H, setRow1H] = useState(0);
  useEffect(() => { if (row1Ref.current) setRow1H(row1Ref.current.getBoundingClientRect().height); });

  const SCORE_OPTIONS = ["Poor (<6)", "Average (6–8)", "Good (8+)"];

  const handleSort = col => {
    if (sortCol !== col) { onSortChange(col, "desc"); }
    else if (sortDir === "desc") { onSortChange(col, "asc"); }
    else { onSortChange(null, "asc"); }
  };

  const activeBuckets = BUCKETS.filter(b => bucketFlags[b.key]);
  const pendencyColSpan = 1 + activeBuckets.length;
  const activeCount = [filters.rooftopType, filters.csm, filters.enterprise, filters.websiteScore, filters.imsIntegration, filters.publishingStatus].filter(Boolean).length;
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
    if (sortCol) { params.set("sortBy", sortCol); params.set("sortDir", sortDir); }
    try {
      const res = await fetch(`${API_BASE}/api/rooftops/export?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { data } = await res.json();
      const headers = ["Enterprise Name", "Rooftop Name", "Type", "CSM", "IMS Integration", "Publishing", "Total Inventory", "With Photos", "Delivered", "Pending", "Pending VINs >24h", "Pending VINs >24h %", "Website Score", ...activeBuckets.map(b => b.label)];
      const csvRows = data.map(r => {
        const rate = r.total === 0 ? 0 : ((r.notProcessedAfter24 / r.total) * 100).toFixed(0);
        return [r.enterprise, r.name, r.type, r.csm, r.imsIntegrationStatus ?? "", r.publishingStatus ?? "", r.total, r.withPhotos ?? 0, r.deliveredWithPhotos ?? 0, r.pendingWithPhotos ?? 0, r.notProcessedAfter24, rate, r.websiteScore !== null && r.websiteScore !== undefined ? Number(r.websiteScore).toFixed(1) : "", ...activeBuckets.map(b => r[b.key] ?? 0)];
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
            {loading && rows.length === 0 && <TableShimmer cols={cols.length + 1} />}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={cols.length + 1} style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>No records match the current filters.</td></tr>
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

  const activeBuckets = BUCKETS.filter(b => bucketFlags[b.key]);
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

  const activeCount = [filters.csm, filters.accountType, filters.websiteScore].filter(Boolean).length;

  const handleDownload = async () => {
    setDownloading(true);
    const params = new URLSearchParams();
    if (filters.search)       params.set("search",      filters.search);
    if (filters.csm)          params.set("csm",         filters.csm);
    if (filters.accountType)  params.set("accountType", filters.accountType);
    if (filters.websiteScore) params.set("websiteScore", filters.websiteScore);
    if (sortCol) { params.set("sortBy", sortCol); params.set("sortDir", sortDir); }
    try {
      const res = await fetch(`${API_BASE}/api/enterprises/export?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { data } = await res.json();
      const headers = ["Enterprise ID", "Enterprise Name", "Account Type", "CSM", "Rooftops", ...(showNotIntegrated ? ["Not Integrated"] : []), ...(showPublishingDisabled ? ["Publishing Disabled"] : []), "Total Inventory", "With Photos", "Delivered", "Pending", "Pending VINs >24h", "Pending VINs >24h %", "Avg Website Score", ...activeBuckets.map(b => b.label)];
      const csvRows = data.map((r: any) => [r.id, r.name, r.accountType ?? "", r.csm ?? "", r.rooftopCount ?? 0, ...(showNotIntegrated ? [r.notIntegratedCount ?? 0] : []), ...(showPublishingDisabled ? [r.publishingDisabledCount ?? 0] : []), r.total, r.withPhotos ?? 0, r.deliveredWithPhotos ?? 0, r.pendingWithPhotos ?? 0, r.notProcessedAfter24, r.total === 0 ? 0 : ((r.notProcessedAfter24 / r.total) * 100).toFixed(0), r.avgWebsiteScore !== null && r.avgWebsiteScore !== undefined ? Number(r.avgWebsiteScore).toFixed(1) : "", ...activeBuckets.map(b => r[b.key] ?? 0)]);
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
  const activeBuckets = BUCKETS.filter(b => csms.some(r => (r[b.key] ?? 0) > 0));

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

  const activeBuckets = BUCKETS.filter(b => rows.some(r => (r[b.key] ?? 0) > 0));
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
                <th rowSpan={2} style={{ ...thBase, textAlign: "center", cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("enterpriseCount")}>Enterprises{si("enterpriseCount")}</th>
                <th rowSpan={2} style={{ ...thBase, textAlign: "center", cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("rooftopCount")}>Rooftops{si("rooftopCount")}</th>
                <th rowSpan={2} style={{ ...thBase, textAlign: "center", cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("total")}>Inventory{si("total")}</th>
                <th rowSpan={2} style={{ ...thBase, textAlign: "center", cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("withPhotos")}>With Photos{si("withPhotos")}</th>
                <th rowSpan={2} style={{ ...thBase, textAlign: "center", cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("deliveredWithPhotos")}>Delivered{si("deliveredWithPhotos")}</th>
                <th rowSpan={2} style={{ ...thBase, textAlign: "center", cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("pendingWithPhotos")}>Pending{si("pendingWithPhotos")}</th>
                <th rowSpan={2} style={{ ...thBase, textAlign: "center", cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("notProcessedAfter24")}>Pending &gt;24h{si("notProcessedAfter24")}</th>
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
                    <td style={{ ...td, textAlign: "center" }}><ClickableNum value={r.enterpriseCount ?? 0} color="#6b7280" onClick={() => onRooftopDrillDown({ [filterKey]: r.label })} /></td>
                    <td style={{ ...td, textAlign: "center" }}><ClickableNum value={r.rooftopCount} color="#6b7280" onClick={() => onRooftopDrillDown({ [filterKey]: r.label })} /></td>
                    <td style={{ ...td, textAlign: "center" }}><ClickableNum value={r.total} color="#4f46e5" onClick={() => onDrillDown(base)} /></td>
                    <td style={{ ...td, textAlign: "center" }}><ClickableNum value={r.withPhotos ?? 0} color="#0ea5e9" onClick={() => onDrillDown({ ...base, hasPhotos: true })} /></td>
                    <td style={{ ...td, textAlign: "center" }}><ClickableNum value={r.deliveredWithPhotos ?? 0} color="#166534" onClick={() => onDrillDown({ ...base, status: "Delivered", hasPhotos: true })} /></td>
                    <td style={{ ...td, textAlign: "center" }}><ClickableNum value={r.pendingWithPhotos ?? 0} color="#991b1b" onClick={() => onDrillDown({ ...base, status: "Not Delivered", hasPhotos: true })} /></td>
                    {/* Standalone: Pending >24h count */}
                    <td style={{ ...td, textAlign: "center" }}>
                      {r.notProcessedAfter24 > 0
                        ? <span onClick={() => onDrillDown({ ...base, status: "Not Delivered", after24h: true, hasPhotos: true })} style={{ cursor: "pointer" }}><Badge label={r.notProcessedAfter24} color="red" /></span>
                        : <span style={{ color: "#9ca3af" }}>0</span>}
                    </td>
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
                <td style={{ ...totTd, textAlign: "center", color: "#6b7280" }}>{(totRow.enterpriseCount ?? 0).toLocaleString()}</td>
                <td style={{ ...totTd, textAlign: "center", color: "#6b7280" }}>{totRow.rooftopCount?.toLocaleString()}</td>
                <td style={{ ...totTd, textAlign: "center" }}><ClickableNum value={totRow.total} color="#4f46e5" onClick={() => onDrillDown({})} /></td>
                <td style={{ ...totTd, textAlign: "center" }}><ClickableNum value={totRow.withPhotos ?? 0} color="#0ea5e9" onClick={() => onDrillDown({ hasPhotos: true })} /></td>
                <td style={{ ...totTd, textAlign: "center" }}><ClickableNum value={totRow.deliveredWithPhotos ?? 0} color="#166534" onClick={() => onDrillDown({ status: "Delivered", hasPhotos: true })} /></td>
                <td style={{ ...totTd, textAlign: "center" }}><ClickableNum value={totRow.pendingWithPhotos ?? 0} color="#991b1b" onClick={() => onDrillDown({ status: "Not Delivered", hasPhotos: true })} /></td>
                {/* Standalone: Pending >24h total count */}
                <td style={{ ...totTd, textAlign: "center" }}>
                  {totRow.notProcessedAfter24 > 0
                    ? <span onClick={() => onDrillDown({ status: "Not Delivered", after24h: true, hasPhotos: true })} style={{ cursor: "pointer" }}><Badge label={totRow.notProcessedAfter24} color="red" /></span>
                    : <span style={{ color: "#9ca3af" }}>0</span>}
                </td>
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
      <div style={{ display: "flex", gap: 14, marginBottom: activeBuckets.length > 0 ? 10 : 28, flexWrap: "wrap" }}>
        <StatCard label="Total Inventory" value={totals.total} color="#6366f1" onClick={() => onDrillDown({})} loading={loading} />
        <StatCard label="With Photos" value={totals.withPhotos ?? 0} sub={totals.total > 0 ? `${(((totals.withPhotos ?? 0) / totals.total) * 100).toFixed(0)}% of total` : ""} color="#0ea5e9" onClick={() => onDrillDown({ hasPhotos: true })} loading={loading} />
        <StatCard label="VIN Delivered" value={totals.deliveredWithPhotos ?? 0} sub={totals.withPhotos > 0 ? `${(((totals.deliveredWithPhotos ?? 0) / totals.withPhotos) * 100).toFixed(0)}% of with photos` : ""} color="#22c55e" onClick={() => onDrillDown({ status: "Delivered", hasPhotos: true })} loading={loading} />
        <StatCard label="Pending VINs" value={totals.pendingWithPhotos ?? 0} sub={totals.withPhotos > 0 ? `${(((totals.pendingWithPhotos ?? 0) / totals.withPhotos) * 100).toFixed(0)}% of with photos` : ""} color="#ef4444" onClick={() => onDrillDown({ status: "Not Delivered", hasPhotos: true })} loading={loading} />
        <StatCard label="Pending VINs >24h" value={totals.notProcessedAfter24} sub={totals.withPhotos > 0 ? `${((totals.notProcessedAfter24 / totals.withPhotos) * 100).toFixed(0)}% of with photos` : ""} color="#f59e0b" onClick={() => onDrillDown({ status: "Not Delivered", after24h: true, hasPhotos: true })} loading={loading} />
      </div>
      {activeBuckets.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 28, alignItems: "center", opacity: loading ? 0.45 : 1, transition: "opacity 0.2s" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase" as const, letterSpacing: 0.5, marginRight: 2 }}>Pending &gt;24h by reason:</span>
          {activeBuckets.map((b: { label: string; count: number }) => (
            <span key={b.label} onClick={loading ? undefined : () => onDrillDown({ status: "Not Delivered", after24h: true, reasonBucket: b.label })}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", cursor: loading ? "default" : "pointer", transition: "all 0.15s" }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = "#fee2e2"; e.currentTarget.style.borderColor = "#fca5a5"; } }}
              onMouseLeave={e => { if (!loading) { e.currentTarget.style.background = "#fef2f2"; e.currentTarget.style.borderColor = "#fecaca"; } }}>
              {b.label} <span style={{ fontWeight: 700, color: "#ef4444" }}>{b.count.toLocaleString()}</span>
            </span>
          ))}
        </div>
      )}
      <SummaryTable title="By Rooftop Type" rows={byType} colorHeader="#6366f1" filterKey="rooftopType" onDrillDown={onDrillDown} onRooftopDrillDown={onRooftopDrillDown} loading={loading} defaultSortCol={null} />
      <SummaryTable title="By CSM" rows={byCSM} colorHeader="#0ea5e9" filterKey="csm" onDrillDown={onDrillDown} onRooftopDrillDown={onRooftopDrillDown} loading={loading} defaultSortCol="rooftopCount" />
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

const DEFAULT_FILTERS = { search: "", enterpriseId: null, rooftop: null, rooftopId: null, rooftopType: null, csm: null, status: null, after24h: null, hasPhotos: null, reasonBucket: null };
const DEFAULT_ROOFTOP_FILTERS = { search: "", rooftopType: null, csm: null, enterprise: null, websiteScore: null, imsIntegration: null, publishingStatus: null };
const DEFAULT_ENTERPRISE_FILTERS = { search: "", csm: null, accountType: null, websiteScore: null };

const EMPTY_SUMMARY = {
  totals:   { total: 0, enterpriseCount: 0, withPhotos: 0, deliveredWithPhotos: 0, pendingWithPhotos: 0, processed: 0, notProcessed: 0, processedAfter24: 0, notProcessedAfter24: 0, bucketProcessingPending: 0, bucketPublishingPending: 0, bucketQcPending: 0, bucketSold: 0, bucketOthers: 0 },
  byCSM:    [],
  byType:   [],
  byBucket: [],
};

export default function Dashboard() {
  const [syncing, setSyncing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  /** Bumps after successful POST /api/sync so Vini reloads Metabase-backed rows. */
  const [viniRefresh, setViniRefresh] = useState(0);
  const [viniMeta, setViniMeta] = useState<{ rowCount: number; syncedAt: string | null } | null>(null);

  const loadViniMeta = useCallback(() => {
    fetch(`${API_BASE}/api/vini/rooftops`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => {
        const n = typeof j.rowCount === "number" ? j.rowCount : (j.rooftops?.length ?? 0);
        setViniMeta({ rowCount: n, syncedAt: j.syncedAt ?? null });
      })
      .catch(() => setViniMeta(null));
  }, []);

  useEffect(() => {
    loadViniMeta();
  }, [loadViniMeta, viniRefresh]);

  const syncNow = useCallback(() => {
    setSyncing(true);
    setFetchError(null);
    fetch(`${API_BASE}/api/sync`, { method: "POST" })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(() => {
        setViniRefresh((x) => x + 1);
      })
      .catch(err => { setFetchError(err.message); })
      .finally(() => { setSyncing(false); });
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
      {syncing && (
        <div className="sync-banner" style={{ width: "100%", height: 36, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "#fff", fontSize: 13, fontWeight: 600, letterSpacing: 0.2, marginBottom: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          Refreshing data from Metabase…
        </div>
      )}
      <div style={{ padding: "20px 32px" }}>
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>
            Vini Dashboard
          </h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0", maxWidth: 640 }}>
            Spyne AI — rooftop account health and call analytics. Numbers come from your Metabase sync (set <span style={{ fontFamily: "monospace", fontSize: 12, background: "#f3f4f6", padding: "1px 6px", borderRadius: 4 }}>VINI_ROOFTOP_METABASE_URL</span> on the server), then click Refresh.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 4 }}>
          <a href="/agents"
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: "1px solid #c7d2fe", background: "#eef2ff", fontSize: 12, fontWeight: 600, color: "#4338ca", textDecoration: "none", transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "#e0e7ff"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#eef2ff"; }}>
            📊 Agents — Day on Day
          </a>
          {!syncing && fetchError && <span style={{ fontSize: 12, color: "#dc2626" }} title={fetchError}>⚠ {fetchError}</span>}
          {viniMeta !== null && (
            <span style={{ fontSize: 12, color: "#16a34a" }}>
              ● {viniMeta.rowCount.toLocaleString()} rooftop{viniMeta.rowCount === 1 ? "" : "s"} in cache
              {viniMeta.syncedAt && (
                <span style={{ color: "#9ca3af" }}>
                  {" "}
                  · synced {timeAgo(new Date(viniMeta.syncedAt).toISOString())}
                </span>
              )}
            </span>
          )}
          <button onClick={syncNow} disabled={syncing}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: syncing ? "#f3f4f6" : "#fff", fontSize: 12, fontWeight: 600, cursor: syncing ? "not-allowed" : "pointer", color: syncing ? "#9ca3af" : "#374151", transition: "all 0.15s" }}
            onMouseEnter={e => { if (!syncing) e.currentTarget.style.borderColor = "#9ca3af"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#d1d5db"; }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      <ViniDashboard refreshToken={String(viniRefresh)} embeddedChrome />
      </div>
    </div>
  );
}
