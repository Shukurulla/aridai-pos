import { app, BrowserWindow, ipcMain, shell } from "electron";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import electronUpdater from "electron-updater";

const { autoUpdater } = electronUpdater;

// ============================================================
// AridaiPOS Monitor — POS terminal (kassa) Electron ilovasi.
// FAQAT UI. Backend YO'Q — local server (aridaipos_server, localhost:4561)
// yoki LAN'dagi server PC'ga ulanadi.
// Auto-update: electron-updater (GitHub release). Renderer Settings → window.pos.updates.
// ============================================================

const __dirname = dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;
const DEV_URL = "http://localhost:5180";
const RELEASES_REPO = "Shukurulla/aridai-pos";

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

// ===== Auto-update (electron-updater) — renderer'ga holat yuboradi =====
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
function sendUpd(state, extra = {}) {
  if (win && !win.isDestroyed()) win.webContents.send("pos:update-event", { state, ...extra });
}
autoUpdater.on("checking-for-update", () => sendUpd("checking"));
autoUpdater.on("update-available", (i) => sendUpd("available", { version: i?.version }));
autoUpdater.on("update-not-available", (i) => sendUpd("latest", { version: i?.version }));
autoUpdater.on("download-progress", (p) => sendUpd("downloading", { percent: Math.round(p?.percent || 0) }));
autoUpdater.on("update-downloaded", (i) => sendUpd("downloaded", { version: i?.version }));
autoUpdater.on("error", (e) => sendUpd("error", { error: String(e?.message || e) }));

// ===== IPC — window.pos.updates / window.pos.zoom =====
ipcMain.handle("pos:current", () => ({ version: app.getVersion() }));
ipcMain.handle("pos:check", async () => {
  if (isDev) return { dev: true };
  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (e) {
    sendUpd("error", { error: String(e?.message || e) });
    return { ok: false };
  }
});
ipcMain.handle("pos:download", async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { ok: true };
  } catch (e) {
    sendUpd("error", { error: String(e?.message || e) });
    return { ok: false };
  }
});
ipcMain.handle("pos:install", () => {
  autoUpdater.quitAndInstall();
  return { ok: true };
});
ipcMain.handle("pos:open", (_e, url) => {
  if (url) shell.openExternal(String(url));
  return { ok: true };
});
ipcMain.handle("pos:releases", async () => {
  try {
    const res = await fetch(`https://api.github.com/repos/${RELEASES_REPO}/releases`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    const list = (await res.json()) || [];
    const data = (Array.isArray(list) ? list : []).map((r) => ({
      tag: r.tag_name,
      name: r.name,
      prerelease: r.prerelease,
      publishedAt: r.published_at,
      url: r.html_url,
      exe: (r.assets || [])
        .filter((a) => String(a.name || "").toLowerCase().endsWith(".exe"))
        .map((a) => ({ url: a.browser_download_url, name: a.name })),
    }));
    return { success: true, data };
  } catch (e) {
    return { success: false, error: String(e?.message || e), data: [] };
  }
});
ipcMain.handle("pos:zoom-get", () => (win ? win.webContents.getZoomFactor() : 1));
ipcMain.handle("pos:zoom-set", (_e, factor) => {
  if (win) win.webContents.setZoomFactor(Number(factor) || 1);
  return { ok: true };
});

app.whenReady().then(async () => {
  await createWindow();
  // Paketlanган ilovada ishga tushganda yangilanishni tekshiramiz (jim).
  if (!isDev) autoUpdater.checkForUpdates().catch(() => {});
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
