import express from "express";
import cors from "cors";
import db from "./db.js";

const app = express();
app.use(cors());
app.use(express.json());

const METABASE_URL =
  "https://metabase.spyne.ai/api/public/card/15e908e4-fe21-4982-9d8c-4aff07f2c948/query/json";

function toApiRow(r) {
  return {
    vin:         r.vin,
    enterpriseId: r.enterprise_id,
    enterprise:  r.enterprise,
    rooftopId:   r.rooftop_id,
    rooftop:     r.rooftop,
    rooftopType: r.rooftop_type,
    csm:         r.csm,
    status:      r.status,
    after24h:    r.after_24h !== null ? Boolean(r.after_24h) : null,
    receivedAt:  r.received_at,
    processedAt: r.processed_at,
    syncedAt:    r.synced_at,
  };
}

// GET /api/vins — return all rows from DB
app.get("/api/vins", (_req, res) => {
  const rows = db.prepare("SELECT * FROM vins ORDER BY received_at DESC").all();
  const meta = db.prepare("SELECT MAX(synced_at) AS last_sync FROM vins").get();
  res.json({ data: rows.map(toApiRow), lastSync: meta?.last_sync ?? null });
});

// POST /api/sync — fetch from Metabase, upsert into DB, return updated rows
app.post("/api/sync", async (_req, res) => {
  try {
    const response = await fetch(METABASE_URL);
    if (!response.ok) throw new Error(`Metabase HTTP ${response.status}`);
    const metaRows = await response.json();

    const syncedAt = new Date().toISOString();

    const upsert = db.prepare(`
      INSERT INTO vins
        (vin, enterprise_id, enterprise, rooftop_id, rooftop, rooftop_type,
         csm, status, after_24h, received_at, processed_at, synced_at)
      VALUES
        (@vin, @enterpriseId, @enterprise, @rooftopId, @rooftop, @rooftopType,
         @csm, @status, @after24h, @receivedAt, @processedAt, @syncedAt)
      ON CONFLICT(vin) DO UPDATE SET
        enterprise_id = excluded.enterprise_id,
        enterprise    = excluded.enterprise,
        rooftop_id    = excluded.rooftop_id,
        rooftop       = excluded.rooftop,
        rooftop_type  = excluded.rooftop_type,
        csm           = excluded.csm,
        status        = excluded.status,
        after_24h     = excluded.after_24h,
        received_at   = excluded.received_at,
        processed_at  = excluded.processed_at,
        synced_at     = excluded.synced_at
    `);

    const EPOCH = "1970-01-01T00:00:00Z";
    const cleanDate = (v) => (!v || v === EPOCH) ? null : v;
    const cleanAfter24 = (v) => {
      if (v === null || v === undefined) return null;
      if (typeof v === "string") return v.toLowerCase() === "yes" ? 1 : 0;
      return v ? 1 : 0;
    };

    db.transaction(() => {
      for (const row of metaRows) {
        upsert.run({
          vin:         row.vinName ?? "",
          enterpriseId: row["m.enterpriseId"] ?? "",
          enterprise:  row.name ?? "",
          rooftopId:   String(row["m.teamId"] ?? ""),
          rooftop:     row.rooftop_name ?? "",
          rooftopType: row.type ?? "",
          csm:         row.email_id ?? "",
          status:      row.status ?? "",
          after24h:    cleanAfter24(row.after_24_hrs ?? row.after_24hrs ?? null),
          receivedAt:  cleanDate(row.receivedAt),
          processedAt: cleanDate(row.sentAt),
          syncedAt,
        });
      }
    })();

    const rows = db.prepare("SELECT * FROM vins ORDER BY received_at DESC").all();
    res.json({ synced: metaRows.length, data: rows.map(toApiRow), syncedAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`));
