import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell } from "electron";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv from "dotenv";
import electronUpdater from "electron-updater";
import { printHtml, buildTestReceiptHtml, buildReceiptHtml, buildKitchenTicketHtml } from "./print.js";
import { setPrintHook, setPrinter, setKitchenHook } from "./backend/print-hook.js";
import { getSyncState } from "./backend/sync/sync-client.js";

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
const GLOBAL_URL = process.env.GLOBAL_URL || "https://api.asadbek-durdana.uz";
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
    const [order, food, category, table, users, printer, printerLogin, restaurants] = await Promise.all([
      import("./backend/models/order.model.js"),
      import("./backend/models/food.model.js"),
      import("./backend/models/category.model.js"),
      import("./backend/models/table.model.js"),
      import("./backend/models/users.model.js"),
      import("./backend/models/printer.model.js"),
      import("./backend/models/printer_login.model.js"),
      import("./backend/models/restaurants.model.js"),
    ]);
    models = {
      order: order.default,
      food: food.default,
      category: category.default,
      table: table.default,
      users: users.default,
      printer: printer.default,
      printer_login: printerLogin.default,
      restaurants: restaurants.default,
    };
  } catch (e) {
    console.error("[LocalServer] modellarni yuklab bo'lmadi:", e.message);
  }
}

// ── VPS heartbeat (status UI uchun) ────────────────────────────────
// Timeout 6s — O'zbekiston↔VPS (Germaniya) HTTPS uchun 1.5s juda qisqa edi
// (sovuq TLS handshake → abort → "Соединение..." qotib qolardi). Xatoni
// to'g'ri ushlaymiz (avval .catch(()=>null) yutib yuborardi → diagnostika yo'q).
async function pingGlobal() {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 6000);
  try {
    const res = await fetch(`${GLOBAL_URL}/api/health`, { signal: ctl.signal });
    if (res && res.ok) {
      heartbeatState.isOnline = true;
      heartbeatState.lastConnectedAt = new Date().toISOString();
      heartbeatState.reconnectAttempts = 0;
      heartbeatState.lastError = null;
    } else {
      heartbeatState.isOnline = false;
      heartbeatState.reconnectAttempts += 1;
      heartbeatState.lastError = `HTTP ${res?.status ?? "?"}`;
    }
  } catch (e) {
    heartbeatState.isOnline = false;
    heartbeatState.reconnectAttempts += 1;
    heartbeatState.lastError = e?.name === "AbortError" ? "timeout (6s)" : (e?.message || "network error");
  } finally {
    clearTimeout(t);
  }
}

// ── Chek avtomatik chop etish (to'lovda) ───────────────────────────
// Buyurtma to'langanda — KASSIR roli bog'langan printerga to'lov cheki chiqadi.
// (Backend pay handler firePrintReceipt(orderId) chaqiradi → shu hook.)
const effQty = (f) => {
  const c = Array.isArray(f.cancels) ? f.cancels : [];
  const inc = c.filter((x) => x.status === "inc").reduce((s, x) => s + (x.changeVal || 0), 0);
  const dec = c.filter((x) => x.status === "dec").reduce((s, x) => s + (x.changeVal || 0), 0);
  return Math.max(0, (f.quantity || 0) + inc - dec);
};
const PAY_LABEL = { cash: "Наличные", card: "Карта", transfer: "Перевод", mixed: "Смешанная", kaspi: "Kaspi", click: "Перевод" };
const CASHIER_ROLES = ["cashier", "kassir"];
const COOK_ROLES = ["cook", "kitchen", "chef", "oshpaz", "povar", "повар", "кухня"];

// Restoran valyutasi (UZS/KZT/...) — chek "сум"/"₸" shu yerdan
async function getRestaurantCurrency(restId) {
  try {
    if (models?.restaurants && restId) {
      const r = await models.restaurants.findById(restId).select("currency");
      if (r?.currency) return r.currency;
    }
  } catch {
    /* ignore */
  }
  return "UZS";
}

