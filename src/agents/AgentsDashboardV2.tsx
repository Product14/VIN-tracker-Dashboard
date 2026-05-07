import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

type AgentType = "Sales Inbound" | "Service Inbound" | "Sales Outbound" | "Service Outbound";

type AgentRowV2 = {
  day: string;

  enterprise_id: string;
  team_id: string;
  enterprise_name: string;
  rooftop_name: string;

  agent_type: AgentType;
  stage: string | null;

  total_leads: number | null;
  total_conversations: number | null;
  total_leads_with_calls: number | null;
  total_leads_with_sms: number | null;
  total_leads_with_chat: number | null;

  total_qualified: number | null;
  total_connected_calls: number | null;
  total_callbacks_or_transfers: number | null;

  total_sms_engaged_leads: number | null;
  total_received_sms: number | null;
  sms_response_rate: number | null;
  sms_booking_rate: number | null;
  sms_avg_conversation_depth: number | null;

  total_appointments: number | null;

  qualified_rate: number | null;
  connected_rate: number | null;
  callback_or_transfer_rate: number | null;
  appointment_booking_rate: number | null;

  avg_score_percentage: number | null;
};

const AGENT_TYPES: AgentType[] = ["Sales Inbound", "Service Inbound", "Sales Outbound", "Service Outbound"];

const AGENT_TYPE_COLORS: Record<AgentType, string> = {
  "Sales Inbound": "#f59e0b",
  "Service Inbound": "#22c55e",
  "Sales Outbound": "#6366f1",
  "Service Outbound": "#0ea5e9",
};

const isInbound = (t: AgentType) => t.endsWith("Inbound");
const isOutbound = (t: AgentType) => t.endsWith("Outbound");

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const rooftopLabel = (r: AgentRowV2): string =>
  r.rooftop_name?.trim() || r.enterprise_name?.trim() || r.team_id || "Unknown";

const enterpriseLabel = (r: AgentRowV2): string => r.enterprise_name?.trim() || "";

type DateRange = "ALL" | "TODAY" | "WEEK" | "MTD";
const DATE_RANGES: { key: DateRange; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "TODAY", label: "Today" },
  { key: "WEEK", label: "This Week" },
  { key: "MTD", label: "MTD" },
];

