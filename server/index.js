import { initSchema } from "./db.js";
import app from "./app.js";

const PORT = process.env.PORT || 3002;

await initSchema();
app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`));
