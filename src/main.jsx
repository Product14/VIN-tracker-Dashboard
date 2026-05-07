import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import Dashboard from "../inventory-dashboard.tsx";
import AgentsDashboard from "./agents/AgentsDashboard.tsx";
import AgentsDashboardV2 from "./agents/AgentsDashboardV2.tsx";
import AgentsDashboardV3 from "./agents/AgentsDashboardV3.tsx";

function Router() {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  if (path === "/agents-v3" || path.startsWith("/agents-v3/")) {
    return <AgentsDashboardV3 />;
  }
  if (path === "/agents-v2" || path.startsWith("/agents-v2/")) {
    return <AgentsDashboardV2 />;
  }
  if (path === "/agents" || path.startsWith("/agents/")) {
    return <AgentsDashboard />;
  }
  return <Dashboard />;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Router />
  </StrictMode>
);
