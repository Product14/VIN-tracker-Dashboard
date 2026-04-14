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

export default function App() {
  const [activeDash, setActiveDash] = useState<string | null>(null);
  const [vinTab, setVinTab] = useState("Overview");
  const [churnTab, setChurnTab] = useState("Issue Level");

  const handleNavClick = useCallback((dashId: string) => {
    setActiveDash(prev => prev === dashId ? prev : dashId);
  }, []);

  const handleTabClick = useCallback((dashId: string, tab: string) => {
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
        {/* Logo */}
        <div style={{ padding: "18px 0 16px", borderBottom: "1px solid #f1f5f9", width: "100%", display: "flex", justifyContent: "center" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
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
        {activeDash === null ? (
          // Landing state — no dashboard selected yet
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#111827" }}>Control Tower</div>
              <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>Select a dashboard from the left sidebar</div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              {NAV.map(item => (
                <button key={item.id} onClick={() => handleNavClick(item.id)}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", transition: "all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.color = "#6366f1"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.color = "#374151"; }}>
                  <span style={{ color: "#6366f1" }}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {activeDash === "churn" && (
              <ChurnDashboard activeTab={churnTab} onTabChange={(t) => handleTabClick("churn", t)} />
            )}
            {activeDash === "vin" && (
              <Dashboard activeTab={vinTab} onTabChange={(t) => handleTabClick("vin", t)} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