function fmtDay(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeekMon(d: Date): Date {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  x.setDate(x.getDate() + diff);
  return x;
}

function inRange(iso: string, range: DateRange): boolean {
  if (range === "ALL") return true;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  const today = startOfDay(new Date());
  if (range === "TODAY") return startOfDay(d).getTime() === today.getTime();
  if (range === "WEEK") {
    const wk = startOfWeekMon(today);
    const wkEnd = new Date(wk);
    wkEnd.setDate(wk.getDate() + 7);
    return d >= wk && d < wkEnd;
  }
  if (range === "MTD") {
    const mStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const mEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    return d >= mStart && d < mEnd;
  }
  return true;
}

type DayBucket = {
  leads: number;
  conversations: number;
  leadsWithCalls: number;
  leadsWithSms: number;
  leadsWithChat: number;
  qualified: number;
  connectedCalls: number;
  callbacksOrTransfers: number;
  appts: number;
  scoreSum: number;
  scoreCount: number;
  smsEngaged: number;
  smsReceived: number;
  smsAppts: number;
  inboundLeads: number;
  outboundLeads: number;
};
const EMPTY_BUCKET: DayBucket = {
  leads: 0, conversations: 0,
  leadsWithCalls: 0, leadsWithSms: 0, leadsWithChat: 0,
  qualified: 0, connectedCalls: 0, callbacksOrTransfers: 0, appts: 0,
  scoreSum: 0, scoreCount: 0,
  smsEngaged: 0, smsReceived: 0, smsAppts: 0,
  inboundLeads: 0, outboundLeads: 0,
};

function projectRow(r: AgentRowV2): DayBucket {
  const leads = num(r.total_leads);
  const inbound = isInbound(r.agent_type);
  const score = r.avg_score_percentage;
  // total_conversations = total_leads on outbound per the server contract;
  // we fall back to leads if the row came through with a null for some reason.
  const conversations = r.total_conversations != null ? num(r.total_conversations) : leads;
  const engaged = inbound ? num(r.total_sms_engaged_leads) : 0;
  // SMS-sourced appointments aren't returned as a count; derive from rate × engaged.
  const smsAppts = engaged > 0 && r.sms_booking_rate != null
    ? Math.round(num(r.sms_booking_rate) * engaged)
    : 0;
  return {
    leads,
    conversations,
    leadsWithCalls: num(r.total_leads_with_calls),
    leadsWithSms: inbound ? num(r.total_leads_with_sms) : 0,
    leadsWithChat: inbound ? num(r.total_leads_with_chat) : 0,
    qualified: num(r.total_qualified),
    connectedCalls: num(r.total_connected_calls),
    callbacksOrTransfers: num(r.total_callbacks_or_transfers),
    appts: num(r.total_appointments),
    scoreSum: score != null && inbound ? num(score) * leads : 0,
    scoreCount: score != null && inbound ? leads : 0,
    smsEngaged: engaged,
    smsReceived: inbound ? num(r.total_received_sms) : 0,
    smsAppts,
    inboundLeads: inbound ? leads : 0,
    outboundLeads: inbound ? 0 : leads,
  };
}

function addBucket(a: DayBucket, b: DayBucket): DayBucket {
  return {
    leads: a.leads + b.leads,
    conversations: a.conversations + b.conversations,
    leadsWithCalls: a.leadsWithCalls + b.leadsWithCalls,
    leadsWithSms: a.leadsWithSms + b.leadsWithSms,
    leadsWithChat: a.leadsWithChat + b.leadsWithChat,
    qualified: a.qualified + b.qualified,
    connectedCalls: a.connectedCalls + b.connectedCalls,
    callbacksOrTransfers: a.callbacksOrTransfers + b.callbacksOrTransfers,
    appts: a.appts + b.appts,
    scoreSum: a.scoreSum + b.scoreSum,
    scoreCount: a.scoreCount + b.scoreCount,
    smsEngaged: a.smsEngaged + b.smsEngaged,
    smsReceived: a.smsReceived + b.smsReceived,
    smsAppts: a.smsAppts + b.smsAppts,
    inboundLeads: a.inboundLeads + b.inboundLeads,
    outboundLeads: a.outboundLeads + b.outboundLeads,
  };
}

type MiddleMode = "connected" | "qualified" | "both";

function middleValue(b: DayBucket, mode: MiddleMode): number {
  if (mode === "connected") return b.connectedCalls;
  if (mode === "qualified") return b.qualified;
  return b.qualified + b.connectedCalls;
}

// Connected mode uses leadsWithCalls; qualified/mixed use conversations.
// Conversations equals leads on outbound rows per the server contract, so
// a mixed-mode denom is additive-equivalent to conversations summed.
function middleDenom(b: DayBucket, mode: MiddleMode): number {
  if (mode === "connected") return b.leadsWithCalls;
  return b.conversations;
}

function apptDenom(b: DayBucket): number {
  return b.conversations;
}

function fmtPct(n: number, denom: number): string {
  if (!denom) return "—";
  return `${((n / denom) * 100).toFixed(1)}%`;
}

function AgentsDashboardV2() {
  const [rows, setRows] = useState<AgentRowV2[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const [active, setActive] = useState<Record<AgentType, boolean>>({
    "Sales Inbound": true,
    "Service Inbound": true,
    "Sales Outbound": true,
    "Service Outbound": true,
  });
  const [dateRange, setDateRange] = useState<DateRange>("ALL");
  const [stageFilter, setStageFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = (force = false) => {
    setLoading(true);
    setError(null);
    const url = `${API_BASE}/api/agents-v2${force ? `?refresh=1&t=${Date.now()}` : ""}`;
    fetch(url, { cache: "no-store" })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(j => {
        setRows(j.rows ?? []);
        setFetchedAt(j.fetchedAt ?? null);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(false);
  }, []);

  const stages = useMemo(() => {
    const s = new Set<string>();
    rows.forEach(r => { if (r.stage && isOutbound(r.agent_type)) s.add(r.stage); });
    return Array.from(s).sort();
  }, [rows]);
  const hasStages = stages.length > 0;

  const presentTypes = useMemo(() => {
    const s = new Set<AgentType>();
    rows.forEach(r => { if (r.agent_type) s.add(r.agent_type); });
    return s;
  }, [rows]);

  const anyInbound = active["Sales Inbound"] || active["Service Inbound"];
  const anyOutbound = active["Sales Outbound"] || active["Service Outbound"];

  const middleMode: MiddleMode =
    anyInbound && anyOutbound ? "both" : anyOutbound ? "connected" : "qualified";
  const middleMetricLabel =
    middleMode === "both" ? "Qualified / Connected"
    : middleMode === "connected" ? "Connected"
    : "Qualified";

  const metricsSeries = useMemo(() => [
    { key: "leads" as const, label: "Total Leads", color: "#6366f1" },
    { key: "qc" as const, label: middleMetricLabel, color: "#0ea5e9" },
    { key: "appts" as const, label: "Appointments", color: "#22c55e" },
  ], [middleMetricLabel]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (!active[r.agent_type]) return false;
      if (!inRange(r.day, dateRange)) return false;
      // Stage filter applies to outbound rows only; inbound rows pass through
      // with null stage since stage is a call-campaign concept.
      if (stageFilter !== "ALL" && isOutbound(r.agent_type) && r.stage !== stageFilter) return false;
      if (q) {
        const hay = `${rooftopLabel(r)} ${enterpriseLabel(r)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, active, dateRange, stageFilter, search]);

  const days = useMemo(() => {
    const s = new Set<string>();
    filtered.forEach(r => r.day && s.add(r.day));
    return Array.from(s).sort();
  }, [filtered]);

  type PivotEntry = { rooftop: string; enterprise: string; days: Map<string, DayBucket> };
  const pivot = useMemo(() => {
    const m = new Map<string, PivotEntry>();
    for (const r of filtered) {
      const key = r.team_id || `${r.enterprise_name ?? ""}::${r.rooftop_name ?? ""}`;
      let entry = m.get(key);
      if (!entry) {
        entry = { rooftop: rooftopLabel(r), enterprise: enterpriseLabel(r), days: new Map() };
        m.set(key, entry);
      }
      const prev = entry.days.get(r.day) ?? EMPTY_BUCKET;
      entry.days.set(r.day, addBucket(prev, projectRow(r)));
    }
    return m;
  }, [filtered]);

  type RooftopRow = {
    key: string;
    rooftop: string;
    enterprise: string;
    daily: ({ day: string } & DayBucket)[];
    total: DayBucket;
  };
  const rooftopRows: RooftopRow[] = useMemo(() => {
    const out: RooftopRow[] = [];
    for (const [key, entry] of pivot.entries()) {
      const daily = days
        .filter(d => entry.days.has(d))
        .map(d => ({ day: d, ...(entry.days.get(d) as DayBucket) }));
      const total = daily.reduce<DayBucket>((acc, x) => addBucket(acc, x), { ...EMPTY_BUCKET });
      out.push({ key, rooftop: entry.rooftop, enterprise: entry.enterprise, daily, total });
    }
    out.sort((a, b) => b.total.leads - a.total.leads);
    return out;
  }, [pivot, days]);

  const daily = useMemo(() => {
    const byDay = new Map<string, DayBucket>();
    for (const r of filtered) {
      const prev = byDay.get(r.day) ?? EMPTY_BUCKET;
      byDay.set(r.day, addBucket(prev, projectRow(r)));
    }
    return days.map(d => byDay.get(d) ?? { ...EMPTY_BUCKET });
  }, [filtered, days]);

  const totals = useMemo<DayBucket>(
    () => daily.reduce<DayBucket>((acc, x) => addBucket(acc, x), { ...EMPTY_BUCKET }),
    [daily]
  );

  const totalsMid = middleValue(totals, middleMode);
  const totalsMidDenom = middleDenom(totals, middleMode);
  const totalsApptDenom = apptDenom(totals);

  const showSmsPanel = anyInbound;

  const toggleExpand = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  const expandAll = () => setExpanded(new Set(rooftopRows.map(r => r.key)));
  const collapseAll = () => setExpanded(new Set());

  const showingPlaceholder = loading && rows.length === 0;

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: "20px 32px", background: "#f9fafb", minHeight: "100vh" }}>
      <style>{`
        @keyframes agentShimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .agent-shimmer {
          background: linear-gradient(90deg, #eef0f3 25%, #e2e5ea 50%, #eef0f3 75%);
          background-size: 200% 100%;
          animation: agentShimmer 1.3s ease-in-out infinite;
          border-radius: 6px;
          color: transparent !important;
        }
        .agent-refreshing { animation: agentSpin 1s linear infinite; }
        @keyframes agentSpin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>
            Agents V2 — Unified Day on Day by Rooftop
          </h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0", maxWidth: 760 }}>
            Lead-level activity across all four agents (Sales/Service × Inbound/Outbound). Inbound rows attribute to
            lead-creation day; outbound rows attribute to call day. Qualified and appointment rates use{" "}
            <em>total_conversations</em> on inbound (SMS-only leads are counted). Multi-rooftop enterprises render
            as separate rows per <code>team_id</code>.
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

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 18, background: "#fff", padding: 12, borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>Agents:</span>
        {AGENT_TYPES.map(t => (
          <Chip
            key={t}
            label={t}
            active={active[t]}
            onToggle={() => setActive(prev => ({ ...prev, [t]: !prev[t] }))}
            activeColor={AGENT_TYPE_COLORS[t]}
            disabled={!loading && rows.length > 0 && !presentTypes.has(t)}
            title={`The Metabase card currently returns no ${t} rows`}
          />
        ))}
        <div style={{ width: 1, height: 24, background: "#e5e7eb", margin: "0 4px" }} />
        <SegmentedControl options={DATE_RANGES} value={dateRange} onChange={setDateRange} />
        {hasStages && (
          <>
            <div style={{ width: 1, height: 24, background: "#e5e7eb", margin: "0 4px" }} />
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <label style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>Stage</label>
              <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}
                title="Stage applies to outbound rows only — inbound rows pass through regardless."
                style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, background: "#fff" }}>
                <option value="ALL">All stages</option>
                {stages.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </>
        )}
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search rooftop or enterprise…"
          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, minWidth: 220 }} />
        <div style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280" }}>
          {rooftopRows.length} rooftop{rooftopRows.length === 1 ? "" : "s"} · {days.length} day{days.length === 1 ? "" : "s"}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <KpiCard label="Total Leads" scope="All Rooftops" value={totals.leads} color="#6366f1" loading={showingPlaceholder} />
        <KpiCard label={middleMetricLabel} scope="All Rooftops" value={totalsMid} color="#0ea5e9" loading={showingPlaceholder}
          sub={totalsMidDenom > 0 ? `${((totalsMid / totalsMidDenom) * 100).toFixed(1)}% of ${middleMode === "connected" ? "calls" : "conversations"}` : undefined} />
        <KpiCard label="Appointments" scope="All Rooftops" value={totals.appts} color="#22c55e" loading={showingPlaceholder}
          sub={totalsApptDenom > 0 ? `${((totals.appts / totalsApptDenom) * 100).toFixed(1)}% of conversations` : undefined} />
        <KpiCard label="Rooftops" scope="Distinct team_id" value={rooftopRows.length} color="#f59e0b" loading={showingPlaceholder} />
      </div>

      {/* SMS KPIs — visible whenever an inbound agent is active */}
      {showSmsPanel && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>
            SMS — Inbound Funnel
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <KpiCard label="SMS Engaged Leads" scope="Inbound" value={totals.smsEngaged} color="#8b5cf6" loading={showingPlaceholder}
              sub={totals.leadsWithSms > 0 ? `${((totals.smsEngaged / totals.leadsWithSms) * 100).toFixed(1)}% response rate` : undefined} />
            <KpiCard label="SMS Booking Rate" scope="Engaged Leads"
              value={totals.smsEngaged > 0 ? Math.round((totals.smsAppts / totals.smsEngaged) * 1000) / 10 : 0}
              color="#ec4899" loading={showingPlaceholder}
              sub={totals.smsEngaged > 0 ? `${totals.smsAppts.toLocaleString()} appts / ${totals.smsEngaged.toLocaleString()} engaged` : undefined}
              valueSuffix="%" />
            <KpiCard label="Avg Conversation Depth" scope="Per Engaged Lead"
              value={totals.smsEngaged > 0 ? Math.round((totals.smsReceived / totals.smsEngaged) * 10) / 10 : 0}
              color="#0ea5e9" loading={showingPlaceholder}
              sub="received SMS per engaged lead"
              valueSuffix=" msgs" />
            <KpiCard label="Total Received SMS" scope="Inbound" value={totals.smsReceived} color="#14b8a6" loading={showingPlaceholder} />
          </div>
        </div>
      )}

      {/* Chart */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: 16, marginBottom: 20, position: "relative" }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>
            Day-on-day — Total Leads, {middleMetricLabel}, Appointments
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
          <LineChart
            days={days}
            series={metricsSeries.map(m => ({
              name: m.label,
              color: m.color,
              values: daily.map(d =>
                m.key === "leads" ? d.leads
                : m.key === "qc" ? middleValue(d, middleMode)
                : d.appts
              ),
            }))}
          />
        )}
      </div>

      {/* Expandable table */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Rooftop breakdown — expand for daily detail</div>
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
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ position: "sticky", top: 0, background: "#f9fafb", zIndex: 1 }}>
              <tr>
                <th style={{ ...thStyle, width: 30 }} />
                <th style={{ ...thStyle, textAlign: "left", minWidth: 240 }}>Rooftop / Day</th>
                <th style={{ ...thStyle, textAlign: "right", minWidth: 90 }}>Leads</th>
                <th style={{ ...thStyle, textAlign: "right", minWidth: 110 }}>Conv.</th>
                <th style={{ ...thStyle, textAlign: "right", minWidth: 90 }}>Calls</th>
                {showSmsPanel && <th style={{ ...thStyle, textAlign: "right", minWidth: 80 }}>SMS</th>}
                <th style={{ ...thStyle, textAlign: "right", minWidth: 130 }}>{middleMetricLabel}</th>
                <th style={{ ...thStyle, textAlign: "right", minWidth: 110 }}>Connected</th>
                <th style={{ ...thStyle, textAlign: "right", minWidth: 130 }}>CB / Xfer</th>
                <th style={{ ...thStyle, textAlign: "right", minWidth: 130 }}>Appointments</th>
                {showSmsPanel && (
                  <>
                    <th style={{ ...thStyle, textAlign: "right", minWidth: 110 }}>SMS Engaged</th>
                    <th style={{ ...thStyle, textAlign: "right", minWidth: 100 }}>SMS Book</th>
                    <th style={{ ...thStyle, textAlign: "right", minWidth: 80 }}>Depth</th>
                  </>
                )}
                <th style={{ ...thStyle, textAlign: "right", minWidth: 90 }}>Avg Score</th>
              </tr>
            </thead>
            <tbody>
              {showingPlaceholder && Array.from({ length: 8 }).map((_, i) => (
                <tr key={`sh-${i}`} style={{ borderTop: "1px solid #f3f4f6" }}>
                  {Array.from({ length: showSmsPanel ? 13 : 9 }).map((__, j) => (
                    <td key={j} style={{ padding: "10px 12px" }}>
                      <div className="agent-shimmer" style={{ height: 14, width: j === 1 ? "60%" : "50%" }}>&nbsp;</div>
                    </td>
                  ))}
                </tr>
              ))}
              {!showingPlaceholder && rooftopRows.length === 0 && (
                <tr>
                  <td colSpan={showSmsPanel ? 13 : 9} style={{ padding: 24, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                    No rooftops match filters
                  </td>
                </tr>
              )}
              {!showingPlaceholder && rooftopRows.map(row => {
                const isOpen = expanded.has(row.key);
                const mid = middleValue(row.total, middleMode);
                const midDen = middleDenom(row.total, middleMode);
                const apptDen = apptDenom(row.total);
                const avgScore = row.total.scoreCount > 0 ? row.total.scoreSum / row.total.scoreCount : null;
                return (
                  <Fragment key={row.key}>
                    <tr
                      onClick={() => toggleExpand(row.key)}
                      style={{ borderTop: "1px solid #f3f4f6", background: isOpen ? "#eef2ff" : "#fff", cursor: "pointer" }}>
                      <td style={{ ...tdStyle, textAlign: "center", color: "#6b7280", fontWeight: 700, userSelect: "none" }}>
                        <span style={{ display: "inline-block", width: 16, transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>▶</span>
                      </td>
                      <td style={{ ...tdStyle, whiteSpace: "normal" }}
                          title={`team_id: ${row.key}`}>
                        <div style={{ fontWeight: 700, color: "#111827" }}>
                          {row.rooftop}
                          <span style={{ marginLeft: 8, fontSize: 11, color: "#6b7280", fontWeight: 500 }}>
                            ({row.daily.length} day{row.daily.length === 1 ? "" : "s"})
                          </span>
                        </div>
                        {row.enterprise && row.enterprise !== row.rooftop && (
                          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{row.enterprise}</div>
                        )}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: "#4f46e5" }}>{row.total.leads.toLocaleString()}</td>
                      <td style={{ ...tdStyle, textAlign: "right", color: "#374151" }}>{row.total.conversations.toLocaleString()}</td>
                      <td style={{ ...tdStyle, textAlign: "right", color: "#374151" }}>{row.total.leadsWithCalls.toLocaleString()}</td>
                      {showSmsPanel && (
                        <td style={{ ...tdStyle, textAlign: "right", color: row.total.leadsWithSms > 0 ? "#374151" : "#d1d5db" }}>
                          {row.total.inboundLeads > 0 ? row.total.leadsWithSms.toLocaleString() : "—"}
                        </td>
                      )}
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: "#0369a1" }}>
                        {mid.toLocaleString()}
                        <span style={{ marginLeft: 6, color: "#9ca3af", fontWeight: 500, fontSize: 11 }}>{fmtPct(mid, midDen)}</span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", color: "#374151" }}>
                        {row.total.connectedCalls.toLocaleString()}
                        <span style={{ marginLeft: 6, color: "#9ca3af", fontWeight: 500, fontSize: 11 }}>{fmtPct(row.total.connectedCalls, row.total.leadsWithCalls)}</span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", color: "#c2410c" }}>
                        {row.total.callbacksOrTransfers.toLocaleString()}
                        <span style={{ marginLeft: 6, color: "#9ca3af", fontWeight: 500, fontSize: 11 }}>{fmtPct(row.total.callbacksOrTransfers, row.total.leadsWithCalls)}</span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: "#15803d" }}>
                        {row.total.appts.toLocaleString()}
                        <span style={{ marginLeft: 6, color: "#9ca3af", fontWeight: 500, fontSize: 11 }}>{fmtPct(row.total.appts, apptDen)}</span>
                      </td>
                      {showSmsPanel && (
                        <>
                          <td style={{ ...tdStyle, textAlign: "right", color: row.total.smsEngaged > 0 ? "#7c3aed" : "#d1d5db", fontWeight: 600 }}>
                            {row.total.inboundLeads > 0 ? row.total.smsEngaged.toLocaleString() : "—"}
                            {row.total.smsEngaged > 0 && (
                              <span style={{ marginLeft: 6, color: "#9ca3af", fontWeight: 500, fontSize: 11 }}>{fmtPct(row.total.smsEngaged, row.total.leadsWithSms)}</span>
                            )}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right", color: row.total.smsEngaged > 0 ? "#be185d" : "#d1d5db" }}>
                            {row.total.smsEngaged > 0 ? `${((row.total.smsAppts / row.total.smsEngaged) * 100).toFixed(1)}%` : "—"}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right", color: row.total.smsEngaged > 0 ? "#374151" : "#d1d5db" }}>
                            {row.total.smsEngaged > 0 ? (row.total.smsReceived / row.total.smsEngaged).toFixed(1) : "—"}
                          </td>
                        </>
                      )}
                      <td style={{ ...tdStyle, textAlign: "right", color: avgScore != null ? "#374151" : "#d1d5db" }}>
                        {avgScore != null ? `${avgScore.toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                    {isOpen && row.daily.map(d => {
                      const dMid = middleValue(d, middleMode);
                      const dMidDen = middleDenom(d, middleMode);
                      const dApptDen = apptDenom(d);
                      const dAvg = d.scoreCount > 0 ? d.scoreSum / d.scoreCount : null;
                      return (
                        <tr key={`${row.key}::${d.day}`} style={{ borderTop: "1px solid #f3f4f6", background: "#fafbff" }}>
                          <td style={dayCellStyle} />
                          <td style={{ ...dayCellStyle, paddingLeft: 36, color: "#6b7280" }}>{fmtDay(d.day)}</td>
                          <td style={{ ...dayCellStyle, textAlign: "right", color: d.leads > 0 ? "#374151" : "#d1d5db" }}>
                            {d.leads > 0 ? d.leads.toLocaleString() : "—"}
                          </td>
                          <td style={{ ...dayCellStyle, textAlign: "right", color: d.conversations > 0 ? "#374151" : "#d1d5db" }}>
                            {d.conversations > 0 ? d.conversations.toLocaleString() : "—"}
                          </td>
                          <td style={{ ...dayCellStyle, textAlign: "right", color: d.leadsWithCalls > 0 ? "#374151" : "#d1d5db" }}>
                            {d.leadsWithCalls > 0 ? d.leadsWithCalls.toLocaleString() : "—"}
                          </td>
                          {showSmsPanel && (
                            <td style={{ ...dayCellStyle, textAlign: "right", color: d.leadsWithSms > 0 ? "#374151" : "#d1d5db" }}>
                              {d.inboundLeads > 0 ? (d.leadsWithSms > 0 ? d.leadsWithSms.toLocaleString() : "0") : "—"}
                            </td>
                          )}
                          <td style={{ ...dayCellStyle, textAlign: "right", color: dMid > 0 ? "#374151" : "#d1d5db" }}>
                            {dMid > 0 ? dMid.toLocaleString() : "—"}
                            {dMid > 0 && (
                              <span style={{ marginLeft: 6, color: "#9ca3af", fontSize: 11 }}>{fmtPct(dMid, dMidDen)}</span>
                            )}
                          </td>
                          <td style={{ ...dayCellStyle, textAlign: "right", color: d.connectedCalls > 0 ? "#374151" : "#d1d5db" }}>
                            {d.connectedCalls > 0 ? d.connectedCalls.toLocaleString() : "—"}
                            {d.connectedCalls > 0 && (
                              <span style={{ marginLeft: 6, color: "#9ca3af", fontSize: 11 }}>{fmtPct(d.connectedCalls, d.leadsWithCalls)}</span>
                            )}
                          </td>
                          <td style={{ ...dayCellStyle, textAlign: "right", color: d.callbacksOrTransfers > 0 ? "#374151" : "#d1d5db" }}>
                            {d.callbacksOrTransfers > 0 ? d.callbacksOrTransfers.toLocaleString() : "—"}
                            {d.callbacksOrTransfers > 0 && (
                              <span style={{ marginLeft: 6, color: "#9ca3af", fontSize: 11 }}>{fmtPct(d.callbacksOrTransfers, d.leadsWithCalls)}</span>
                            )}
                          </td>
                          <td style={{ ...dayCellStyle, textAlign: "right", color: d.appts > 0 ? "#374151" : "#d1d5db" }}>
                            {d.appts > 0 ? d.appts.toLocaleString() : "—"}
                            {d.appts > 0 && (
                              <span style={{ marginLeft: 6, color: "#9ca3af", fontSize: 11 }}>{fmtPct(d.appts, dApptDen)}</span>
                            )}
                          </td>
                          {showSmsPanel && (
                            <>
                              <td style={{ ...dayCellStyle, textAlign: "right", color: d.smsEngaged > 0 ? "#374151" : "#d1d5db" }}>
                                {d.inboundLeads > 0 ? (d.smsEngaged > 0 ? d.smsEngaged.toLocaleString() : "0") : "—"}
                                {d.smsEngaged > 0 && (
                                  <span style={{ marginLeft: 6, color: "#9ca3af", fontSize: 11 }}>{fmtPct(d.smsEngaged, d.leadsWithSms)}</span>
                                )}
                              </td>
                              <td style={{ ...dayCellStyle, textAlign: "right", color: d.smsEngaged > 0 ? "#374151" : "#d1d5db" }}>
                                {d.smsEngaged > 0 ? `${((d.smsAppts / d.smsEngaged) * 100).toFixed(1)}%` : "—"}
                              </td>
                              <td style={{ ...dayCellStyle, textAlign: "right", color: d.smsEngaged > 0 ? "#374151" : "#d1d5db" }}>
                                {d.smsEngaged > 0 ? (d.smsReceived / d.smsEngaged).toFixed(1) : "—"}
                              </td>
                            </>
                          )}
                          <td style={{ ...dayCellStyle, textAlign: "right", color: dAvg != null ? "#374151" : "#d1d5db" }}>
                            {dAvg != null ? `${dAvg.toFixed(1)}%` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Chip({ label, active, onToggle, activeColor, disabled, title }: { label: string; active: boolean; onToggle: () => void; activeColor: string; disabled?: boolean; title?: string }) {
  return (
    <button onClick={disabled ? undefined : onToggle} disabled={disabled} title={title}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "6px 12px", borderRadius: 999,
        border: `1px solid ${disabled ? "#e5e7eb" : active ? activeColor : "#d1d5db"}`,
        background: disabled ? "#f3f4f6" : active ? activeColor : "#fff",
        color: disabled ? "#9ca3af" : active ? "#fff" : "#6b7280",
        fontSize: 12, fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.7 : 1,
        transition: "all 0.15s",
      }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: disabled ? "#d1d5db" : active ? "#fff" : "#d1d5db" }} />
      {label}
      {disabled && <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 500, marginLeft: 2 }}>(no data)</span>}
    </button>
  );
}

function SegmentedControl<T extends string>({ options, value, onChange }: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
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
const tdStyle: CSSProperties = {
  padding: "8px 12px", fontSize: 13, color: "#374151", whiteSpace: "nowrap",
};
const dayCellStyle: CSSProperties = {
  padding: "3px 12px", fontSize: 12, color: "#4b5563", whiteSpace: "nowrap", lineHeight: 1.3,
};

function KpiCard({ label, scope, value, color, loading, sub, valueSuffix }: { label: string; scope: string; value: number; color: string; loading: boolean; sub?: string; valueSuffix?: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: "16px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", border: "1px solid #e5e7eb", flex: 1, minWidth: 180 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
        <div style={{ fontSize: 12, color: "#374151", fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{scope}</div>
      </div>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
          <div className="agent-shimmer" style={{ height: 28, width: "55%" }}>&nbsp;</div>
          {sub !== undefined && <div className="agent-shimmer" style={{ height: 12, width: "40%" }}>&nbsp;</div>}
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <div style={{ fontSize: 26, fontWeight: 700, color }}>
            {value.toLocaleString()}{valueSuffix ?? ""}
          </div>
          {sub && <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>({sub})</div>}
        </div>
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

  const xFor = (i: number) => {
    if (days.length <= 1) return padL + plotW / 2;
    return padL + (i * plotW) / (days.length - 1);
  };
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
        <div
          style={{
            position: "absolute", top: 16,
            left: tooltipPlaceLeft ? undefined : `calc(${tooltipX}% + 12px)`,
            right: tooltipPlaceLeft ? `calc(${100 - tooltipX}% + 12px)` : undefined,
            background: "#111827", color: "#fff", padding: "8px 12px", borderRadius: 8,
            fontSize: 12, boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
            pointerEvents: "none", minWidth: 180, zIndex: 10,
          }}
        >
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

export default AgentsDashboardV2;
