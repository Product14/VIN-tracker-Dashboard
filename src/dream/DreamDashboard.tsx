import { Fragment, useEffect, useMemo, useState, type CSSProperties } from "react";

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

type Activity = {
  type: "call" | "sms" | string;
  at: string;
  direction: "Inbound" | "Outbound" | string | null;
  status: string | null;
  callType: string | null;
  endedReason: string | null;
  agent: string | null;
  campaignId: string | null;
  summary: string | null;
};

type Lead = {
  leadId: string;
  teamId: string | null;
  leadCreatedAt: string | null;
  leadSource: string | null;
  leadStage: string | null;
  customerName: string | null;
  customerPhone: string | null;
  firstActivityAt: string | null;
  lastActivityAt: string | null;
  activityCount: number;
  callCount: number;
  smsCount: number;
  inboundCount: number;
  outboundCount: number;
  meetingCount: number;
  actionItemCount: number;
  hasMeeting: boolean;
  hasActionItem: boolean;
  appointmentPitched: boolean;
  appointmentScheduled: boolean;
  activities: Activity[];
};

// Three Dream Automotive rooftops, friendly-named for the segmented control.
// IDs are the same ones the Metabase query filters on.
const TEAM_LABELS: Record<string, string> = {
  "7607d0e6f5": "Dream Nissan Lawrence",
  "6730ea9132": "Dream Nissan Legends",
  "3d3deabc98": "Dream Nissan Midwest",
};
const TEAM_IDS = Object.keys(TEAM_LABELS);

type DateRange = "ALL" | "TODAY" | "WEEK" | "MTD" | "CUSTOM";
const DATE_RANGES: { key: DateRange; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "TODAY", label: "Today" },
  { key: "WEEK", label: "This Week" },
  { key: "MTD", label: "MTD" },
  { key: "CUSTOM", label: "Custom" },
];
type CustomRange = { from: string; to: string };
type Channel = "ALL" | "call" | "sms";
type Direction = "ALL" | "Inbound" | "Outbound";

type SortKey = "customer" | "source" | "leadCreated" | "lastActivity" | "activities" | "channels" | "outcome";
type SortDir = "asc" | "desc";
type SortState = { key: SortKey; dir: SortDir };

// Sort defaults: dates/numbers descending (newest/highest first), text ascending (A→Z).
const SORT_DEFAULT_DIR: Record<SortKey, SortDir> = {
  customer: "asc", source: "asc",
  leadCreated: "desc", lastActivity: "desc",
  activities: "desc", channels: "desc", outcome: "desc",
};

function outcomeScore(l: Lead): number {
  return (l.hasMeeting || l.appointmentScheduled ? 2 : 0) + (l.hasActionItem ? 1 : 0);
}

function compareLeads(a: Lead, b: Lead, key: SortKey): number {
  switch (key) {
    case "customer":     return (a.customerName ?? "").localeCompare(b.customerName ?? "");
    case "source":       return `${a.leadSource ?? ""} ${a.leadStage ?? ""}`
                                .localeCompare(`${b.leadSource ?? ""} ${b.leadStage ?? ""}`);
    case "leadCreated":  return (a.leadCreatedAt ?? "").localeCompare(b.leadCreatedAt ?? "");
    case "lastActivity": return (a.lastActivityAt ?? "").localeCompare(b.lastActivityAt ?? "");
    case "activities":   return a.activityCount - b.activityCount;
    case "channels":     return (a.callCount + a.smsCount) - (b.callCount + b.smsCount);
    case "outcome":      return outcomeScore(a) - outcomeScore(b);
  }
}

function startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function startOfWeekMon(d: Date): Date {
  const x = startOfDay(d);
  const day = x.getDay();
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day));
  return x;
}
function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
function inRange(iso: string | null, range: DateRange, custom: CustomRange): boolean {
  if (range === "ALL") return true;
  if (!iso) return false;
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

const fmtNum = (n: number) => n.toLocaleString();
const fmtTimeAgo = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const dys = Math.floor(h / 24);
  return `${dys}d ago`;
};
const fmtDayHour = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

