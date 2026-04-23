import { useState, useEffect, useMemo, useCallback, type CSSProperties } from "react";
import { Upload, Download, Clock, LayoutList, Kanban, Activity, AlertTriangle, BarChart3 } from "lucide-react";
import Papa from "papaparse";
import RagFilterCards from "./components/RagFilterCards";
import AgentTabs from "./components/AgentTabs";
import FilterBar, { type Filters } from "./components/FilterBar";
import RagLogicPanel from "./components/RagLogicPanel";
import AccountTable from "./components/AccountTable";
import BoardView from "./components/BoardView";
import ImportModal from "./components/ImportModal";
import { scoreRooftop, rooftopKey } from "./lib/ragLogic";
import type { Rooftop, RooftopScored, RagStatus, SalesInboundStatuses, DeploymentStatus } from "./lib/ragLogic";
import { EMPTY_SALES_INBOUND_STATUSES } from "./lib/ragLogic";

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

const STORAGE_KEY = "vini_rag_data";
const STORAGE_TS_KEY = "vini_rag_timestamp";
const STORAGE_DEPLOY_KEY = "vini_deployment_statuses";

const METABASE_VINI_DASHBOARD =
  "https://metabase.spyne.ai/public/dashboard/6a25c398-f239-427e-b354-8fd5f4684725";

type ViewMode = "table" | "board";
type GroupBy = "tofu" | "outcome" | "quality";
type ViniSection = "account" | "issues" | "metabase";

type ViniAccountHealthProps = { refreshToken?: string | null; embeddedChrome?: boolean };

