import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Filial admin paneli — global backend (4560) ga ulanadi. /api → 4560 proksi (CORS'siz).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    strictPort: true,
    proxy: {
      "/api": { target: "http://localhost:4560", changeOrigin: true },
      "/uploads": { target: "http://localhost:4560", changeOrigin: true },
    },
  },
});