async function printOrderReceipt(orderId) {
  try {
    if (!models?.printer || !models?.printer_login || !models?.order) return;
    const logins = await models.printer_login.find({ role: { $in: CASHIER_ROLES } });
    if (!logins.length) return; // kassir printeri bog'lanmagan — jim
    const printerIds = [...new Set(logins.map((l) => String(l.printer)))];

    const order = await models.order.findById(orderId);
    if (!order) return;

    const currency = await getRestaurantCurrency(authState?.restaurantId || order.restaurantId);

    const items = (order.foods || [])
      .filter((f) => !f.isDeleted)
      .map((f) => {
        const qty = effQty(f);
        const line = f.isHourly && f.hourlyFinalAmount > 0 ? f.hourlyFinalAmount : (f.foodPrice || 0) * qty;
        return { name: f.foodName, qty, price: f.isHourly ? f.hourlyPrice || f.foodPrice : f.foodPrice, lineTotal: line };
      })
      .filter((it) => it.qty > 0);

    const html = buildReceiptHtml({
      brand: authState?.restaurantName || "AridaiPOS",
      branchName: authState?.branchName,
      currency,
      receiptNumber: order.receiptNumber,
      date: new Date(order.paidAt || Date.now()).toLocaleString("ru-RU", { timeZone: "Asia/Tashkent" }),
      sellerName: order.waiter?.name || undefined,
      items,
      subtotal: order.subTotal || 0,
      discountTotal: order.discountAmount || 0,
      discountPercent: order.discount?.percent || 0,
      serviceAmount: order.service?.amount || 0,
      total: order.totalPrice || 0,
      paymentLabel: PAY_LABEL[order.paymentMethod] || order.paymentMethod,
      footer: "Спасибо за покупку!",
    });

    for (const pid of printerIds) {
      const printer = await models.printer.findById(pid);
      if (printer?.device_name) {
        const r = await printHtml(html, printer.device_name);
        if (!r?.success) console.warn("[receipt] print xato:", printer.device_name, r?.error);
      }
    }
  } catch (e) {
    console.warn("[receipt] printOrderReceipt xato:", e?.message);
  }
}
setPrintHook(printOrderReceipt);
setPrinter(printHtml); // backend print-hub (/print/*) shu orqali chop etadi

