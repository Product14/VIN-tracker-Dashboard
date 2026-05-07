import "./loadEnv.js";
import { initSchema } from "./db.js";
import app from "./app.js";

const PORT = process.env.PORT || 3002;

try {
  await initSchema();
} catch (err) {
  // AggregateError (e.g. pg ECONNREFUSED) has empty .message; surface .code and inner errors.
  const parts = [err?.message, err?.code, ...(err?.errors?.map((e) => e?.message) ?? [])].filter(Boolean);
  const reason = parts.length ? parts.join(" | ") : String(err);
  const hint = !process.env.VIN_TRACKER_DATABASE_URL
    ? "\n  hint: VIN_TRACKER_DATABASE_URL is not set — copy .env.example to .env (or database_url.env) and fill in the Supabase URL."
    : "";
  console.warn(
    `[startup] initSchema failed — DB endpoints will 500, but non-DB routes (e.g. /api/campaigns) still work.\n  reason: ${reason}${hint}`
  );
}

app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`));
