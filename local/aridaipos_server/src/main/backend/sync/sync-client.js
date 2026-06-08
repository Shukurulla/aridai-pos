import config from "../config/index.js";
import restaurantsModel from "../models/restaurants.model.js";
import branchesModel from "../models/branches.model.js";
import categoryModel from "../models/category.model.js";
import foodModel from "../models/food.model.js";
import tableModel from "../models/table.model.js";
import serviceModel from "../models/service.model.js";
import discountModel from "../models/discount.model.js";
import usersModel from "../models/users.model.js";
import shiftModel from "../models/shift.model.js";
import orderModel from "../models/order.model.js";
import expenseModel from "../models/expense.model.js";
import advanceModel from "../models/advance.model.js";
import { firePrintKitchen } from "../print-hook.js";

// Global'dan kelgan hujjatni lokal Mongo'ga BIR XIL _id bilan yozadi (mirror).
// MUHIM: Model orqali cast (ObjectId'lar) → keyin RAW collection bulkWrite.
// Sabab: Mongoose 9 `Model.bulkWrite(replaceOne)`'ni VALIDATE qiladi. Sync
// qilinadigan hujjatda required maydon yo'q bo'lsa (mas. restaurant.owner.password
// — global'da select:false, bootstrap'da kelmaydi) → op JIMGINA tashlanadi
// (xato bermaydi, lekin yozmaydi) → restoran sync bo'lmay qolardi (valyuta xato).
// `new Model(doc).toObject()` cast qiladi (validatsiyasiz), raw write esa validate qilmaydi.
async function upsertMany(Model, docs) {
  const list = (docs || []).filter(Boolean);
  if (!list.length) return 0;
  const ops = list.map((doc) => {
    const casted = new Model(doc).toObject();
    return { replaceOne: { filter: { _id: casted._id }, replacement: casted, upsert: true } };
  });
  const r = await Model.collection.bulkWrite(ops, { ordered: false });
  return (r.upsertedCount || 0) + (r.modifiedCount || 0);
}

// ===== Boshlang'ich sync — global'dan filial mirror =====
export async function bootstrapSync() {
  if (!config.branchToken) {
    throw new Error("BRANCH_TOKEN yo'q — local.json/.env ga branch tokenini kiriting");
  }
  const res = await fetch(`${config.globalUrl}/api/sync/bootstrap`, {
    headers: { Authorization: `Bearer ${config.branchToken}` },
  });
  const json = await res.json();
  if (json.status !== "success") {
    throw new Error(`bootstrap xato: ${json.message || json.code || res.status}`);
  }
  const d = json.data;

  // Menyu signaturasi — POS real-time refresh FAQAT haqiqiy o'zgarishda bo'lsin
  // (har tsikldagi replaceOne "modified" sonidan emas — aniqroq).
  const menuSig = JSON.stringify([
    (d.categories || []).map((c) => [c._id, c.title, c.sortOrder, c.isActive]),
    (d.foods || []).map((f) => [f._id, f.name, f.price, f.isHourly, String(f.category), f.isActive, f.availability?.stopped]),
    (d.tables || []).map((t) => [t._id, t.number, t.title, t.type, t.isActive]),
    (d.services || []).map((s) => [s._id, s.servicePercent, s.isActive]),
  ]);

  const counts = {
    restaurant: await upsertMany(restaurantsModel, [d.restaurant]),
    branch: await upsertMany(branchesModel, [d.branch]),
    categories: await upsertMany(categoryModel, d.categories),
    foods: await upsertMany(foodModel, d.foods),
    tables: await upsertMany(tableModel, d.tables),
    services: await upsertMany(serviceModel, d.services),
    discounts: await upsertMany(discountModel, d.discounts),
    users: await upsertMany(usersModel, d.users),
  };
  return { counts, syncedAt: d.syncedAt, menuSig };
}

