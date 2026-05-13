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
  total_sms: number | null;
  eligible_campaign_leads: number | null;
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

type DateRange = "ALL" | "TODAY" | "WEEK" | "MTD" | "D30" | "CUSTOM";
const DATE_RANGES: { key: DateRange; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "TODAY", label: "Today" },
  { key: "WEEK", label: "This Week" },
  { key: "MTD", label: "MTD" },
  { key: "D30", label: "Last 30D" },
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
  if (range === "D30") {
    const start = new Date(today); start.setDate(start.getDate() - 29);
    const end = new Date(today); end.setDate(end.getDate() + 1);
    return d >= start && d < end;
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
  totalSms: number;
  eligible: number;
  fupSum: number;     // sum of avg_followups_till_appt × appts
  fupWeight: number;  // sum of appts where fup is non-null
  qSum: number;       // quality_score × total_leads
  qWeight: number;    // total_leads where quality_score is non-null
};
const EMPTY: Bucket = {
  totalLeads: 0, touched: 0, leadsWithCalls: 0, leadsWithSms: 0,
  qualified: 0, appts: 0, apptValue: 0, totalCalls: 0, totalSms: 0,
  eligible: 0, fupSum: 0, fupWeight: 0, qSum: 0, qWeight: 0,
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
    totalSms: num(r.total_sms),
    eligible: num(r.eligible_campaign_leads),
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
    totalSms: a.totalSms + b.totalSms,
    eligible: a.eligible + b.eligible,
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
  const [dateRange, setDateRange] = useState<DateRange>("D30");
  const [customRange, setCustomRange] = useState<CustomRange>(() => ({ from: "", to: todayIso() }));
  const [stageFilter, setStageFilter] = useState<Set<string>>(new Set());
  const [stageMasterList, setStageMasterList] = useState<string[]>([]);
  // Rooftop-name (lower-case, trimmed) → curated stage from the Google Sheets.
  // When present, this overrides Metabase's rooftop_stage value.
  const [rooftopToStage, setRooftopToStage] = useState<Map<string, string>>(new Map());
  const [search, setSearch] = useState("");
  const [selectedRooftops, setSelectedRooftops] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Sort state: null label means "default" (totalLeads desc, the original behavior).
  const [sort, setSort] = useState<{ label: string | null; dir: "asc" | "desc" }>({ label: null, dir: "desc" });

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

  // Stage roster from Google Sheets (via /api/agent-stages). Response shape:
  //   { stages: { Live: [...names], Onboarding: [...] }, rooftopToStage: {<lower-name>: stage}, errors: {...} }
  // The rooftopToStage map overrides Metabase's rooftop_stage per row (matched by
  // case-insensitive trimmed rooftop_name). Silent failure — if the endpoint is
  // unconfigured or returns the empty shape, we just fall back to data-derived stages.
  useEffect(() => {
    fetch(`${API_BASE}/api/agent-stages`, { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (!j) return;
        if (j.stages && typeof j.stages === "object" && !Array.isArray(j.stages)) {
          setStageMasterList(Object.keys(j.stages));
        }
        if (j.rooftopToStage && typeof j.rooftopToStage === "object") {
          const m = new Map<string, string>();
          for (const [k, v] of Object.entries(j.rooftopToStage)) {
            if (typeof v === "string") m.set(k.toLowerCase().trim(), v);
          }
          setRooftopToStage(m);
        }
      })
      .catch(() => { /* fall back to data-derived list */ });
  }, []);

  // Curated stage for a row — sheet override (by normalized rooftop_name) takes
  // precedence over Metabase's rooftop_stage.
  const effectiveStage = (r: AgentRowV3): string | null => {
    const name = (r.rooftop_name ?? "").toLowerCase().trim();
    if (name && rooftopToStage.has(name)) return rooftopToStage.get(name)!;
    return r.rooftop_stage ?? null;
  };

  // Reset row-expansion state whenever the active agent or filters narrow.
  useEffect(() => { setExpanded(new Set()); }, [activeAgent, dateRange, customRange, stageFilter, search, selectedRooftops]);
  // Reset sort when the agent (and therefore the column set) changes.
  useEffect(() => { setSort({ label: null, dir: "desc" }); }, [activeAgent]);

  // Stages observed in the data after sheet override is applied.
  const observedStages = useMemo(() => {
    const s = new Set<string>();
    rows.forEach(r => {
      const eff = effectiveStage(r);
      if (eff) s.add(eff);
    });
    return s;
  // effectiveStage closes over rooftopToStage; declare that as the dep.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, rooftopToStage]);

  // Master list = sheet order first (preserves the curated order), then any observed
  // stages not in the sheet appended at the end (highlighted as "(unlisted)").
  const stages = useMemo(() => {
    const out: { key: string; sublabel?: string }[] = [];
    const seen = new Set<string>();
    for (const s of stageMasterList) {
      if (!s || seen.has(s)) continue;
      seen.add(s);
      out.push({ key: s, sublabel: observedStages.has(s) ? undefined : "(no rooftops)" });
    }
    for (const s of Array.from(observedStages).sort()) {
      if (seen.has(s)) continue;
      seen.add(s);
      out.push({ key: s, sublabel: stageMasterList.length > 0 ? "(unlisted)" : undefined });
    }
    return out;
  }, [stageMasterList, observedStages]);

  const presentAgents = useMemo(() => {
    const s = new Set<AgentType>();
    rows.forEach(r => { if (r.agent_type) s.add(r.agent_type); });
    return s;
  }, [rows]);

  // Rooftops available in the current agent/date/stage scope. Used to populate the dropdown.
  const availableRooftops = useMemo(() => {
    const m = new Map<string, { key: string; label: string; enterprise: string }>();
    for (const r of rows) {
      if (r.agent_type !== activeAgent) continue;
      if (!inRange(r.day, dateRange, customRange)) continue;
      if (stageFilter.size > 0 && !stageFilter.has(effectiveStage(r) ?? "")) continue;
      const key = r.team_id || `${r.enterprise_name ?? ""}::${r.rooftop_name ?? ""}`;
      if (!m.has(key)) {
        m.set(key, { key, label: rooftopLabel(r), enterprise: enterpriseLabel(r) });
      }
    }
    return Array.from(m.values()).sort((a, b) => a.label.localeCompare(b.label));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, activeAgent, dateRange, customRange, stageFilter, rooftopToStage]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const hasSelection = selectedRooftops.size > 0;
    return rows.filter(r => {
      if (r.agent_type !== activeAgent) return false;
      if (!inRange(r.day, dateRange, customRange)) return false;
      if (stageFilter.size > 0 && !stageFilter.has(effectiveStage(r) ?? "")) return false;
      if (hasSelection) {
        const key = r.team_id || `${r.enterprise_name ?? ""}::${r.rooftop_name ?? ""}`;
        if (!selectedRooftops.has(key)) return false;
      }
      if (q) {
        const hay = `${rooftopLabel(r)} ${enterpriseLabel(r)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, activeAgent, dateRange, customRange, stageFilter, search, selectedRooftops, rooftopToStage]);

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
          stage: effectiveStage(r), daily: [], total: { ...EMPTY },
        };
        m.set(key, entry);
      }
      const prev = stageMap.get(key);
      if (!prev || r.day > prev.day) stageMap.set(key, { day: r.day, stage: effectiveStage(r) });
      const proj = projectRow(r);
      entry.total = add(entry.total, proj);
      entry.daily.push({ day: r.day, ...proj });
    }
    for (const [key, entry] of m) entry.stage = stageMap.get(key)?.stage ?? entry.stage;
    for (const e of m.values()) e.daily.sort((a, b) => a.day.localeCompare(b.day));
    return Array.from(m.values());
  // effectiveStage closes over rooftopToStage — list it so the agg re-runs on load.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, rooftopToStage]);

  const sortedRooftopRows = useMemo(() => {
    const rows = [...rooftopRows];
    const cols = columnsFor(activeAgent);
    // Rooftop / Day header → sort by rooftop name. Any metric col → sort by its sortValue.
    if (sort.label === "Rooftop / Day") {
      rows.sort((a, b) => a.rooftop.localeCompare(b.rooftop));
      if (sort.dir === "desc") rows.reverse();
      return rows;
    }
    const col = sort.label ? cols.find(c => c.label === sort.label) : null;
    if (!col) {
      // Default: total leads desc (preserve historical behavior).
      rows.sort((a, b) => b.total.totalLeads - a.total.totalLeads);
      return rows;
    }
    rows.sort((a, b) => {
      const av = col.sortValue(a.total);
      const bv = col.sortValue(b.total);
      return sort.dir === "asc" ? av - bv : bv - av;
    });
    return rows;
  }, [rooftopRows, sort, activeAgent]);

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
  const expandAll = () => setExpanded(new Set(sortedRooftopRows.map(r => r.key)));
  const collapseAll = () => setExpanded(new Set());

  const onSort = (label: string) => {
    setSort(prev => {
      if (prev.label === label) return { label, dir: prev.dir === "asc" ? "desc" : "asc" };
      // First click defaults to desc for metrics (largest first) and asc for the name column.
      return { label, dir: label === "Rooftop / Day" ? "asc" : "desc" };
    });
  };

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
            outbound, campaign-day attribution. Rooftop stage is taken from the curated Google
            Sheets (one sheet per stage) when a match exists; otherwise Metabase's
            <code>rooftop_stage</code> is used. Live and Churned counts use the most recent day's
            stage per <code>team_id</code> within the active filters.
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
        <MultiSelectDropdown
          options={stages.map(s => ({ key: s.key, label: s.key, sublabel: s.sublabel }))}
          selected={stageFilter}
          onChange={setStageFilter}
          headerLabel="Stage"
          allLabel="All stages"
          pluralUnit="stages"
          searchPlaceholder="Search stage…"
          minWidth={180}
        />
        <MultiSelectDropdown
          options={availableRooftops.map(r => ({ key: r.key, label: r.label, sublabel: r.enterprise }))}
          selected={selectedRooftops}
          onChange={setSelectedRooftops}
          headerLabel="Rooftops"
          allLabel="All rooftops"
          pluralUnit="rooftops"
          searchPlaceholder="Search rooftop…"
        />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search enterprise…"
          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, minWidth: 180 }} />
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
        totalRooftops={rooftopRows.length}
        loading={showingPlaceholder}
      />

      {/* Chart — single plot, dual Y-axes so large- and small-scale series share the canvas */}
      {(() => {
        const spec = chartSpecFor(activeAgent, daily);
        return (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: 16, marginBottom: 20, position: "relative" }}>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>
                Day-on-day — {spec.title}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                Left axis: {spec.leftLabel}. Right axis: {spec.rightLabel}. Hover for day-level details.
              </div>
            </div>
            {showingPlaceholder ? (
              <div className="agent-shimmer" style={{ height: 320 }} />
            ) : days.length === 0 ? (
              <div style={{ height: 320, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 13 }}>
                No data — widen your filters or pick a different date range.
              </div>
            ) : (
              <LineChart days={days} series={spec.series} leftLabel={spec.leftLabel} rightLabel={spec.rightLabel} />
            )}
          </div>
        );
      })()}

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
            rows={sortedRooftopRows}
            expanded={expanded}
            onToggle={toggleExpand}
            loading={showingPlaceholder}
            sort={sort}
            onSort={onSort}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Per-agent KPI strip ─────────────────────────────────────────────────────

type KpiSpec = { label: string; value: string | number; color: string; sub?: string };

function KpiStrip({ agent, totals, liveRooftops, churnedRooftops, totalRooftops, loading }: {
  agent: AgentType;
  totals: Bucket;
  liveRooftops: number;
  churnedRooftops: number;
  totalRooftops: number;
  loading: boolean;
}) {
  const channelMix = (b: Bucket) => `${fmtNum(b.leadsWithCalls)} via calls · ${fmtNum(b.leadsWithSms)} via SMS`;

  // MAIN — the four headline metrics. For Service IB there is no separate "total
  // leads" concept (it's a phone answering service), so Touched is the head metric;
  // we substitute Total Calls in the first slot to keep volume visible.
  const totalLabel = agent === "Sales Outbound" ? "Total Leads Synced"
                   : agent === "Service Outbound" ? "Total Leads Synced"
                   : agent === "Service Inbound" ? "Total Calls"
                   : "Unique Leads";
  const totalValue = agent === "Service Inbound" ? totals.totalCalls : totals.totalLeads;
  const totalSub = agent === "Service Inbound" && totals.leadsWithCalls > 0
    ? `${fmtNum(totals.leadsWithCalls)} unique leads`
    : undefined;

  const main: KpiSpec[] = [
    { label: totalLabel, value: fmtNum(totalValue), color: "#6366f1", sub: totalSub },
    { label: "Touched", value: fmtNum(totals.touched), color: "#0ea5e9", sub: channelMix(totals) },
    { label: "Qualified", value: fmtNum(totals.qualified), color: "#0d9488", sub: fmtRate(totals.qualified, totals.touched) + " of touched" },
    { label: "Appointments", value: fmtNum(totals.appts), color: "#22c55e", sub: fmtRate(totals.appts, totals.touched) + " of touched" },
  ];

  // SECONDARY — smaller cards. Always include the user-requested core four
  // (calls/sms, followups, conv rate, total accounts); fold in agent-specific
  // extras after that.
  const accountsSub = `${liveRooftops} live · ${churnedRooftops} churned`;
  const secondary: KpiSpec[] = [
    { label: "Total Calls", value: fmtNum(totals.totalCalls), color: "#6366f1",
      sub: totals.leadsWithCalls > 0 ? `${fmtNum(totals.leadsWithCalls)} unique leads` : undefined },
    { label: "Total SMS", value: fmtNum(totals.totalSms), color: "#0ea5e9",
      sub: totals.leadsWithSms > 0 ? `${fmtNum(totals.leadsWithSms)} unique leads` : undefined },
    { label: "Conversion Rate", value: fmtRate(totals.appts, totals.touched), color: "#15803d", sub: "appts / touched" },
    { label: "Followups till Appt", value: fmtFollowups(totals), color: "#9333ea", sub: "SMS + calls per appt" },
    { label: "Total Accounts", value: fmtNum(totalRooftops), color: "#475569", sub: accountsSub },
    { label: "Appointment Value", value: fmtCurrency(totals.apptValue), color: "#ea580c" },
    { label: "Quality Score", value: fmtScore(totals), color: "#db2777", sub: "lead-weighted" },
  ];

  // OB-specific extra (still emitted by the SQL).
  if (agent === "Sales Outbound" || agent === "Service Outbound") {
    secondary.push(
      { label: "Eligible", value: fmtNum(totals.eligible), color: "#0369a1",
        sub: fmtRate(totals.eligible, totals.totalLeads) + " of total" },
    );
  }
  if (agent === "Sales Inbound") {
    secondary.push({ label: "Coverage", value: fmtRate(totals.touched, totals.totalLeads), color: "#8b5cf6", sub: "touched / unique" });
  }

  return (
    <div style={{ marginBottom: 18 }}>
      {/* MAIN — large headline cards */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        {main.map(c => (
          <KpiCard key={c.label} label={c.label} value={c.value} color={c.color} loading={loading} sub={c.sub} size="main" />
        ))}
      </div>
      {/* SECONDARY — smaller cards under the main row */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {secondary.map(c => (
          <KpiCard key={c.label} label={c.label} value={c.value} color={c.color} loading={loading} sub={c.sub} size="secondary" />
        ))}
      </div>
    </div>
  );
}

// ─── Per-agent chart series ──────────────────────────────────────────────────

// Series get assigned to one of two Y-axes. Large-scale series ride the LEFT axis,
// smaller-scale series ride the RIGHT axis. Both render in the same plot area —
// each series is just scaled by its own axis max.
type Axis = "L" | "R";
type ChartSeries = { name: string; color: string; values: number[]; axis: Axis };
type ChartSpec = {
  title: string;
  series: ChartSeries[];
  leftLabel: string;
  rightLabel: string;
};
function chartSpecFor(agent: AgentType, daily: Bucket[]): ChartSpec {
  // Four lines only across all agents: Total · Touched · Qualified · Appointments.
  // "Total" = unique leads volume; for Service Inbound (no leads-creation count) we
  // use Total Calls as the volume series on the left axis.
  const totalLabel = agent === "Sales Outbound" ? "Total Leads Synced"
                   : agent === "Service Outbound" ? "Total Leads Synced"
                   : agent === "Service Inbound" ? "Total Calls"
                   : "Unique Leads";
  const totalValues = agent === "Service Inbound"
    ? daily.map(d => d.totalCalls)
    : daily.map(d => d.totalLeads);
  return {
    title: `${totalLabel} · Touched · Qualified · Appointments`,
    leftLabel: totalLabel,
    rightLabel: "Touched / Qualified / Appts",
    series: [
      { name: totalLabel,     color: "#6366f1", values: totalValues,               axis: "L" },
      { name: "Touched",      color: "#0ea5e9", values: daily.map(d => d.touched),   axis: "R" },
      { name: "Qualified",    color: "#0d9488", values: daily.map(d => d.qualified), axis: "R" },
      { name: "Appointments", color: "#22c55e", values: daily.map(d => d.appts),     axis: "R" },
    ],
  };
}

// ─── Per-agent rooftop table ─────────────────────────────────────────────────

type RooftopRowData = {
  key: string; rooftop: string; enterprise: string; stage: string | null;
  daily: ({ day: string } & Bucket)[]; total: Bucket;
};

function RooftopTable({ agent, rows, expanded, onToggle, loading, sort, onSort }: {
  agent: AgentType;
  rows: RooftopRowData[];
  expanded: Set<string>;
  onToggle: (k: string) => void;
  loading: boolean;
  sort: { label: string | null; dir: "asc" | "desc" };
  onSort: (label: string) => void;
}) {
  const cols = columnsFor(agent);
  const totalCols = cols.length + 2; // arrow + rooftop label + metrics

  const sortIndicator = (label: string) => {
    if (sort.label !== label) return <span style={{ color: "#d1d5db", marginLeft: 4 }}>⇅</span>;
    return <span style={{ color: "#4f46e5", marginLeft: 4 }}>{sort.dir === "asc" ? "▲" : "▼"}</span>;
  };

  const sortableHeaderStyle = (label: string): CSSProperties => ({
    cursor: "pointer",
    userSelect: "none",
    color: sort.label === label ? "#4f46e5" : thStyle.color,
  });

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead style={{ position: "sticky", top: 0, background: "#f9fafb", zIndex: 1 }}>
        <tr>
          <th style={{ ...thStyle, width: 30 }} />
          <th
            style={{ ...thStyle, ...sortableHeaderStyle("Rooftop / Day"), textAlign: "left", minWidth: 240 }}
            onClick={() => onSort("Rooftop / Day")}>
            Rooftop / Day{sortIndicator("Rooftop / Day")}
          </th>
          {cols.map(c => (
            <th
              key={c.label}
              style={{ ...thStyle, ...sortableHeaderStyle(c.label), textAlign: "right", minWidth: c.minWidth ?? 100 }}
              onClick={() => onSort(c.label)}>
              {c.label}{sortIndicator(c.label)}
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

type Col = {
  label: string;
  render: (b: Bucket) => string;
  sortValue: (b: Bucket) => number;
  minWidth?: number;
  emphasize?: boolean;
};

// Compact "calls / sms" leads cell.
const fmtChannelMix = (b: Bucket): string =>
  b.leadsWithCalls === 0 && b.leadsWithSms === 0
    ? "—"
    : `${fmtNum(b.leadsWithCalls)} / ${fmtNum(b.leadsWithSms)}`;

const safeRate = (n: number, d: number) => (d > 0 ? n / d : -1); // -1 sinks "—" to bottom on desc

function columnsFor(agent: AgentType): Col[] {
  if (agent === "Sales Inbound") {
    return [
      { label: "Unique Leads", render: b => fmtNum(b.totalLeads), sortValue: b => b.totalLeads, emphasize: true },
      { label: "Touched", render: b => fmtNum(b.touched), sortValue: b => b.touched },
      { label: "Calls / SMS", render: fmtChannelMix, sortValue: b => b.leadsWithCalls + b.leadsWithSms, minWidth: 100 },
      { label: "Total Calls", render: b => fmtNum(b.totalCalls), sortValue: b => b.totalCalls },
      { label: "Total SMS", render: b => fmtNum(b.totalSms), sortValue: b => b.totalSms },
      { label: "Qualified", render: b => fmtNum(b.qualified), sortValue: b => b.qualified },
      { label: "Coverage", render: b => fmtRate(b.touched, b.totalLeads), sortValue: b => safeRate(b.touched, b.totalLeads), minWidth: 90 },
      { label: "Appts", render: b => fmtNum(b.appts), sortValue: b => b.appts, emphasize: true },
      { label: "Conv. Rate", render: b => fmtRate(b.appts, b.touched), sortValue: b => safeRate(b.appts, b.touched), minWidth: 90 },
      { label: "Appt $", render: b => fmtCurrency(b.apptValue), sortValue: b => b.apptValue, minWidth: 90 },
      { label: "Quality", render: b => fmtScore(b), sortValue: b => (b.qWeight > 0 ? b.qSum / b.qWeight : -1), minWidth: 80 },
    ];
  }
  if (agent === "Service Inbound") {
    return [
      { label: "Touched", render: b => fmtNum(b.touched), sortValue: b => b.touched, emphasize: true },
      { label: "Calls / SMS", render: fmtChannelMix, sortValue: b => b.leadsWithCalls + b.leadsWithSms, minWidth: 100 },
      { label: "Total Calls", render: b => fmtNum(b.totalCalls), sortValue: b => b.totalCalls },
      { label: "Total SMS", render: b => fmtNum(b.totalSms), sortValue: b => b.totalSms },
      { label: "Qualified", render: b => fmtNum(b.qualified), sortValue: b => b.qualified },
      { label: "Appts", render: b => fmtNum(b.appts), sortValue: b => b.appts, emphasize: true },
      { label: "Conv. Rate", render: b => fmtRate(b.appts, b.touched), sortValue: b => safeRate(b.appts, b.touched), minWidth: 90 },
      { label: "Appt $", render: b => fmtCurrency(b.apptValue), sortValue: b => b.apptValue, minWidth: 90 },
      { label: "Quality", render: b => fmtScore(b), sortValue: b => (b.qWeight > 0 ? b.qSum / b.qWeight : -1), minWidth: 80 },
    ];
  }
  // Sales OB & Service OB share columns
  const leadsLabel = "Total Leads Synced";
  return [
    { label: leadsLabel, render: b => fmtNum(b.totalLeads), sortValue: b => b.totalLeads, emphasize: true },
    { label: "Eligible", render: b => fmtNum(b.eligible), sortValue: b => b.eligible },
    { label: "Touched", render: b => fmtNum(b.touched), sortValue: b => b.touched },
    { label: "Calls / SMS", render: fmtChannelMix, sortValue: b => b.leadsWithCalls + b.leadsWithSms, minWidth: 100 },
    { label: "Total Calls", render: b => fmtNum(b.totalCalls), sortValue: b => b.totalCalls },
    { label: "Total SMS", render: b => fmtNum(b.totalSms), sortValue: b => b.totalSms },
    { label: "Qualified", render: b => fmtNum(b.qualified), sortValue: b => b.qualified },
    { label: "Appts", render: b => fmtNum(b.appts), sortValue: b => b.appts, emphasize: true },
    { label: "Conv. Rate", render: b => fmtRate(b.appts, b.touched), sortValue: b => safeRate(b.appts, b.touched), minWidth: 90 },
    { label: "Appt $", render: b => fmtCurrency(b.apptValue), sortValue: b => b.apptValue, minWidth: 90 },
    { label: "Followups", render: b => fmtFollowups(b), sortValue: b => (b.fupWeight > 0 ? b.fupSum / b.fupWeight : -1), minWidth: 90 },
    { label: "Quality", render: b => fmtScore(b), sortValue: b => (b.qWeight > 0 ? b.qSum / b.qWeight : -1), minWidth: 80 },
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

type MultiSelectOption = { key: string; label: string; sublabel?: string };

function MultiSelectDropdown({
  options, selected, onChange,
  headerLabel, allLabel, pluralUnit, searchPlaceholder, minWidth = 200,
}: {
  options: MultiSelectOption[];
  selected: Set<string>;
  onChange: (s: Set<string>) => void;
  headerLabel: string;       // e.g. "Rooftops", "Stage"
  allLabel: string;          // e.g. "All rooftops", "All stages"
  pluralUnit: string;        // e.g. "rooftops", "stages"
  searchPlaceholder: string;
  minWidth?: number;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const q = query.trim().toLowerCase();
  const visible = q
    ? options.filter(o =>
        o.label.toLowerCase().includes(q) ||
        (o.sublabel ?? "").toLowerCase().includes(q))
    : options;

  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key); else next.add(key);
    onChange(next);
  };

  const clearAll = () => onChange(new Set());

  const buttonLabel = selected.size === 0
    ? allLabel
    : selected.size === 1
      ? (options.find(o => selected.has(o.key))?.label ?? `1 ${pluralUnit}`)
      : `${selected.size} ${pluralUnit}`;

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button onClick={() => setOpen(v => !v)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db",
          background: "#fff", fontSize: 13, fontWeight: 600, color: "#374151",
          cursor: "pointer", minWidth,
        }}>
        <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>{headerLabel}</span>
        <span style={{ flex: 1, textAlign: "left", color: selected.size === 0 ? "#9ca3af" : "#111827", fontWeight: selected.size === 0 ? 500 : 600 }}>
          {buttonLabel}
        </span>
        <span style={{ color: "#9ca3af", fontSize: 10 }}>▼</span>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 20,
          background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
          boxShadow: "0 6px 20px rgba(0,0,0,0.08)", padding: 10, minWidth: 280, maxWidth: 360,
        }}>
          <input
            autoFocus
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            style={{
              width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db",
              fontSize: 13, marginBottom: 8, boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, fontSize: 11, color: "#6b7280" }}>
            <span>{visible.length} of {options.length}</span>
            {selected.size > 0 && (
              <button onClick={clearAll}
                style={{ background: "transparent", border: "none", color: "#4f46e5", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0 }}>
                Clear ({selected.size})
              </button>
            )}
          </div>
          <div style={{ maxHeight: 280, overflowY: "auto", borderTop: "1px solid #f3f4f6" }}>
            {visible.length === 0 ? (
              <div style={{ padding: "16px 8px", textAlign: "center", color: "#9ca3af", fontSize: 12 }}>
                No matches
              </div>
            ) : visible.map(o => {
              const checked = selected.has(o.key);
              return (
                <label key={o.key}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "6px 4px", borderRadius: 4, cursor: "pointer",
                    background: checked ? "#eef2ff" : "transparent",
                  }}>
                  <input type="checkbox" checked={checked} onChange={() => toggle(o.key)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "#111827", fontWeight: checked ? 600 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {o.label}
                    </div>
                    {o.sublabel && o.sublabel !== o.label && (
                      <div style={{ fontSize: 11, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {o.sublabel}
                      </div>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
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

function KpiCard({ label, value, color, loading, sub, size = "main" }: {
  label: string; value: string | number; color: string; loading: boolean; sub?: string;
  size?: "main" | "secondary";
}) {
  const isMain = size === "main";
  return (
    <div style={{
      background: "#fff", borderRadius: 12,
      padding: isMain ? "16px 22px" : "10px 14px",
      boxShadow: isMain ? "0 1px 3px rgba(0,0,0,0.06)" : "0 1px 2px rgba(0,0,0,0.04)",
      border: "1px solid #e5e7eb",
      flex: isMain ? "1 1 220px" : "1 1 150px",
      minWidth: isMain ? 200 : 140,
    }}>
      <div style={{
        fontSize: isMain ? 12 : 11,
        color: isMain ? "#374151" : "#6b7280",
        fontWeight: 600,
        marginBottom: isMain ? 6 : 2,
        textTransform: isMain ? "none" : "uppercase",
        letterSpacing: isMain ? 0 : 0.4,
      }}>
        {label}
      </div>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
          <div className="agent-shimmer" style={{ height: isMain ? 30 : 18, width: "55%" }}>&nbsp;</div>
          {sub !== undefined && <div className="agent-shimmer" style={{ height: 10, width: "40%" }}>&nbsp;</div>}
        </div>
      ) : (
        <>
          <div style={{ fontSize: isMain ? 30 : 18, fontWeight: 700, color, lineHeight: 1.1 }}>
            {typeof value === "number" ? value.toLocaleString() : value}
          </div>
          {sub && (
            <div style={{ fontSize: isMain ? 11 : 10, color: "#9ca3af", fontWeight: 500, marginTop: isMain ? 4 : 2 }}>
              {sub}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LineChart({ days, series, leftLabel, rightLabel }: {
  days: string[];
  series: { name: string; color: string; values: number[]; axis: "L" | "R" }[];
  leftLabel?: string;
  rightLabel?: string;
}) {
  const width = 860;
  const height = 320;
  const padL = 60, padR = 60, padT = 16, padB = 42;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  // Per-series visibility. Click a legend chip to toggle; visible series re-scale
  // the axes so isolating a small line zooms it up automatically.
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  // If a series-set change removes a name, drop it from the hidden set so we don't
  // pin stale state across agent switches.
  useEffect(() => {
    const names = new Set(series.map(s => s.name));
    setHidden(prev => {
      let changed = false;
      const next = new Set<string>();
      for (const n of prev) { if (names.has(n)) next.add(n); else changed = true; }
      return changed ? next : prev;
    });
  }, [series]);

  const toggle = (name: string) => {
    setHidden(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      // Don't allow hiding every series — keep at least one visible.
      if (next.size >= series.length) return prev;
      return next;
    });
  };

  const isVisible = (name: string) => !hidden.has(name);
  const visibleSeries = series.filter(s => isVisible(s.name));
  const leftSeries  = visibleSeries.filter(s => s.axis === "L");
  const rightSeries = visibleSeries.filter(s => s.axis === "R");
  const hasRight = rightSeries.length > 0;

  const leftMax  = niceCeil(Math.max(1, ...leftSeries.flatMap(s => s.values)));
  const rightMax = niceCeil(Math.max(1, ...rightSeries.flatMap(s => s.values)));

  const xFor = (i: number) =>
    days.length <= 1 ? padL + plotW / 2 : padL + (i * plotW) / (days.length - 1);
  const yForAxis = (v: number, axis: "L" | "R") =>
    padT + plotH - (v / (axis === "L" ? leftMax : rightMax)) * plotH;

  const yTicks = 5;
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

  // Pick a color hint for each axis label — use the first series on that axis.
  const leftAxisColor  = leftSeries[0]?.color  ?? "#6b7280";
  const rightAxisColor = rightSeries[0]?.color ?? "#6b7280";

  return (
    <div style={{ position: "relative" }}>
      <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {/* Gridlines + LEFT axis tick labels (aligned to leftMax) */}
        {Array.from({ length: yTicks + 1 }, (_, i) => {
          const t = (leftMax * i) / yTicks;
          const y = padT + plotH - (i / yTicks) * plotH;
          return (
            <g key={`l-${i}`}>
              <line x1={padL} x2={width - padR} y1={y} y2={y} stroke="#f3f4f6" />
              <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="10" fill={leftAxisColor}>
                {Math.round(t).toLocaleString()}
              </text>
            </g>
          );
        })}
        {/* RIGHT axis tick labels (scaled to rightMax) */}
        {hasRight && Array.from({ length: yTicks + 1 }, (_, i) => {
          const t = (rightMax * i) / yTicks;
          const y = padT + plotH - (i / yTicks) * plotH;
          return (
            <text key={`r-${i}`} x={width - padR + 8} y={y + 4} textAnchor="start" fontSize="10" fill={rightAxisColor}>
              {Math.round(t).toLocaleString()}
            </text>
          );
        })}
        {/* Axis vertical rules */}
        <line x1={padL} x2={padL} y1={padT} y2={padT + plotH} stroke="#e5e7eb" />
        {hasRight && <line x1={width - padR} x2={width - padR} y1={padT} y2={padT + plotH} stroke="#e5e7eb" />}

        {/* Axis titles */}
        {leftLabel && (
          <text x={padL - 50} y={padT + plotH / 2} textAnchor="middle" fontSize="10" fill={leftAxisColor}
            transform={`rotate(-90 ${padL - 50} ${padT + plotH / 2})`} style={{ fontWeight: 600 }}>
            {leftLabel}
          </text>
        )}
        {hasRight && rightLabel && (
          <text x={width - padR + 50} y={padT + plotH / 2} textAnchor="middle" fontSize="10" fill={rightAxisColor}
            transform={`rotate(90 ${width - padR + 50} ${padT + plotH / 2})`} style={{ fontWeight: 600 }}>
            {rightLabel}
          </text>
        )}

        {days.map((d, i) =>
          i % labelStep === 0 ? (
            <text key={d} x={xFor(i)} y={height - padB + 16} textAnchor="middle" fontSize="10" fill="#6b7280">
              {fmtDay(d)}
            </text>
          ) : null
        )}
        {visibleSeries.map(s => {
          const d = s.values
            .map((v, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(2)} ${yForAxis(v, s.axis).toFixed(2)}`)
            .join(" ");
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke={s.color} strokeWidth={2.25} />
              {s.values.map((v, i) => (
                <circle key={i} cx={xFor(i)} cy={yForAxis(v, s.axis)} r={hoverIdx === i ? 4.5 : 3} fill={s.color} stroke="#fff" strokeWidth={hoverIdx === i ? 1.5 : 0} />
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
          {visibleSeries.map(s => (
            <div key={s.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "2px 0" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, display: "inline-block" }} />
                {s.name}
                <span style={{ fontSize: 10, color: "#9ca3af", marginLeft: 2 }}>({s.axis})</span>
              </span>
              <span style={{ fontWeight: 700 }}>{(s.values[hoverIdx] ?? 0).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* Toggleable legend — click to hide/show a series. Axes auto-rescale to what's visible. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10, paddingLeft: 4, alignItems: "center" }}>
        {series.map(s => {
          const visible = isVisible(s.name);
          return (
            <button
              key={s.name}
              onClick={() => toggle(s.name)}
              title={visible ? `Click to hide ${s.name}` : `Click to show ${s.name}`}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "4px 10px", borderRadius: 999,
                border: `1px solid ${visible ? s.color : "#e5e7eb"}`,
                background: visible ? `${s.color}10` : "#fff",
                color: visible ? "#111827" : "#9ca3af",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
                opacity: visible ? 1 : 0.6,
                transition: "all 0.15s",
              }}>
              <span style={{
                width: 14, height: 3, background: visible ? s.color : "#d1d5db",
                display: "inline-block", borderRadius: 2,
              }} />
              <span style={{ textDecoration: visible ? "none" : "line-through" }}>{s.name}</span>
              <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 500 }}>
                ({s.axis === "L" ? "left" : "right"})
              </span>
            </button>
          );
        })}
        {hidden.size > 0 && (
          <button onClick={() => setHidden(new Set())}
            style={{
              marginLeft: 4, padding: "4px 10px", borderRadius: 999,
              border: "1px solid #d1d5db", background: "#fff",
              fontSize: 11, fontWeight: 600, color: "#4f46e5", cursor: "pointer",
            }}>
            Show all
          </button>
        )}
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
