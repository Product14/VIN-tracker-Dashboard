import "../server/loadEnv.js";
import { initSchema } from "../server/db.js";
import app from "../server/app.js";

// Best-effort schema init on cold start. CREATE TABLE IF NOT EXISTS is
// idempotent — safe on every invocation. Failures (e.g. missing
// VIN_TRACKER_DATABASE_URL on this Vercel project, ECONNREFUSED) must NOT
// crash the lambda, otherwise DB-less endpoints like /api/agents return 500.
try {
  await initSchema();
} catch (err) {
  const parts = [err?.message, err?.code, ...(err?.errors?.map((e) => e?.message) ?? [])].filter(Boolean);
  const reason = parts.length ? parts.join(" | ") : String(err);
  console.warn(`[startup] initSchema failed — DB endpoints will 500, non-DB routes still work.\n  reason: ${reason}`);
}

export default app;
