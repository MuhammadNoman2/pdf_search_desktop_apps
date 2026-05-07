import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Relative base so Electron can load from file:// in production
  base: command === "serve" ? "/" : "./",
  server: {
    port: 5173,
    proxy: {
      "/upload": "http://localhost:3001",
      "/search":  "http://localhost:3001",
      "/pdf":     "http://localhost:3001",
      "/files":   "http://localhost:3001",
      "/file":    "http://localhost:3001",
    },
  },
}));
