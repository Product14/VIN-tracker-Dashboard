import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import Dashboard from "../inventory-dashboard.tsx";
import AgentsDashboard from "./agents/AgentsDashboard.tsx";

function Router() {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

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
