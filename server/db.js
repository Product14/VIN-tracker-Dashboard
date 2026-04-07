import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, "vins.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS vins (
    vin          TEXT PRIMARY KEY,
    enterprise_id TEXT,
    enterprise   TEXT,
    rooftop_id   TEXT,
    rooftop      TEXT,
    rooftop_type TEXT,
    csm          TEXT,
    status       TEXT,
    after_24h    INTEGER,
    received_at  TEXT,
    processed_at TEXT,
    synced_at    TEXT
  )
`);

export default db;
