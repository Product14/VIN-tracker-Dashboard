// ─── Migration Runner ─────────────────────────────────────────────────────────
// Reads numbered .sql files from server/migrations/, applies any that haven't
// been recorded in schema_migrations, and exits. Safe to run multiple times.
// Hooked into the Vercel build command so it runs once per deployment.

import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, "migrations");

const pool = new Pool({
  connectionString: process.env.VIN_TRACKER_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const { rows } = await client.query(`SELECT filename FROM schema_migrations`);
    const applied = new Set(rows.map(r => r.filename));

    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith(".sql"))
      .sort();

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      console.log(`[migrate] applying ${file}…`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO schema_migrations (filename) VALUES ($1)`,
          [file]
        );
        await client.query("COMMIT");
        ran++;
        console.log(`[migrate] applied ${file}`);
      } catch (e) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${file} failed: ${e.message}`);
      }
    }

    if (ran === 0) console.log("[migrate] nothing to apply");
    else console.log(`[migrate] done — ${ran} migration(s) applied`);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(e => {
  console.error("[migrate] fatal:", e.message);
  process.exit(1);
});
