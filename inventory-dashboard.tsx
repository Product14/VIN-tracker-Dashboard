import { useState, useMemo, useCallback } from "react";

const SAMPLE_DATA = [
  { vin: "1HGCM82633A004352", rooftop: "Downtown Auto", rooftopType: "Franchise", csm: "Sarah Miller", status: "Processed", processedAt: "2026-04-06T10:30:00", receivedAt: "2026-04-06T08:00:00" },
  { vin: "2T1BURHE0JC123456", rooftop: "Downtown Auto", rooftopType: "Franchise", csm: "Sarah Miller", status: "Processed", processedAt: "2026-04-05T14:00:00", receivedAt: "2026-04-04T09:00:00" },
  { vin: "3VWDX7AJ5DM654321", rooftop: "Westside Motors", rooftopType: "Independent", csm: "James Cooper", status: "Not Processed", processedAt: null, receivedAt: "2026-04-06T11:00:00" },
  { vin: "5YFBURHE4JP789012", rooftop: "Westside Motors", rooftopType: "Independent", csm: "James Cooper", status: "Processed", processedAt: "2026-04-06T16:00:00", receivedAt: "2026-04-06T07:00:00" },
  { vin: "1G1YY22G965109876", rooftop: "Westside Motors", rooftopType: "Independent", csm: "James Cooper", status: "Not Processed", processedAt: null, receivedAt: "2026-04-05T06:00:00" },
  { vin: "JH4KA8260MC543210", rooftop: "Northgate Dealers", rooftopType: "Franchise", csm: "Sarah Miller", status: "Processed", processedAt: "2026-04-07T02:00:00", receivedAt: "2026-04-06T01:00:00" },
  { vin: "WVWZZZ3CZWE112233", rooftop: "Northgate Dealers", rooftopType: "Franchise", csm: "Sarah Miller", status: "Not Processed", processedAt: null, receivedAt: "2026-04-07T08:00:00" },
  { vin: "1FTFW1ET5DFA44556", rooftop: "Southpark Auto", rooftopType: "Independent", csm: "Lisa Chang", status: "Processed", processedAt: "2026-04-06T20:00:00", receivedAt: "2026-04-06T09:00:00" },
  { vin: "2GCEC19T441778899", rooftop: "Southpark Auto", rooftopType: "Independent", csm: "Lisa Chang", status: "Not Processed", processedAt: null, receivedAt: "2026-04-05T14:00:00" },
  { vin: "3N1AB7AP4GY990011", rooftop: "Southpark Auto", rooftopType: "Independent", csm: "Lisa Chang", status: "Processed", processedAt: "2026-04-07T06:00:00", receivedAt: "2026-04-07T04:00:00" },
  { vin: "KNDJP3A56H7223344", rooftop: "Eastend Cars", rooftopType: "Franchise", csm: "Lisa Chang", status: "Not Processed", processedAt: null, receivedAt: "2026-04-06T05:00:00" },
  { vin: "4T1BF1FK5CU556677", rooftop: "Eastend Cars", rooftopType: "Franchise", csm: "Lisa Chang", status: "Processed", processedAt: "2026-04-06T12:00:00", receivedAt: "2026-04-06T06:00:00" },
  { vin: "1N4AL3AP8DC889900", rooftop: "Central Auto Group", rooftopType: "Franchise", csm: "James Cooper", status: "Processed", processedAt: "2026-04-05T22:00:00", receivedAt: "2026-04-05T08:00:00" },
  { vin: "5XYZUDLA1DG112244", rooftop: "Central Auto Group", rooftopType: "Franchise", csm: "James Cooper", status: "Not Processed", processedAt: null, receivedAt: "2026-04-04T10:00:00" },
  { vin: "JM1BK32F781335566", rooftop: "Central Auto Group", rooftopType: "Franchise", csm: "James Cooper", status: "Processed", processedAt: "2026-04-06T09:00:00", receivedAt: "2026-04-06T07:30:00" },
  { vin: "WBAPH5C55BA778899", rooftop: "Valley Rides", rooftopType: "Independent", csm: "Sarah Miller", status: "Not Processed", processedAt: null, receivedAt: "2026-04-07T07:00:00" },
  { vin: "1ZVBP8AM7D5990011", rooftop: "Valley Rides", rooftopType: "Independent", csm: "Sarah Miller", status: "Processed", processedAt: "2026-04-06T18:00:00", receivedAt: "2026-04-05T10:00:00" },
  { vin: "2C3CDXCT1EH223344", rooftop: "Valley Rides", rooftopType: "Independent", csm: "Sarah Miller", status: "Processed", processedAt: "2026-04-07T01:00:00", receivedAt: "2026-04-06T22:00:00" },
];

