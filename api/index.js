import "../server/loadEnv.js";
import { initSchema } from "../server/db.js";
import app from "../server/app.js";

// Top-level await: ensures tables/views exist before the Lambda handles any request.
// CREATE TABLE IF NOT EXISTS is idempotent — safe on every cold start.
await initSchema();

export default app;