// call_summary ships in two shapes: plain prose (call summaries) or JSON array of
// chat sentences (SMS). Return up to 3 lines, or null if nothing usable.
function formatSummary(raw: string | null | undefined): string[] | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "[]" || trimmed === '[""]' || trimmed === "{}") return null;

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      const arr: unknown[] = Array.isArray(parsed)
        ? parsed
        : (parsed && typeof parsed === "object" && Array.isArray((parsed as { chatSummary?: unknown[] }).chatSummary))
          ? (parsed as { chatSummary: unknown[] }).chatSummary
          : [];
      const sentences = arr.map(s => typeof s === "string" ? s.trim() : "").filter(Boolean);
      return sentences.length ? sentences.slice(0, 3) : null;
    } catch {
      return [trimmed.replace(/[\[\{"]/g, "").trim()].filter(Boolean);
    }
  }
  return trimmed.split(/\n+/).map(l => l.trim()).filter(Boolean).slice(0, 3);
}

function DreamDashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  const [team, setTeam] = useState<string>("ALL");          // ALL | one of TEAM_IDS
  const [dateRange, setDateRange] = useState<DateRange>("ALL");
  const [customRange, setCustomRange] = useState<CustomRange>(() => ({ from: "", to: todayIso() }));
  const [channel, setChannel] = useState<Channel>("ALL");
  const [direction, setDirection] = useState<Direction>("ALL");
  const [stageFilter, setStageFilter] = useState<string>("ALL");
  const [sourceFilter, setSourceFilter] = useState<string>("ALL");
  const [outcome, setOutcome] = useState<"ALL" | "appointment" | "actionItem" | "noActivity">("ALL");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortState>({ key: "lastActivity", dir: "desc" });
  const toggleSort = (key: SortKey) => setSort(s =>
    s.key === key
      ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
      : { key, dir: SORT_DEFAULT_DIR[key] }
  );

  const load = (force = false) => {
    setLoading(true);
    setError(null);
    const url = `${API_BASE}/api/dream${force ? `?refresh=1&t=${Date.now()}` : ""}`;
    fetch(url, { cache: "no-store" })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(j => {
        setLeads(j.leads ?? []);
        setFetchedAt(j.fetchedAt ?? null);
        setStale(!!j.stale);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(false); }, []);
  useEffect(() => { setExpanded(new Set()); }, [team, dateRange, customRange, channel, direction, stageFilter, sourceFilter, outcome, search]);

  // Per-team lead counts — drive the chip badges and the segmented control.
  const teamCounts = useMemo(() => {
    const c: Record<string, number> = { ALL: leads.length };
    for (const id of TEAM_IDS) c[id] = 0;
    for (const l of leads) if (l.teamId && c[l.teamId] != null) c[l.teamId]++;
    return c;
  }, [leads]);

  const stages = useMemo(() => {
    const s = new Set<string>();
    leads.forEach(l => { if (l.leadStage) s.add(l.leadStage); });
    return Array.from(s).sort();
  }, [leads]);
  const sources = useMemo(() => {
    const s = new Set<string>();
    leads.forEach(l => { if (l.leadSource) s.add(l.leadSource); });
    return Array.from(s).sort();
  }, [leads]);

  // Filter leads (and within each lead, filter activities by date/channel/direction).
  // A lead matches if (a) its metadata passes filters AND (b) at least one of its
  // activities passes — except when "noActivity" outcome is selected, where leads
  // with zero in-scope activities are what we want.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out: Lead[] = [];

    for (const l of leads) {
      if (team         !== "ALL" && l.teamId     !== team)         continue;
      if (stageFilter  !== "ALL" && l.leadStage  !== stageFilter)  continue;
      if (sourceFilter !== "ALL" && l.leadSource !== sourceFilter) continue;
      if (q) {
        const hay = `${l.customerName ?? ""} ${l.customerPhone ?? ""} ${l.leadId}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }

      const inScope = l.activities.filter(a => {
        if (!inRange(a.at, dateRange, customRange)) return false;
        if (channel   !== "ALL" && a.type      !== channel)   return false;
        if (direction !== "ALL" && a.direction !== direction) return false;
        return true;
      });

      if (outcome === "appointment" && !(l.hasMeeting || l.appointmentScheduled)) continue;
      if (outcome === "actionItem"  && !l.hasActionItem) continue;
      if (outcome === "noActivity"  && inScope.length > 0) continue;
      if (outcome !== "noActivity" && dateRange !== "ALL" && inScope.length === 0) continue;

      // Recompute lead-level counts from in-scope activities so the table matches the
      // expanded timeline. Keep meeting/action-item flags untouched (lead-level).
      let calls = 0, sms = 0, inbound = 0, outbound = 0;
      let firstAt: string | null = null, lastAt: string | null = null;
      for (const a of inScope) {
        if (a.type === "call")       calls++;
        else if (a.type === "sms")   sms++;
        if (a.direction === "Inbound")        inbound++;
        else if (a.direction === "Outbound")  outbound++;
        if (!firstAt || a.at < firstAt) firstAt = a.at;
        if (!lastAt  || a.at > lastAt)  lastAt  = a.at;
      }

      out.push({
        ...l,
        activities: inScope,
        activityCount: inScope.length,
        callCount: calls,
        smsCount: sms,
        inboundCount: inbound,
        outboundCount: outbound,
        firstActivityAt: firstAt ?? l.firstActivityAt,
        lastActivityAt:  lastAt  ?? l.lastActivityAt,
      });
    }

    const dir = sort.dir === "asc" ? 1 : -1;
    out.sort((a, b) => {
      const primary = compareLeads(a, b, sort.key);
      if (primary !== 0) return primary * dir;
      // Stable tiebreaker so rows don't shuffle when the primary key ties.
      return (b.lastActivityAt ?? b.leadCreatedAt ?? "")
        .localeCompare(a.lastActivityAt ?? a.leadCreatedAt ?? "");
    });
    return out;
  }, [leads, team, dateRange, customRange, channel, direction, stageFilter, sourceFilter, outcome, search, sort]);

  const kpis = useMemo(() => {
    let activities = 0, calls = 0, sms = 0, inbound = 0, outbound = 0,
        appts = 0, actionItems = 0;
    for (const l of filtered) {
      activities += l.activityCount;
      calls += l.callCount;
      sms += l.smsCount;
      inbound += l.inboundCount;
      outbound += l.outboundCount;
      if (l.hasMeeting || l.appointmentScheduled) appts++;
      if (l.hasActionItem) actionItems++;
    }
    return { leads: filtered.length, activities, calls, sms, inbound, outbound, appts, actionItems };
  }, [filtered]);

  const showingPlaceholder = loading && leads.length === 0;
  const toggle = (id: string) => setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const expandAll = () => setExpanded(new Set(filtered.map(l => l.leadId)));
  const collapseAll = () => setExpanded(new Set());

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: "20px 32px", background: "#f9fafb", minHeight: "100vh" }}>
      <style>{`
        @keyframes dreamShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        .dream-shimmer { background:linear-gradient(90deg,#eef0f3 25%,#e2e5ea 50%,#eef0f3 75%); background-size:200% 100%; animation:dreamShimmer 1.3s ease-in-out infinite; border-radius:6px; color:transparent !important; }
        .dream-refreshing { animation: dreamSpin 1s linear infinite; }
        @keyframes dreamSpin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ marginBottom: 20, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>
            Dream Automotive · Lead Activity
          </h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0", maxWidth: 760 }}>
            Every lead and the calls, SMS, and appointments Emily has run against it.
            Newest activity at the top. Click a row for the full timeline.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 4 }}>
          {fetchedAt && !loading && (
            <span style={{ fontSize: 12, color: stale ? "#d97706" : "#16a34a" }}>
              ● {leads.length.toLocaleString()} leads
              {stale ? " · stale cache" : ""} · fetched {new Date(fetchedAt).toLocaleTimeString()}
            </span>
          )}
          {loading && <span style={{ fontSize: 12, color: "#6b7280" }}>Fetching…</span>}
          <button onClick={() => load(true)} disabled={loading}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: loading ? "#f3f4f6" : "#fff", fontSize: 12, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", color: loading ? "#9ca3af" : "#374151" }}>
            <span className={loading ? "dream-refreshing" : undefined} style={{ display: "inline-block" }}>↻</span>
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
          Failed to load: {error}
        </div>
      )}

      {/* Rooftop tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12, borderBottom: "1px solid #e5e7eb" }}>
        <RooftopTab id="ALL"        label="All rooftops" count={teamCounts.ALL}   active={team === "ALL"}        onClick={() => setTeam("ALL")}        color="#4f46e5" />
        {TEAM_IDS.map(id => (
          <RooftopTab key={id} id={id} label={TEAM_LABELS[id]} count={teamCounts[id] ?? 0}
            active={team === id} onClick={() => setTeam(id)} color={teamColor(id)} />
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 18, background: "#fff", padding: 12, borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <SegmentedControl options={DATE_RANGES} value={dateRange} onChange={setDateRange} />
        {dateRange === "CUSTOM" && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <label style={lblStyle}>From</label>
            <input type="date" value={customRange.from} max={customRange.to || undefined}
              onChange={e => setCustomRange(r => ({ ...r, from: e.target.value }))} style={dateInputStyle} />
            <label style={lblStyle}>To</label>
            <input type="date" value={customRange.to} min={customRange.from || undefined}
              onChange={e => setCustomRange(r => ({ ...r, to: e.target.value }))} style={dateInputStyle} />
          </div>
        )}
        <Divider />
        <Select label="Channel" value={channel} onChange={v => setChannel(v as Channel)}
          options={[["ALL", "All"], ["call", "Call"], ["sms", "SMS"]]} />
        <Select label="Direction" value={direction} onChange={v => setDirection(v as Direction)}
          options={[["ALL", "All"], ["Inbound", "Inbound"], ["Outbound", "Outbound"]]} />
        <Select label="Stage" value={stageFilter} onChange={setStageFilter}
          options={[["ALL", "All stages"], ...stages.map<[string, string]>(s => [s, s])]} />
        <Select label="Source" value={sourceFilter} onChange={setSourceFilter}
          options={[["ALL", "All sources"], ...sources.map<[string, string]>(s => [s, s])]} />
        <Select label="Outcome" value={outcome} onChange={v => setOutcome(v as typeof outcome)}
          options={[["ALL", "Any"], ["appointment", "Has appointment"], ["actionItem", "Has action item"], ["noActivity", "No activity"]]} />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search customer / phone / lead…"
          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, minWidth: 240 }} />
        <div style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280" }}>
          {filtered.length.toLocaleString()} leads · {kpis.activities.toLocaleString()} activities
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <KpiCard label="Leads" value={fmtNum(kpis.leads)} color="#6366f1" loading={showingPlaceholder} />
        <KpiCard label="Activities" value={fmtNum(kpis.activities)} color="#0ea5e9" loading={showingPlaceholder}
          sub={`${fmtNum(kpis.calls)} calls · ${fmtNum(kpis.sms)} SMS`} />
        <KpiCard label="Inbound / Outbound" value={`${fmtNum(kpis.inbound)} / ${fmtNum(kpis.outbound)}`} color="#0369a1" loading={showingPlaceholder} />
        <KpiCard label="Appointments" value={fmtNum(kpis.appts)} color="#22c55e" loading={showingPlaceholder} sub="leads with a meeting" />
        <KpiCard label="Action items" value={fmtNum(kpis.actionItems)} color="#a855f7" loading={showingPlaceholder} sub="leads with a CRM task" />
      </div>

      {/* Leads table */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
            Leads · click any row for the full activity timeline
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={expandAll}   style={smallBtnStyle}>Expand all</button>
            <button onClick={collapseAll} style={smallBtnStyle}>Collapse all</button>
          </div>
        </div>
        <div style={{ overflowX: "auto", maxHeight: 720 }}>
          <LeadsTable leads={filtered} expanded={expanded} onToggle={toggle} loading={showingPlaceholder} sort={sort} onSort={toggleSort} />
        </div>
      </div>
    </div>
  );
}

// ─── Tables ──────────────────────────────────────────────────────────────────

function LeadsTable({ leads, expanded, onToggle, loading, sort, onSort }: {
  leads: Lead[]; expanded: Set<string>; onToggle: (id: string) => void; loading: boolean;
  sort: SortState; onSort: (key: SortKey) => void;
}) {
  const COL_COUNT = 8;
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead style={{ position: "sticky", top: 0, background: "#f9fafb", zIndex: 1 }}>
        <tr>
          <th style={{ ...thStyle, width: 30 }} />
          <SortableTh label="Customer"      sortKey="customer"     align="left"  minWidth={200} sort={sort} onSort={onSort} />
          <SortableTh label="Source · Stage" sortKey="source"      align="left"  minWidth={150} sort={sort} onSort={onSort} />
          <SortableTh label="Lead came in"  sortKey="leadCreated"  align="right" width={120}    sort={sort} onSort={onSort} />
          <SortableTh label="Last activity" sortKey="lastActivity" align="right" width={120}    sort={sort} onSort={onSort} />
          <SortableTh label="Activities"    sortKey="activities"   align="right" width={90}     sort={sort} onSort={onSort} />
          <SortableTh label="Channels"      sortKey="channels"     align="right" width={110}    sort={sort} onSort={onSort} />
          <SortableTh label="Outcome"       sortKey="outcome"      align="left"  minWidth={200} sort={sort} onSort={onSort} />
        </tr>
      </thead>
      <tbody>
        {loading && Array.from({ length: 8 }).map((_, i) => (
          <tr key={`sh-${i}`} style={{ borderTop: "1px solid #f3f4f6" }}>
            {Array.from({ length: COL_COUNT }).map((__, j) => (
              <td key={j} style={{ padding: "10px 12px" }}>
                <div className="dream-shimmer" style={{ height: 14, width: j === 1 ? "70%" : "55%" }}>&nbsp;</div>
              </td>
            ))}
          </tr>
        ))}
        {!loading && leads.length === 0 && (
          <tr><td colSpan={COL_COUNT} style={{ padding: 24, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
            No leads match these filters.
          </td></tr>
        )}
        {!loading && leads.map(l => {
          const open = expanded.has(l.leadId);
          return (
            <Fragment key={l.leadId}>
              <tr onClick={() => onToggle(l.leadId)}
                style={{ borderTop: "1px solid #f3f4f6", background: open ? "#eef2ff" : "#fff", cursor: "pointer" }}>
                <td style={{ ...tdStyle, textAlign: "center", color: "#6b7280", fontWeight: 700, userSelect: "none" }}>
                  <span style={{ display: "inline-block", width: 16, transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>▶</span>
                </td>
                <td style={tdStyle}>
                  <div style={{ fontWeight: 600, color: "#111827" }}>{l.customerName ?? "(unknown)"}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{l.customerPhone ?? l.leadId}</div>
                </td>
                <td style={{ ...tdStyle, fontSize: 12, color: "#374151" }}>
                  <div>{l.leadSource ?? "—"}</div>
                  {l.leadStage && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.4 }}>{l.leadStage}</div>}
                </td>
                <td style={{ ...tdStyle, color: "#6b7280", fontSize: 12 }}>{fmtDayHour(l.leadCreatedAt)}</td>
                <td style={{ ...tdStyle, color: "#374151", fontSize: 12 }}>
                  <div style={{ fontWeight: 600 }}>{fmtTimeAgo(l.lastActivityAt)}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>{fmtDayHour(l.lastActivityAt)}</div>
                </td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: "#111827" }}>
                  {l.activityCount}
                  <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 500 }}>
                    {l.inboundCount}↓ / {l.outboundCount}↑
                  </div>
                </td>
                <td style={{ ...tdStyle, fontSize: 12, color: "#6b7280" }}>
                  {l.callCount > 0 && <span title={`${l.callCount} calls`}>📞 {l.callCount} </span>}
                  {l.smsCount > 0  && <span title={`${l.smsCount} SMS`}>💬 {l.smsCount}</span>}
                  {(l.callCount + l.smsCount) === 0 && <span style={{ color: "#cbd5e1" }}>—</span>}
                </td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {(l.hasMeeting || l.appointmentScheduled) && <Pill color="#166534" bg="#dcfce7" label="APPOINTMENT" />}
                    {l.hasActionItem  && <Pill color="#1e40af" bg="#dbeafe" label="ACTION ITEM" />}
                    {!l.hasMeeting && !l.appointmentScheduled && !l.hasActionItem && (
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>—</span>
                    )}
                  </div>
                </td>
              </tr>
              {open && (
                <tr style={{ background: "#fafbff" }}>
                  <td />
                  <td colSpan={COL_COUNT - 1} style={{ padding: "8px 16px 16px" }}>
                    <ActivityTimeline items={l.activities} />
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

function ActivityTimeline({ items }: { items: Activity[] }) {
  if (items.length === 0) return <div style={{ color: "#9ca3af", fontSize: 12 }}>No activity in scope.</div>;
  return (
    <ol style={{ listStyle: "none", padding: 0, margin: 0, position: "relative" }}>
      <span style={{ position: "absolute", left: 8, top: 4, bottom: 4, width: 2, background: "#e5e7eb" }} />
      {items.map((a, i) => {
        const lines = formatSummary(a.summary);
        return (
          <li key={`${a.at}::${a.type}::${i}`}
            style={{ position: "relative", paddingLeft: 28, paddingTop: 8, paddingBottom: 8 }}>
            <span style={{
              position: "absolute", left: 2, top: 14, width: 14, height: 14, borderRadius: "50%",
              background: channelDot(a.type),
              border: "2px solid #fff", boxShadow: "0 0 0 1px #d1d5db",
            }} />
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>
                {labelFor(a)}
              </span>
              <span style={{ fontSize: 11, color: "#9ca3af" }}>
                {fmtDayHour(a.at)} · {fmtTimeAgo(a.at)}
              </span>
              {a.endedReason && <span style={{ fontSize: 11, color: "#6b7280" }}>({a.endedReason})</span>}
              {a.status && a.status !== "completed" && (
                <Pill color="#9a3412" bg="#ffedd5" label={a.status} />
              )}
            </div>
            {lines === null ? (
              <div style={{ fontSize: 12, color: "#cbd5e1", fontStyle: "italic", marginTop: 2 }}>
                (no transcript captured)
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "#4b5563", marginTop: 4, lineHeight: 1.5 }}>
                {lines.map((line, li) => (
                  <div key={li} style={{ display: "flex", gap: 6 }}>
                    <span style={{ color: "#cbd5e1" }}>•</span><span>{line}</span>
                  </div>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function channelDot(t: string): string {
  if (t === "call") return "#6366f1";
  if (t === "sms")  return "#0ea5e9";
  return "#9ca3af";
}
function labelFor(a: Activity): string {
  const noun = a.type === "call" ? "Call" : a.type === "sms" ? "SMS" : "Activity";
  const dir = a.direction ? ` · ${a.direction}` : "";
  const ag  = a.agent ? ` · ${a.agent}` : "";
  return `${noun}${dir}${ag}`;
}

// ─── Atoms ───────────────────────────────────────────────────────────────────

function RooftopTab({ label, count, active, onClick, color }: {
  id: string; label: string; count: number; active: boolean; onClick: () => void; color: string;
}) {
  return (
    <button onClick={onClick}
      style={{
        padding: "10px 16px", border: "none", background: "transparent",
        borderBottom: `2px solid ${active ? color : "transparent"}`,
        color: active ? color : "#374151",
        fontSize: 13, fontWeight: active ? 700 : 600, cursor: "pointer", marginBottom: -1,
        transition: "color 0.15s, border-color 0.15s",
        display: "inline-flex", alignItems: "center", gap: 8,
      }}>
      <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: color }} />
      {label}
      <span style={{
        fontSize: 11, fontWeight: 600,
        color: active ? color : "#9ca3af",
        background: active ? `${color}15` : "#f3f4f6",
        padding: "1px 7px", borderRadius: 999,
      }}>{count.toLocaleString()}</span>
    </button>
  );
}

function teamColor(id: string): string {
  if (id === "7607d0e6f5") return "#f59e0b"; // Lawrence — amber
  if (id === "6730ea9132") return "#22c55e"; // Legends — green
  if (id === "3d3deabc98") return "#0ea5e9"; // Midwest — sky
  return "#6b7280";
}

function SortableTh({ label, sortKey, align, width, minWidth, sort, onSort }: {
  label: string; sortKey: SortKey; align: "left" | "right";
  width?: number; minWidth?: number;
  sort: SortState; onSort: (key: SortKey) => void;
}) {
  const active = sort.key === sortKey;
  const arrow = active ? (sort.dir === "asc" ? "▲" : "▼") : "↕";
  return (
    <th style={{ ...thStyle, textAlign: align, width, minWidth, cursor: "pointer", userSelect: "none", color: active ? "#111827" : "#6b7280" }}
      onClick={() => onSort(sortKey)}
      title={`Sort by ${label}`}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, justifyContent: align === "right" ? "flex-end" : "flex-start", width: "100%" }}>
        {label}
        <span style={{ fontSize: 9, color: active ? "#4f46e5" : "#cbd5e1" }}>{arrow}</span>
      </span>
    </th>
  );
}

function Pill({ color, bg, label }: { color: string; bg: string; label: string }) {
  return (
    <span style={{
      padding: "2px 7px", borderRadius: 999, fontSize: 10, fontWeight: 700,
      background: bg, color, textTransform: "uppercase", letterSpacing: 0.4,
      whiteSpace: "nowrap",
    }}>{label}</span>
  );
}

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: [string, string][];
}) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <label style={lblStyle}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, background: "#fff", maxWidth: 200 }}>
        {options.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
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
              padding: "6px 12px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
              background: active ? "#4f46e5" : "#fff",
              color: active ? "#fff" : "#374151",
              borderRight: i < options.length - 1 ? "1px solid #e5e7eb" : "none",
              transition: "background 0.15s",
            }}>{o.label}</button>
        );
      })}
    </div>
  );
}

function Divider() { return <div style={{ width: 1, height: 24, background: "#e5e7eb", margin: "0 4px" }} />; }

function KpiCard({ label, value, color, loading, sub }: {
  label: string; value: string; color: string; loading: boolean; sub?: string;
}) {
  return (
    <div style={{
      background: "#fff", borderRadius: 12, padding: "14px 18px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.05)", border: "1px solid #e5e7eb",
      flex: "1 1 180px", minWidth: 170,
    }}>
      <div style={{ fontSize: 12, color: "#374151", fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {loading
        ? <div className="dream-shimmer" style={{ height: 26, width: "55%" }}>&nbsp;</div>
        : <>
            <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
            {sub && <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500, marginTop: 2 }}>{sub}</div>}
          </>}
    </div>
  );
}

const lblStyle: CSSProperties = { fontSize: 12, color: "#6b7280", fontWeight: 600 };
const dateInputStyle: CSSProperties = { padding: "5px 8px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, background: "#fff" };
const thStyle: CSSProperties = {
  padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "#6b7280",
  textTransform: "uppercase", letterSpacing: 0.4, borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap", textAlign: "right",
};
const tdStyle: CSSProperties = { padding: "8px 12px", fontSize: 13, color: "#374151", whiteSpace: "nowrap", verticalAlign: "top" };
const smallBtnStyle: CSSProperties = { padding: "4px 10px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", color: "#374151" };

export default DreamDashboard;