const NOW = new Date("2026-04-07T12:00:00");
const H24 = 24 * 60 * 60 * 1000;

function isAfter24h(item) {
  if (item.status === "Processed") return (new Date(item.processedAt) - new Date(item.receivedAt)) > H24;
  return (NOW - new Date(item.receivedAt)) > H24;
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
  return <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>{label}</span>;
}

function ClickableNum({ value, color, onClick, title }) {
  return (
    <span onClick={onClick} title={title || "Click to view in Raw tab"} style={{ color, fontWeight: 700, cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 3, transition: "opacity 0.15s" }}
      onMouseEnter={e => e.target.style.opacity = 0.7} onMouseLeave={e => e.target.style.opacity = 1}>
      {value}
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
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{sub}</div>}
      {interactive && <div style={{ fontSize: 11, color: "#a5b4fc", marginTop: 6 }}>Click to view details →</div>}
    </div>
  );
}

function FilterBar({ filters, setFilters, data }) {
  const rooftops = [...new Set(data.map(d => d.rooftop))].sort();
  const types = [...new Set(data.map(d => d.rooftopType))].sort();
  const csms = [...new Set(data.map(d => d.csm))].sort();
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
          <option value="Processed">Processed</option>
          <option value="Not Processed">Not Processed</option>
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
          {filters.status && <Badge label={`Status: ${filters.status}`} color={filters.status === "Processed" ? "green" : "red"} />}
          {filters.after24h !== null && <Badge label={filters.after24h ? "After 24h" : "Within 24h"} color="amber" />}
        </div>
      )}
    </div>
  );
}

