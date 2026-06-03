import { app, BrowserWindow } from "electron";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// ============================================================
// AridaiPOS Monitor — POS terminal (kassa) Electron ilovasi.
// FAQAT UI. Backend YO'Q — local server (aridaipos_server, localhost:4561)
// yoki LAN'dagi server PC'ga ulanadi. Renderer api.ts ulanishni hal qiladi:
//   window.__API_BASE__ || localStorage 'hub-url' || http://localhost:4561
// Bir filialda bir nechta monitor bo'lishi mumkin (bittasi server PC'da).
// ============================================================

const __dirname = dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;
const DEV_URL = "http://localhost:5180";

let win = null;

async function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: "#f4f1ea",
    title: "AridaiPos — Касса",
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    // Renderer (vite 5180) tayyor bo'lguncha kutamiz (retry)
    for (let i = 0; i < 40; i++) {
      try {
        await win.loadURL(DEV_URL);
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  } else {
    await win.loadFile(join(__dirname, "../../dist/renderer/index.html"));
  }
}

app.whenReady().then(async () => {
  await createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