// ===== Push — lokal order/smena/rasxod/avans global'ga =====
export async function pushSync({ orders = [], shifts = [], expenses = [], advances = [] } = {}) {
  if (!config.branchToken) throw new Error("BRANCH_TOKEN yo'q");
  if (!orders.length && !shifts.length && !expenses.length && !advances.length) {
    return { accepted: { orders: 0, shifts: 0, expenses: 0, advances: 0 } };
  }

  const res = await fetch(`${config.globalUrl}/api/sync/push`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.branchToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ orders, shifts, expenses, advances }),
  });
  const json = await res.json();
  if (json.status !== "success") {
    throw new Error(`push xato: ${json.message || json.code || res.status}`);
  }

  // Global javobiga qarab lokalda status belgilash (raw — sync-meta hook'siz):
  //  - qabul qilinganlar → "synced"
  //  - CONFLICT (global yangiroq) → "conflict" (collectPending olmaydi → qayta push yo'q,
  //    keyingi pull global versiyasini qaytaradi → konvergensiya)
  //  - TENANT_MISMATCH → "rejected" (noto'g'ri filial — qayta urinmaydi)
  const rejected = json?.accepted?.rejected || [];
  const idSet = (type, reason) =>
    new Set(rejected.filter((r) => r.type === type && r.reason === reason).map((r) => String(r.id)));

  const markByStatus = async (Model, docs, type) => {
    if (!docs.length) return;
    const conf = idSet(type, "CONFLICT");
    const rej = idSet(type, "TENANT_MISMATCH");
    const syncedIds = [], confIds = [], rejIds = [];
    for (const d of docs) {
      const sid = String(d._id);
      if (conf.has(sid)) confIds.push(d._id);
      else if (rej.has(sid)) rejIds.push(d._id);
      else syncedIds.push(d._id);
    }
    const upd = (ids, status) =>
      ids.length ? Model.collection.updateMany({ _id: { $in: ids } }, { $set: { syncStatus: status } }) : null;
    await Promise.all([upd(syncedIds, "synced"), upd(confIds, "conflict"), upd(rejIds, "rejected")].filter(Boolean));
  };

  await markByStatus(orderModel, orders, "order");
  await markByStatus(shiftModel, shifts, "shift");
  await markByStatus(expenseModel, expenses, "expense");
  await markByStatus(advanceModel, advances, "advance");
  return json;
}

// Hali global'ga yuborilmagan (sync kerak) order/smena/rasxod/avanslarni topadi
export async function collectPending() {
  const pend = { syncStatus: { $in: ["pending", "in_progress"] } };
  const [orders, shifts, expenses, advances] = await Promise.all([
    orderModel.find(pend).limit(200).lean(),
    shiftModel.find(pend).limit(50).lean(),
    expenseModel.find(pend).limit(200).lean(),
    advanceModel.find(pend).limit(200).lean(),
  ]);
  return { orders, shifts, expenses, advances };
}