function RawTab({ data, filters, setFilters }) {
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const filtered = applyRawFilters(data, filters);

  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    return [...filtered].sort((a, b) => {
      let va = a[sortCol], vb = b[sortCol];
      if (sortCol === "after24h") { va = isAfter24h(a); vb = isAfter24h(b); }
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === "asc" ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
  }, [filtered, sortCol, sortDir]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const cols = [
    { key: "vin", label: "VIN" }, { key: "rooftop", label: "Rooftop" }, { key: "rooftopType", label: "Type" },
    { key: "csm", label: "CSM" }, { key: "status", label: "Status" }, { key: "after24h", label: "After 24h?" },
    { key: "receivedAt", label: "Received" }, { key: "processedAt", label: "Processed" }
  ];

  return (
    <div>
      <FilterBar filters={filters} setFilters={setFilters} data={data} />
      <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              {cols.map(c => (
                <th key={c.key} onClick={() => handleSort(c.key)} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "#374151", borderBottom: "2px solid #e5e7eb", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" }}>
                  {c.label} {sortCol === c.key ? (sortDir === "asc" ? "↑" : "↓") : <span style={{ color: "#d1d5db" }}>↕</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>No records match the current filters.</td></tr>
            )}
            {sorted.map((d, i) => (
              <tr key={d.vin} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 12, borderBottom: "1px solid #f3f4f6" }}>{d.vin}</td>
                <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6" }}>{d.rooftop}</td>
                <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6" }}><Badge label={d.rooftopType} color={d.rooftopType === "Franchise" ? "blue" : "gray"} /></td>
                <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6" }}>{d.csm}</td>
                <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6" }}><Badge label={d.status} color={d.status === "Processed" ? "green" : "red"} /></td>
                <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6" }}>{isAfter24h(d) ? <Badge label="Yes" color="amber" /> : <Badge label="No" color="green" />}</td>
                <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap", fontSize: 12 }}>{new Date(d.receivedAt).toLocaleString()}</td>
                <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap", fontSize: 12 }}>{d.processedAt ? new Date(d.processedAt).toLocaleString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: "#9ca3af" }}>Showing {sorted.length} of {data.length} records</div>
    </div>
  );
}

function RooftopTab({ data, onDrillDown }) {
  const rooftops = useMemo(() => {
    const map = {};
    data.forEach(d => {
      if (!map[d.rooftop]) map[d.rooftop] = { name: d.rooftop, type: d.rooftopType, csm: d.csm, total: 0, processed: 0, processedAfter24: 0, notProcessed: 0, notProcessedAfter24: 0 };
      const r = map[d.rooftop]; r.total++;
      if (d.status === "Processed") { r.processed++; if (isAfter24h(d)) r.processedAfter24++; }
      else { r.notProcessed++; if (isAfter24h(d)) r.notProcessedAfter24++; }
    });
    return Object.values(map);
  }, [data]);

  return (
    <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid #e5e7eb" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#f9fafb" }}>
            {["Rooftop Name", "Type", "CSM", "Total Inventory", "VIN Processed", "Processed >24h", "VIN Not Processed", "Not Processed >24h"].map(h => (
              <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "#374151", borderBottom: "2px solid #e5e7eb", whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rooftops.map((r, i) => (
            <tr key={r.name} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
              <td style={{ padding: "10px 14px", fontWeight: 600, borderBottom: "1px solid #f3f4f6" }}>{r.name}</td>
              <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6" }}><Badge label={r.type} color={r.type === "Franchise" ? "blue" : "gray"} /></td>
              <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6" }}>{r.csm}</td>
              <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6" }}>
                <ClickableNum value={r.total} color="#4f46e5" onClick={() => onDrillDown({ rooftop: r.name })} />
              </td>
              <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6" }}>
                <ClickableNum value={r.processed} color="#166534" onClick={() => onDrillDown({ rooftop: r.name, status: "Processed" })} />
              </td>
              <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6" }}>
                {r.processedAfter24 > 0
                  ? <span onClick={() => onDrillDown({ rooftop: r.name, status: "Processed", after24h: true })} style={{ cursor: "pointer" }}><Badge label={r.processedAfter24} color="amber" /></span>
                  : <span style={{ color: "#9ca3af" }}>0</span>}
              </td>
              <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6" }}>
                <ClickableNum value={r.notProcessed} color="#991b1b" onClick={() => onDrillDown({ rooftop: r.name, status: "Not Processed" })} />
              </td>
              <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6" }}>
                {r.notProcessedAfter24 > 0
                  ? <span onClick={() => onDrillDown({ rooftop: r.name, status: "Not Processed", after24h: true })} style={{ cursor: "pointer" }}><Badge label={r.notProcessedAfter24} color="red" /></span>
                  : <span style={{ color: "#9ca3af" }}>0</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OverviewTab({ data, onDrillDown }) {
  const byType = useMemo(() => {
    const map = {};
    data.forEach(d => {
      if (!map[d.rooftopType]) map[d.rooftopType] = { label: d.rooftopType, total: 0, processed: 0, processedAfter24: 0, notProcessed: 0, notProcessedAfter24: 0 };
      const r = map[d.rooftopType]; r.total++;
      if (d.status === "Processed") { r.processed++; if (isAfter24h(d)) r.processedAfter24++; }
      else { r.notProcessed++; if (isAfter24h(d)) r.notProcessedAfter24++; }
    });
    return Object.values(map);
  }, [data]);

  const byCSM = useMemo(() => {
    const map = {};
    data.forEach(d => {
      if (!map[d.csm]) map[d.csm] = { label: d.csm, total: 0, processed: 0, processedAfter24: 0, notProcessed: 0, notProcessedAfter24: 0 };
      const r = map[d.csm]; r.total++;
      if (d.status === "Processed") { r.processed++; if (isAfter24h(d)) r.processedAfter24++; }
      else { r.notProcessed++; if (isAfter24h(d)) r.notProcessedAfter24++; }
    });
    return Object.values(map);
  }, [data]);

  const totals = useMemo(() => {
    let t = { total: 0, processed: 0, notProcessed: 0, processedAfter24: 0, notProcessedAfter24: 0 };
    data.forEach(d => {
      t.total++;
      if (d.status === "Processed") { t.processed++; if (isAfter24h(d)) t.processedAfter24++; }
      else { t.notProcessed++; if (isAfter24h(d)) t.notProcessedAfter24++; }
    });
    return t;
  }, [data]);

  function SummaryTable({ title, rows, colorHeader, filterKey }) {
    return (
      <div style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1f2937", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 4, height: 20, borderRadius: 2, background: colorHeader, display: "inline-block" }} />
          {title}
        </h3>
        <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid #e5e7eb" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                {[filterKey === "rooftopType" ? "Rooftop Type" : "CSM Name", "Total", "Processed", "Processed >24h", "Not Processed", "Not Processed >24h", "Processing Rate"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "#374151", borderBottom: "2px solid #e5e7eb", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const rate = r.total === 0 ? 0 : (r.processed / r.total) * 100;
                const base = { [filterKey]: r.label };
                return (
                  <tr key={r.label} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 600, borderBottom: "1px solid #f3f4f6" }}>{r.label}</td>
                    <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6" }}>
                      <ClickableNum value={r.total} color="#4f46e5" onClick={() => onDrillDown(base)} />
                    </td>
                    <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6" }}>
                      <ClickableNum value={r.processed} color="#166534" onClick={() => onDrillDown({ ...base, status: "Processed" })} />
                    </td>
                    <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6" }}>
                      {r.processedAfter24 > 0
                        ? <span onClick={() => onDrillDown({ ...base, status: "Processed", after24h: true })} style={{ cursor: "pointer" }}><Badge label={r.processedAfter24} color="amber" /></span>
                        : "0"}
                    </td>
                    <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6" }}>
                      <ClickableNum value={r.notProcessed} color="#991b1b" onClick={() => onDrillDown({ ...base, status: "Not Processed" })} />
                    </td>
                    <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6" }}>
                      {r.notProcessedAfter24 > 0
                        ? <span onClick={() => onDrillDown({ ...base, status: "Not Processed", after24h: true })} style={{ cursor: "pointer" }}><Badge label={r.notProcessedAfter24} color="red" /></span>
                        : "0"}
                    </td>
                    <td style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 80, height: 8, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ width: `${rate}%`, height: "100%", background: rate >= 70 ? "#22c55e" : rate >= 50 ? "#eab308" : "#ef4444", borderRadius: 4 }} />
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

  return (
    <div>
      <div style={{ display: "flex", gap: 14, marginBottom: 28, flexWrap: "wrap" }}>
        <StatCard label="Total Inventory" value={totals.total} color="#6366f1" onClick={() => onDrillDown({})} />
        <StatCard label="VIN Processed" value={totals.processed} sub={`${((totals.processed / totals.total) * 100).toFixed(0)}% of total`} color="#22c55e" onClick={() => onDrillDown({ status: "Processed" })} />
        <StatCard label="VIN Not Processed" value={totals.notProcessed} sub={`${totals.notProcessedAfter24} over 24h`} color="#ef4444" onClick={() => onDrillDown({ status: "Not Processed" })} />
        <StatCard label="Processed >24h" value={totals.processedAfter24} color="#f59e0b" onClick={() => onDrillDown({ status: "Processed", after24h: true })} />
      </div>
      <SummaryTable title="By Rooftop Type" rows={byType} colorHeader="#6366f1" filterKey="rooftopType" />
      <SummaryTable title="By CSM" rows={byCSM} colorHeader="#0ea5e9" filterKey="csm" />
    </div>
  );
}

const DEFAULT_FILTERS = { search: "", rooftop: null, rooftopType: null, csm: null, status: null, after24h: null };

export default function Dashboard() {
  const [tab, setTab] = useState("Overview");
  const [rawFilters, setRawFilters] = useState(DEFAULT_FILTERS);
  const tabs = ["Overview", "Rooftop", "Raw"];

  const handleDrillDown = useCallback((filters) => {
    setRawFilters({ ...DEFAULT_FILTERS, ...filters });
    setTab("Raw");
  }, []);

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", maxWidth: 1100, margin: "0 auto", padding: 20 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>VIN Inventory Dashboard</h1>
        <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>Tracking VIN processing across rooftops and CSMs — click any number to drill down</p>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "#f3f4f6", borderRadius: 10, padding: 4, width: "fit-content" }}>
        {tabs.map(t => (
          <button key={t} onClick={() => { setTab(t); if (t !== "Raw") setRawFilters(DEFAULT_FILTERS); }} style={{
            padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600,
            background: tab === t ? "#fff" : "transparent", color: tab === t ? "#111827" : "#6b7280",
            boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,0.1)" : "none", transition: "all 0.15s"
          }}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && <OverviewTab data={SAMPLE_DATA} onDrillDown={handleDrillDown} />}
      {tab === "Rooftop" && <RooftopTab data={SAMPLE_DATA} onDrillDown={handleDrillDown} />}
      {tab === "Raw" && <RawTab data={SAMPLE_DATA} filters={rawFilters} setFilters={setRawFilters} />}
    </div>
  );
}
