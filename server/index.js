import app from "./app.js";

// ─── Start ───────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`));