// ===== Global'dan O'ZGARGAN orderlarni tortish (cancel/tahrir propagatsiyasi) =====
// Admin global'da order/item bekor qilsa → local'ga qaytadi → POS real-time yangilanadi.
// skipIds — shu tsiklda push qilingan orderlar (ortiqcha emit bo'lmasin).
export async function pullOrders(skipIds = new Set()) {
  if (!config.branchToken) return { changed: 0 };
  const since = lastOrderSyncAt || new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const res = await fetch(`${config.globalUrl}/api/sync/orders-since?ts=${encodeURIComponent(since)}`, {
    headers: { Authorization: `Bearer ${config.branchToken}` },
  });
  const json = await res.json();
  if (json.status !== "success") throw new Error(`orders pull: ${json.message || json.code || res.status}`);
  lastOrderSyncAt = json.syncedAt || new Date().toISOString();
  const orders = json.data || [];
  if (!orders.length) return { changed: 0 };

  // Local PENDING (POS hozir tahrirlayotgan, push qilinmagan) orderlarni global versiyasi
  // bilan EZIB yubormaymiz — konflikt oldini olish. Shu tsikl push qilinganlar ham skip.
  const ids = orders.map((o) => o._id);
  const localPending = await orderModel
    .find({ _id: { $in: ids }, syncStatus: { $in: ["pending", "in_progress"] } })
    .select("_id")
    .lean();
  const skip = new Set([...localPending.map((o) => String(o._id)), ...skipIds]);
  const toApply = orders.filter((o) => !skip.has(String(o._id)));
  if (!toApply.length) return { changed: 0 };

  // Qaysилари local'da YANGI (avval yo'q edi) — bu WAITER/tashqi (telefon, boshqa POS)
  // orderlar. POS o'zi yaratgan orderlar local'da ALLAQACHON bor (POST /orders) →
  // "new" emas → povar chekи ikki marta chiqmaydi.
  const applyIds = toApply.map((o) => String(o._id));
  const existing = await orderModel.find({ _id: { $in: applyIds } }).select("_id").lean();
  const existingSet = new Set(existing.map((o) => String(o._id)));

  const ops = toApply.map((o) => ({
    replaceOne: { filter: { _id: o._id }, replacement: { ...o, syncStatus: "synced" }, upsert: true },
  }));
  await orderModel.bulkWrite(ops, { ordered: false });

  // Birinchi pull (dastlabki 24h backfill) — chek chiqarmaymiz (storm bo'lmasin).
  const isFirst = firstOrderPull;
  firstOrderPull = false;
  const RECENT_MS = 5 * 60 * 1000;
  const now = Date.now();

  // (1) YANGI (local'da avval yo'q) + YAQINDA yaratilgan + aktiv = WAITER/tashqi order
  // → povar (kuxnya) cheki. POS o'zi yaratganlar local'da bor → "new" emas → 2x chiqmaydi.
  if (!isFirst) {
    for (const o of toApply) {
      if (existingSet.has(String(o._id))) continue; // yangi emas (POS o'zi yaratgan / tahrir)
      if (o.isCancel || o.paymentStatus === "paid") continue;
      const created = o.createdAt ? new Date(o.createdAt).getTime() : 0;
      if (!created || now - created > RECENT_MS) continue; // eski → o'tkazamiz
      const hasItems = Array.isArray(o.foods) && o.foods.some((f) => !f?.isDeleted && (Number(f?.quantity) || 0) > 0);
      if (!hasItems) continue;
      firePrintKitchen(String(o._id)); // to'liq "КУХНЯ" cheki (yangi order)
    }
  }

  // (2) Prichek so'rovi (waiter "Счёт" bosgan → checkRequest.requested=true). POS'ga
  // "print_check_requested" emit qilamiz (POS precheck chop etadi). Dedup: orderId + at
  // (bitta so'rov bir marta; qayta so'ralsa at o'zgaradi → qayta chiqadi).
  const checkRequests = [];
  for (const o of toApply) {
    const cr = o.checkRequest;
    const key = String(o._id);
    if (!cr || cr.requested !== true || !cr.at) {
      if (cr && cr.requested === false) printedCheckReqs.delete(key); // bekor → keyingi so'rov chiqsin
      continue;
    }
    const at = new Date(cr.at).getTime();
    const prev = printedCheckReqs.get(key);
    printedCheckReqs.set(key, at);
    if (isFirst || prev === at) continue; // birinchi pull (baseline) / allaqachon chiqarilgan
    if (o.isCancel || o.paymentStatus === "paid") continue;
    if (!at || now - at > RECENT_MS) continue; // eski so'rov
    checkRequests.push({
      orderId: key,
      orderNumber: o.receiptNumber || o.orderNumber || 0,
      waiterName: o.waiter?.name || cr.byName || "",
      requestedAt: cr.at,
    });
  }
  if (printedCheckReqs.size > 500) {
    for (const [k, at] of printedCheckReqs) if (now - at > 3600000) printedCheckReqs.delete(k);
  }

  return { changed: toApply.length, ids: applyIds, checkRequests };
}

// ===== Global'da O'ZGARGAN smenalarni tortish (admin yopdi/ochdi → POS'ga qaytadi) =====
export async function pullShifts(skipIds = new Set()) {
  if (!config.branchToken) return { changed: 0, shifts: [] };
  const since = lastShiftSyncAt || new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const res = await fetch(`${config.globalUrl}/api/sync/shifts-since?ts=${encodeURIComponent(since)}`, {
    headers: { Authorization: `Bearer ${config.branchToken}` },
  });
  const json = await res.json();
  if (json.status !== "success") throw new Error(`shifts pull: ${json.message || json.code || res.status}`);
  lastShiftSyncAt = json.syncedAt || new Date().toISOString();
  const shifts = json.data || [];
  if (!shifts.length) return { changed: 0, shifts: [] };

  const ids = shifts.map((s) => s._id);
  const localPending = await shiftModel
    .find({ _id: { $in: ids }, syncStatus: { $in: ["pending", "in_progress"] } })
    .select("_id")
    .lean();
  const skip = new Set([...localPending.map((s) => String(s._id)), ...skipIds]);
  const toApply = shifts.filter((s) => !skip.has(String(s._id)));
  if (!toApply.length) return { changed: 0, shifts: [] };

  const ops = toApply.map((s) => ({
    replaceOne: { filter: { _id: s._id }, replacement: { ...s, syncStatus: "synced" }, upsert: true },
  }));
  await shiftModel.bulkWrite(ops, { ordered: false });
  return { changed: toApply.length, shifts: toApply.map((s) => ({ _id: String(s._id), isActive: s.isActive })) };
}

