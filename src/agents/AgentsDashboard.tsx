import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

type AgentType = "Sales Inbound" | "Service Inbound" | "Sales Outbound" | "Service Outbound";

type AgentRowV3 = {
  day: string;
  team_id: string;
  enterprise_id: string;
  enterprise_name: string;
  rooftop_name: string;
  rooftop_stage: string | null;
  service_type: string;
  direction: string;
  agent_type: AgentType;

  total_leads: number | null;
  touched_leads: number | null;
  total_leads_with_calls: number | null;
  total_leads_with_sms: number | null;
  qualified_leads: number | null;
  appointments: number | null;
  appointment_value: number | null;
  total_calls: number | null;
  appointment_intent_leads: number | null;
  eligible_campaign_leads: number | null;
  leads_targeted: number | null;
  leads_engaged: number | null;
  avg_followups_till_appt: number | string | null;
  coverage: number | null;
  conversion_rate: number | null;
  quality_score: number | null;
};

const AGENT_TYPES: AgentType[] = ["Sales Inbound", "Service Inbound", "Sales Outbound", "Service Outbound"];
const AGENT_LABELS: Record<AgentType, string> = {
  "Sales Inbound": "Sales IB",
  "Service Inbound": "Service IB",
  "Sales Outbound": "Sales OB",
  "Service Outbound": "Service OB",
};
const AGENT_COLORS: Record<AgentType, string> = {
  "Sales Inbound": "#f59e0b",
  "Service Inbound": "#22c55e",
  "Sales Outbound": "#6366f1",
  "Service Outbound": "#0ea5e9",
};

const num = (v: unknown): number => {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const numOrNull = (v: unknown): number | null => {
  if (v == null || v === "" || v === "NaN") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

type DateRange = "ALL" | "TODAY" | "WEEK" | "MTD" | "CUSTOM";
const DATE_RANGES: { key: DateRange; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "TODAY", label: "Today" },
  { key: "WEEK", label: "This Week" },
  { key: "MTD", label: "MTD" },
  { key: "CUSTOM", label: "Custom" },
];

type CustomRange = { from: string; to: string }; // ISO yyyy-mm-dd, both inclusive

function fmtDay(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function startOfWeekMon(d: Date): Date {
  const x = startOfDay(d);
  const day = x.getDay();
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day));
  return x;
}
function inRange(iso: string, range: DateRange, custom: CustomRange): boolean {
  if (range === "ALL") return true;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  const today = startOfDay(new Date());
  if (range === "TODAY") return startOfDay(d).getTime() === today.getTime();
  if (range === "WEEK") {
    const wk = startOfWeekMon(today);
    const end = new Date(wk); end.setDate(wk.getDate() + 7);
    return d >= wk && d < end;
  }
  if (range === "MTD") {
    const mStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const mEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    return d >= mStart && d < mEnd;
  }
  if (range === "CUSTOM") {
    const day = startOfDay(d);
    if (custom.from) {
      const f = startOfDay(new Date(custom.from));
      if (!isNaN(f.getTime()) && day < f) return false;
    }
    if (custom.to) {
      const t = startOfDay(new Date(custom.to));
      if (!isNaN(t.getTime()) && day > t) return false;
    }
    return true;
  }
  return true;
}

function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

const rooftopLabel = (r: AgentRowV3) =>
  r.rooftop_name?.trim() || r.enterprise_name?.trim() || r.team_id || "Unknown";
const enterpriseLabel = (r: AgentRowV3) => r.enterprise_name?.trim() || "";

type Bucket = {
  totalLeads: number;
  touched: number;
  leadsWithCalls: number;
  leadsWithSms: number;
  qualified: number;
  appts: number;
  apptValue: number;
  totalCalls: number;
  intent: number;
  eligible: number;
  targeted: number;
  engaged: number;
  fupSum: number;     // sum of avg_followups_till_appt × appts
  fupWeight: number;  // sum of appts where fup is non-null
  qSum: number;       // quality_score × total_leads
  qWeight: number;    // total_leads where quality_score is non-null
};
const EMPTY: Bucket = {
  totalLeads: 0, touched: 0, leadsWithCalls: 0, leadsWithSms: 0,
  qualified: 0, appts: 0, apptValue: 0, totalCalls: 0,
  intent: 0, eligible: 0, targeted: 0, engaged: 0,
  fupSum: 0, fupWeight: 0, qSum: 0, qWeight: 0,
};

