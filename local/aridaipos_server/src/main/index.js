import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell } from "electron";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv from "dotenv";
import electronUpdater from "electron-updater";

const { autoUpdater } = electronUpdater;

// ============================================================
// AridaiPOS Local Server — Electron main process.
// Filial PC'da ishlaydi: lokal backend (Express + lokal MongoDB + VPS sync)
// shu yerda ko'tariladi, status UI (renderer) holatni ko'rsatadi.
// POS monitorlar LAN orqali shu backendga (4561) ulanadi.
// Struktura kepket aridai-local-server bilan bir xil (src/main/preload/renderer).
// ============================================================

const __dirname = dirname(fileURLToPath(import.meta.url));

// .env folder ildizidan — backend config (process.env) o'qishidan OLDIN yuklanadi
dotenv.config({ path: join(__dirname, "../../.env") });

const PORT = Number(process.env.LOCAL_PORT) || 4561;
const GLOBAL_URL = process.env.GLOBAL_URL || "http://localhost:4560";
const isDev = !app.isPackaged;
const DEV_URL = "http://localhost:5273";

let mainWindow = null;
let tray = null;
let backend = null; // { app, httpServer, io }
let models = null; // dynamic-loaded mongoose models (status/foods/categories)

// ── Saqlanadigan holat (userData/*.json) ───────────────────────────
function userFile(name) {
  return join(app.getPath("userData"), name);
}
function readJson(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(userFile(name), "utf8"));
  } catch {
    return fallback;
  }
}
function writeJson(name, data) {
  try {
    fs.writeFileSync(userFile(name), JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

let authState = null; // { staff, token, restaurantName, branchName, branchId, restaurantId }
let currentZoom = 1;
const clampZoom = (f) => Math.min(2, Math.max(0.5, Math.round((Number(f) || 1) * 100) / 100));

const heartbeatState = {
  isOnline: false,
  lastConnectedAt: null,
  reconnectAttempts: 0,
  lastError: null,
};

// ── Backend (Express + Mongo) boot ─────────────────────────────────
async function bootBackend() {
  const { startLocalBackend } = await import("./backend/server.js");
  try {
    backend = await startLocalBackend();
    console.log(`[LocalServer] backend ${PORT} portda ko'tarildi`);
  } catch (e) {
    if (e.code === "EADDRINUSE") {
      console.warn(`[LocalServer] ${PORT} band — mavjud backendga ulanamiz (mongoose ulangan)`);
    } else {
      console.error("[LocalServer] backend xato:", e.message);
    }
  }
  // Mongoose modellarini status/foods/categories uchun yuklab qo'yamiz
  try {
    const [order, food, category, table, users] = await Promise.all([
      import("./backend/models/order.model.js"),
      import("./backend/models/food.model.js"),
      import("./backend/models/category.model.js"),
      import("./backend/models/table.model.js"),
      import("./backend/models/users.model.js"),
    ]);
    models = {
      order: order.default,
      food: food.default,
      category: category.default,
      table: table.default,
      users: users.default,
    };
  } catch (e) {
    console.error("[LocalServer] modellarni yuklab bo'lmadi:", e.message);
  }
}

// ── VPS heartbeat (status UI uchun) ────────────────────────────────
async function pingGlobal() {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 1500);
    const res = await fetch(`${GLOBAL_URL}/api/health`, { signal: ctl.signal }).catch(() => null);
    clearTimeout(t);
    if (res && res.ok) {
      heartbeatState.isOnline = true;
      heartbeatState.lastConnectedAt = new Date().toISOString();
      heartbeatState.reconnectAttempts = 0;
      heartbeatState.lastError = null;
    } else {
      heartbeatState.isOnline = false;
      heartbeatState.reconnectAttempts += 1;
    }
  } catch (e) {
    heartbeatState.isOnline = false;
    heartbeatState.reconnectAttempts += 1;
    heartbeatState.lastError = e.message;
  }
}

// ── Oyna ───────────────────────────────────────────────────────────
function applyZoom(f) {
  currentZoom = clampZoom(f);
  try {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.setZoomFactor(currentZoom);
  } catch {
    /* ignore */
  }
  writeJson("ui-zoom.json", { factor: currentZoom });
  return currentZoom;
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 820,
    minWidth: 1100,
    minHeight: 700,
    title: "AridaiPOS Local Server",
    backgroundColor: "#f4f2ed",
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.on("did-finish-load", () => {
    try {
      mainWindow.webContents.setZoomFactor(currentZoom);
    } catch {
      /* ignore */
    }
  });

  if (isDev) {
    for (let i = 0; i < 40; i++) {
      try {
        await mainWindow.loadURL(DEV_URL);
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  } else {
    await mainWindow.loadFile(join(__dirname, "../../dist/renderer/index.html"));
  }
}

function createTray() {
  try {
    const iconPath = join(__dirname, "../renderer/src/assets/aridai-logo.png");
    let img = nativeImage.createFromPath(iconPath);
    if (img.isEmpty()) img = nativeImage.createEmpty();
    tray = new Tray(img.resize ? img.resize({ width: 18, height: 18 }) : img);
    const menu = Menu.buildFromTemplate([
      { label: "Открыть Local Server", click: () => mainWindow?.show() },
      { type: "separator" },
      { label: "Выход", click: () => app.quit() },
    ]);
    tray.setToolTip("AridaiPOS Local Server");
    tray.setContextMenu(menu);
    tray.on("click", () => mainWindow?.show());
  } catch (e) {
    console.warn("[LocalServer] tray yaratilmadi:", e.message);
  }
}

// ── IPC handlerlar ─────────────────────────────────────────────────
function registerIpc() {
  // AUTH — mening sinab ko'rilgan /api/auth/login (in-process backend) orqali
  ipcMain.handle("auth:login", async (_e, { phone, password }) => {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      const json = await res.json();
      if (!json.success) {
        return { success: false, error: json.error?.message || "Ошибка входа" };
      }
      const d = json.data;
      const role = d.staff?.role;
      // Local Server paneli — FAQAT boshqaruv rollari (filial admin/admin/owner).
      // waiter/cook/cashier kira olmaydi.
      const ALLOWED = ["branch_admin", "admin", "owner"];
      if (!ALLOWED.includes(role)) {
        return { success: false, error: "Доступ только для администратора филиала" };
      }
      authState = {
        staff: { firstName: d.staff.firstName, lastName: d.staff.lastName, role },
        token: d.token,
        restaurantName: d.restaurant?.name || "Ресторан",
        branchName: d.branch?.name || "Филиал",
        branchId: String(d.staff.branchId || d.branch?._id || ""),
        restaurantId: String(d.staff.restaurantId || d.restaurant?._id || ""),
      };
      writeJson("auth.json", authState);
      return { success: true, data: authState };
    } catch (e) {
      return { success: false, error: e.message || "Сетевая ошибка" };
    }
  });

  ipcMain.handle("auth:current", async () => authState);
  ipcMain.handle("auth:logout", async () => {
    authState = null;
    writeJson("auth.json", null);
    return { success: true };
  });

  // ZOOM
  ipcMain.handle("zoom:get", async () => currentZoom);
  ipcMain.handle("zoom:set", async (_e, factor) => applyZoom(factor));

  // STATUS — lokal baza countlari + VPS heartbeat
  ipcMain.handle("status:get", async () => {
    const branch = authState?.branchId || process.env.BRANCH_ID || null;
    const counts = { orders: 0, foods: 0, categories: 0, tables: 0, staff: 0 };
    let pendingSyncCount = 0;
    if (models && branch) {
      try {
        const [o, f, c, t, s, pending] = await Promise.all([
          models.order.countDocuments({ branch }),
          models.food.countDocuments({ branch }),
          models.category.countDocuments({ branch }),
          models.table.countDocuments({ branch }),
          models.users.countDocuments({ branch }),
          models.order.countDocuments({ branch, syncStatus: "pending" }).catch(() => 0),
        ]);
        counts.orders = o;
        counts.foods = f;
        counts.categories = c;
        counts.tables = t;
        counts.staff = s;
        pendingSyncCount = pending;
      } catch {
        /* ignore */
      }
    }
    return {
      isOnline: heartbeatState.isOnline,
      isBranchLockedOffline: false,
      pendingSyncCount,
      heartbeat: { ...heartbeatState },
      counts,
      lastFullSyncAt: null,
    };
  });

  // SYNC — hozircha qo'lda push (to'liq sync keyingi bosqich, task #30)
  ipcMain.handle("sync:run", async () => {
    await pingGlobal();
    return { success: true };
  });

  // ORDERS purge-stale (hozircha noop — to'liq sync bilan birga keladi)
  ipcMain.handle("orders:purge-stale", async () => ({
    success: true,
    deleted: { total: 0, otherRestaurant: 0, otherShift: 0 },
    remaining: 0,
  }));

  // CATEGORIES / FOODS — lokal mongoose
  ipcMain.handle("categories:list", async () => {
    const branch = authState?.branchId;
    if (!models || !branch) return [];
    try {
      const list = await models.category.find({ branch, isActive: true }).sort({ title: 1 });
      return list.map((c) => ({ _id: c._id, title: c.title }));
    } catch {
      return [];
    }
  });
  ipcMain.handle("foods:list", async () => {
    const branch = authState?.branchId;
    if (!models || !branch) return [];
    try {
      const list = await models.food.find({ branch, isActive: true }).sort({ name: 1 });
      return list.map((f) => ({ _id: f._id, name: f.name, price: f.price, category: f.category }));
    } catch {
      return [];
    }
  });

  // PRINTERS — hali ko'chirilmagan (kepket printer-hub keyingi bosqich)
  const printerStub = { success: false, error: "Принтеры пока не подключены (в разработке)" };
  ipcMain.handle("printers:list", async () => []);
  ipcMain.handle("printers:devices", async () => []);
  ipcMain.handle("printers:save", async () => printerStub);
  ipcMain.handle("printers:remove", async () => printerStub);
  ipcMain.handle("printers:test", async () => printerStub);
  ipcMain.handle("printers:loginList", async () => []);
  ipcMain.handle("printers:loginAdd", async () => printerStub);
  ipcMain.handle("printers:loginCategories", async () => printerStub);
  ipcMain.handle("printers:loginFoods", async () => printerStub);
  ipcMain.handle("printers:loginRemove", async () => printerStub);
  ipcMain.handle("printers:logoGet", async () => ({ enabled: false, hasLogo: false }));
  ipcMain.handle("printers:logoSet", async () => printerStub);
  ipcMain.handle("printers:logoUpload", async () => printerStub);
  ipcMain.handle("printers:logoClear", async () => printerStub);

  // UPDATES — auto-update hali sozlanmagan (faqat versiya ko'rsatiladi)
  ipcMain.handle("updates:current", async () => ({ version: app.getVersion(), packaged: app.isPackaged }));
  ipcMain.handle("updates:check", async () => ({ success: false, error: "Нет опубликованных релизов" }));
  ipcMain.handle("updates:download", async () => ({ success: false }));
  ipcMain.handle("updates:install", async () => ({ success: false }));
  ipcMain.handle("updates:releases", async () => ({ success: true, data: [] }));
  ipcMain.handle("updates:open", async (_e, url) => {
    try {
      if (url) await shell.openExternal(url);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
}

// ===== Auto-update (electron-updater, GitHub release) — SAYLENT =====
// Server fon infratuzilma: yangilanish jimgina yuklanadi va keyingi qayta
// ishga tushishda o'rnatiladi (POS monitordan farqli — interaktiv UI shart emas).
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.on("update-available", (i) =>
  console.log(`[update] yangi versiya: ${i?.version} — yuklanmoqda…`),
);
autoUpdater.on("update-downloaded", (i) => {
  console.log(`[update] ${i?.version} yuklandi — keyingi qayta ishga tushishda o'rnatiladi`);
  if (tray) tray.setToolTip(`AridaiPOS Server — обновление ${i?.version} готово (перезапустите)`);
});
autoUpdater.on("error", (e) => console.error("[update] xato:", e?.message || e));

function startAutoUpdate() {
  if (isDev) return; // dev'da tekshirmaymiz
  autoUpdater.checkForUpdates().catch(() => {});
  // Har 6 soatda qayta tekshirish (server uzoq ishlaydi)
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 6 * 60 * 60 * 1000);
}

// ── App lifecycle ──────────────────────────────────────────────────
app.whenReady().then(async () => {
  authState = readJson("auth.json", null);
  currentZoom = clampZoom(readJson("ui-zoom.json", { factor: 1 }).factor);

  registerIpc();
  await bootBackend();
  pingGlobal();
  setInterval(pingGlobal, 8000);

  await createWindow();
  createTray();
  startAutoUpdate();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  // Tray'da qoladi (server fonida ishlashda davom etadi). macOS'da odatdagidek.
  if (process.platform !== "darwin") {
    // Windows/Linux: tray bo'lsa yopilmaydi, aks holda chiqamiz
    if (!tray) app.quit();
  }
});

app.on("before-quit", async () => {
  try {
    if (backend?.httpServer) {
      const { stopLocalBackend } = await import("./backend/server.js");
      await stopLocalBackend().catch(() => {});
    }
  } catch {
    /* ignore */
  }
});