function ViniAccountHealth({ refreshToken, embeddedChrome }: ViniAccountHealthProps) {
  const [rooftops, setRooftops] = useState<RooftopScored[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [deploymentStatuses, setDeploymentStatuses] = useState<Record<string, SalesInboundStatuses>>({});
  const [showImport, setShowImport] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [boardGroupBy, setBoardGroupBy] = useState<GroupBy>("tofu");
  const [activeAgent, setActiveAgent] = useState<string>("Sales Inbound");
  const [accountRagFilter, setAccountRagFilter] = useState<RagStatus | "ALL">("ALL");
  const [filters, setFilters] = useState<Filters>({
    search: "",
    tofu: "ALL",
    outcome: "ALL",
    quality: "ALL",
  });

  /** Loads Metabase-backed rows from POST /api/sync cache; falls back to local CSV import or default sample data. */
  const loadRooftopMetrics = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/vini/rooftops`);
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json();
      const list = (j.rooftops ?? []) as Rooftop[];
      if (list.length > 0) {
        setRooftops(list.map(scoreRooftop));
        setLastUpdated(
          j.syncedAt
            ? `Auto-synced · ${new Date(j.syncedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`
            : "Auto-synced from Metabase"
        );
        return;
      }
    } catch {
      /* fall through */
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const ts = localStorage.getItem(STORAGE_TS_KEY);
      if (stored) {
        setRooftops(JSON.parse(stored));
        if (ts) setLastUpdated(ts);
        return;
      }
    } catch {
      /* ignore */
    }

    setRooftops([]);
    setLastUpdated("No data yet — set VINI_ROOFTOP_METABASE_URL, click Refresh, or Import CSV");
  }, []);

  useEffect(() => {
    void loadRooftopMetrics();
  }, [loadRooftopMetrics, refreshToken]);

  useEffect(() => {
    fetch(`${API_BASE}/api/statuses`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Object.keys(data).length > 0) {
          setDeploymentStatuses(data);
          try {
            localStorage.setItem(STORAGE_DEPLOY_KEY, JSON.stringify(data));
          } catch {
            /* ignore */
          }
        } else {
          try {
            const cached = localStorage.getItem(STORAGE_DEPLOY_KEY);
            if (cached) setDeploymentStatuses(JSON.parse(cached));
          } catch {
            /* ignore */
          }
        }
      })
      .catch(() => {
        try {
          const cached = localStorage.getItem(STORAGE_DEPLOY_KEY);
          if (cached) setDeploymentStatuses(JSON.parse(cached));
        } catch {
          /* ignore */
        }
      });
  }, []);

  const handleStatusChange = (key: string, field: keyof SalesInboundStatuses, value: DeploymentStatus) => {
    setDeploymentStatuses((prev) => {
      const next = {
        ...prev,
        [key]: { ...EMPTY_SALES_INBOUND_STATUSES, ...prev[key], [field]: value },
      };
      try {
        localStorage.setItem(STORAGE_DEPLOY_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      const r = rooftops.find((rt) => rooftopKey(rt) === key);
      fetch(`${API_BASE}/api/statuses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rooftopKey: key,
          rooftopName: r?.rooftopName ?? key,
          enterprise: r?.enterpriseName ?? "",
          statuses: next[key],
        }),
      }).catch(console.error);
      return next;
    });
  };

  const handleImport = (scored: RooftopScored[], timestamp: string) => {
    setRooftops(scored);
    setLastUpdated(timestamp);
    setActiveAgent("Sales Inbound");
    setAccountRagFilter("ALL");
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scored));
      localStorage.setItem(STORAGE_TS_KEY, timestamp);
    } catch {
      /* ignore */
    }
  };

  const agentFiltered = useMemo(() => {
    if (activeAgent === "ALL") return rooftops;
    return rooftops.filter((r) => r.agentType === activeAgent);
  }, [rooftops, activeAgent]);

  const filtered = useMemo(() => {
    return agentFiltered.filter((r) => {
      if (accountRagFilter !== "ALL" && r.accountRag !== accountRagFilter) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (
          !r.rooftopName.toLowerCase().includes(q) &&
          !r.enterpriseName.toLowerCase().includes(q)
        )
          return false;
      }
      if (filters.tofu !== "ALL" && r.tofu.status !== filters.tofu) return false;
      if (filters.outcome !== "ALL" && r.outcome.status !== filters.outcome) return false;
      if (filters.quality !== "ALL" && r.quality.status !== filters.quality) return false;
      return true;
    });
  }, [agentFiltered, accountRagFilter, filters]);

  const handleExport = () => {
    const rows = filtered.map((r, i) => ({
      "#": i + 1,
      Rooftop: r.rooftopName,
      Enterprise: r.enterpriseName,
      "Agent Type": r.agentType,
      "Account RAG": r.accountRag,
      "Total Leads": r.totalLeads,
      "Vini Interactions": r.viniInteractions,
      "Capture Rate": r.captureRate !== null ? `${Math.round(r.captureRate * 100)}%` : "",
      "TOFU RAG": r.tofu.status,
      "TOFU Value": r.tofu.value,
      "Avg Score": r.avgScore !== null ? `${Math.round(r.avgScore)}%` : "",
      "Quality RAG": r.quality.status,
      "Quality Value": r.quality.value,
      Appointments: r.appointments,
      "Appt Rate": r.apptRate !== null ? `${Math.round(r.apptRate * 100)}%` : "",
      "Outcome RAG": r.outcome.status,
      "Outcome Value": r.outcome.value,
    }));

    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `vini-health-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const btnOutline: CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 8,
    border: "1px solid #d1d5db", background: "#fff", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer",
  };
  const btnPrimary: CSSProperties = {
    ...btnOutline, border: "1px solid #4f46e5", background: "#4f46e5", color: "#fff",
  };

  return (
    <div style={{ maxWidth: 1600, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          {!embeddedChrome && (
            <>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: 0 }}>Account Health</h2>
              <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>Live rooftop RAG (TOFU, quality, ROI)</p>
            </>
          )}
          {embeddedChrome && (
            <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>RAG overview, filters, and table — data from Metabase sync or CSV import.</p>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {lastUpdated && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#9ca3af" }}>
              <Clock style={{ width: 14, height: 14 }} />
              {lastUpdated}
            </div>
          )}
          <RagLogicPanel />
          <button type="button" onClick={handleExport} style={btnOutline}>
            <Download style={{ width: 16, height: 16 }} />
            Export CSV
          </button>
          <button type="button" onClick={() => setShowImport(true)} style={btnPrimary}>
            <Upload style={{ width: 16, height: 16 }} />
            Import CSV
          </button>
        </div>
      </div>

      {rooftops.length === 0 && (
        <div
          style={{
            padding: "20px 24px",
            marginBottom: 20,
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            background: "#fffbeb",
            color: "#92400e",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <strong>No rooftop rows yet.</strong> Configure <code style={{ fontSize: 12 }}>VINI_ROOFTOP_METABASE_URL</code> on the server and click{" "}
          <strong>Refresh</strong> in the header, or use <strong>Import CSV</strong> with your export.
        </div>
      )}

      <AgentTabs rooftops={rooftops} active={activeAgent} onChange={setActiveAgent} />

      <RagFilterCards rooftops={agentFiltered} active={accountRagFilter} onChange={setAccountRagFilter} />

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <FilterBar filters={filters} onChange={setFilters} />
        </div>
        <div style={{ display: "flex", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", overflow: "hidden", flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none",
              background: viewMode === "table" ? "#1f2937" : "transparent", color: viewMode === "table" ? "#fff" : "#6b7280",
            }}
          >
            <LayoutList style={{ width: 14, height: 14 }} />
            Table
          </button>
          <button
            type="button"
            onClick={() => setViewMode("board")}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none", borderLeft: "1px solid #e5e7eb",
              background: viewMode === "board" ? "#1f2937" : "transparent", color: viewMode === "board" ? "#fff" : "#6b7280",
            }}
          >
            <Kanban style={{ width: 14, height: 14 }} />
            Board
          </button>
        </div>
      </div>

      <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 8 }}>
        Showing <span style={{ fontWeight: 600, color: "#4b5563" }}>{filtered.length}</span> of{" "}
        <span style={{ fontWeight: 600, color: "#4b5563" }}>{rooftops.length}</span> rooftops
      </p>

      {viewMode === "table" ? (
        <AccountTable
          rooftops={filtered}
          showDeploymentCols={activeAgent === "Sales Inbound"}
          deploymentStatuses={deploymentStatuses}
          onStatusChange={handleStatusChange}
        />
      ) : (
        <BoardView rooftops={filtered} groupBy={boardGroupBy} onGroupByChange={setBoardGroupBy} />
      )}

      {showImport && <ImportModal onImport={handleImport} onClose={() => setShowImport(false)} />}
    </div>
  );
}

function sectionPillStyle(active: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 20px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    background: active ? "#fff" : "transparent",
    color: active ? "#111827" : "#6b7280",
    boxShadow: active ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
    transition: "all 0.15s",
  };
}

type ViniDashboardProps = { refreshToken?: string | null; embeddedChrome?: boolean };

export default function ViniDashboard({ refreshToken, embeddedChrome }: ViniDashboardProps) {
  const [section, setSection] = useState<ViniSection>("account");

  const openMetabase = useCallback(() => {
    window.open(METABASE_VINI_DASHBOARD, "_blank", "noopener,noreferrer");
  }, []);

  return (
    <div style={{ color: "#111827" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4, background: "#f3f4f6", borderRadius: 10, padding: 4, width: "fit-content" }}>
          <button type="button" style={sectionPillStyle(section === "account")} onClick={() => setSection("account")}>
            <Activity style={{ width: 16, height: 16 }} />
            Account Health
          </button>
          <button type="button" style={sectionPillStyle(section === "issues")} onClick={() => setSection("issues")}>
            <AlertTriangle style={{ width: 16, height: 16 }} />
            Agent Issues
          </button>
          <button type="button" style={sectionPillStyle(section === "metabase")} onClick={() => setSection("metabase")}>
            <BarChart3 style={{ width: 16, height: 16 }} />
            Call analytics
          </button>
        </div>
        <button
          type="button"
          onClick={openMetabase}
          style={{ marginLeft: "auto", fontSize: 13, fontWeight: 600, color: "#4f46e5", background: "none", border: "none", cursor: "pointer" }}
        >
          Open Metabase ↗
        </button>
      </div>

      {section === "account" && <ViniAccountHealth refreshToken={refreshToken} embeddedChrome={embeddedChrome} />}

      {section === "issues" && (
        <div style={{ borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden", background: "#f9fafb", height: "min(85vh, 900px)" }}>
          <iframe title="Agent Issues — AI Agent Analytics" src="/agent-analytics.html" style={{ width: "100%", height: "100%", border: "none", minHeight: 560 }} />
        </div>
      )}

      {section === "metabase" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
            Metabase public dashboard (call volume, outcomes, QC, costs). Use filters inside the frame.
          </p>
          <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", background: "#f3f4f6" }}>
            <iframe
              title="Vini — Metabase"
              src={METABASE_VINI_DASHBOARD}
              style={{ width: "100%", border: "none", display: "block", height: "min(85vh, 1400px)", minHeight: 560 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