// Kuxnya cheki — order yaratilganda/taom qo'shilganda povar printeriga.
// Har povar login'i o'ziga biriktirilgan kategoriya/taomlar bo'yicha filtrlaydi
// (hech narsa biriktirilmagan bo'lsa — butun order chiqadi). Narxsiz.
// changes (ixtiyoriy): [{ foodId, name, delta, left? }] — berilsa O'ZGARISH cheki
// (ДОБАВЛЕНО/ОТМЕНЕНО, faqat o'zgargan taomlar). Berilmasa — to'liq "КУХНЯ" cheki
// (yangi order: barcha taomlar). Har ikkalasi ham povar filtri bo'yicha yo'naltiriladi.
async function printKitchenReceipt(orderId, changes, opts) {
  try {
    if (!models?.printer || !models?.printer_login || !models?.order) return;
    const logins = await models.printer_login.find({ role: { $in: COOK_ROLES } });
    if (!logins.length) return; // povar printeri bog'lanmagan — jim
    const order = await models.order.findById(orderId);
    if (!order) return;

    const hasChanges = Array.isArray(changes) && changes.length > 0;
    const allItems = hasChanges ? [] : (order.foods || []).filter((f) => !f.isDeleted && effQty(f) > 0);
    if (!hasChanges && !allItems.length) return;

    // Taom → kategoriya (povar routing uchun)
    const srcIds = hasChanges ? changes.map((c) => String(c.foodId || "")) : allItems.map((f) => String(f.foodId || ""));
    const foodIds = [...new Set(srcIds.filter(Boolean))];
    const foods = foodIds.length ? await models.food.find({ _id: { $in: foodIds } }).select("_id category") : [];
    const foodCat = new Map(foods.map((f) => [String(f._id), String(f.category || "")]));

    const tableDoc = order.table ? await models.table.findById(order.table) : null;
    const tableName =
      tableDoc?.title || (tableDoc?.number ? `Стол ${tableDoc.number}` : order.orderType === "takeaway" ? "Собой" : "");
    const date = new Date(order.createdAt || Date.now()).toLocaleString("ru-RU", { timeZone: "Asia/Tashkent" });

    // Povar filtri (category_ids/food_ids) — bo'sh bo'lsa barcha taomlar shu povarga.
    const matcherFor = (login) => {
      let catIds = [];
      let foodSel = [];
      try { catIds = JSON.parse(login.category_ids || "[]").map(String); } catch { /* ignore */ }
      try { foodSel = JSON.parse(login.food_ids || "[]").map(String); } catch { /* ignore */ }
      const hasFilter = catIds.length > 0 || foodSel.length > 0;
      return (foodId) => {
        if (!hasFilter) return true;
        const fid = String(foodId || "");
        return foodSel.includes(fid) || catIds.includes(foodCat.get(fid) || "");
      };
    };

    for (const login of logins) {
      const match = matcherFor(login);
      let html;
      if (hasChanges) {
        const mine = changes.filter((c) => match(c.foodId));
        const added = mine.filter((c) => Number(c.delta) > 0).map((c) => ({ name: c.name, qty: Number(c.delta) }));
        const cancelled = mine
          .filter((c) => Number(c.delta) < 0)
          .map((c) => ({ name: c.name, qty: -Number(c.delta), left: c.left }));
        if (!added.length && !cancelled.length) continue;
        html = buildKitchenTicketHtml({
          title: opts?.title, // mas. "ЗАКАЗ ОТМЕНЁН" (to'liq bekor); aks holda "ИЗМЕНЕНИЕ"
          cookName: login.staff_name,
          tableName,
          waiterName: order.waiter?.name,
          receiptNumber: order.receiptNumber,
          date,
          added,
          cancelled,
        });
      } else {
        const cookItems = allItems.filter((f) => match(f.foodId));
        if (!cookItems.length) continue;
        html = buildKitchenTicketHtml({
          cookName: login.staff_name,
          tableName,
          waiterName: order.waiter?.name,
          receiptNumber: order.receiptNumber,
          date,
          items: cookItems.map((f) => ({ name: f.foodName, qty: effQty(f) })),
        });
      }
      const printer = await models.printer.findById(login.printer);
      if (printer?.device_name) {
        const r = await printHtml(html, printer.device_name);
        if (!r?.success) console.warn("[kitchen] print xato:", printer.device_name, r?.error);
      }
    }
  } catch (e) {
    console.warn("[kitchen] printKitchenReceipt xato:", e?.message);
  }
}
setKitchenHook(printKitchenReceipt);

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
    // Sessiya yaroqlimi? branchToken yo'q (provisioning ketgan) YOKI sync 401
    // (TOKEN_INVALID/REVOKED) → sessiya buzuq → renderer login'ga qaytaradi.
    // Tarmoq xatosi ("fetch failed") sessiyani buzmaydi (offline — normal).
    let sessionInvalid = false;
    try {
      const ss = getSyncState();
      const tokenErr = /TOKEN_INVALID|TOKEN_REVOKED|unauthorized|\b401\b/i.test(ss.lastSyncError || "");
      sessionInvalid = !ss.hasBranchToken || tokenErr;
    } catch {
      /* sync-client hali tayyor emas — e'tiborsiz */
    }

    return {
      isOnline: heartbeatState.isOnline,
      isBranchLockedOffline: false,
      pendingSyncCount,
      heartbeat: { ...heartbeatState },
      counts,
      lastFullSyncAt: null,
      globalUrl: GLOBAL_URL, // status UI'da ko'rsatish (qaysi serverga ulanyapti)
      localPort: PORT, // LAN porti (POS monitorlar shu yerga ulanadi)
      sessionInvalid, // true → renderer login'ga qaytaradi (qayta provision kerak)
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

  // PRINTERS — lokal printer konfiguratsiyasi (Phase 1: devices + saqlash + test).
  // Login biriktirish va logo — keyingi bosqich (graceful stub, UI buzilmaydi).
  const mapPrinter = (p) => ({
    id: String(p._id),
    name: p.name,
    device_name: p.device_name,
    kind: p.kind,
    is_default: p.is_default,
    ip_address: p.ip_address,
  });

  // OS'ga ulangan printerlar ro'yxati (getPrintersAsync)
  ipcMain.handle("printers:devices", async () => {
    try {
      if (!mainWindow || mainWindow.isDestroyed()) return { success: true, data: [] };
      const printers = await mainWindow.webContents.getPrintersAsync();
      return {
        success: true,
        data: (printers || []).map((p) => ({
          name: p.name,
          displayName: p.displayName || p.name,
          isDefault: !!p.isDefault,
          status: p.status,
        })),
      };
    } catch (e) {
      return { success: false, error: e.message, data: [] };
    }
  });

  // Saqlangan printerlar ro'yxati
  ipcMain.handle("printers:list", async () => {
    if (!models?.printer) return { success: true, data: [] };
    try {
      const list = await models.printer.find().sort({ createdAt: 1 });
      return { success: true, data: list.map(mapPrinter) };
    } catch (e) {
      return { success: false, error: e.message, data: [] };
    }
  });

  // Printer qo'shish / tahrirlash
  ipcMain.handle("printers:save", async (_e, form) => {
    if (!models?.printer) return { success: false, error: "Локальная БД недоступна" };
    try {
      const data = {
        name: String(form?.name || "").trim(),
        device_name: String(form?.device_name || "").trim(),
        kind: form?.kind || "cashier",
        is_default: !!form?.is_default,
        ip_address: form?.ip_address || null,
      };
      if (!data.name || !data.device_name) {
        return { success: false, error: "Введите название и выберите принтер" };
      }
      const doc = form?.id
        ? await models.printer.findByIdAndUpdate(form.id, data, { new: true })
        : await models.printer.create(data);
      if (!doc) return { success: false, error: "Принтер не найден" };
      // Bitta default — boshqalardan default'ni olib tashlaymiz
      if (data.is_default) {
        await models.printer.updateMany({ _id: { $ne: doc._id } }, { $set: { is_default: false } });
      }
      return { success: true, data: mapPrinter(doc) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("printers:remove", async (_e, id) => {
    if (!models?.printer) return { success: false, error: "Локальная БД недоступна" };
    try {
      await models.printer.findByIdAndDelete(id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // Test chop etish — HTML → PDF → printer (testprinter loyihasi oqimi, print.js)
  ipcMain.handle("printers:test", async (_e, id) => {
    try {
      const p = id && models?.printer ? await models.printer.findById(id) : null;
      const deviceName = p?.device_name || "";
      if (!deviceName) return { success: false, error: "Принтер не выбран" };
      const seller = authState?.staff
        ? `${authState.staff.firstName || ""} ${authState.staff.lastName || ""}`.trim()
        : undefined;
      const html = buildTestReceiptHtml({
        restaurantName: authState?.restaurantName,
        branchName: authState?.branchName,
        currency: await getRestaurantCurrency(authState?.restaurantId),
        sellerName: seller || undefined,
        printerName: p?.name,
      });
      return await printHtml(html, deviceName);
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ── Printer ↔ login biriktirish (login roli nimani chop etishni belgilaydi) ──
  const mapLogin = (l) => ({
    id: String(l._id),
    phone: l.phone,
    staff_name: l.staff_name,
    role: l.role,
    category_ids: l.category_ids || "[]",
    food_ids: l.food_ids || "[]",
  });

  ipcMain.handle("printers:loginList", async (_e, printerId) => {
    if (!models?.printer_login) return { success: true, data: [] };
    try {
      const list = await models.printer_login.find({ printer: printerId }).sort({ createdAt: 1 });
      return { success: true, data: list.map(mapLogin) };
    } catch (e) {
      return { success: false, error: e.message, data: [] };
    }
  });

  ipcMain.handle("printers:loginAdd", async (_e, { printerId, phone, password } = {}) => {
    if (!models?.printer_login) return { success: false, error: "Локальная БД недоступна" };
    if (!printerId || !phone || !password) return { success: false, error: "Введите телефон и пароль" };
    try {
      const { normalizePhone } = await import("./backend/utils/phone.js");
      let normPhone;
      try {
        normPhone = normalizePhone(phone);
      } catch {
        return { success: false, error: "Неверный номер телефона" };
      }

      // staff: { userId, phone, name, role }
      let staff = null;

      // 1) ONLINE — global'da tekshiramiz (eng YANGI parol; admin panelda
      //    o'zgartirilgan parol local sync bo'lmasdan ham ishlaydi).
      try {
        const res = await fetch(`${GLOBAL_URL}/api/users/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: normPhone, password }),
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.status === "success" && json.data) {
          const u = json.data;
          staff = { userId: u._id, phone: u.phone, name: u.name, role: u.role };
        } else if (json.code === "INVALID_CREDENTIALS") {
          // Global — manba haqiqati: parol aniq noto'g'ri
          return { success: false, error: "Неверный телефон или пароль" };
        }
        // boshqa xato (5xx/429) — pastga, local fallback
      } catch {
        // tarmoq yo'q — offline, local fallback
      }

      // 2) OFFLINE fallback — local synced user
      if (!staff && models?.users) {
        const { comparePassword } = await import("./backend/utils/password.js");
        const user = await models.users.findOne({ phone: normPhone }).select("+password");
        if (user && user.isActive !== false && (await comparePassword(password, user.password))) {
          staff = { userId: user._id, phone: user.phone, name: user.name, role: user.role };
        }
      }

      if (!staff) return { success: false, error: "Неверный телефон или пароль (или нет связи с сервером)" };

      const exists = await models.printer_login.findOne({ printer: printerId, userId: staff.userId });
      if (exists) return { success: false, error: "Этот логин уже привязан к принтеру" };
      const doc = await models.printer_login.create({
        printer: printerId,
        userId: staff.userId,
        phone: staff.phone,
        staff_name: staff.name,
        role: staff.role,
      });
      return { success: true, data: mapLogin(doc) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("printers:loginRemove", async (_e, loginId) => {
    if (!models?.printer_login) return { success: false, error: "Локальная БД недоступна" };
    try {
      await models.printer_login.findByIdAndDelete(loginId);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("printers:loginCategories", async (_e, { loginId, categoryIds } = {}) => {
    if (!models?.printer_login) return { success: false, error: "Локальная БД недоступна" };
    try {
      await models.printer_login.findByIdAndUpdate(loginId, {
        category_ids: JSON.stringify(Array.isArray(categoryIds) ? categoryIds : []),
      });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("printers:loginFoods", async (_e, { loginId, foodIds } = {}) => {
    if (!models?.printer_login) return { success: false, error: "Локальная БД недоступна" };
    try {
      await models.printer_login.findByIdAndUpdate(loginId, {
        food_ids: JSON.stringify(Array.isArray(foodIds) ? foodIds : []),
      });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  const localCfgModel = async () => (await import("./backend/models/local_config.model.js")).default;
  ipcMain.handle("printers:logoGet", async () => {
    try {
      const c = await (await localCfgModel()).findOne();
      return { success: true, enabled: c?.logoEnabled !== false, custom: !!c?.logo, preview: c?.logo || null };
    } catch (e) {
      return { success: false, error: e.message, enabled: true, custom: false, preview: null };
    }
  });
  ipcMain.handle("printers:logoSet", async (_e, on) => {
    try {
      await (await localCfgModel()).findOneAndUpdate({}, { logoEnabled: !!on }, { upsert: true });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  ipcMain.handle("printers:logoUpload", async (_e, base64) => {
    try {
      if (!base64 || typeof base64 !== "string" || !base64.startsWith("data:image/")) {
        return { success: false, error: "Неверный формат (нужен PNG/JPG)" };
      }
      if (base64.length > 700000) return { success: false, error: "Изображение слишком большое (макс ~500 КБ). Уменьшите." };
      await (await localCfgModel()).findOneAndUpdate({}, { logo: base64, logoEnabled: true }, { upsert: true });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  ipcMain.handle("printers:logoClear", async () => {
    try {
      await (await localCfgModel()).findOneAndUpdate({}, { logo: null }, { upsert: true });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

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