function projectRow(r: AgentRowV3): Bucket {
  const totalLeads = num(r.total_leads);
  const appts = num(r.appointments);
  const fup = numOrNull(r.avg_followups_till_appt);
  const score = numOrNull(r.quality_score);
  return {
    totalLeads,
    touched: num(r.touched_leads),
    leadsWithCalls: num(r.total_leads_with_calls),
    leadsWithSms: num(r.total_leads_with_sms),
    qualified: num(r.qualified_leads),
    appts,
    apptValue: num(r.appointment_value),
    totalCalls: num(r.total_calls),
    intent: num(r.appointment_intent_leads),
    eligible: num(r.eligible_campaign_leads),
    targeted: num(r.leads_targeted),
    engaged: num(r.leads_engaged),
    fupSum: fup != null && appts > 0 ? fup * appts : 0,
    fupWeight: fup != null && appts > 0 ? appts : 0,
    qSum: score != null && totalLeads > 0 ? score * totalLeads : 0,
    qWeight: score != null && totalLeads > 0 ? totalLeads : 0,
  };
}
function add(a: Bucket, b: Bucket): Bucket {
  return {
    totalLeads: a.totalLeads + b.totalLeads,
    touched: a.touched + b.touched,
    leadsWithCalls: a.leadsWithCalls + b.leadsWithCalls,
    leadsWithSms: a.leadsWithSms + b.leadsWithSms,
    qualified: a.qualified + b.qualified,
    appts: a.appts + b.appts,
    apptValue: a.apptValue + b.apptValue,
    totalCalls: a.totalCalls + b.totalCalls,
    intent: a.intent + b.intent,
    eligible: a.eligible + b.eligible,
    targeted: a.targeted + b.targeted,
    engaged: a.engaged + b.engaged,
    fupSum: a.fupSum + b.fupSum,
    fupWeight: a.fupWeight + b.fupWeight,
    qSum: a.qSum + b.qSum,
    qWeight: a.qWeight + b.qWeight,
  };
}

const fmtNum = (n: number) => n.toLocaleString();
const fmtCurrency = (n: number) => `$${Math.round(n).toLocaleString()}`;
const fmtRate = (num: number, den: number) =>
  den > 0 ? `${((num / den) * 100).toFixed(1)}%` : "—";
const fmtScore = (b: Bucket) =>
  b.qWeight > 0 ? `${(b.qSum / b.qWeight).toFixed(1)}` : "—";
const fmtFollowups = (b: Bucket) =>
  b.fupWeight > 0 ? (b.fupSum / b.fupWeight).toFixed(1) : "—";

