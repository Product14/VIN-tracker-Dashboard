import React, { useState, useMemo } from "react";

// ─── Sample Data ─────────────────────────────────────────────────────────────

interface ChurnIssue {
  id: string;
  rooftop: string;
  rooftopId: string;
  enterprise: string;
  csm: string;
  arr: number;
  issueType: string;
  status: "Open" | "In Progress" | "Resolved" | "Escalated";
  priority: "Critical" | "High" | "Medium" | "Low";
  createdAt: string;
  daysOpen: number;
  description: string;
  // VIN metrics (from VIN Inventory — in production, join by rooftopId)
  vinTotal: number;
  vinPending: number;
  vinPendingOver24: number;
}

const ISSUES: ChurnIssue[] = [
  { id: "CHN-001", rooftop: "Downtown Auto", rooftopId: "RT-001", enterprise: "Metro Auto Group", csm: "Sarah Miller", arr: 96000, issueType: "Churn Risk", status: "Escalated", priority: "Critical", createdAt: "2026-03-10", daysOpen: 35, description: "CEO expressed intent to cancel. Unhappy with delivery rates and support response time.", vinTotal: 48, vinPending: 14, vinPendingOver24: 8 },
  { id: "CHN-002", rooftop: "Westside Motors", rooftopId: "RT-002", enterprise: "Westside Holdings", csm: "James Cooper", arr: 72000, issueType: "Integration Failure", status: "In Progress", priority: "High", createdAt: "2026-03-28", daysOpen: 17, description: "IMS integration down since March 28. VINs not flowing through to publishing.", vinTotal: 63, vinPending: 22, vinPendingOver24: 15 },
  { id: "CHN-003", rooftop: "Northgate Dealers", rooftopId: "RT-003", enterprise: "Metro Auto Group", csm: "Sarah Miller", arr: 84000, issueType: "Low Usage", status: "Open", priority: "High", createdAt: "2026-04-01", daysOpen: 13, description: "Login activity dropped 60% over the past 30 days. Staff turnover suspected.", vinTotal: 31, vinPending: 9, vinPendingOver24: 4 },
  { id: "CHN-004", rooftop: "Southpark Auto", rooftopId: "RT-004", enterprise: "Southpark Automotive LLC", csm: "Lisa Chang", arr: 48000, issueType: "Billing Dispute", status: "Open", priority: "Medium", createdAt: "2026-04-03", daysOpen: 11, description: "Disputing last 2 invoices. Claims credits for downtime were not applied.", vinTotal: 27, vinPending: 6, vinPendingOver24: 2 },
  { id: "CHN-005", rooftop: "Eastend Cars", rooftopId: "RT-005", enterprise: "Eastend Motor Corp", csm: "Lisa Chang", arr: 120000, issueType: "Renewal Risk", status: "Open", priority: "Critical", createdAt: "2026-03-20", daysOpen: 25, description: "Contract renewal in 30 days. Competitor evaluation ongoing. Needs executive engagement.", vinTotal: 89, vinPending: 31, vinPendingOver24: 19 },
  { id: "CHN-006", rooftop: "Central Auto Group", rooftopId: "RT-006", enterprise: "Central Auto Group", csm: "James Cooper", arr: 60000, issueType: "Support Escalation", status: "In Progress", priority: "High", createdAt: "2026-04-05", daysOpen: 9, description: "3 open P1 support tickets over 7 days. Publishing failures on 40+ VINs.", vinTotal: 42, vinPending: 18, vinPendingOver24: 11 },
  { id: "CHN-007", rooftop: "Valley Rides", rooftopId: "RT-007", enterprise: "Westside Holdings", csm: "Sarah Miller", arr: 36000, issueType: "Feature Gap", status: "Open", priority: "Low", createdAt: "2026-04-07", daysOpen: 7, description: "Requesting bulk upload feature. Will move to competitor if not delivered by Q3.", vinTotal: 19, vinPending: 4, vinPendingOver24: 1 },
  { id: "CHN-008", rooftop: "Premier Motors", rooftopId: "RT-008", enterprise: "Premier Holdings", csm: "Sarah Miller", arr: 108000, issueType: "Churn Risk", status: "Escalated", priority: "Critical", createdAt: "2026-03-25", daysOpen: 20, description: "GM directly contacted our VP. Delivery SLA repeatedly missed. Formal complaint filed.", vinTotal: 74, vinPending: 28, vinPendingOver24: 21 },
  { id: "CHN-009", rooftop: "Premier Motors", rooftopId: "RT-008", enterprise: "Premier Holdings", csm: "Sarah Miller", arr: 108000, issueType: "Integration Failure", status: "Resolved", priority: "High", createdAt: "2026-03-18", daysOpen: 5, description: "Resolved: API key rotation caused 5-day integration outage. Post-mortem sent.", vinTotal: 74, vinPending: 28, vinPendingOver24: 21 },
  { id: "CHN-010", rooftop: "Lakeview Auto", rooftopId: "RT-009", enterprise: "Lakeview Automotive", csm: "Lisa Chang", arr: 54000, issueType: "Low Usage", status: "Open", priority: "Medium", createdAt: "2026-04-02", daysOpen: 12, description: "Only 2 of 8 staff using the platform. Training sessions not completed.", vinTotal: 33, vinPending: 11, vinPendingOver24: 5 },
  { id: "CHN-011", rooftop: "Riverside Cars", rooftopId: "RT-010", enterprise: "Riverside Automotive", csm: "James Cooper", arr: 78000, issueType: "Renewal Risk", status: "In Progress", priority: "High", createdAt: "2026-03-30", daysOpen: 15, description: "Renewal call scheduled. Customer asking for 20% price reduction to renew.", vinTotal: 56, vinPending: 17, vinPendingOver24: 9 },
  { id: "CHN-012", rooftop: "Sunset Dealers", rooftopId: "RT-011", enterprise: "Sunset Auto Group", csm: "Lisa Chang", arr: 42000, issueType: "Billing Dispute", status: "Open", priority: "Medium", createdAt: "2026-04-06", daysOpen: 8, description: "Overcharge on March invoice. $2,400 in dispute. Awaiting finance approval for credit.", vinTotal: 24, vinPending: 8, vinPendingOver24: 3 },
  { id: "CHN-013", rooftop: "Northgate Dealers", rooftopId: "RT-003", enterprise: "Metro Auto Group", csm: "Sarah Miller", arr: 84000, issueType: "Support Escalation", status: "In Progress", priority: "High", createdAt: "2026-04-04", daysOpen: 10, description: "QC Hold backlog growing. 15 VINs stuck for over 72h. Team requesting priority review.", vinTotal: 31, vinPending: 9, vinPendingOver24: 4 },
  { id: "CHN-014", rooftop: "Eastend Cars", rooftopId: "RT-005", enterprise: "Eastend Motor Corp", csm: "Lisa Chang", arr: 120000, issueType: "Low Usage", status: "Open", priority: "Medium", createdAt: "2026-04-08", daysOpen: 6, description: "Photo shoot scheduling rate dropped to 40%. Staff citing platform complexity.", vinTotal: 89, vinPending: 31, vinPendingOver24: 19 },
  { id: "CHN-015", rooftop: "Summit Motors", rooftopId: "RT-012", enterprise: "Summit Auto", csm: "James Cooper", arr: 66000, issueType: "Feature Gap", status: "Open", priority: "Low", createdAt: "2026-04-09", daysOpen: 5, description: "Requested white-label portal access. Currently blocked by product roadmap.", vinTotal: 38, vinPending: 12, vinPendingOver24: 6 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString();
const fmtARR = (n: number) => `$${(n / 1000).toFixed(0)}K`;

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    Critical: { bg: "#fef2f2", text: "#991b1b", border: "#fecaca" },
    High:     { bg: "#fff7ed", text: "#9a3412", border: "#fed7aa" },
    Medium:   { bg: "#fffbeb", text: "#92400e", border: "#fde68a" },
    Low:      { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" },
  };
  const c = colors[priority] || colors.Low;
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
      {priority}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    Open:         { bg: "#eff6ff", text: "#1e40af", border: "#bfdbfe" },
    "In Progress":{ bg: "#faf5ff", text: "#6b21a8", border: "#e9d5ff" },
    Resolved:     { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" },
    Escalated:    { bg: "#fef2f2", text: "#991b1b", border: "#fecaca" },
  };
  const c = colors[status] || colors.Open;
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
      {status}
    </span>
  );
}

function IssueTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    "Churn Risk":         "#ef4444",
    "Renewal Risk":       "#f59e0b",
    "Integration Failure":"#8b5cf6",
    "Support Escalation": "#3b82f6",
    "Low Usage":          "#6b7280",
    "Billing Dispute":    "#ec4899",
    "Feature Gap":        "#14b8a6",
  };
  const color = colors[type] || "#6b7280";
  return (
    <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: color + "18", color, border: `1px solid ${color}30` }}>
      {type}
    </span>
  );
}

function SortIcon({ col, sortCol, sortDir }: { col: string; sortCol: string | null; sortDir: "asc" | "desc" }) {
  if (sortCol !== col) return <span style={{ color: "#d1d5db", fontSize: 10 }}>↕</span>;
  return <span style={{ color: "#6366f1", fontSize: 10 }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
}

function downloadCSV(filename: string, headers: string[], rows: any[][]) {
  const escape = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.map(escape).join(","), ...rows.map(r => r.map(escape).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const thStyle = (numeric = false, sorted = false): React.CSSProperties => ({
  padding: "10px 14px",
  textAlign: numeric ? "center" : "left",
  fontWeight: 600, fontSize: 12,
  color: sorted ? "#4f46e5" : "#374151",
  borderBottom: "2px solid #e5e7eb",
  whiteSpace: "normal",
  cursor: "pointer",
  userSelect: "none",
  background: "#f9fafb",
});
const tdBase: React.CSSProperties = { padding: "10px 14px", borderBottom: "1px solid #f3f4f6", fontSize: 13 };

// ─── View 1: Issue Level ──────────────────────────────────────────────────────

function IssueLevelView() {
  const [sortCol, setSortCol] = useState("arr");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterCSM, setFilterCSM] = useState("");

  const csms = useMemo(() => [...new Set(ISSUES.map(i => i.csm))].sort(), []);

  const sorted = useMemo(() => {
    let rows = ISSUES.filter(i => {
      if (filterStatus && i.status !== filterStatus) return false;
      if (filterPriority && i.priority !== filterPriority) return false;
      if (filterCSM && i.csm !== filterCSM) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!i.rooftop.toLowerCase().includes(s) && !i.enterprise.toLowerCase().includes(s) && !i.issueType.toLowerCase().includes(s) && !i.id.toLowerCase().includes(s)) return false;
      }
      return true;
    });
    return rows.sort((a, b) => {
      const va = (a as any)[sortCol], vb = (b as any)[sortCol];
      if (typeof va === "number") return sortDir === "asc" ? va - vb : vb - va;
      return sortDir === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
  }, [sortCol, sortDir, search, filterStatus, filterPriority, filterCSM]);

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir(col === "arr" || col === "daysOpen" ? "desc" : "asc"); }
  };

  const sel: React.CSSProperties = { padding: "6px 10px", borderRadius: 7, border: "1px solid #d1d5db", fontSize: 12, background: "#fff", outline: "none" };

  return (
    <div>
      {/* Filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <input placeholder="Search rooftop, enterprise, issue..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 220, padding: "6px 12px", borderRadius: 7, border: "1px solid #d1d5db", fontSize: 12, outline: "none" }} />
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={sel}>
          <option value="">All Priorities</option>
          {["Critical","High","Medium","Low"].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={sel}>
          <option value="">All Statuses</option>
          {["Open","In Progress","Escalated","Resolved"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterCSM} onChange={e => setFilterCSM(e.target.value)} style={sel}>
          <option value="">All CSMs</option>
          {csms.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={() => downloadCSV("churn-issues.csv",
          ["Issue ID","Issue Type","Rooftop","Enterprise","CSM","ARR","Priority","Status","Days Open","Description"],
          sorted.map(i => [i.id, i.issueType, i.rooftop, i.enterprise, i.csm, i.arr, i.priority, i.status, i.daysOpen, i.description])
        )} style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid #d1d5db", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#374151", whiteSpace: "nowrap" }}>
          ↓ Export CSV
        </button>
      </div>

      <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {[
                { key: "id", label: "Issue ID" },
                { key: "issueType", label: "Issue Type" },
                { key: "rooftop", label: "Rooftop" },
                { key: "enterprise", label: "Enterprise" },
                { key: "csm", label: "CSM" },
                { key: "arr", label: "ARR", numeric: true },
                { key: "priority", label: "Priority" },
                { key: "status", label: "Status" },
                { key: "daysOpen", label: "Days Open", numeric: true },
              ].map(c => (
                <th key={c.key} onClick={() => handleSort(c.key)} style={thStyle(c.numeric, sortCol === c.key)}>
                  {c.label} <SortIcon col={c.key} sortCol={sortCol} sortDir={sortDir} />
                </th>
              ))}
              <th style={thStyle(false)}>Description</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((issue, i) => (
              <tr key={issue.id} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                <td style={{ ...tdBase, fontFamily: "monospace", fontSize: 11, color: "#6366f1", fontWeight: 700 }}>{issue.id}</td>
                <td style={tdBase}><IssueTypeBadge type={issue.issueType} /></td>
                <td style={{ ...tdBase, fontWeight: 600 }}>{issue.rooftop}</td>
                <td style={{ ...tdBase, color: "#6b7280" }}>{issue.enterprise}</td>
                <td style={tdBase}>{issue.csm}</td>
                <td style={{ ...tdBase, textAlign: "center", fontWeight: 700, color: "#374151" }}>{fmtARR(issue.arr)}</td>
                <td style={{ ...tdBase, textAlign: "center" }}><PriorityBadge priority={issue.priority} /></td>
                <td style={{ ...tdBase, textAlign: "center" }}><StatusBadge status={issue.status} /></td>
                <td style={{ ...tdBase, textAlign: "center", fontWeight: 600, color: issue.daysOpen >= 20 ? "#dc2626" : issue.daysOpen >= 10 ? "#d97706" : "#374151" }}>{issue.daysOpen}d</td>
                <td style={{ ...tdBase, color: "#6b7280", fontSize: 12, maxWidth: 280, whiteSpace: "normal" }}>{issue.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: "#9ca3af" }}>Showing {sorted.length} of {ISSUES.length} issues</div>
    </div>
  );
}

// ─── View 2: Rooftop Level ────────────────────────────────────────────────────

function RooftopLevelView({ onDrillDown }: { onDrillDown: (rooftop: string) => void }) {
  const [sortCol, setSortCol] = useState("arr");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    const map: Record<string, any> = {};
    ISSUES.forEach(i => {
      if (!map[i.rooftopId]) {
        map[i.rooftopId] = { rooftop: i.rooftop, enterprise: i.enterprise, csm: i.csm, arr: i.arr, total: 0, critical: 0, high: 0, medium: 0, low: 0, open: 0, totalDays: 0 };
      }
      const r = map[i.rooftopId];
      r.total++;
      r.totalDays += i.daysOpen;
      if (i.priority === "Critical") r.critical++;
      else if (i.priority === "High") r.high++;
      else if (i.priority === "Medium") r.medium++;
      else r.low++;
      if (i.status === "Open" || i.status === "Escalated" || i.status === "In Progress") r.open++;
    });
    return Object.values(map).map((r: any) => ({ ...r, avgDays: Math.round(r.totalDays / r.total) }));
  }, []);

  const sorted = useMemo(() => [...rows].sort((a: any, b: any) => {
    const va = a[sortCol], vb = b[sortCol];
    if (typeof va === "number") return sortDir === "asc" ? va - vb : vb - va;
    return sortDir === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
  }), [rows, sortCol, sortDir]);

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  const totRow = useMemo(() => sorted.reduce((t: any, r: any) => ({
    total: t.total + r.total, critical: t.critical + r.critical, high: t.high + r.high,
    medium: t.medium + r.medium, low: t.low + r.low, open: t.open + r.open,
  }), { total: 0, critical: 0, high: 0, medium: 0, low: 0, open: 0 }), [sorted]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <button onClick={() => downloadCSV("churn-rooftop.csv",
          ["Rooftop","Enterprise","CSM","ARR","Total Issues","Critical","High","Medium","Low","Active","Avg Days Open"],
          sorted.map((r: any) => [r.rooftop, r.enterprise, r.csm, r.arr, r.total, r.critical, r.high, r.medium, r.low, r.open, r.avgDays])
        )} style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid #d1d5db", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#374151" }}>
          ↓ Export CSV
        </button>
      </div>
      <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {[
                { key: "rooftop", label: "Rooftop" },
                { key: "enterprise", label: "Enterprise" },
                { key: "csm", label: "CSM" },
                { key: "arr", label: "ARR", numeric: true },
                { key: "total", label: "Issues", numeric: true },
                { key: "critical", label: "Critical", numeric: true },
                { key: "high", label: "High", numeric: true },
                { key: "medium", label: "Medium", numeric: true },
                { key: "low", label: "Low", numeric: true },
                { key: "open", label: "Active", numeric: true },
                { key: "avgDays", label: "Avg Days Open", numeric: true },
              ].map(c => (
                <th key={c.key} onClick={() => handleSort(c.key)} style={thStyle(c.numeric, sortCol === c.key)}>
                  {c.label} <SortIcon col={c.key} sortCol={sortCol} sortDir={sortDir} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r: any, i: number) => (
              <tr key={r.rooftop} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                <td style={{ ...tdBase, fontWeight: 600 }}>
                  <span onClick={() => onDrillDown(r.rooftop)} style={{ cursor: "pointer", color: "#4f46e5", textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 3 }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = "0.7")} onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
                    {r.rooftop}
                  </span>
                </td>
                <td style={{ ...tdBase, color: "#6b7280" }}>{r.enterprise}</td>
                <td style={tdBase}>{r.csm}</td>
                <td style={{ ...tdBase, textAlign: "center", fontWeight: 700 }}>{fmtARR(r.arr)}</td>
                <td style={{ ...tdBase, textAlign: "center", fontWeight: 700 }}>{r.total}</td>
                <td style={{ ...tdBase, textAlign: "center" }}>{r.critical > 0 ? <span style={{ fontWeight: 700, color: "#dc2626" }}>{r.critical}</span> : <span style={{ color: "#d1d5db" }}>—</span>}</td>
                <td style={{ ...tdBase, textAlign: "center" }}>{r.high > 0 ? <span style={{ fontWeight: 600, color: "#ea580c" }}>{r.high}</span> : <span style={{ color: "#d1d5db" }}>—</span>}</td>
                <td style={{ ...tdBase, textAlign: "center" }}>{r.medium > 0 ? <span style={{ color: "#d97706" }}>{r.medium}</span> : <span style={{ color: "#d1d5db" }}>—</span>}</td>
                <td style={{ ...tdBase, textAlign: "center" }}>{r.low > 0 ? <span style={{ color: "#16a34a" }}>{r.low}</span> : <span style={{ color: "#d1d5db" }}>—</span>}</td>
                <td style={{ ...tdBase, textAlign: "center", fontWeight: 600 }}>{r.open}</td>
                <td style={{ ...tdBase, textAlign: "center", color: r.avgDays >= 20 ? "#dc2626" : r.avgDays >= 10 ? "#d97706" : "#374151", fontWeight: 600 }}>{r.avgDays}d</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: "#f9fafb", fontWeight: 700 }}>
              <td colSpan={4} style={{ ...tdBase, borderTop: "2px solid #e5e7eb", color: "#374151" }}>Total</td>
              <td style={{ ...tdBase, textAlign: "center", borderTop: "2px solid #e5e7eb" }}>{totRow.total}</td>
              <td style={{ ...tdBase, textAlign: "center", borderTop: "2px solid #e5e7eb", color: "#dc2626" }}>{totRow.critical}</td>
              <td style={{ ...tdBase, textAlign: "center", borderTop: "2px solid #e5e7eb", color: "#ea580c" }}>{totRow.high}</td>
              <td style={{ ...tdBase, textAlign: "center", borderTop: "2px solid #e5e7eb", color: "#d97706" }}>{totRow.medium}</td>
              <td style={{ ...tdBase, textAlign: "center", borderTop: "2px solid #e5e7eb", color: "#16a34a" }}>{totRow.low}</td>
              <td style={{ ...tdBase, textAlign: "center", borderTop: "2px solid #e5e7eb" }}>{totRow.open}</td>
              <td style={{ ...tdBase, borderTop: "2px solid #e5e7eb" }}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── View 3: Rooftop × Issue Level ───────────────────────────────────────────

function RooftopIssueLevelView({ filterRooftop }: { filterRooftop?: string }) {
  const [sortCol, setSortCol] = useState("arr");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [rooftopFilter, setRooftopFilter] = useState(filterRooftop ?? "");

  const rooftops = useMemo(() => [...new Set(ISSUES.map(i => i.rooftop))].sort(), []);

  const sorted = useMemo(() => {
    const rows = ISSUES.filter(i => !rooftopFilter || i.rooftop === rooftopFilter);
    return [...rows].sort((a: any, b: any) => {
      const va = a[sortCol], vb = b[sortCol];
      if (typeof va === "number") return sortDir === "asc" ? va - vb : vb - va;
      return sortDir === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
  }, [sortCol, sortDir, rooftopFilter]);

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <select value={rooftopFilter} onChange={e => setRooftopFilter(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 7, border: `1px solid ${rooftopFilter ? "#818cf8" : "#d1d5db"}`, background: rooftopFilter ? "#eef2ff" : "#fff", fontSize: 12, outline: "none", minWidth: 200 }}>
          <option value="">All Rooftops</option>
          {rooftops.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        {rooftopFilter && <button onClick={() => setRooftopFilter("")} style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #fca5a5", background: "#fef2f2", color: "#dc2626", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Clear filter</button>}
        <div style={{ flex: 1 }} />
        <button onClick={() => downloadCSV("churn-rooftop-issue.csv",
          ["Rooftop","Enterprise","CSM","ARR","Issue ID","Issue Type","Status","Priority","Days Open"],
          sorted.map(i => [i.rooftop, i.enterprise, i.csm, i.arr, i.id, i.issueType, i.status, i.priority, i.daysOpen])
        )} style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid #d1d5db", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#374151" }}>
          ↓ Export CSV
        </button>
      </div>

      <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {[
                { key: "rooftop", label: "Rooftop" },
                { key: "enterprise", label: "Enterprise" },
                { key: "csm", label: "CSM" },
                { key: "arr", label: "ARR", numeric: true },
                { key: "issueType", label: "Issue Type" },
                { key: "status", label: "Status" },
                { key: "priority", label: "Priority" },
                { key: "daysOpen", label: "Days Open", numeric: true },
              ].map(c => (
                <th key={c.key} onClick={() => handleSort(c.key)} style={thStyle(c.numeric, sortCol === c.key)}>
                  {c.label} <SortIcon col={c.key} sortCol={sortCol} sortDir={sortDir} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((issue, i) => (
              <tr key={issue.id} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                <td style={{ ...tdBase, fontWeight: 600 }}>{issue.rooftop}</td>
                <td style={{ ...tdBase, color: "#6b7280" }}>{issue.enterprise}</td>
                <td style={tdBase}>{issue.csm}</td>
                <td style={{ ...tdBase, textAlign: "center", fontWeight: 700 }}>{fmtARR(issue.arr)}</td>
                <td style={tdBase}><IssueTypeBadge type={issue.issueType} /></td>
                <td style={{ ...tdBase, textAlign: "center" }}><StatusBadge status={issue.status} /></td>
                <td style={{ ...tdBase, textAlign: "center" }}><PriorityBadge priority={issue.priority} /></td>
                <td style={{ ...tdBase, textAlign: "center", fontWeight: 600, color: issue.daysOpen >= 20 ? "#dc2626" : issue.daysOpen >= 10 ? "#d97706" : "#374151" }}>{issue.daysOpen}d</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: "#9ca3af" }}>Showing {sorted.length} of {ISSUES.length} rows</div>
    </div>
  );
}

// ─── Summary stat cards ───────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 10, padding: "16px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", border: "1px solid #e5e7eb", flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 500, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ─── Main ChurnDashboard ──────────────────────────────────────────────────────

export default function ChurnDashboard({ activeTab, onTabChange }: { activeTab: string; onTabChange: (t: string) => void }) {
  const [drillRooftop, setDrillRooftop] = useState<string | undefined>(undefined);

  const handleRooftopDrillDown = (rooftop: string) => {
    setDrillRooftop(rooftop);
    onTabChange("Rooftop × Issue");
  };

  const openIssues   = ISSUES.filter(i => i.status !== "Resolved").length;
  const criticalCount = ISSUES.filter(i => i.priority === "Critical").length;
  const totalARR     = [...new Map(ISSUES.map(i => [i.rooftopId, i.arr])).values()].reduce((a, b) => a + b, 0);
  const avgDays      = Math.round(ISSUES.reduce((a, i) => a + i.daysOpen, 0) / ISSUES.length);

  return (
    <div style={{ padding: "20px 28px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* Summary cards */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <StatCard label="Total Issues" value={ISSUES.length} sub={`${openIssues} active`} color="#4f46e5" />
        <StatCard label="Critical / Escalated" value={criticalCount} sub="Needs immediate action" color="#dc2626" />
        <StatCard label="At-Risk ARR" value={`$${(totalARR / 1000).toFixed(0)}K`} sub="Across affected rooftops" color="#d97706" />
        <StatCard label="Avg Days Open" value={`${avgDays}d`} sub="Active issues" color="#0ea5e9" />
      </div>

      {/* Tab content */}
      {activeTab === "Issue Level" && <IssueLevelView />}
      {activeTab === "Rooftop Level" && <RooftopLevelView onDrillDown={handleRooftopDrillDown} />}
      {activeTab === "Rooftop × Issue" && <RooftopIssueLevelView filterRooftop={drillRooftop} />}
    </div>
  );
}
