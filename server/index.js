import app, { syncFromMetabase } from "./app.js";

// ─── Auto-sync every hour (local dev only) ───────────────────────────────────

async function runAutoSync() {
  try {
    const { count, syncedAt } = await syncFromMetabase();
    console.log(`[auto-sync] OK — ${count} rows at ${syncedAt}`);
  } catch (err) {
    console.error(`[auto-sync] FAILED — ${err.message}`);
  }
}

runAutoSync();
setInterval(runAutoSync, 60 * 60 * 1000);

// ─── Start ───────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`));
