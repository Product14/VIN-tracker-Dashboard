import React, { useState, useCallback } from "react";
import Dashboard from "../inventory-dashboard.tsx";
import ChurnDashboard from "./ChurnDashboard.tsx";

const SIDEBAR = [
  {
    id: "churn",
    label: "Churn Dashboard",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" /><polyline points="16 17 22 17 22 11" />
      </svg>
    ),
    tabs: ["Issue Level", "Rooftop Level", "Rooftop × Issue"],
  },
  {
    id: "vin",
    label: "VIN Inventory",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
      </svg>
    ),
    tabs: ["Overview", "Enterprise View", "Rooftop View", "VIN Data"],
  },
];

export default function App() {
  const [activeDash, setActiveDash] = useState("vin");
  const [vinTab, setVinTab] = useState("Overview");
  const [churnTab, setChurnTab] = useState("Issue Level");

  const handleTabClick = useCallback((dashId: string, tab: string) => {
    setActiveDash(dashId);
    if (dashId === "vin") setVinTab(tab);
    else setChurnTab(tab);
  }, []);

  const activeTab = activeDash === "vin" ? vinTab : churnTab;

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", overflow: "hidden" }}>
      {/* Sidebar */}
      <aside style={{ width: 220, background: "#0f172a", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        {/* Brand */}
        <div style={{ padding: "18px 16px 16px", borderBottom: "1px solid #1e293b" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
              </svg>
            </div>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.3px" }}>Control Tower</span>
          </div>
          <div style={{ fontSize: 11, color: "#475569", paddingLeft: 32 }}>Customer Success</div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "10px 0", overflowY: "auto" }}>
          {SIDEBAR.map(item => {
            const isDashActive = activeDash === item.id;
            return (
              <div key={item.id} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 14px 4px", color: isDashActive ? "#94a3b8" : "#475569", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  <span style={{ color: isDashActive ? "#6366f1" : "#334155" }}>{item.icon}</span>
                  {item.label}
                </div>
                {item.tabs.map(tab => {
                  const isActive = isDashActive && activeTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => handleTabClick(item.id, tab)}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        width: "100%", textAlign: "left",
                        padding: "6px 14px 6px 26px",
                        background: isActive ? "#1e293b" : "transparent",
                        border: "none",
                        borderLeft: `2px solid ${isActive ? "#6366f1" : "transparent"}`,
                        color: isActive ? "#e2e8f0" : "#64748b",
                        fontSize: 12.5, fontWeight: isActive ? 600 : 400,
                        cursor: "pointer", transition: "all 0.1s",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}
                      onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = "#1e293b80"; e.currentTarget.style.color = "#94a3b8"; } }}
                      onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#64748b"; } }}
                    >
                      {isActive && <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#6366f1", flexShrink: 0 }} />}
                      {tab}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div style={{ padding: "10px 14px", borderTop: "1px solid #1e293b", fontSize: 10, color: "#334155", fontWeight: 500 }}>
          Spyne · Internal Tool
        </div>
      </aside>

      {/* Content */}
      <main style={{ flex: 1, overflow: "auto", background: "#f8fafc" }}>
        {/* Tab breadcrumb header */}
        <div style={{ padding: "14px 28px 0", display: "flex", alignItems: "center", gap: 6, color: "#9ca3af", fontSize: 12 }}>
          <span style={{ color: "#6366f1", fontWeight: 600 }}>{SIDEBAR.find(s => s.id === activeDash)?.label}</span>
          <span>›</span>
          <span style={{ color: "#374151", fontWeight: 600 }}>{activeTab}</span>
        </div>

        {activeDash === "churn" && (
          <ChurnDashboard activeTab={churnTab} onTabChange={(t) => handleTabClick("churn", t)} />
        )}
        {activeDash === "vin" && (
          <Dashboard activeTab={vinTab} onTabChange={(t) => handleTabClick("vin", t)} />
        )}
      </main>
    </div>
  );
}
