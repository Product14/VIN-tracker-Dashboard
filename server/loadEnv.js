/**
 * Loads env before db.js runs. Prefers database_url.env (local), then .env.
 * Avoids Node failing when --env-file=database_url.env is missing.
 */
import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = dirname(fileURLToPath(import.meta.url));
const root = join(serverDir, "..");

if (existsSync(join(root, ".env"))) {
  dotenv.config({ path: join(root, ".env") });
}
if (existsSync(join(root, "database_url.env"))) {
  dotenv.config({ path: join(root, "database_url.env"), override: true });
}
