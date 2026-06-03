import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "url";

// POS Monitor renderer (kepket-kz POS UI ko'chirilgan). Electron main shu sahifani
// yuklaydi. Lokal serverga (4561) HTTP orqali ulanadi. base "./" — prod file://.
export default defineConfig({
  root: "src/renderer",
  base: "./",
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src/renderer/src", import.meta.url)) },
  },
  server: { port: 5180, strictPort: true },
  build: {
    outDir: fileURLToPath(new URL("./dist/renderer", import.meta.url)),
    emptyOutDir: true,
  },
});
