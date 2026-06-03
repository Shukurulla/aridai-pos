import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "url";

// Local Server status UI (renderer). Electron main shu sahifani yuklaydi.
// Dev: localhost:5273 · Prod: dist/renderer/index.html (file://)
export default defineConfig({
  root: "src/renderer",
  base: "./",
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src/renderer/src", import.meta.url)) },
  },
  server: { port: 5273, strictPort: true },
  build: {
    outDir: fileURLToPath(new URL("./dist/renderer", import.meta.url)),
    emptyOutDir: true,
  },
});