// ===== Davriy sync (global ↔ local) — IKKI tezlik =====
// Menyu/stol/user bootstrap — OG'IR (har 10s). Order push+pull — YENGIL (har 2s) →
// admin o'zgarishi ~2s ichida POS'ga qaytadi (socket "order_updated" → reload).
let menuTimer = null;
let orderTimer = null;
let syncingMenu = false;
let syncingOrders = false;
let lastSyncAt = null;
let lastSyncError = null;
let lastCounts = null;
let lastMenuSig = null; // oxirgi menyu signaturasi
let lastOrderSyncAt = null; // oxirgi order pull vaqti (global soatida, ISO)
let firstOrderPull = true; // birinchi pull (backfill) — povar chekи chiqarmaymiz (storm)
const printedCheckReqs = new Map(); // orderId → checkRequest.at (ms) — prichek dedup
let lastShiftSyncAt = null; // oxirgi shift pull vaqti
let onMenuChangeCb = null; // menyu o'zgarsa (server.js → socket "menu:updated")
let onOrdersChangeCb = null; // order o'zgarsa (server.js → socket "order_updated")
let onShiftsChangeCb = null; // smena o'zgarsa (server.js → socket "shift:closed"/"order_updated")

// Menyu/stol/user PULL (og'ir) + menyu o'zgarishini bildirish
export async function runMenuSync() {
  if (!config.branchToken || syncingMenu) return;
  syncingMenu = true;
  try {
    const boot = await bootstrapSync();
    lastCounts = boot.counts;
    if (boot.menuSig !== lastMenuSig) {
      if (lastMenuSig !== null && onMenuChangeCb) {
        try {
          onMenuChangeCb(boot.counts);
        } catch {
          /* ignore */
        }
      }
      lastMenuSig = boot.menuSig;
    }
    lastSyncAt = new Date();
    lastSyncError = null;
  } catch (e) {
    lastSyncError = e.message; // offline — keyingi tsiklda qayta urinadi
  } finally {
    syncingMenu = false;
  }
}

// Order PUSH (local→global) + PULL (global→local). YENGIL — tez-tez chaqiriladi.
export async function runOrderSync() {
  if (!config.branchToken || syncingOrders) return;
  syncingOrders = true;
  try {
    const pending = await collectPending();
    const pushedIds = new Set();
    const pushedShiftIds = new Set();
    if (pending.orders.length || pending.shifts.length || pending.expenses.length || pending.advances.length) {
      await pushSync(pending);
      pending.orders.forEach((o) => pushedIds.add(String(o._id)));
      pending.shifts.forEach((s) => pushedShiftIds.add(String(s._id)));
    }
    // Order pull (global→local)
    const pulled = await pullOrders(pushedIds);
    if (pulled.changed && onOrdersChangeCb) {
      try {
        onOrdersChangeCb(pulled);
      } catch {
        /* ignore */
      }
    }
    // Shift pull (admin yopdi/ochdi → POS'ga qaytadi)
    const pulledShifts = await pullShifts(pushedShiftIds);
    if (pulledShifts.changed && onShiftsChangeCb) {
      try {
        onShiftsChangeCb(pulledShifts);
      } catch {
        /* ignore */
      }
    }
    lastSyncError = null;
  } catch (e) {
    lastSyncError = e.message;
  } finally {
    syncingOrders = false;
  }
}

// Eski API (bitta tsikl) — moslik uchun
export async function runSyncCycle() {
  await runMenuSync();
  await runOrderSync();
}

export function startSyncLoop(menuIntervalMs = 10000, onMenuChange = null, onOrdersChange = null, orderIntervalMs = 2000, onShiftsChange = null) {
  // callback'larni saqlaymiz (provisionFromGlobal qayta chaqirsa yo'qotmaymiz)
  if (onMenuChange) onMenuChangeCb = onMenuChange;
  if (onOrdersChange) onOrdersChangeCb = onOrdersChange;
  if (onShiftsChange) onShiftsChangeCb = onShiftsChange;
  if (menuTimer) clearInterval(menuTimer);
  if (orderTimer) clearInterval(orderTimer);
  runMenuSync(); // darhol bir marta
  runOrderSync();
  menuTimer = setInterval(runMenuSync, menuIntervalMs);
  orderTimer = setInterval(runOrderSync, orderIntervalMs);
  return { menuTimer, orderTimer };
}

export function stopSyncLoop() {
  if (menuTimer) {
    clearInterval(menuTimer);
    menuTimer = null;
  }
  if (orderTimer) {
    clearInterval(orderTimer);
    orderTimer = null;
  }
}

export function getSyncState() {
  return { lastSyncAt, lastSyncError, lastCounts, hasBranchToken: !!config.branchToken };
}
