import React, { useState, useMemo, useCallback, useEffect } from "react";

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


function downloadCSV(filename, headers, rows) {
  const escape = v => {
    const s = v === null || v === undefined ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.map(escape).join(","), ...rows.map(r => r.map(escape).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
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

function FilterBar({ filters, setFilters, rooftopOptions = [], typeOptions = [], csmOptions = [] }) {
  const rooftops = rooftopOptions;
  const types = typeOptions;
  const csms = csmOptions;
  const activeCount = [filters.rooftop, filters.rooftopType, filters.csm, filters.status, filters.after24h !== null ? "x" : null].filter(Boolean).length;

  const sel = { padding: "7px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, background: "#fff", minWidth: 130, outline: "none" };
  const activeSel = (v) => v ? { ...sel, borderColor: "#818cf8", background: "#eef2ff" } : sel;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input placeholder="Search VIN, Rooftop, CSM..." value={filters.search || ""} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
          style={{ flex: 1, minWidth: 180, padding: "7px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, outline: "none" }} />
        <select value={filters.rooftop || ""} onChange={e => setFilters(f => ({ ...f, rooftop: e.target.value || null }))} style={activeSel(filters.rooftop)}>
          <option value="">All Rooftops</option>
          {rooftops.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={filters.rooftopType || ""} onChange={e => setFilters(f => ({ ...f, rooftopType: e.target.value || null }))} style={activeSel(filters.rooftopType)}>
          <option value="">All Types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filters.csm || ""} onChange={e => setFilters(f => ({ ...f, csm: e.target.value || null }))} style={activeSel(filters.csm)}>
          <option value="">All CSMs</option>
          {csms.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filters.status || ""} onChange={e => setFilters(f => ({ ...f, status: e.target.value || null }))} style={activeSel(filters.status)}>
          <option value="">All Statuses</option>
          <option value="Delivered">Delivered</option>
          <option value="Not Delivered">Not Delivered</option>
        </select>
        <select value={filters.after24h === null ? "" : filters.after24h ? "yes" : "no"} onChange={e => { const v = e.target.value; setFilters(f => ({ ...f, after24h: v === "" ? null : v === "yes" })); }} style={activeSel(filters.after24h !== null)}>
          <option value="">24h: Any</option>
          <option value="yes">After 24h</option>
          <option value="no">Within 24h</option>
        </select>
        {activeCount > 0 && (
          <button onClick={() => setFilters({ search: "", rooftop: null, rooftopType: null, csm: null, status: null, after24h: null })}
            style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #fca5a5", background: "#fef2f2", color: "#dc2626", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
            Clear {activeCount} filter{activeCount > 1 ? "s" : ""}
          </button>
        )}
      </div>
      {activeCount > 0 && (
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
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

function RawTab({ data, filters, setFilters, total, page, pageCount, onPageChange, rooftopOptions, typeOptions, csmOptions }) {
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

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
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const cols = [
    { key: "vin", label: "VIN" }, { key: "enterpriseId", label: "Enterprise ID" }, { key: "enterprise", label: "Enterprise" },
    { key: "rooftopId", label: "Rooftop ID" }, { key: "rooftop", label: "Rooftop" }, { key: "rooftopType", label: "Type" },
    { key: "csm", label: "CSM" }, { key: "status", label: "Status" }, { key: "after24h", label: "After 24h?", numeric: true },
    { key: "receivedAt", label: "Received" }, { key: "processedAt", label: "Delivered" }
  ];
  const numericVinKeys = new Set(["after24h"]);

  const handleDownload = () => {
    const headers = ["VIN", "Enterprise ID", "Enterprise", "Rooftop ID", "Rooftop", "Type", "CSM", "Status", "After 24h?", "Received", "Delivered"];
    const rows = sorted.map(d => [d.vin, d.enterpriseId, d.enterprise, d.rooftopId, d.rooftop, d.rooftopType, d.csm, d.status, isAfter24h(d) ? "Yes" : "No", new Date(d.receivedAt).toLocaleString(), d.processedAt ? new Date(d.processedAt).toLocaleString() : ""]);
    downloadCSV("vin-data.csv", headers, rows);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <DownloadButton onClick={handleDownload} />
      </div>
      <FilterBar filters={filters} setFilters={setFilters} rooftopOptions={rooftopOptions} typeOptions={typeOptions} csmOptions={csmOptions} />
      <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              {cols.map(c => (
                <th key={c.key} onClick={() => handleSort(c.key)} style={{ padding: "10px 14px", textAlign: c.numeric ? "center" : "left", fontWeight: 600, color: "#374151", borderBottom: "2px solid #e5e7eb", whiteSpace: "normal", cursor: "pointer", userSelect: "none" }}>
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
                <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 12, borderBottom: "1px solid #f3f4f6" }}>{d.vin}</td>
                <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 12, borderBottom: "1px solid #f3f4f6", color: "#0ea5e9", fontWeight: 600 }}>{d.enterpriseId}</td>
                <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6" }}>{d.enterprise}</td>
                <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 12, borderBottom: "1px solid #f3f4f6", color: "#6366f1", fontWeight: 600 }}>{d.rooftopId}</td>
                <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6" }}>{d.rooftop}</td>
                <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6" }}><Badge label={d.rooftopType} color={d.rooftopType === "Franchise" ? "blue" : "gray"} /></td>
                <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6" }}>{d.csm}</td>
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
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  const types = [...new Set(allRooftops.map(r => r.type))].sort();
  const csms = [...new Set(allRooftops.map(r => r.csm))].sort();

  const filtered = useMemo(() => allRooftops.filter(r => {
    if (filters.rooftopType && r.type !== filters.rooftopType) return false;
    if (filters.csm && r.csm !== filters.csm) return false;
    if (filters.search) {
      const s = filters.search.toLowerCase();
      if (!r.name.toLowerCase().includes(s) && !r.csm.toLowerCase().includes(s)) return false;
    }
    return true;
  }), [allRooftops, filters]);

  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    return [...filtered].sort((a, b) => {
      const va = a[sortCol], vb = b[sortCol];
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === "asc" ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
  }, [filtered, sortCol, sortDir]);

  const handleSort = col => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const activeCount = [filters.rooftopType, filters.csm].filter(Boolean).length;
  const sel = { padding: "7px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, background: "#fff", minWidth: 130, outline: "none" };
  const activeSel = v => v ? { ...sel, borderColor: "#818cf8", background: "#eef2ff" } : sel;

  const cols = [
    { key: "name", label: "Rooftop Name" }, { key: "type", label: "Type" }, { key: "csm", label: "CSM" },
    { key: "total", label: "Total Inventory", numeric: true }, { key: "processed", label: "VIN Delivered", numeric: true },
    { key: "processedAfter24", label: "Delivered VINs >24h", numeric: true }, { key: "notProcessed", label: "Pending VINs", numeric: true },
    { key: "notProcessedAfter24", label: "Pending VINs >24h", numeric: true },
  ];

  const tdStyle = { padding: "10px 14px", borderBottom: "1px solid #f3f4f6" };

  const handleDownload = () => {
    const headers = ["Rooftop Name", "Type", "CSM", "Total Inventory", "VIN Delivered", "Delivered VINs >24h", "Pending VINs", "Pending VINs >24h"];
    const rows = sorted.map(r => [r.name, r.type, r.csm, r.total, r.processed, r.processedAfter24, r.notProcessed, r.notProcessedAfter24]);
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
          <select value={filters.rooftopType || ""} onChange={e => setFilters(f => ({ ...f, rooftopType: e.target.value || null }))} style={activeSel(filters.rooftopType)}>
            <option value="">All Types</option>
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filters.csm || ""} onChange={e => setFilters(f => ({ ...f, csm: e.target.value || null }))} style={activeSel(filters.csm)}>
            <option value="">All CSMs</option>
            {csms.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {activeCount > 0 && (
            <button onClick={() => setFilters({ search: "", rooftopType: null, csm: null })}
              style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #fca5a5", background: "#fef2f2", color: "#dc2626", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
              Clear {activeCount} filter{activeCount > 1 ? "s" : ""}
            </button>
          )}
        </div>
        {activeCount > 0 && (
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {filters.rooftopType && <Badge label={`Type: ${filters.rooftopType}`} color="blue" />}
            {filters.csm && <Badge label={`CSM: ${filters.csm}`} color="blue" />}
          </div>
        )}
      </div>
      <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              {cols.map(c => (
                <th key={c.key} onClick={() => handleSort(c.key)} style={{ padding: "10px 14px", textAlign: c.numeric ? "center" : "left", fontWeight: 600, color: "#374151", borderBottom: "2px solid #e5e7eb", whiteSpace: "normal", cursor: "pointer", userSelect: "none" }}>
                  {c.label} {sortCol === c.key ? (sortDir === "asc" ? "↑" : "↓") : <span style={{ color: "#d1d5db" }}>↕</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>No records match the current filters.</td></tr>
            )}
            {sorted.map((r, i) => (
              <tr key={r.name} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{r.name}</td>
                <td style={tdStyle}><Badge label={r.type} color={r.type === "Franchise" ? "blue" : "gray"} /></td>
                <td style={tdStyle}>{r.csm}</td>
                <td style={{ ...tdStyle, textAlign: "center" }}><ClickableNum value={r.total} color="#4f46e5" onClick={() => onDrillDown({ rooftop: r.name })} /></td>
                <td style={{ ...tdStyle, textAlign: "center" }}><ClickableNum value={r.processed} color="#166534" onClick={() => onDrillDown({ rooftop: r.name, status: "Delivered" })} /></td>
                <td style={{ ...tdStyle, textAlign: "center" }}>
                  {r.processedAfter24 > 0
                    ? <span onClick={() => onDrillDown({ rooftop: r.name, status: "Delivered", after24h: true })} style={{ cursor: "pointer" }}><Badge label={r.processedAfter24} color="amber" /></span>
                    : <span style={{ color: "#9ca3af" }}>0</span>}
                </td>
                <td style={{ ...tdStyle, textAlign: "center" }}><ClickableNum value={r.notProcessed} color="#991b1b" onClick={() => onDrillDown({ rooftop: r.name, status: "Not Delivered" })} /></td>
                <td style={{ ...tdStyle, textAlign: "center" }}>
                  {r.notProcessedAfter24 > 0
                    ? <span onClick={() => onDrillDown({ rooftop: r.name, status: "Not Delivered", after24h: true })} style={{ cursor: "pointer" }}><Badge label={r.notProcessedAfter24} color="red" /></span>
                    : <span style={{ color: "#9ca3af" }}>0</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: "#9ca3af" }}>Showing {sorted.length} of {allRooftops.length} rooftops</div>
    </div>
  );
}

function EnterpriseTab({ enterprises, onDrillDown }) {

  const tdStyle = { padding: "10px 14px", borderBottom: "1px solid #f3f4f6" };

  const handleDownload = () => {
    const headers = ["Enterprise ID", "Enterprise Name", "Total Inventory", "VIN Delivered", "Delivered VINs >24h", "Pending VINs", "Pending VINs >24h", "Pending VINs >24h %"];
    const rows = enterprises.map(r => [r.id, r.name, r.total, r.processed, r.processedAfter24, r.notProcessed, r.notProcessedAfter24, r.total === 0 ? 0 : ((r.notProcessedAfter24 / r.total) * 100).toFixed(0)]);
    downloadCSV("enterprise-view.csv", headers, rows);
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
            {["Enterprise ID", "Enterprise Name", "Total Inventory", "VIN Delivered", "Delivered VINs >24h", "Pending VINs", "Pending VINs >24h", "Pending VINs >24h %"].map((h, idx) => (
              <th key={h} style={{ padding: "10px 14px", textAlign: idx >= 2 ? "center" : "left", fontWeight: 600, color: "#374151", borderBottom: "2px solid #e5e7eb", whiteSpace: "normal" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {enterprises.map((r, i) => {
            const rate = r.total === 0 ? 0 : (r.notProcessedAfter24 / r.total) * 100;
            return (
              <tr key={r.id} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12, color: "#0ea5e9", fontWeight: 600 }}>{r.id}</td>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{r.name}</td>
                <td style={{ ...tdStyle, textAlign: "center" }}><ClickableNum value={r.total} color="#4f46e5" onClick={() => onDrillDown({ enterprise: r.name })} /></td>
                <td style={{ ...tdStyle, textAlign: "center" }}><ClickableNum value={r.processed} color="#166534" onClick={() => onDrillDown({ enterprise: r.name, status: "Delivered" })} /></td>
                <td style={{ ...tdStyle, textAlign: "center" }}>
                  {r.processedAfter24 > 0
                    ? <span onClick={() => onDrillDown({ enterprise: r.name, status: "Delivered", after24h: true })} style={{ cursor: "pointer" }}><Badge label={r.processedAfter24} color="amber" /></span>
                    : <span style={{ color: "#9ca3af" }}>0</span>}
                </td>
                <td style={{ ...tdStyle, textAlign: "center" }}><ClickableNum value={r.notProcessed} color="#991b1b" onClick={() => onDrillDown({ enterprise: r.name, status: "Not Delivered" })} /></td>
                <td style={{ ...tdStyle, textAlign: "center" }}>
                  {r.notProcessedAfter24 > 0
                    ? <span onClick={() => onDrillDown({ enterprise: r.name, status: "Not Delivered", after24h: true })} style={{ cursor: "pointer" }}><Badge label={r.notProcessedAfter24} color="red" /></span>
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
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
                <td style={{ ...tdStyle, fontWeight: 600 }}>{r.name}</td>
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

function OverviewTab({ totals, byType, byCSM, onDrillDown, onRooftopDrillDown }) {

  function SummaryTable({ title, rows, colorHeader, filterKey, onRooftopDrillDown, scrollable = false }) {
    const totRow = rows.reduce((t, r) => ({
      total: t.total + r.total, processed: t.processed + r.processed, processedAfter24: t.processedAfter24 + r.processedAfter24,
      notProcessed: t.notProcessed + r.notProcessed, notProcessedAfter24: t.notProcessedAfter24 + r.notProcessedAfter24,
      rooftopCount: t.rooftopCount + r.rooftopCount,
    }), { total: 0, processed: 0, processedAfter24: 0, notProcessed: 0, notProcessedAfter24: 0, rooftopCount: 0 });
    const totRate = totRow.total === 0 ? 0 : (totRow.notProcessedAfter24 / totRow.total) * 100;
    const nameCol = filterKey === "rooftopType" ? "Rooftop Type" : "CSM Name";
    const td = { padding: "10px 14px", borderBottom: "1px solid #f3f4f6" };
    const totTd = { padding: "10px 14px", background: "#f9fafb", fontWeight: 700, borderTop: "2px solid #e5e7eb" };
    return (
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1f2937", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 4, height: 20, borderRadius: 2, background: colorHeader, display: "inline-block" }} />
            {title}
          </h3>
          <DownloadButton onClick={() => {
            const nameCol = filterKey === "rooftopType" ? "Rooftop Type" : "CSM Name";
            const headers = [nameCol, "Rooftops", "Total", "Delivered", "Delivered VINs >24h", "Pending VINs", "Pending VINs >24h", "Pending VINs >24h %"];
            const csvRows = rows.map(r => [r.label, r.rooftopCount, r.total, r.processed, r.processedAfter24, r.notProcessed, r.notProcessedAfter24, r.total === 0 ? 0 : ((r.notProcessedAfter24 / r.total) * 100).toFixed(0)]);
            downloadCSV(`overview-${filterKey}.csv`, headers, csvRows);
          }} />
        </div>
        <div style={{ borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden" }}>
          <div style={{ overflowX: "auto", ...(scrollable ? { maxHeight: 260, overflowY: "auto" } : {}) }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ position: scrollable ? "sticky" : "static", top: 0, zIndex: 1 }}>
                <tr style={{ background: "#f9fafb" }}>
                  {[nameCol, "Rooftops", "Total", "Delivered", "Delivered VINs >24h", "Pending VINs", "Pending VINs >24h", "Pending VINs >24h %"].map((h, idx) => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: idx >= 1 ? "center" : "left", fontWeight: 600, color: "#374151", borderBottom: "2px solid #e5e7eb", whiteSpace: "normal", background: "#f9fafb" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const rate = r.total === 0 ? 0 : (r.notProcessedAfter24 / r.total) * 100;
                  const base = { [filterKey]: r.label };
                  return (
                    <tr key={r.label} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                      <td style={{ ...td, fontWeight: 600 }}>
                        <span onClick={() => onRooftopDrillDown({ [filterKey]: r.label })} title="Click to view in Rooftop View"
                          style={{ cursor: "pointer", color: "#111827", textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 3 }}
                          onMouseEnter={e => (e.currentTarget.style.color = "#4f46e5")} onMouseLeave={e => (e.currentTarget.style.color = "#111827")}>
                          {r.label}
                        </span>
                      </td>
                      <td style={{ ...td, textAlign: "center", color: "#6b7280" }}>{r.rooftopCount?.toLocaleString()}</td>
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
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
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
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 14, marginBottom: 28, flexWrap: "wrap" }}>
        <StatCard label="Total Inventory" value={totals.total} color="#6366f1" onClick={() => onDrillDown({})} />
        <StatCard label="VIN Delivered" value={totals.processed} sub={`${((totals.processed / totals.total) * 100).toFixed(0)}% of total`} color="#22c55e" onClick={() => onDrillDown({ status: "Delivered" })} />
        <StatCard label="Pending VINs" value={totals.notProcessed} sub={totals.total > 0 ? `${((totals.notProcessed / totals.total) * 100).toFixed(0)}% of total` : ""} color="#ef4444" onClick={() => onDrillDown({ status: "Not Delivered" })} />
        <StatCard label="Pending VINs >24h" value={totals.notProcessedAfter24} sub={totals.total > 0 ? `${((totals.notProcessedAfter24 / totals.total) * 100).toFixed(0)}% of total` : ""} color="#f59e0b" onClick={() => onDrillDown({ status: "Not Delivered", after24h: true })} />
      </div>
      <SummaryTable title="By Rooftop Type" rows={byType} colorHeader="#6366f1" filterKey="rooftopType" onRooftopDrillDown={onRooftopDrillDown} />
      <SummaryTable title="By CSM" rows={byCSM} colorHeader="#0ea5e9" filterKey="csm" onRooftopDrillDown={onRooftopDrillDown} scrollable={true} />
    </div>
  );
}

const DEFAULT_FILTERS = { search: "", rooftop: null, rooftopType: null, csm: null, status: null, after24h: null };
const DEFAULT_ROOFTOP_FILTERS = { search: "", rooftopType: null, csm: null };

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

  const tabs = ["Overview", "Rooftop View", "VIN Data"];

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
    if (filters.search)     params.set("search",      filters.search);
    if (filters.rooftop)    params.set("rooftop",     filters.rooftop);
    if (filters.rooftopType)params.set("rooftopType", filters.rooftopType);
    if (filters.csm)        params.set("csm",         filters.csm);
    if (filters.status)     params.set("status",      filters.status);
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

  // On mount: load summary; auto-sync if DB is empty
  useEffect(() => {
    loadSummary()
      .then(json => {
        if (!json) syncNow(); else setLoading(false);
      })
      .catch(err => { setFetchError(err.message); setLoading(false); });
  }, []);

  // Load raw page when switching to VIN Data tab or when filters/page change
  useEffect(() => {
    if (tab === "VIN Data") loadRawPage(rawPage, rawFilters);
  }, [tab, rawPage, rawFilters]);

  // Sync from Metabase → refresh summary
  const syncNow = useCallback(() => {
    setSyncing(true);
    setFetchError(null);
    fetch("/api/sync", { method: "POST" })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(({ error, syncedAt }) => {
        if (error) throw new Error(error);
        setLastSync(syncedAt);
        return loadSummary();
      })
      .then(() => { setSyncing(false); setLoading(false); })
      .catch(err => { setFetchError(err.message); setSyncing(false); setLoading(false); });
  }, [loadSummary]);

  const s = summary ?? EMPTY_SUMMARY;

  // Derive filter dropdown options from summary data (full dataset)
  const rooftopOptions = useMemo(() => [...new Set((s.byRooftop ?? []).map((r: any) => r.name))].sort() as string[], [s.byRooftop]);
  const typeOptions    = useMemo(() => [...new Set((s.byRooftop ?? []).map((r: any) => r.type))].sort() as string[], [s.byRooftop]);
  const csmOptions     = useMemo(() => [...new Set((s.byCSM    ?? []).map((r: any) => r.name))].sort() as string[], [s.byCSM]);

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
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", maxWidth: 1200, margin: "0 auto", padding: 20 }}>
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>VIN Inventory Dashboard</h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>Tracking VIN processing across rooftops and CSMs — click any number to drill down</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 4 }}>
          {(loading || syncing) && <span style={{ fontSize: 12, color: "#6b7280" }}>⟳ {loading ? "Loading…" : "Syncing from Metabase…"}</span>}
          {!loading && !syncing && fetchError && <span style={{ fontSize: 12, color: "#dc2626" }} title={fetchError}>⚠ {fetchError}</span>}
          {!loading && !syncing && summary && (
            <span style={{ fontSize: 12, color: "#16a34a" }}>
              ● {(summary?.totalRows ?? 0).toLocaleString()} records
              {lastSync && <span style={{ color: "#9ca3af" }}> · synced {new Date(lastSync).toLocaleTimeString()}</span>}
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
          <button key={t} onClick={() => { setTab(t); if (t !== "VIN Data") setRawFilters(DEFAULT_FILTERS); if (t !== "Rooftop View") setRooftopFilters(DEFAULT_ROOFTOP_FILTERS); }} style={{
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
        />
      )}
    </div>
  );
}
