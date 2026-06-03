import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev'da /api so'rovlari global backend'ga (4560) proxy qilinadi
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:4560",
      "/uploads": "http://localhost:4560",
    },
  },
});
