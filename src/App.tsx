import React, { useState, useCallback } from "react";
import Dashboard from "../inventory-dashboard.tsx";
import ChurnDashboard from "./ChurnDashboard.tsx";

const NAV = [
  {
    id: "churn",
    label: "Churn Dashboard",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" /><polyline points="16 17 22 17 22 11" />
      </svg>
    ),
    tabs: ["Issue Level", "Rooftop Level", "Rooftop × Issue"],
  },
  {
    id: "vin",
    label: "VIN Tracking",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
      </svg>
    ),
    tabs: ["Overview", "Enterprise View", "Rooftop View", "VIN Data"],
  },
];

// Sub-tab icons
const TAB_ICONS: Record<string, JSX.Element> = {
  "Issue Level": (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  ),
  "Rooftop Level": (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  "Rooftop × Issue": (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
    </svg>
  ),
  "Overview": (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
    </svg>
  ),
  "Enterprise View": (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    </svg>
  ),
  "Rooftop View": (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  ),
  "VIN Data": (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>
  ),
};

function HomePage({ onNavigate }: { onNavigate: (dashId: string, tab: string) => void }) {
  const cards = [
    {
      id: "churn", label: "Churn Dashboard",
      description: "Monitor at-risk accounts, track open issues by priority, and drill from enterprise level down to individual rooftop incidents.",
      color: "#6366f1", lightColor: "#eef2ff",
      icon: NAV[0].icon,
      tabs: ["Issue Level", "Rooftop Level", "Rooftop × Issue"],
      stats: [{ label: "Issue Types", value: "7" }, { label: "Views", value: "3" }, { label: "ARR Tracked", value: "$800K+" }],
    },
    {
      id: "vin", label: "VIN Tracking Dashboard",
      description: "Track VIN delivery SLAs across all rooftops and CSMs. Identify pending backlogs, >24h violations, and drill into raw VIN data.",
      color: "#0ea5e9", lightColor: "#e0f2fe",
      icon: NAV[1].icon,
      tabs: ["Overview", "Enterprise View", "Rooftop View", "VIN Data"],
      stats: [{ label: "Live Records", value: "120K+" }, { label: "Rooftops", value: "500+" }, { label: "CSMs", value: "20+" }],
    },
  ];

  return (
    <div style={{ minHeight: "100%", background: "#f8fafc", padding: "40px 48px" }}>
      {/* Hero */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(99,102,241,0.35)" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "#111827", letterSpacing: "-0.5px" }}>Control Tower</h1>
            <p style={{ margin: 0, fontSize: 13, color: "#6b7280", fontWeight: 500 }}>Customer Success · Spyne Internal</p>
          </div>
        </div>
        <p style={{ margin: 0, maxWidth: 620, fontSize: 15, color: "#4b5563", lineHeight: 1.7 }}>
          A unified command center for the Customer Success team — monitor churn risk, track VIN delivery SLAs, and take action across all rooftops and enterprises from a single surface.
        </p>

        {/* Key pillars */}
        <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
          {[
            { icon: "⚡", label: "Real-time sync", sub: "Live from Metabase" },
            { icon: "🔍", label: "Drill-down", sub: "Enterprise → Rooftop → VIN" },
            { icon: "📊", label: "Aggregated views", sub: "Totals, rates & trends" },
            { icon: "⬇️", label: "CSV export", sub: "Every table, any filter" },
          ].map(p => (
            <div key={p.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <span style={{ fontSize: 18 }}>{p.icon}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>{p.label}</div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>{p.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dashboard cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 24 }}>
        {cards.map(card => (
          <div key={card.id} style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
            {/* Card header */}
            <div style={{ padding: "22px 24px 18px", borderBottom: "1px solid #f3f4f6" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: card.lightColor, display: "flex", alignItems: "center", justifyContent: "center", color: card.color }}>
                  {card.icon}
                </div>
                <span style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>{card.label}</span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>{card.description}</p>

              {/* Stats row */}
              <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
                {card.stats.map(s => (
                  <div key={s.label}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: card.color }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div style={{ padding: "14px 24px 18px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Views</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {card.tabs.map((tab, idx) => (
                  <button key={tab} onClick={() => onNavigate(card.id, tab)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "9px 12px", borderRadius: 8,
                      background: idx === 0 ? card.lightColor : "#f9fafb",
                      border: `1px solid ${idx === 0 ? card.color + "30" : "#f3f4f6"}`,
                      color: idx === 0 ? card.color : "#374151",
                      fontSize: 13, fontWeight: idx === 0 ? 600 : 400,
                      cursor: "pointer", textAlign: "left", transition: "all 0.12s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = card.lightColor; e.currentTarget.style.borderColor = card.color + "40"; e.currentTarget.style.color = card.color; }}
                    onMouseLeave={e => { e.currentTarget.style.background = idx === 0 ? card.lightColor : "#f9fafb"; e.currentTarget.style.borderColor = idx === 0 ? card.color + "30" : "#f3f4f6"; e.currentTarget.style.color = idx === 0 ? card.color : "#374151"; }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "inherit", opacity: 0.7 }}>{TAB_ICONS[tab]}</span>
                      {tab}
                    </span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [activeDash, setActiveDash] = useState<string | null>(null);
  const [showHome, setShowHome] = useState(true);
  const [vinTab, setVinTab] = useState("Overview");
  const [churnTab, setChurnTab] = useState("Issue Level");

  const goHome = useCallback(() => {
    setShowHome(true);
    setActiveDash(null);
  }, []);

  const handleNavClick = useCallback((dashId: string) => {
    setShowHome(false);
    setActiveDash(prev => prev === dashId ? prev : dashId);
  }, []);

  const handleTabClick = useCallback((dashId: string, tab: string) => {
    setShowHome(false);
    setActiveDash(dashId);
    if (dashId === "vin") setVinTab(tab);
    else setChurnTab(tab);
  }, []);

  const activeTab = activeDash === "vin" ? vinTab : churnTab;
  const subPanelOpen = activeDash !== null;
  const activeNav = NAV.find(n => n.id === activeDash);

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", overflow: "hidden", background: "#f1f5f9" }}>

      {/* ── Icon rail (always visible) ── */}
      <aside style={{
        width: 80, background: "#fff", display: "flex", flexDirection: "column", alignItems: "center",
        flexShrink: 0, borderRight: "1px solid #e5e7eb", zIndex: 20,
      }}>
        {/* Logo — click to go home */}
        <div style={{ padding: "18px 0 16px", borderBottom: "1px solid #f1f5f9", width: "100%", display: "flex", justifyContent: "center" }}>
          <button onClick={goHome} title="Home" style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: showHome ? "0 0 0 3px #c7d2fe" : "none", transition: "box-shadow 0.15s" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
          </button>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 12, gap: 4, width: "100%" }}>
          {NAV.map(item => {
            const isActive = activeDash === item.id;
            return (
              <button key={item.id} onClick={() => handleNavClick(item.id)}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  gap: 5, width: "100%", padding: "10px 6px",
                  background: "transparent", border: "none", cursor: "pointer",
                  color: isActive ? "#6366f1" : "#94a3b8",
                  transition: "all 0.15s",
                  position: "relative",
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = "#475569"; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = "#94a3b8"; }}
              >
                {isActive && (
                  <span style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 3, height: 28, borderRadius: "0 3px 3px 0", background: "#6366f1" }} />
                )}
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center",
                  width: 40, height: 40, borderRadius: 10,
                  background: isActive ? "#eef2ff" : "transparent",
                  transition: "background 0.15s",
                }}>
                  {item.icon}
                </span>
                <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 500, letterSpacing: "0.01em", textAlign: "center", lineHeight: 1.2 }}>
                  {item.label.split(" ")[0]}
                </span>
              </button>
            );
          })}
        </nav>

        <div style={{ padding: "12px 0", borderTop: "1px solid #f1f5f9", width: "100%", display: "flex", justifyContent: "center" }}>
          <span style={{ fontSize: 9, color: "#cbd5e1", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Spyne</span>
        </div>
      </aside>

      {/* ── Sub-panel (slides in when a dashboard is selected) ── */}
      <div style={{
        width: subPanelOpen ? 220 : 0,
        overflow: "hidden",
        transition: "width 0.2s ease",
        flexShrink: 0,
        background: "#fff",
        borderRight: subPanelOpen ? "1px solid #e5e7eb" : "none",
        display: "flex", flexDirection: "column",
        zIndex: 10,
      }}>
        {activeNav && (
          <>
            {/* Sub-panel header */}
            <div style={{ padding: "20px 16px 14px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#6366f1" }}>{activeNav.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#111827", textTransform: "uppercase", letterSpacing: "0.04em" }}>{activeNav.label}</span>
              </div>
              <button onClick={() => setActiveDash(null)}
                style={{ width: 24, height: 24, borderRadius: "50%", border: "1px solid #e5e7eb", background: "#f9fafb", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280", flexShrink: 0 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
            </div>

            {/* Sub-tabs */}
            <nav style={{ flex: 1, padding: "8px 0", overflowY: "auto" }}>
              {activeNav.tabs.map(tab => {
                const isActive = activeTab === tab && activeDash === activeNav.id;
                const icon = TAB_ICONS[tab];
                return (
                  <button key={tab} onClick={() => handleTabClick(activeNav.id, tab)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      width: "100%", textAlign: "left",
                      padding: "9px 16px",
                      background: isActive ? "#eef2ff" : "transparent",
                      border: "none",
                      borderRadius: isActive ? "0 8px 8px 0" : 0,
                      color: isActive ? "#4f46e5" : "#64748b",
                      fontSize: 13, fontWeight: isActive ? 700 : 400,
                      cursor: "pointer", transition: "all 0.12s",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      marginRight: 8,
                    }}
                    onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.color = "#374151"; } }}
                    onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#64748b"; } }}
                  >
                    <span style={{ color: isActive ? "#6366f1" : "#94a3b8", flexShrink: 0 }}>{icon}</span>
                    {tab}
                  </button>
                );
              })}
            </nav>
          </>
        )}
      </div>

      {/* ── Main content ── */}
      <main style={{ flex: 1, overflow: "auto", background: "#f8fafc" }}>
        {showHome && <HomePage onNavigate={handleTabClick} />}
        {!showHome && activeDash === "churn" && (
          <ChurnDashboard activeTab={churnTab} onTabChange={(t) => handleTabClick("churn", t)} />
        )}
        {!showHome && activeDash === "vin" && (
          <Dashboard activeTab={vinTab} onTabChange={(t) => handleTabClick("vin", t)} />
        )}
      </main>
    </div>
  );
}
