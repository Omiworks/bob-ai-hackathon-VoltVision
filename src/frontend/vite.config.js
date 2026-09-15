import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GridGuardian AI frontend — Vite config.
// Proxies /api requests to the FastAPI backend during local development
// so the frontend can call relative paths like fetch("/api/dashboard").
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
