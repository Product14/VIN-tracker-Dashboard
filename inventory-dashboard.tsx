import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";

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

function StatCard({ label, value, sub, color = "#6366f1", onClick }) {
  const interactive = !!onClick;
  return (
    <div onClick={onClick} style={{ background: "#fff", borderRadius: 12, padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", border: "1px solid #e5e7eb", flex: 1, minWidth: 160, cursor: interactive ? "pointer" : "default", transition: "all 0.15s", ...(interactive ? {} : {}) }}
      onMouseEnter={e => { if (interactive) { e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.12)"; e.currentTarget.style.transform = "translateY(-2px)"; } }}
      onMouseLeave={e => { if (interactive) { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)"; e.currentTarget.style.transform = "translateY(0)"; } }}>
      <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 500, marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontSize: 28, fontWeight: 700, color }}>{typeof value === "number" ? value.toLocaleString() : value}</div>
        {sub && <div style={{ fontSize: 13, color: "#9ca3af", fontWeight: 500 }}>({sub})</div>}
      </div>
      {interactive && <div style={{ fontSize: 11, color: "#a5b4fc", marginTop: 6 }}>Click to view details →</div>}
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

  const activeCount = [filters.enterpriseId, filters.rooftop, filters.rooftopType, filters.csm, filters.status, filters.after24h !== null ? "x" : null].filter(Boolean).length;

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
        {activeCount > 0 && (
          <button onClick={() => setFilters({ search: "", enterpriseId: null, rooftop: null, rooftopType: null, csm: null, status: null, after24h: null })}
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
        </div>
      )}
    </div>
  );
}

function RawTab({ data, filters, setFilters, total, page, pageCount, onPageChange, rooftopOptions, typeOptions, csmOptions, enterpriseObjects = [] }) {
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [downloading, setDownloading] = useState(false);

  const sorted = useMemo(() => {
    if (!sortCol) return data;
    return [...data].sort((a, b) => {
      let va = a[sortCol], vb = b[sortCol];
      if (sortCol === "after24h") { va = isAfter24h(a); vb = isAfter24h(b); }
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === "asc" ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
  }, [data, sortCol, sortDir]);

  const handleSort = (col) => {
    if (sortCol !== col) { setSortCol(col); setSortDir("asc"); }
    else if (sortDir === "asc") { setSortDir("desc"); }
    else { setSortCol(null); setSortDir("asc"); }
  };

  const cols = [
    { key: "enterprise",  label: "Enterprise Name" },
    { key: "rooftop",     label: "Rooftop Name" },
    { key: "rooftopType", label: "Type" },
    { key: "csm",         label: "CSM" },
    { key: "vin",         label: "VIN" },
    { key: "dealerVinId", label: "Dealer VIN ID", numeric: true },
    { key: "status",      label: "Status" },
    { key: "after24h",    label: "After 24h?", numeric: true },
    { key: "receivedAt",  label: "Received" },
    { key: "processedAt", label: "Delivered" },
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
    try {
      const res = await fetch(`/api/vins/export?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { data } = await res.json();
      const headers = ["Enterprise Name", "Rooftop Name", "Type", "CSM", "VIN", "Dealer VIN ID", "Status", "After 24h?", "Received", "Delivered"];
      const rows = data.map(d => [d.enterprise, d.rooftop, d.rooftopType, d.csm, d.vin, d.dealerVinId ?? "", d.status, isAfter24h(d) ? "Yes" : "No", d.receivedAt ? new Date(d.receivedAt).toLocaleString() : "", d.processedAt ? new Date(d.processedAt).toLocaleString() : ""]);
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
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={11} style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>No records match the current filters.</td></tr>
            )}
            {sorted.map((d, i) => (
              <tr key={d.vin} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6", textAlign: "center", color: "#9ca3af", fontSize: 12 }}>{i + 1}</td>
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
                <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6" }}><Badge label={d.status} color={d.status === "Delivered" ? "green" : "red"} /></td>
                <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6", textAlign: "center" }}>{isAfter24h(d) ? <Badge label="Yes" color="amber" /> : <Badge label="No" color="green" />}</td>
                <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap", fontSize: 12 }}>{new Date(d.receivedAt).toLocaleString()}</td>
                <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap", fontSize: 12 }}>{d.processedAt ? new Date(d.processedAt).toLocaleString() : "—"}</td>
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

function RooftopTab({ allRooftops, onDrillDown, filters, setFilters }) {
  const [sortCol, setSortCol] = useState("notProcessedAfter24");
  const [sortDir, setSortDir] = useState("desc");

  const types = [...new Set(allRooftops.map(r => r.type))].sort();
  const csms = [...new Set(allRooftops.map(r => r.csm))].sort();
  const enterpriseOptions = [...new Set(allRooftops.map(r => r.enterprise).filter(Boolean))].sort();

  const SCORE_OPTIONS = ["Poor (<6)", "Average (6–8)", "Good (8+)"];

  const filtered = useMemo(() => allRooftops.filter(r => {
    if (filters.rooftopType && r.type !== filters.rooftopType) return false;
    if (filters.csm && r.csm !== filters.csm) return false;
    if (filters.enterprise && r.enterprise !== filters.enterprise) return false;
    if (filters.websiteScore) {
      const s = r.websiteScore;
      if (filters.websiteScore === "Poor (<6)"     && !(s !== null && s !== undefined && s < 6))  return false;
      if (filters.websiteScore === "Average (6–8)" && !(s !== null && s !== undefined && s >= 6 && s < 8)) return false;
      if (filters.websiteScore === "Good (8+)"     && !(s !== null && s !== undefined && s >= 8)) return false;
    }
    if (filters.search) {
      const s = filters.search.toLowerCase();
      if (!r.name.toLowerCase().includes(s) && !r.csm.toLowerCase().includes(s)) return false;
    }
    return true;
  }), [allRooftops, filters]);

  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    return [...filtered].sort((a, b) => {
      const va = sortCol === "rate" ? (a.total === 0 ? 0 : a.notProcessedAfter24 / a.total) : a[sortCol];
      const vb = sortCol === "rate" ? (b.total === 0 ? 0 : b.notProcessedAfter24 / b.total) : b[sortCol];
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === "asc" ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
  }, [filtered, sortCol, sortDir]);

  const handleSort = col => {
    if (sortCol !== col) { setSortCol(col); setSortDir("asc"); }
    else if (sortDir === "asc") { setSortDir("desc"); }
    else { setSortCol(null); setSortDir("asc"); }
  };

  const activeCount = [filters.rooftopType, filters.csm, filters.enterprise, filters.websiteScore].filter(Boolean).length;
  const cols = [
    { key: "enterprise",          label: "Enterprise Name" },
    { key: "name",                label: "Rooftop Name" },
    { key: "type",                label: "Type" },
    { key: "csm",                 label: "CSM" },
    { key: "total",               label: "Total Inventory",     numeric: true },
    { key: "processed",           label: "VINs Delivered",      numeric: true },
    { key: "notProcessedAfter24", label: "Pending VINs >24h",   numeric: true },
    { key: "rate",                label: "Pending VINs >24h %", numeric: true },
    { key: "websiteScore",        label: "Website Score",       numeric: true },
    { key: "_links",              label: "Links",               numeric: true, noSort: true },
  ];

  const tdStyle = { padding: "10px 14px", borderBottom: "1px solid #f3f4f6" };

  const handleDownload = () => {
    const headers = ["Enterprise Name", "Rooftop Name", "Type", "CSM", "Total Inventory", "VINs Delivered", "Pending VINs >24h", "Pending VINs >24h %", "Website Score"];
    const rows = sorted.map(r => {
      const rate = r.total === 0 ? 0 : ((r.notProcessedAfter24 / r.total) * 100).toFixed(0);
      return [r.enterprise, r.name, r.type, r.csm, r.total, r.processed, r.notProcessedAfter24, rate, r.websiteScore !== null && r.websiteScore !== undefined ? Number(r.websiteScore).toFixed(1) : ""];
    });
    downloadCSV("rooftop-view.csv", headers, rows);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <DownloadButton onClick={handleDownload} />
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
          </div>
        )}
      </div>
      <div style={{ maxHeight: "calc(100vh - 260px)", overflow: "auto", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600, color: "#374151", borderBottom: "2px solid #e5e7eb", background: "#f9fafb", position: "sticky", top: 0, zIndex: 2, width: 48, whiteSpace: "nowrap" }}>S. No.</th>
              {cols.map(c => (
                <th key={c.key} onClick={() => !c.noSort && handleSort(c.key)} style={{ padding: "10px 14px", textAlign: c.numeric ? "center" : "left", fontWeight: 600, color: "#374151", borderBottom: "2px solid #e5e7eb", whiteSpace: "normal", cursor: c.noSort ? "default" : "pointer", userSelect: "none", background: "#f9fafb", position: "sticky", top: 0, zIndex: 2 }}>
                  {c.label} {!c.noSort && (sortCol === c.key ? (sortDir === "asc" ? "↑" : "↓") : <span style={{ color: "#d1d5db" }}>↕</span>)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={11} style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>No records match the current filters.</td></tr>
            )}
            {sorted.map((r, i) => {
              const rate = r.total === 0 ? 0 : (r.notProcessedAfter24 / r.total) * 100;
              return (
                <tr key={r.rooftopId || r.name} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                  <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af", fontSize: 12 }}>{i + 1}</td>
                  <td style={tdStyle}><Truncated value={r.enterprise} maxWidth={180} /></td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}><Truncated value={r.name} maxWidth={150} /></td>
                  <td style={tdStyle}><Badge label={r.type} color={r.type === "Franchise" ? "blue" : "gray"} /></td>
                  <td style={tdStyle}><Truncated value={fmtCsm(r.csm)} maxWidth={130} /></td>
                  <td style={{ ...tdStyle, textAlign: "center" }}><ClickableNum value={r.total} color="#4f46e5" onClick={() => onDrillDown({ rooftopId: r.rooftopId })} /></td>
                  <td style={{ ...tdStyle, textAlign: "center" }}><ClickableNum value={r.processed} color="#166534" onClick={() => onDrillDown({ rooftopId: r.rooftopId, status: "Delivered" })} /></td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    {r.notProcessedAfter24 > 0
                      ? <span onClick={() => onDrillDown({ rooftopId: r.rooftopId, status: "Not Delivered", after24h: true })} style={{ cursor: "pointer" }}><Badge label={r.notProcessedAfter24} color="red" /></span>
                      : <span style={{ color: "#9ca3af" }}>0</span>}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      <div style={{ width: 60, height: 8, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${rate}%`, height: "100%", background: rate >= 30 ? "#ef4444" : rate >= 15 ? "#eab308" : "#22c55e", borderRadius: 4 }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{rate.toFixed(0)}%</span>
                    </div>
                  </td>
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
      <div style={{ marginTop: 10, fontSize: 12, color: "#9ca3af" }}>Showing {sorted.length} of {allRooftops.length} rooftops</div>
    </div>
  );
}

function EnterpriseTab({ enterprises, onDrillDown, filters = DEFAULT_ENTERPRISE_FILTERS, setFilters = (_f) => {} }) {
  const [sortCol, setSortCol] = useState("notProcessedAfter24");
  const [sortDir, setSortDir] = useState("desc");

  const tdStyle = { padding: "10px 14px", borderBottom: "1px solid #f3f4f6" };

  const csmOptions = useMemo(() => [...new Set(enterprises.map(r => r.csm).filter(Boolean))].sort() as string[], [enterprises]);
  const typeOptions = useMemo(() => [...new Set(enterprises.map(r => r.accountType).filter(Boolean))].sort() as string[], [enterprises]);
  const SCORE_OPTIONS = ["Poor (<6)", "Average (6–8)", "Good (8+)"];

  const cols = [
    { key: "id",                  label: "Enterprise ID" },
    { key: "name",                label: "Enterprise Name" },
    { key: "accountType",         label: "Account Type" },
    { key: "csm",                 label: "CSM" },
    { key: "total",               label: "Total Inventory",     numeric: true },
    { key: "processed",           label: "VIN Delivered",       numeric: true },
    { key: "processedAfter24",    label: "Delivered VINs >24h", numeric: true },
    { key: "notProcessed",        label: "Pending VINs",        numeric: true },
    { key: "notProcessedAfter24", label: "Pending VINs >24h",   numeric: true },
    { key: "rate",                label: "Pending VINs >24h %", numeric: true },
    { key: "avgWebsiteScore",     label: "Avg Website Score",   numeric: true },
    { key: "_links",              label: "Links",               numeric: true, noSort: true },
  ];

  const handleSort = col => {
    if (sortCol !== col) { setSortCol(col); setSortDir("asc"); }
    else if (sortDir === "asc") { setSortDir("desc"); }
    else { setSortCol(null); setSortDir("asc"); }
  };

  const activeCount = [filters.csm, filters.accountType, filters.websiteScore].filter(Boolean).length;

  const filtered = useMemo(() => {
    return enterprises.filter(r => {
      if (filters.csm && r.csm !== filters.csm) return false;
      if (filters.accountType && r.accountType !== filters.accountType) return false;
      if (filters.websiteScore) {
        const s = r.avgWebsiteScore;
        if (filters.websiteScore === "Poor (<6)"    && !(s !== null && s !== undefined && s < 6))  return false;
        if (filters.websiteScore === "Average (6–8)" && !(s !== null && s !== undefined && s >= 6 && s < 8)) return false;
        if (filters.websiteScore === "Good (8+)"    && !(s !== null && s !== undefined && s >= 8)) return false;
      }
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (!r.name.toLowerCase().includes(s) && !(r.id || "").toLowerCase().includes(s) && !(r.csm || "").toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [enterprises, filters.search, filters.csm, filters.accountType, filters.websiteScore]);

  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    return [...filtered].sort((a, b) => {
      const va = sortCol === "rate" ? (a.total === 0 ? 0 : a.notProcessedAfter24 / a.total) : a[sortCol];
      const vb = sortCol === "rate" ? (b.total === 0 ? 0 : b.notProcessedAfter24 / b.total) : b[sortCol];
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === "asc" ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
  }, [filtered, sortCol, sortDir]);

  const handleDownload = () => {
    const headers = ["Enterprise ID", "Enterprise Name", "Account Type", "CSM", "Total Inventory", "VIN Delivered", "Delivered VINs >24h", "Pending VINs", "Pending VINs >24h", "Pending VINs >24h %", "Avg Website Score"];
    const rows = sorted.map(r => [r.id, r.name, r.accountType ?? "", r.csm ?? "", r.total, r.processed, r.processedAfter24, r.notProcessed, r.notProcessedAfter24, r.total === 0 ? 0 : ((r.notProcessedAfter24 / r.total) * 100).toFixed(0), r.avgWebsiteScore !== null && r.avgWebsiteScore !== undefined ? Number(r.avgWebsiteScore).toFixed(1) : ""]);
    downloadCSV("enterprise-view.csv", headers, rows);
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
        <DownloadButton onClick={handleDownload} />
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
            <tr style={{ background: "#f9fafb" }}>
              <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600, color: "#374151", borderBottom: "2px solid #e5e7eb", background: "#f9fafb", position: "sticky", top: 0, zIndex: 2, width: 48, whiteSpace: "nowrap" }}>S. No.</th>
              {cols.map(c => (
                <th key={c.key} onClick={() => !c.noSort && handleSort(c.key)}
                  style={{ padding: "10px 14px", textAlign: c.numeric ? "center" : "left", fontWeight: 600, color: "#374151", borderBottom: "2px solid #e5e7eb", whiteSpace: "normal", cursor: c.noSort ? "default" : "pointer", userSelect: "none", background: "#f9fafb", position: "sticky", top: 0, zIndex: 2 }}>
                  {c.label} {!c.noSort && (sortCol === c.key ? (sortDir === "asc" ? "↑" : "↓") : <span style={{ color: "#d1d5db" }}>↕</span>)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={13} style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>No records match the current filters.</td></tr>
            )}
            {sorted.map((r, i) => {
              const rate = r.total === 0 ? 0 : (r.notProcessedAfter24 / r.total) * 100;
              return (
                <tr key={r.id} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                  <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af", fontSize: 12 }}>{i + 1}</td>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12, color: "#0ea5e9", fontWeight: 600 }}><Truncated value={r.id} maxWidth={90} /></td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}><Truncated value={r.name} maxWidth={180} /></td>
                  <td style={tdStyle}>{r.accountType ? <Badge label={r.accountType} color="blue" /> : <span style={{ color: "#9ca3af" }}>—</span>}</td>
                  <td style={tdStyle}><Truncated value={fmtCsm(r.csm)} maxWidth={130} /></td>
                  <td style={{ ...tdStyle, textAlign: "center" }}><ClickableNum value={r.total} color="#4f46e5" onClick={() => onDrillDown({ enterpriseId: r.id })} /></td>
                  <td style={{ ...tdStyle, textAlign: "center" }}><ClickableNum value={r.processed} color="#166534" onClick={() => onDrillDown({ enterpriseId: r.id, status: "Delivered" })} /></td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    {r.processedAfter24 > 0
                      ? <span onClick={() => onDrillDown({ enterpriseId: r.id, status: "Delivered", after24h: true })} style={{ cursor: "pointer" }}><Badge label={r.processedAfter24} color="amber" /></span>
                      : <span style={{ color: "#9ca3af" }}>0</span>}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}><ClickableNum value={r.notProcessed} color="#991b1b" onClick={() => onDrillDown({ enterpriseId: r.id, status: "Not Delivered" })} /></td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    {r.notProcessedAfter24 > 0
                      ? <span onClick={() => onDrillDown({ enterpriseId: r.id, status: "Not Delivered", after24h: true })} style={{ cursor: "pointer" }}><Badge label={r.notProcessedAfter24} color="red" /></span>
                      : <span style={{ color: "#9ca3af" }}>0</span>}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      <div style={{ width: 80, height: 8, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${rate}%`, height: "100%", background: rate >= 30 ? "#ef4444" : rate >= 15 ? "#eab308" : "#22c55e", borderRadius: 4 }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{rate.toFixed(0)}%</span>
                    </div>
                  </td>
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
      <div style={{ marginTop: 10, fontSize: 12, color: "#9ca3af" }}>Showing {sorted.length} of {enterprises.length} enterprises</div>
    </div>
  );
}

function CSMTab({ csms, onDrillDown }) {

  const tdStyle = { padding: "10px 14px", borderBottom: "1px solid #f3f4f6" };

  const handleDownload = () => {
    const headers = ["CSM Name", "Total Inventory", "VIN Delivered", "Delivered VINs >24h", "Pending VINs", "Pending VINs >24h", "Pending VINs >24h %"];
    const rows = csms.map(r => [r.name, r.total, r.processed, r.processedAfter24, r.notProcessed, r.notProcessedAfter24, r.total === 0 ? 0 : ((r.notProcessedAfter24 / r.total) * 100).toFixed(0)]);
    downloadCSV("csm-view.csv", headers, rows);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <DownloadButton onClick={handleDownload} />
      </div>
      <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid #e5e7eb" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#f9fafb" }}>
            {["CSM Name", "Total Inventory", "VIN Delivered", "Delivered VINs >24h", "Pending VINs", "Pending VINs >24h", "Pending VINs >24h %"].map((h, idx) => (
              <th key={h} style={{ padding: "10px 14px", textAlign: idx >= 1 ? "center" : "left", fontWeight: 600, color: "#374151", borderBottom: "2px solid #e5e7eb", whiteSpace: "normal" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {csms.map((r, i) => {
            const rate = r.total === 0 ? 0 : (r.notProcessedAfter24 / r.total) * 100;
            return (
              <tr key={r.name} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                <td style={{ ...tdStyle, fontWeight: 600 }}><Truncated value={fmtCsm(r.name)} maxWidth={160} /></td>
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </div>
  );
}

function SummaryTable({ title, rows, colorHeader, filterKey, onDrillDown, onRooftopDrillDown }) {
  const [sortCol, setSortCol] = useState("notProcessedAfter24");
  const [sortDir, setSortDir] = useState("desc");

  const handleSort = col => {
    if (sortCol !== col) { setSortCol(col); setSortDir("asc"); }
    else if (sortDir === "asc") { setSortDir("desc"); }
    else { setSortCol(null); setSortDir("asc"); }
  };

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const va = sortCol === "rate" ? (a.total === 0 ? 0 : a.notProcessedAfter24 / a.total) : a[sortCol];
      const vb = sortCol === "rate" ? (b.total === 0 ? 0 : b.notProcessedAfter24 / b.total) : b[sortCol];
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === "asc" ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
  }, [rows, sortCol, sortDir]);

  const totRow = rows.reduce((t, r) => ({
    total: t.total + r.total, processed: t.processed + r.processed, processedAfter24: t.processedAfter24 + r.processedAfter24,
    notProcessed: t.notProcessed + r.notProcessed, notProcessedAfter24: t.notProcessedAfter24 + r.notProcessedAfter24,
    rooftopCount: t.rooftopCount + r.rooftopCount,
  }), { total: 0, processed: 0, processedAfter24: 0, notProcessed: 0, notProcessedAfter24: 0, rooftopCount: 0 });
  const totRate = totRow.total === 0 ? 0 : (totRow.notProcessedAfter24 / totRow.total) * 100;
  const nameCol = filterKey === "rooftopType" ? "Rooftop Type" : "CSM Name";
  const td = { padding: "10px 14px", borderBottom: "1px solid #f3f4f6" };
  const totTd = { padding: "10px 14px", background: "#f9fafb", fontWeight: 700, borderTop: "2px solid #e5e7eb" };

  const cols = [
    { key: "label",               label: nameCol,               numeric: false },
    { key: "rooftopCount",        label: "Rooftops",            numeric: true  },
    { key: "total",               label: "Total",               numeric: true  },
    { key: "processed",           label: "Delivered",           numeric: true  },
    { key: "processedAfter24",    label: "Delivered VINs >24h", numeric: true  },
    { key: "notProcessed",        label: "Pending VINs",        numeric: true  },
    { key: "notProcessedAfter24", label: "Pending VINs >24h",   numeric: true  },
    { key: "rate",                label: "Pending VINs >24h %", numeric: true  },
    ...(filterKey === "csm" ? [{ key: "avgWebsiteScore", label: "Avg Website Score", numeric: true }] : []),
  ];

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1f2937", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 4, height: 20, borderRadius: 2, background: colorHeader, display: "inline-block" }} />
          {title}
        </h3>
        <DownloadButton onClick={() => {
          const headers = [nameCol, "Rooftops", "Total", "Delivered", "Delivered VINs >24h", "Pending VINs", "Pending VINs >24h", "Pending VINs >24h %", ...(filterKey === "csm" ? ["Avg Website Score"] : [])];
          const csvRows = sorted.map(r => [r.label, r.rooftopCount, r.total, r.processed, r.processedAfter24, r.notProcessed, r.notProcessedAfter24, r.total === 0 ? 0 : ((r.notProcessedAfter24 / r.total) * 100).toFixed(0), ...(filterKey === "csm" ? [r.avgWebsiteScore !== null && r.avgWebsiteScore !== undefined ? Number(r.avgWebsiteScore).toFixed(1) : ""] : [])]);
          downloadCSV(`overview-${filterKey}.csv`, headers, csvRows);
        }} />
      </div>
      <div style={{ borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden" }}>
        <div style={{ maxHeight: "calc(100vh - 260px)", overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600, color: "#374151", borderBottom: "2px solid #e5e7eb", background: "#f9fafb", position: "sticky", top: 0, zIndex: 2, width: 48, whiteSpace: "nowrap" }}>S. No.</th>
                {cols.map(c => (
                  <th key={c.key} onClick={() => handleSort(c.key)}
                    style={{ padding: "10px 14px", textAlign: c.numeric ? "center" : "left", fontWeight: 600, color: "#374151", borderBottom: "2px solid #e5e7eb", whiteSpace: "normal", background: "#f9fafb", cursor: "pointer", userSelect: "none", position: "sticky", top: 0, zIndex: 2 }}>
                    {c.label} {sortCol === c.key ? (sortDir === "asc" ? "↑" : "↓") : <span style={{ color: "#d1d5db" }}>↕</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => {
                const rate = r.total === 0 ? 0 : (r.notProcessedAfter24 / r.total) * 100;
                const base = { [filterKey]: r.label };
                return (
                  <tr key={r.label} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                    <td style={{ ...td, textAlign: "center", color: "#9ca3af", fontSize: 12 }}>{i + 1}</td>
                    <td style={{ ...td, fontWeight: 600 }}>
                      <span onClick={() => onRooftopDrillDown({ [filterKey]: r.label })} title={r.label}
                        style={{ cursor: "pointer", color: "#111827", textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 3, display: "block", maxWidth: filterKey === "csm" ? 160 : 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        onMouseEnter={e => (e.currentTarget.style.color = "#4f46e5")} onMouseLeave={e => (e.currentTarget.style.color = "#111827")}>
                        {filterKey === "csm" ? fmtCsm(r.label) : r.label}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: "center" }}><ClickableNum value={r.rooftopCount} color="#6b7280" onClick={() => onRooftopDrillDown({ [filterKey]: r.label })} /></td>
                    <td style={{ ...td, textAlign: "center" }}><ClickableNum value={r.total} color="#4f46e5" onClick={() => onDrillDown(base)} /></td>
                    <td style={{ ...td, textAlign: "center" }}><ClickableNum value={r.processed} color="#166534" onClick={() => onDrillDown({ ...base, status: "Delivered" })} /></td>
                    <td style={{ ...td, textAlign: "center" }}>
                      {r.processedAfter24 > 0
                        ? <span onClick={() => onDrillDown({ ...base, status: "Delivered", after24h: true })} style={{ cursor: "pointer" }}><Badge label={r.processedAfter24} color="amber" /></span>
                        : "0"}
                    </td>
                    <td style={{ ...td, textAlign: "center" }}><ClickableNum value={r.notProcessed} color="#991b1b" onClick={() => onDrillDown({ ...base, status: "Not Delivered" })} /></td>
                    <td style={{ ...td, textAlign: "center" }}>
                      {r.notProcessedAfter24 > 0
                        ? <span onClick={() => onDrillDown({ ...base, status: "Not Delivered", after24h: true })} style={{ cursor: "pointer" }}><Badge label={r.notProcessedAfter24} color="red" /></span>
                        : "0"}
                    </td>
                    <td style={{ ...td, textAlign: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        <div style={{ width: 80, height: 8, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ width: `${rate}%`, height: "100%", background: rate >= 30 ? "#ef4444" : rate >= 15 ? "#eab308" : "#22c55e", borderRadius: 4 }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{rate.toFixed(0)}%</span>
                      </div>
                    </td>
                    {filterKey === "csm" && (
                      <td style={{ ...td, textAlign: "center" }}>
                        {r.avgWebsiteScore !== null && r.avgWebsiteScore !== undefined
                          ? <span style={{ fontWeight: 700, color: r.avgWebsiteScore >= 8 ? "#166534" : r.avgWebsiteScore >= 6 ? "#92400e" : "#991b1b" }}>
                              {Number(r.avgWebsiteScore).toFixed(1)}
                            </span>
                          : <span style={{ color: "#9ca3af" }}>—</span>}
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
                <td style={{ ...totTd, textAlign: "center", color: "#6b7280" }}>{totRow.rooftopCount?.toLocaleString()}</td>
                <td style={{ ...totTd, textAlign: "center" }}><ClickableNum value={totRow.total} color="#4f46e5" onClick={() => onDrillDown({})} /></td>
                <td style={{ ...totTd, textAlign: "center" }}><ClickableNum value={totRow.processed} color="#166534" onClick={() => onDrillDown({ status: "Delivered" })} /></td>
                <td style={{ ...totTd, textAlign: "center" }}>{totRow.processedAfter24 > 0 ? <Badge label={totRow.processedAfter24} color="amber" /> : "0"}</td>
                <td style={{ ...totTd, textAlign: "center" }}><ClickableNum value={totRow.notProcessed} color="#991b1b" onClick={() => onDrillDown({ status: "Not Delivered" })} /></td>
                <td style={{ ...totTd, textAlign: "center" }}>{totRow.notProcessedAfter24 > 0 ? <Badge label={totRow.notProcessedAfter24} color="red" /> : "0"}</td>
                <td style={totTd}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <div style={{ width: 80, height: 8, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${totRate}%`, height: "100%", background: totRate >= 30 ? "#ef4444" : totRate >= 15 ? "#eab308" : "#22c55e", borderRadius: 4 }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>{totRate.toFixed(0)}%</span>
                  </div>
                </td>
                {filterKey === "csm" && <td style={{ ...totTd, textAlign: "center", color: "#9ca3af" }}>—</td>}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ totals, byType, byCSM, onDrillDown, onRooftopDrillDown }) {
  return (
    <div>
      <div style={{ display: "flex", gap: 14, marginBottom: 28, flexWrap: "wrap" }}>
        <StatCard label="Total Inventory" value={totals.total} color="#6366f1" onClick={() => onDrillDown({})} />
        <StatCard label="VIN Delivered" value={totals.processed} sub={`${((totals.processed / totals.total) * 100).toFixed(0)}% of total`} color="#22c55e" onClick={() => onDrillDown({ status: "Delivered" })} />
        <StatCard label="Pending VINs" value={totals.notProcessed} sub={totals.total > 0 ? `${((totals.notProcessed / totals.total) * 100).toFixed(0)}% of total` : ""} color="#ef4444" onClick={() => onDrillDown({ status: "Not Delivered" })} />
        <StatCard label="Pending VINs >24h" value={totals.notProcessedAfter24} sub={totals.total > 0 ? `${((totals.notProcessedAfter24 / totals.total) * 100).toFixed(0)}% of total` : ""} color="#f59e0b" onClick={() => onDrillDown({ status: "Not Delivered", after24h: true })} />
      </div>
      <SummaryTable title="By Rooftop Type" rows={byType} colorHeader="#6366f1" filterKey="rooftopType" onDrillDown={onDrillDown} onRooftopDrillDown={onRooftopDrillDown} />
      <SummaryTable title="By CSM" rows={byCSM} colorHeader="#0ea5e9" filterKey="csm" onDrillDown={onDrillDown} onRooftopDrillDown={onRooftopDrillDown} />
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

const DEFAULT_FILTERS = { search: "", enterpriseId: null, rooftop: null, rooftopId: null, rooftopType: null, csm: null, status: null, after24h: null };
const DEFAULT_ROOFTOP_FILTERS = { search: "", rooftopType: null, csm: null, enterprise: null, websiteScore: null };
const DEFAULT_ENTERPRISE_FILTERS = { search: "", csm: null, accountType: null, websiteScore: null };

const EMPTY_SUMMARY = {
  totals:       { total: 0, processed: 0, notProcessed: 0, processedAfter24: 0, notProcessedAfter24: 0 },
  byRooftop:    [],
  byEnterprise: [],
  byCSM:        [],
  byType:       [],
};

export default function Dashboard() {
  const [tab, setTab] = useState("Overview");
  const [rawFilters, setRawFilters] = useState(DEFAULT_FILTERS);
  const [rooftopFilters, setRooftopFilters] = useState(DEFAULT_ROOFTOP_FILTERS);
  const [enterpriseFilters, setEnterpriseFilters] = useState(DEFAULT_ENTERPRISE_FILTERS);
  const [, setTick] = useState(0);

  // Summary data — sourced from /api/summary (DB views, full dataset)
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);

  // Raw paginated data — sourced from /api/vins, only used in VIN Data tab
  const [rawData, setRawData] = useState<any[]>([]);
  const [rawPage, setRawPage] = useState(1);
  const [rawPageCount, setRawPageCount] = useState(1);
  const [rawTotal, setRawTotal] = useState(0);
  const [rawLoading, setRawLoading] = useState(false);

  const tabs = ["Overview", "Enterprise View", "Rooftop View", "VIN Data"];

  // Fetch summary data from DB views
  const loadSummary = useCallback(() => {
    return fetch("/api/summary")
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(json => {
        if (json.totalRows === 0) return null; // DB empty
        setSummary(json);
        setLastSync(json.lastSync);
        return json;
      });
  }, []);

  // Fetch paginated raw VIN rows
  const loadRawPage = useCallback((page: number, filters: any) => {
    setRawLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (filters.search)       params.set("search",       filters.search);
    if (filters.enterpriseId) params.set("enterpriseId", filters.enterpriseId);
    if (filters.rooftopId)    params.set("rooftopId",    filters.rooftopId);
    if (filters.rooftop)      params.set("rooftop",      filters.rooftop);
    if (filters.rooftopType)  params.set("rooftopType",  filters.rooftopType);
    if (filters.csm)          params.set("csm",          filters.csm);
    if (filters.status)       params.set("status",       filters.status);
    if (filters.after24h !== null) params.set("after24h", filters.after24h ? "true" : "false");

    fetch(`/api/vins?${params}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(({ data, total, pageCount }) => {
        setRawData(data);
        setRawTotal(total);
        setRawPageCount(pageCount);
        setRawLoading(false);
      })
      .catch(err => { setFetchError(err.message); setRawLoading(false); });
  }, []);

  // On mount: load DB. If empty (fresh deployment), auto-sync once then load.
  useEffect(() => {
    loadSummary()
      .then(data => {
        if (data) { setLoading(false); return; }
        // DB is empty — auto-sync (happens after every new Vercel deployment)
        setSyncing(true);
        return fetch("/api/sync", { method: "POST" })
          .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
          .then(({ error }) => { if (error) throw new Error(error); return loadSummary(); })
          .then(() => { setSyncing(false); setLoading(false); })
          .catch(err => { setFetchError(err.message); setSyncing(false); setLoading(false); });
      })
      .catch(err => { setFetchError(err.message); setLoading(false); });
  }, []);

  // Load raw page when switching to VIN Data tab or when filters/page change
  useEffect(() => {
    if (tab === "VIN Data") loadRawPage(rawPage, rawFilters);
  }, [tab, rawPage, rawFilters]);

  // Tick every 30s so relative "synced X ago" label stays fresh
  useEffect(() => {
    const id = setInterval(() => setTick(n => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  // Sync from Metabase — keeps existing data visible until new data is ready
  const syncNow = useCallback(() => {
    setSyncing(true);
    setFetchError(null);
    fetch("/api/sync", { method: "POST" })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(({ error, syncedAt }) => {
        if (error) throw new Error(error);
        setLastSync(syncedAt);
        return loadSummary(); // replaces summary only after new data is ready
      })
      .then(() => { setSyncing(false); })
      .catch(err => { setFetchError(err.message); setSyncing(false); });
  }, [loadSummary]);

  const s = summary ?? EMPTY_SUMMARY;

  // Derive filter dropdown options from summary data (full dataset)
  const rooftopOptions    = useMemo(() => [...new Set((s.byRooftop ?? []).map((r: any) => r.name))].sort() as string[], [s.byRooftop]);
  const typeOptions       = useMemo(() => [...new Set((s.byRooftop ?? []).map((r: any) => r.type))].sort() as string[], [s.byRooftop]);
  const csmOptions        = useMemo(() => [...new Set((s.byCSM     ?? []).map((r: any) => r.name))].sort() as string[], [s.byCSM]);
  const enterpriseObjects = useMemo(() => (s.byEnterprise ?? []).filter((r: any) => r.name).sort((a: any, b: any) => a.name.localeCompare(b.name)), [s.byEnterprise]);

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
          <button onClick={syncNow} disabled={loading || syncing}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: (loading || syncing) ? "#f3f4f6" : "#fff", fontSize: 12, fontWeight: 600, cursor: (loading || syncing) ? "not-allowed" : "pointer", color: (loading || syncing) ? "#9ca3af" : "#374151", transition: "all 0.15s" }}
            onMouseEnter={e => { if (!loading && !syncing) e.currentTarget.style.borderColor = "#9ca3af"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#d1d5db"; }}>
            ↻ Refresh
          </button>
        </div>
      </div>

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

      {tab === "Overview" && <OverviewTab totals={s.totals} byType={s.byType} byCSM={s.byCSM} onDrillDown={handleDrillDown} onRooftopDrillDown={handleRooftopDrillDown} />}
      {tab === "Rooftop View" && <RooftopTab allRooftops={s.byRooftop} onDrillDown={handleDrillDown} filters={rooftopFilters} setFilters={setRooftopFilters} />}
      {tab === "Enterprise View" && <EnterpriseTab enterprises={s.byEnterprise} onDrillDown={handleDrillDown} filters={enterpriseFilters} setFilters={setEnterpriseFilters} />}
      {tab === "VIN Data" && (
        <RawTab
          data={rawData}
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
        />
      )}
      </div>
    </div>
  );
}
