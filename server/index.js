import "./loadEnv.js";
import { initSchema } from "./db.js";
import app from "./app.js";

const PORT = process.env.PORT || 3002;

try {
  await initSchema();
} catch (err) {
  console.warn(
    `[startup] initSchema failed — DB endpoints will 500, but non-DB routes (e.g. /api/campaigns) still work.\n  reason: ${err?.message ?? err}`
  );
}

app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`));