function AgentsDashboard() {
  const [rows, setRows] = useState<AgentRowV3[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const [activeAgent, setActiveAgent] = useState<AgentType>("Sales Inbound");
  const [dateRange, setDateRange] = useState<DateRange>("ALL");
  const [customRange, setCustomRange] = useState<CustomRange>(() => ({ from: "", to: todayIso() }));
  const [stageFilter, setStageFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = (force = false) => {
    setLoading(true);
    setError(null);
    const url = `${API_BASE}/api/agents${force ? `?refresh=1&t=${Date.now()}` : ""}`;
    fetch(url, { cache: "no-store" })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(j => { setRows(j.rows ?? []); setFetchedAt(j.fetchedAt ?? null); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(false); }, []);

  // Reset row-expansion state whenever the active agent or filters narrow.
  useEffect(() => { setExpanded(new Set()); }, [activeAgent, dateRange, customRange, stageFilter, search]);

  const stages = useMemo(() => {
    const s = new Set<string>();
    rows.forEach(r => { if (r.rooftop_stage) s.add(r.rooftop_stage); });
    return Array.from(s).sort();
  }, [rows]);

  const presentAgents = useMemo(() => {
    const s = new Set<AgentType>();
    rows.forEach(r => { if (r.agent_type) s.add(r.agent_type); });
    return s;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (r.agent_type !== activeAgent) return false;
      if (!inRange(r.day, dateRange, customRange)) return false;
      if (stageFilter !== "ALL" && r.rooftop_stage !== stageFilter) return false;
      if (q) {
        const hay = `${rooftopLabel(r)} ${enterpriseLabel(r)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, activeAgent, dateRange, customRange, stageFilter, search]);

  const days = useMemo(
    () => Array.from(new Set(filtered.map(r => r.day))).sort(),
    [filtered]
  );

  type RooftopAgg = {
    key: string;
    rooftop: string;
    enterprise: string;
    stage: string | null;
    daily: ({ day: string } & Bucket)[];
    total: Bucket;
  };
  const rooftopRows: RooftopAgg[] = useMemo(() => {
    const m = new Map<string, RooftopAgg>();
    const stageMap = new Map<string, { day: string; stage: string | null }>();
    for (const r of filtered) {
      const key = r.team_id || `${r.enterprise_name ?? ""}::${r.rooftop_name ?? ""}`;
      let entry = m.get(key);
      if (!entry) {
        entry = {
          key, rooftop: rooftopLabel(r), enterprise: enterpriseLabel(r),
          stage: r.rooftop_stage, daily: [], total: { ...EMPTY },
        };
        m.set(key, entry);
      }
      const prev = stageMap.get(key);
      if (!prev || r.day > prev.day) stageMap.set(key, { day: r.day, stage: r.rooftop_stage });
      const proj = projectRow(r);
      entry.total = add(entry.total, proj);
      entry.daily.push({ day: r.day, ...proj });
    }
    for (const [key, entry] of m) entry.stage = stageMap.get(key)?.stage ?? entry.stage;
    for (const e of m.values()) e.daily.sort((a, b) => a.day.localeCompare(b.day));
    return Array.from(m.values()).sort((a, b) => b.total.totalLeads - a.total.totalLeads);
  }, [filtered]);

  const daily = useMemo(() => {
    const byDay = new Map<string, Bucket>();
    for (const r of filtered) {
      const prev = byDay.get(r.day) ?? EMPTY;
      byDay.set(r.day, add(prev, projectRow(r)));
    }
    return days.map(d => byDay.get(d) ?? { ...EMPTY });
  }, [filtered, days]);

  const totals = useMemo(() => daily.reduce(add, { ...EMPTY }), [daily]);

  const { liveRooftops, churnedRooftops } = useMemo(() => {
    let live = 0, churned = 0;
    for (const rt of rooftopRows) {
      if (rt.stage === "Live") live++;
      else if (rt.stage === "Churned") churned++;
    }
    return { liveRooftops: live, churnedRooftops: churned };
  }, [rooftopRows]);

  const showingPlaceholder = loading && rows.length === 0;

  const toggleExpand = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  const expandAll = () => setExpanded(new Set(rooftopRows.map(r => r.key)));
  const collapseAll = () => setExpanded(new Set());

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: "20px 32px", background: "#f9fafb", minHeight: "100vh" }}>
      <style>{`
        @keyframes agentShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        .agent-shimmer { background:linear-gradient(90deg,#eef0f3 25%,#e2e5ea 50%,#eef0f3 75%); background-size:200% 100%; animation:agentShimmer 1.3s ease-in-out infinite; border-radius:6px; color:transparent !important; }
        .agent-refreshing { animation: agentSpin 1s linear infinite; }
        @keyframes agentSpin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ marginBottom: 20, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>
            Agents — Per-Agent Campaign Metrics
          </h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0", maxWidth: 800 }}>
            One tab per agent (Sales/Service × Inbound/Outbound). Each tab shows the metrics
            specific to that agent's funnel — for inbound, lead-creation-day attribution; for
            outbound, campaign-day attribution. Live and Churned rooftop counts use the most
            recent day's <code>rooftop_stage</code> per <code>team_id</code> within the active filters.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 4 }}>
          {fetchedAt && !loading && (
            <span style={{ fontSize: 12, color: "#16a34a" }}>
              ● {rows.length.toLocaleString()} rows · fetched {new Date(fetchedAt).toLocaleTimeString()}
            </span>
          )}
          {loading && <span style={{ fontSize: 12, color: "#6b7280" }}>Fetching…</span>}
          <button onClick={() => load(true)} disabled={loading}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: loading ? "#f3f4f6" : "#fff", fontSize: 12, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", color: loading ? "#9ca3af" : "#374151" }}>
            <span className={loading ? "agent-refreshing" : undefined} style={{ display: "inline-block" }}>↻</span>
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
          Failed to load: {error}
        </div>
      )}

      {/* Agent tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12, borderBottom: "1px solid #e5e7eb" }}>
        {AGENT_TYPES.map(t => {
          const active = t === activeAgent;
          const hasData = presentAgents.has(t) || rows.length === 0;
          return (
            <button
              key={t}
              onClick={() => setActiveAgent(t)}
              disabled={!loading && rows.length > 0 && !hasData}
              title={!hasData ? `No ${t} rows in current data` : undefined}
              style={{
                padding: "10px 16px", border: "none", background: "transparent",
                borderBottom: `2px solid ${active ? AGENT_COLORS[t] : "transparent"}`,
                color: active ? AGENT_COLORS[t] : hasData ? "#374151" : "#d1d5db",
                fontSize: 13, fontWeight: active ? 700 : 600,
                cursor: hasData ? "pointer" : "not-allowed",
                marginBottom: -1,
                transition: "color 0.15s, border-color 0.15s",
              }}
            >
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: AGENT_COLORS[t], marginRight: 8, verticalAlign: "middle" }} />
              {AGENT_LABELS[t]}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 18, background: "#fff", padding: 12, borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <SegmentedControl options={DATE_RANGES} value={dateRange} onChange={setDateRange} />
        {dateRange === "CUSTOM" && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <label style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>From</label>
            <input type="date" value={customRange.from}
              max={customRange.to || undefined}
              onChange={e => setCustomRange(r => ({ ...r, from: e.target.value }))}
              style={{ padding: "5px 8px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, background: "#fff" }} />
            <label style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>To</label>
            <input type="date" value={customRange.to}
              min={customRange.from || undefined}
              onChange={e => setCustomRange(r => ({ ...r, to: e.target.value }))}
              style={{ padding: "5px 8px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, background: "#fff" }} />
            {(customRange.from || customRange.to) && (
              <button onClick={() => setCustomRange({ from: "", to: "" })}
                title="Clear custom range"
                style={{ padding: "4px 8px", fontSize: 11, fontWeight: 600, color: "#6b7280", background: "transparent", border: "1px solid #e5e7eb", borderRadius: 6, cursor: "pointer" }}>
                Clear
              </button>
            )}
          </div>
        )}
        <div style={{ width: 1, height: 24, background: "#e5e7eb", margin: "0 4px" }} />
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <label style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>Stage</label>
          <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, background: "#fff" }}>
            <option value="ALL">All stages</option>
            {stages.map(s => <option key={s} value={s}>{s || "(blank)"}</option>)}
          </select>
        </div>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search rooftop or enterprise…"
          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, minWidth: 220 }} />
        <div style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280" }}>
          {rooftopRows.length} rooftop{rooftopRows.length === 1 ? "" : "s"} · {days.length} day{days.length === 1 ? "" : "s"}
        </div>
      </div>

      {/* KPIs — agent-specific */}
      <KpiStrip
        agent={activeAgent}
        totals={totals}
        liveRooftops={liveRooftops}
        churnedRooftops={churnedRooftops}
        loading={showingPlaceholder}
      />

      {/* Chart */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: 16, marginBottom: 20, position: "relative" }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>
            Day-on-day — {chartTitleFor(activeAgent)}
          </div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            Aggregated across rooftops matching your filters. Hover for day-level details.
          </div>
        </div>
        {showingPlaceholder ? (
          <div className="agent-shimmer" style={{ height: 320 }} />
        ) : days.length === 0 ? (
          <div style={{ height: 320, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 13 }}>
            No data — widen your filters or pick a different date range.
          </div>
        ) : (
          <LineChart days={days} series={chartSeriesFor(activeAgent, daily)} />
        )}
      </div>

      {/* Rooftop table */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
            Rooftop breakdown — {AGENT_LABELS[activeAgent]} · expand for daily detail
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={expandAll}
              style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", color: "#374151" }}>
              Expand all
            </button>
            <button onClick={collapseAll}
              style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", color: "#374151" }}>
              Collapse all
            </button>
          </div>
        </div>
        <div style={{ overflowX: "auto", maxHeight: 640 }}>
          <RooftopTable
            agent={activeAgent}
            rows={rooftopRows}
            expanded={expanded}
            onToggle={toggleExpand}
            loading={showingPlaceholder}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Per-agent KPI strip ─────────────────────────────────────────────────────

function KpiStrip({ agent, totals, liveRooftops, churnedRooftops, loading }: {
  agent: AgentType;
  totals: Bucket;
  liveRooftops: number;
  churnedRooftops: number;
  loading: boolean;
}) {
  const cards: { label: string; value: string | number; color: string; sub?: string }[] = [
    { label: "Live Rooftops", value: liveRooftops, color: "#16a34a" },
    { label: "Churned Rooftops", value: churnedRooftops, color: "#dc2626" },
  ];

  const channelMix = (b: Bucket) => `${fmtNum(b.leadsWithCalls)} via calls · ${fmtNum(b.leadsWithSms)} via SMS`;

  if (agent === "Sales Inbound") {
    cards.push(
      { label: "Unique Leads", value: fmtNum(totals.totalLeads), color: "#6366f1" },
      { label: "Touched Leads", value: fmtNum(totals.touched), color: "#0ea5e9", sub: channelMix(totals) },
      { label: "Qualified Leads", value: fmtNum(totals.qualified), color: "#0369a1", sub: fmtRate(totals.qualified, totals.touched) + " of touched" },
      { label: "Coverage", value: fmtRate(totals.touched, totals.totalLeads), color: "#8b5cf6", sub: "touched / unique" },
      { label: "Appointments", value: fmtNum(totals.appts), color: "#22c55e" },
      { label: "Conversion Rate", value: fmtRate(totals.appts, totals.touched), color: "#15803d", sub: "appts / touched" },
      { label: "Appointment Value", value: fmtCurrency(totals.apptValue), color: "#ea580c" },
      { label: "Quality Score", value: fmtScore(totals), color: "#db2777", sub: "lead-weighted" },
    );
  } else if (agent === "Service Inbound") {
    cards.push(
      { label: "Unique Leads Touched", value: fmtNum(totals.touched), color: "#0ea5e9", sub: channelMix(totals) },
      { label: "Total Calls", value: fmtNum(totals.totalCalls), color: "#6366f1", sub: totals.leadsWithCalls > 0 ? `${fmtNum(totals.leadsWithCalls)} unique leads` : undefined },
      { label: "Qualified Leads", value: fmtNum(totals.qualified), color: "#0369a1", sub: fmtRate(totals.qualified, totals.touched) + " of touched" },
      { label: "Appt Intent Leads", value: fmtNum(totals.intent), color: "#8b5cf6" },
      { label: "Appointments", value: fmtNum(totals.appts), color: "#22c55e", sub: fmtRate(totals.appts, totals.touched) + " of touched" },
      { label: "Appointment Value", value: fmtCurrency(totals.apptValue), color: "#ea580c" },
      { label: "Quality Score", value: fmtScore(totals), color: "#db2777", sub: "lead-weighted" },
    );
  } else {
    // Sales OB & Service OB share the same metric set; Sales/Service differs only in the lead-source label.
    const leadsLabel = agent === "Sales Outbound" ? "Total Leads in CRM" : "Total Leads in DMS";
    cards.push(
      { label: leadsLabel, value: fmtNum(totals.totalLeads), color: "#6366f1" },
      { label: "Eligible Campaign Leads", value: fmtNum(totals.eligible), color: "#0ea5e9", sub: fmtRate(totals.eligible, totals.totalLeads) + " of total" },
      { label: "Leads Targeted", value: fmtNum(totals.targeted), color: "#0369a1", sub: fmtRate(totals.targeted, totals.eligible) + " of eligible" },
      { label: "Leads Touched", value: fmtNum(totals.touched), color: "#8b5cf6", sub: channelMix(totals) },
      { label: "Leads Engaged", value: fmtNum(totals.engaged), color: "#a21caf", sub: fmtRate(totals.engaged, totals.touched) + " of touched" },
      { label: "Qualified Leads", value: fmtNum(totals.qualified), color: "#0d9488", sub: fmtRate(totals.qualified, totals.engaged) + " of engaged" },
      { label: "Appointments", value: fmtNum(totals.appts), color: "#22c55e", sub: fmtRate(totals.appts, totals.qualified) + " of qualified" },
      { label: "Appointment Value", value: fmtCurrency(totals.apptValue), color: "#ea580c" },
      { label: "Followups till Appt", value: fmtFollowups(totals), color: "#9333ea", sub: "SMS + Calls per appt" },
      { label: "Quality Score", value: fmtScore(totals), color: "#db2777", sub: "lead-weighted" },
    );
  }

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
      {cards.map(c => (
        <KpiCard key={c.label} label={c.label} value={c.value} color={c.color} loading={loading} sub={c.sub} />
      ))}
    </div>
  );
}

// ─── Per-agent chart series ──────────────────────────────────────────────────

function chartTitleFor(agent: AgentType): string {
  if (agent === "Sales Inbound") return "Unique Leads, Touched, Appointments";
  if (agent === "Service Inbound") return "Total Calls, Qualified, Appointments";
  return "Eligible, Engaged, Appointments";
}
function chartSeriesFor(agent: AgentType, daily: Bucket[]):
  { name: string; color: string; values: number[] }[] {
  if (agent === "Sales Inbound") {
    return [
      { name: "Unique Leads", color: "#6366f1", values: daily.map(d => d.totalLeads) },
      { name: "Touched", color: "#0ea5e9", values: daily.map(d => d.touched) },
      { name: "Appointments", color: "#22c55e", values: daily.map(d => d.appts) },
    ];
  }
  if (agent === "Service Inbound") {
    return [
      { name: "Total Calls", color: "#6366f1", values: daily.map(d => d.totalCalls) },
      { name: "Qualified", color: "#0369a1", values: daily.map(d => d.qualified) },
      { name: "Appointments", color: "#22c55e", values: daily.map(d => d.appts) },
    ];
  }
  return [
    { name: "Eligible", color: "#0ea5e9", values: daily.map(d => d.eligible) },
    { name: "Engaged", color: "#a21caf", values: daily.map(d => d.engaged) },
    { name: "Appointments", color: "#22c55e", values: daily.map(d => d.appts) },
  ];
}

// ─── Per-agent rooftop table ─────────────────────────────────────────────────

type RooftopRowData = {
  key: string; rooftop: string; enterprise: string; stage: string | null;
  daily: ({ day: string } & Bucket)[]; total: Bucket;
};

function RooftopTable({ agent, rows, expanded, onToggle, loading }: {
  agent: AgentType;
  rows: RooftopRowData[];
  expanded: Set<string>;
  onToggle: (k: string) => void;
  loading: boolean;
}) {
  const cols = columnsFor(agent);
  const totalCols = cols.length + 2; // arrow + rooftop label + metrics

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead style={{ position: "sticky", top: 0, background: "#f9fafb", zIndex: 1 }}>
        <tr>
          <th style={{ ...thStyle, width: 30 }} />
          <th style={{ ...thStyle, textAlign: "left", minWidth: 240 }}>Rooftop / Day</th>
          {cols.map(c => (
            <th key={c.label} style={{ ...thStyle, textAlign: "right", minWidth: c.minWidth ?? 100 }}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {loading && Array.from({ length: 8 }).map((_, i) => (
          <tr key={`sh-${i}`} style={{ borderTop: "1px solid #f3f4f6" }}>
            {Array.from({ length: totalCols }).map((__, j) => (
              <td key={j} style={{ padding: "10px 12px" }}>
                <div className="agent-shimmer" style={{ height: 14, width: j === 1 ? "60%" : "50%" }}>&nbsp;</div>
              </td>
            ))}
          </tr>
        ))}
        {!loading && rows.length === 0 && (
          <tr>
            <td colSpan={totalCols} style={{ padding: 24, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
              No rooftops match filters
            </td>
          </tr>
        )}
        {!loading && rows.map(row => {
          const isOpen = expanded.has(row.key);
          return (
            <Fragment key={row.key}>
              <tr
                onClick={() => onToggle(row.key)}
                style={{ borderTop: "1px solid #f3f4f6", background: isOpen ? "#eef2ff" : "#fff", cursor: "pointer" }}>
                <td style={{ ...tdStyle, textAlign: "center", color: "#6b7280", fontWeight: 700, userSelect: "none" }}>
                  <span style={{ display: "inline-block", width: 16, transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>▶</span>
                </td>
                <td style={{ ...tdStyle, whiteSpace: "normal" }} title={`team_id: ${row.key}`}>
                  <div style={{ fontWeight: 700, color: "#111827" }}>
                    {row.rooftop}
                    <StagePill stage={row.stage} />
                    <span style={{ marginLeft: 8, fontSize: 11, color: "#6b7280", fontWeight: 500 }}>
                      ({row.daily.length} day{row.daily.length === 1 ? "" : "s"})
                    </span>
                  </div>
                  {row.enterprise && row.enterprise !== row.rooftop && (
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{row.enterprise}</div>
                  )}
                </td>
                {cols.map(c => (
                  <td key={c.label} style={{ ...tdStyle, textAlign: "right", color: c.emphasize ? "#0369a1" : "#374151", fontWeight: c.emphasize ? 600 : 400 }}>
                    {c.render(row.total)}
                  </td>
                ))}
              </tr>
              {isOpen && row.daily.map(d => (
                <tr key={`${row.key}::${d.day}`} style={{ borderTop: "1px solid #f3f4f6", background: "#fafbff" }}>
                  <td style={dayCellStyle} />
                  <td style={{ ...dayCellStyle, paddingLeft: 36, color: "#6b7280" }}>{fmtDay(d.day)}</td>
                  {cols.map(c => (
                    <td key={c.label} style={{ ...dayCellStyle, textAlign: "right", color: "#4b5563" }}>
                      {c.render(d)}
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

type Col = { label: string; render: (b: Bucket) => string; minWidth?: number; emphasize?: boolean };

// Compact "calls / sms" leads cell.
const fmtChannelMix = (b: Bucket): string =>
  b.leadsWithCalls === 0 && b.leadsWithSms === 0
    ? "—"
    : `${fmtNum(b.leadsWithCalls)} / ${fmtNum(b.leadsWithSms)}`;

function columnsFor(agent: AgentType): Col[] {
  if (agent === "Sales Inbound") {
    return [
      { label: "Unique Leads", render: b => fmtNum(b.totalLeads), emphasize: true },
      { label: "Touched", render: b => fmtNum(b.touched) },
      { label: "Calls / SMS", render: fmtChannelMix, minWidth: 100 },
      { label: "Qualified", render: b => fmtNum(b.qualified) },
      { label: "Coverage", render: b => fmtRate(b.touched, b.totalLeads), minWidth: 90 },
      { label: "Appts", render: b => fmtNum(b.appts), emphasize: true },
      { label: "Conv. Rate", render: b => fmtRate(b.appts, b.touched), minWidth: 90 },
      { label: "Appt $", render: b => fmtCurrency(b.apptValue), minWidth: 90 },
      { label: "Quality", render: b => fmtScore(b), minWidth: 80 },
    ];
  }
  if (agent === "Service Inbound") {
    return [
      { label: "Touched", render: b => fmtNum(b.touched), emphasize: true },
      { label: "Calls / SMS", render: fmtChannelMix, minWidth: 100 },
      { label: "Total Calls", render: b => fmtNum(b.totalCalls) },
      { label: "Qualified", render: b => fmtNum(b.qualified) },
      { label: "Intent", render: b => fmtNum(b.intent) },
      { label: "Appts", render: b => fmtNum(b.appts), emphasize: true },
      { label: "Appt $", render: b => fmtCurrency(b.apptValue), minWidth: 90 },
      { label: "Quality", render: b => fmtScore(b), minWidth: 80 },
    ];
  }
  // Sales OB & Service OB share columns
  const leadsLabel = agent === "Sales Outbound" ? "CRM Leads" : "DMS Leads";
  return [
    { label: leadsLabel, render: b => fmtNum(b.totalLeads), emphasize: true },
    { label: "Eligible", render: b => fmtNum(b.eligible) },
    { label: "Targeted", render: b => fmtNum(b.targeted) },
    { label: "Touched", render: b => fmtNum(b.touched) },
    { label: "Calls / SMS", render: fmtChannelMix, minWidth: 100 },
    { label: "Engaged", render: b => fmtNum(b.engaged) },
    { label: "Qualified", render: b => fmtNum(b.qualified) },
    { label: "Appts", render: b => fmtNum(b.appts), emphasize: true },
    { label: "Appt $", render: b => fmtCurrency(b.apptValue), minWidth: 90 },
    { label: "Followups", render: b => fmtFollowups(b), minWidth: 90 },
    { label: "Quality", render: b => fmtScore(b), minWidth: 80 },
  ];
}

// ─── Small pieces ────────────────────────────────────────────────────────────

function StagePill({ stage }: { stage: string | null }) {
  if (!stage) return null;
  const colorMap: Record<string, { bg: string; fg: string }> = {
    "Live": { bg: "#dcfce7", fg: "#166534" },
    "Churned": { bg: "#fee2e2", fg: "#991b1b" },
    "Onboarding": { bg: "#dbeafe", fg: "#1e40af" },
    "New": { bg: "#fef3c7", fg: "#92400e" },
    "Contracted": { bg: "#e0e7ff", fg: "#3730a3" },
    "Contract-Initiated": { bg: "#ede9fe", fg: "#5b21b6" },
  };
  const c = colorMap[stage] ?? { bg: "#f3f4f6", fg: "#374151" };
  return (
    <span style={{
      marginLeft: 8, padding: "2px 7px", borderRadius: 999, fontSize: 10, fontWeight: 700,
      background: c.bg, color: c.fg, textTransform: "uppercase", letterSpacing: 0.4,
      verticalAlign: "middle",
    }}>
      {stage}
    </span>
  );
}

function SegmentedControl<T extends string>({ options, value, onChange }: {
  options: { key: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "inline-flex", border: "1px solid #d1d5db", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
      {options.map((o, i) => {
        const active = o.key === value;
        return (
          <button key={o.key} onClick={() => onChange(o.key)}
            style={{
              padding: "6px 12px", fontSize: 12, fontWeight: 600,
              border: "none", cursor: "pointer",
              background: active ? "#4f46e5" : "#fff",
              color: active ? "#fff" : "#374151",
              borderRight: i < options.length - 1 ? "1px solid #e5e7eb" : "none",
              transition: "background 0.15s",
            }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const thStyle: CSSProperties = {
  padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "#6b7280",
  textTransform: "uppercase", letterSpacing: 0.4, borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap",
};
const tdStyle: CSSProperties = { padding: "8px 12px", fontSize: 13, color: "#374151", whiteSpace: "nowrap" };
const dayCellStyle: CSSProperties = { padding: "3px 12px", fontSize: 12, color: "#4b5563", whiteSpace: "nowrap", lineHeight: 1.3 };

function KpiCard({ label, value, color, loading, sub }: {
  label: string; value: string | number; color: string; loading: boolean; sub?: string;
}) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: "14px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", border: "1px solid #e5e7eb", flex: "1 1 180px", minWidth: 170 }}>
      <div style={{ fontSize: 12, color: "#374151", fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
          <div className="agent-shimmer" style={{ height: 26, width: "55%" }}>&nbsp;</div>
          {sub !== undefined && <div className="agent-shimmer" style={{ height: 12, width: "40%" }}>&nbsp;</div>}
        </div>
      ) : (
        <>
          <div style={{ fontSize: 24, fontWeight: 700, color }}>
            {typeof value === "number" ? value.toLocaleString() : value}
          </div>
          {sub && <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500, marginTop: 2 }}>{sub}</div>}
        </>
      )}
    </div>
  );
}

function LineChart({ days, series }: { days: string[]; series: { name: string; color: string; values: number[] }[] }) {
  const width = 860;
  const height = 320;
  const padL = 50, padR = 16, padT = 16, padB = 42;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const allMax = Math.max(1, ...series.flatMap(s => s.values));
  const niceMax = niceCeil(allMax);

  const xFor = (i: number) =>
    days.length <= 1 ? padL + plotW / 2 : padL + (i * plotW) / (days.length - 1);
  const yFor = (v: number) => padT + plotH - (v / niceMax) * plotH;

  const yTicks = 5;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => (niceMax * i) / yTicks);
  const labelStep = Math.max(1, Math.ceil(days.length / 10));

  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const handleMouse = (e: React.MouseEvent<SVGRectElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const userX = ((e.clientX - rect.left) / rect.width) * width;
    if (days.length <= 1) { setHoverIdx(0); return; }
    const i = Math.round(((userX - padL) * (days.length - 1)) / plotW);
    setHoverIdx(Math.max(0, Math.min(days.length - 1, i)));
  };

  const tooltipX = hoverIdx !== null ? (xFor(hoverIdx) / width) * 100 : 0;
  const tooltipPlaceLeft = tooltipX > 60;

  return (
    <div style={{ position: "relative" }}>
      <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={width - padR} y1={yFor(t)} y2={yFor(t)} stroke="#f3f4f6" />
            <text x={padL - 8} y={yFor(t) + 4} textAnchor="end" fontSize="10" fill="#9ca3af">
              {Math.round(t).toLocaleString()}
            </text>
          </g>
        ))}
        {days.map((d, i) =>
          i % labelStep === 0 ? (
            <text key={d} x={xFor(i)} y={height - padB + 16} textAnchor="middle" fontSize="10" fill="#6b7280">
              {fmtDay(d)}
            </text>
          ) : null
        )}
        {series.map(s => {
          const d = s.values
            .map((v, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(2)} ${yFor(v).toFixed(2)}`)
            .join(" ");
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke={s.color} strokeWidth={2.25} />
              {s.values.map((v, i) => (
                <circle key={i} cx={xFor(i)} cy={yFor(v)} r={hoverIdx === i ? 4.5 : 3} fill={s.color} stroke="#fff" strokeWidth={hoverIdx === i ? 1.5 : 0} />
              ))}
            </g>
          );
        })}
        {hoverIdx !== null && (
          <line x1={xFor(hoverIdx)} x2={xFor(hoverIdx)} y1={padT} y2={padT + plotH}
            stroke="#9ca3af" strokeDasharray="3 3" strokeWidth={1} />
        )}
        <rect x={padL} y={padT} width={plotW} height={plotH} fill="transparent"
          onMouseMove={handleMouse} onMouseLeave={() => setHoverIdx(null)} />
      </svg>

      {hoverIdx !== null && (
        <div style={{
          position: "absolute", top: 16,
          left: tooltipPlaceLeft ? undefined : `calc(${tooltipX}% + 12px)`,
          right: tooltipPlaceLeft ? `calc(${100 - tooltipX}% + 12px)` : undefined,
          background: "#111827", color: "#fff", padding: "8px 12px", borderRadius: 8,
          fontSize: 12, boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
          pointerEvents: "none", minWidth: 180, zIndex: 10,
        }}>
          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>
            {fmtDay(days[hoverIdx])}
          </div>
          {series.map(s => (
            <div key={s.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "2px 0" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, display: "inline-block" }} />
                {s.name}
              </span>
              <span style={{ fontWeight: 700 }}>{(s.values[hoverIdx] ?? 0).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 10, paddingLeft: 4 }}>
        {series.map(s => (
          <div key={s.name} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#374151" }}>
            <span style={{ width: 14, height: 3, background: s.color, display: "inline-block", borderRadius: 2 }} />
            {s.name}
          </div>
        ))}
      </div>
    </div>
  );
}

function niceCeil(n: number): number {
  if (n <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(n)));
  const norm = n / pow;
  let nice;
  if (norm <= 1) nice = 1;
  else if (norm <= 2) nice = 2;
  else if (norm <= 5) nice = 5;
  else nice = 10;
  return nice * pow;
}

export default AgentsDashboard;
