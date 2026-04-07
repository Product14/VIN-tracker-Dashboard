import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/metabase-api": {
        target: "https://metabase.spyne.ai",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/metabase-api/, ""),
      },
      "/api": {
        target: "http://localhost:3002",
        changeOrigin: true,
      },
    },
  },
});
