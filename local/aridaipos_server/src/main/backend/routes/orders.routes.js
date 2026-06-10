import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import orderModel from "../models/order.model.js";
import foodModel from "../models/food.model.js";
import tableModel from "../models/table.model.js";
import serviceModel from "../models/service.model.js";
import shiftModel from "../models/shift.model.js";
import branchesModel from "../models/branches.model.js";
import restaurantsModel from "../models/restaurants.model.js";
import usersModel from "../models/users.model.js";
import { calculateOrderTotals } from "../utils/order-calc.js";
import { checkManagerPin, kitchenStarted, pinError } from "../utils/manager-pin.js";
import { checkStockAvailability, deductForOrder, restoreForOrder, stockErrorMessage } from "../utils/sklad.js";
import { createEarnSession } from "../utils/keshbek.js";
import { firePrintKitchen } from "../print-hook.js";

// Kepket frontend kutgan order endpointlari (format: items[], grandTotal, ...)
const router = express.Router();
router.use(authMiddleware);

// Mening paymentMethod enum → kepket paymentType (frontend/chek 'click' kutadi)
function toKepketPayType(method) {
  if (method === "transfer") return "click";
  return method || null;
}
// kepket paymentType → mening PAYMENT_METHODS enum
function toLocalPayMethod(type) {
  if (type === "click") return "transfer";
  return type;
}

// Mening foods[] cookingStatus → kepket item status
const COOK_TO_KEPKET = { waiting: "pending", cooking: "preparing", ready: "ready", served: "served" };

// Item effektiv miqdori (inc/dec cancels bilan). Admin global'da itemni bekor qilsa
// (dec) → bu yerda kamayadi; to'liq bekor (0) bo'lsa item ro'yxatdan chiqariladi.
function effQty(f) {
  const c = Array.isArray(f.cancels) ? f.cancels : [];
  const inc = c.filter((x) => x.status === "inc").reduce((s, x) => s + x.changeVal, 0);
  const dec = c.filter((x) => x.status === "dec").reduce((s, x) => s + x.changeVal, 0);
  return Math.max(0, (f.quantity || 0) + inc - dec);
}

// Mening order modeli (foods[]) → XOM kepket Order shakli.
// MUHIM: frontend transform AYNAN shu maydonlarni o'qiydi —
//   items[].status/isPaid, serviceCharge (serviceFee EMAS), serviceChargePercent,
//   discount, discountPercent, waiterName (waiter.name EMAS), tableNumber/tableName.
// Shuning uchun normallashtirmasdan, XOM kepket nomlari bilan beramiz.
function mapOrder(o, tableDoc) {
  const orderPaid = o.paymentStatus === "paid";
  const number = tableDoc?.number || 0;
  const items = (o.foods || [])
    .filter((f) => !f.isDeleted && effQty(f) > 0)
    .map((f) => ({
      _id: f._id,
      foodId: f.foodId,
      name: f.foodName,
      foodName: f.foodName,
      price: f.foodPrice,
      quantity: effQty(f),
      status: COOK_TO_KEPKET[f.cookingStatus] || "pending",
      isPaid: f.isPaid === true || orderPaid,
      // Soatlik taom (PlayStation/kabina) — frontend vaqt bo'yicha jonli hisoblaydi
      isHourly: f.isHourly === true,
      hourlyPrice: f.hourlyPrice || 0,
      hourlyStartedAt: f.hourlyStartedAt,
      hourlyStoppedAt: f.hourlyStoppedAt,
      hourlyFinalAmount: f.hourlyFinalAmount || 0,
      addedAt: f.addedAt,
      isDeleted: false,
    }));
  return {
    _id: o._id,
    orderNumber: parseInt(String(o.receiptNumber || "").split("-").pop(), 10) || 0,
    orderType: o.orderType === "dineIn" ? "dine-in" : o.orderType === "takeaway" ? "saboy" : o.orderType,
    // Stol — flat (frontend `tableId?.number || tableNumber` fallback ishlaydi)
    tableId: o.table ? String(o.table) : "",
    tableNumber: number,
    tableName: tableDoc?.title || (number ? `Стол ${number}` : ""),
    // Ofitsiant — flat (frontend `waiterId?.firstName || waiterName`)
    waiterId: o.waiter?.waiterId ? String(o.waiter.waiterId) : "",
    waiterName: o.waiter?.name || "",
    items,
    status: o.isCancel ? "cancelled" : orderPaid ? "paid" : "active",
    isPaid: orderPaid,
    paymentStatus: o.paymentStatus,
    paymentType: toKepketPayType(o.paymentMethod),
    paymentSplit: o.paymentMethod === "mixed" ? { cash: o.mixed?.cash || 0, card: o.mixed?.card || 0, click: o.mixed?.transfer || 0 } : undefined,
    // Hisoblar — XOM kepket nomlari (serviceCharge/discount)
    subtotal: o.subTotal || 0,
    serviceCharge: o.service?.amount || 0,
    serviceChargePercent: o.service?.percent || 0,
    discount: o.discountAmount || 0,
    discountPercent: o.discount?.percent || 0,
    grandTotal: o.totalPrice || 0,
    hasHourlyCharge: false,
    hourlyChargeAmount: 0,
    createdAt: o.createdAt,
    paidAt: o.paidAt,
  };
}

async function genReceipt(branch) {
  const b = await branchesModel.findById(branch).select("receiptPrefix");
  const prefix = b?.receiptPrefix || "POS";
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const count = await orderModel.countDocuments({ branch, createdAt: { $gte: start } });
  return `${prefix}-${ymd}-${String(count + 1).padStart(4, "0")}`;
}

async function buildFoods(items, branch) {
  const foods = [];
  for (const it of items || []) {
    const food = await foodModel.findOne({ _id: it.foodId, branch });
    if (!food) continue;
    const now = new Date();
    const f = {
      foodId: food._id,
      foodName: food.name,
      foodPrice: food.price,
      quantity: Number(it.quantity) || 1,
      cancels: [],
      addedAt: now,
    };
    // Soatlik taom (PlayStation/kabina) — vaqt SHU ZAHOTI boshlanadi (hourlyStartedAt).
    // price = soatlik stavka → hourlyPrice. Summa daqiqalarga bo'linib hisoblanadi.
    if (food.isHourly) {
      f.isHourly = true;
      f.hourlyPrice = food.price;
      f.hourlyStartedAt = now;
    }
    foods.push(f);
  }
  return foods;
}

// ===== Заказ yaratish =====
router.post("/", async (req, res) => {
  try {
    const branch = req.userData.branch;
    const shift = await shiftModel.findOne({ branch, isActive: true });
    if (!shift) return res.status(400).json({ success: false, error: { message: "Сначала откройте смену" } });

    const { tableId, waiterId, items, orderType } = req.body;
    const foods = await buildFoods(items, branch);
    if (foods.length === 0) return res.status(400).json({ success: false, error: { message: "Добавьте блюда" } });

    const isSaboy = orderType === "saboy" || orderType === "takeaway";
    const oType = isSaboy ? "takeaway" : "dineIn";

    let tableDoc = null;
    if (!isSaboy && tableId) tableDoc = await tableModel.findOne({ _id: tableId, branch });

    let waiter = { waiterId: null, name: null, phone: null };
    if (waiterId) {
      const w = await usersModel.findById(waiterId).select("name phone");
      if (w) waiter = { waiterId: w._id, name: w.name, phone: w.phone };
    }

    const svc = !isSaboy ? await serviceModel.findOne({ branch, isActive: true }) : null;
    const rest = await restaurantsModel.findById(req.userData.restaurantId).select("currency");
    const receiptNumber = await genReceipt(branch);

    const orderData = {
      branch,
      restaurantId: req.userData.restaurantId,
      shift: shift._id,
      receiptNumber,
      currency: rest?.currency,
      orderType: oType,
      waiter,
      table: tableDoc?._id || null,
      service: svc
        ? { serviceId: svc._id, percent: svc.servicePercent, amount: 0, waived: false }
        : { percent: 0, amount: 0, waived: false },
      discount: null,
      foods,
      source: "pos",
      createdInMode: "online",
      paymentStatus: "pending",
      totalPrice: 0,
      syncStatus: "pending",
    };
    calculateOrderTotals(orderData);

    // SKLAD (toggle yoqiq bo'lsa): O1 oversell-blok — ingredient yetmasa RAD
    const stockChk = await checkStockAvailability(req.userData.restaurantId, branch, foods);
    if (!stockChk.ok) {
      return res.status(400).json({
        success: false,
        error: { code: "STOCK_INSUFFICIENT", message: stockErrorMessage(stockChk.missing) },
      });
    }

    const order = await orderModel.create(orderData);
    deductForOrder(order, foods, req.userData.id || req.userData._id); // sklad chiqim — fire-and-forget
    firePrintKitchen(String(order._id)); // povar (kuxnya) cheki — fire-and-forget
    return res.json({ success: true, isNewOrder: true, data: mapOrder(order, tableDoc) });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
});

// ===== Собой (на вынос) — OCHIQ order (oddiy order kabi) =====
// Frontend createSaboyOrder → POST /saboy { items, notes }.
// MUHIM: saboy yaratilganda TO'LANMAYDI. Stol YO'Q, usluga YO'Q, lekin OCHIQ
// (paymentStatus=pending): oshpaz tayyorlaydi → tayyor bo'lgach mijozga beriladi →
// KEYIN alohida to'lanadi (oddiy dine-in order kabi, faqat stolsiz).
router.post("/saboy", async (req, res) => {
  try {
    const branch = req.userData.branch;
    const shift = await shiftModel.findOne({ branch, isActive: true });
    if (!shift) return res.status(400).json({ success: false, error: { message: "Сначала откройте смену" } });

    const { items, notes } = req.body;
    const foods = await buildFoods(items, branch);
    if (foods.length === 0) return res.status(400).json({ success: false, error: { message: "Добавьте блюда" } });

    const rest = await restaurantsModel.findById(req.userData.restaurantId).select("currency");
    const receiptNumber = await genReceipt(branch);

    const orderData = {
      branch,
      restaurantId: req.userData.restaurantId,
      shift: shift._id,
      receiptNumber,
      currency: rest?.currency,
      orderType: "takeaway", // saboy — olib ketish
      waiter: { waiterId: null, name: null, phone: null },
      table: null,
      service: { percent: 0, amount: 0, waived: false }, // saboy — usluga yo'q
      discount: null,
      foods,
      source: "pos",
      createdInMode: "online",
      note: notes || null,
      paymentStatus: "pending", // OCHIQ — to'lov KEYIN (oshpaz tayyorlagandan so'ng)
      totalPrice: 0,
      syncStatus: "pending",
    };
    calculateOrderTotals(orderData);

    // SKLAD (toggle yoqiq bo'lsa): O1 oversell-blok — ingredient yetmasa RAD
    const stockChk = await checkStockAvailability(req.userData.restaurantId, branch, foods);
    if (!stockChk.ok) {
      return res.status(400).json({
        success: false,
        error: { code: "STOCK_INSUFFICIENT", message: stockErrorMessage(stockChk.missing) },
      });
    }

    const order = await orderModel.create(orderData);
    deductForOrder(order, foods, req.userData.id || req.userData._id); // sklad chiqim — fire-and-forget
    firePrintKitchen(String(order._id)); // povar (kuxnya) cheki
    return res.json({ success: true, isNewOrder: true, data: mapOrder(order, null) });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
});

// ===== Объединение заказов (POST /orders/merge) =====
// Frontend mergeOrders → { targetOrderId, sourceOrderIds }. Source orderlarning
// taomlari target'ga ko'chadi, source orderlar O'CHIRILADI (stollari bo'shaydi,
// hisobotdan chiqadi). Faqat to'lanmagan orderlar (merge = sof to'lov amaliyoti).
router.post("/merge", async (req, res) => {
  try {
    const branch = req.userData.branch;
    const { targetOrderId, sourceOrderIds } = req.body;
    if (!targetOrderId || !Array.isArray(sourceOrderIds) || sourceOrderIds.length === 0) {
      return res.status(400).json({ success: false, error: { message: "Выберите заказы для объединения" } });
    }

    const target = await orderModel.findOne({ _id: targetOrderId, branch });
    if (!target) return res.status(404).json({ success: false, error: { message: "Основной заказ не найден" } });
    if (target.paymentStatus === "paid" || target.isCancel) {
      return res.status(400).json({ success: false, error: { message: "Основной заказ закрыт" } });
    }

    const srcIds = sourceOrderIds.filter((id) => String(id) !== String(targetOrderId));
    const sources = await orderModel.find({
      _id: { $in: srcIds },
      branch,
      paymentStatus: { $ne: "paid" },
      isCancel: { $ne: true },
    });
    if (sources.length === 0) {
      return res.status(404).json({ success: false, error: { message: "Заказы для присоединения не найдены" } });
    }

    const mergedOrderIds = [];
    const notes = [];
    for (const src of sources) {
      for (const f of src.foods || []) {
        if (f.isDeleted) continue;
        target.foods.push({
          foodId: f.foodId,
          foodName: f.foodName,
          foodPrice: f.foodPrice,
          quantity: f.quantity,
          note: f.note || null,
          cancels: [],
          cookingStatus: f.cookingStatus || "waiting",
        });
      }
      const srcNo = parseInt(String(src.receiptNumber || "").split("-").pop(), 10) || 0;
      if (src.note) notes.push(`[№${srcNo}]: ${src.note}`);
      mergedOrderIds.push(src._id);
    }
    if (notes.length) target.note = [target.note, ...notes].filter(Boolean).join("\n");

    calculateOrderTotals(target);
    target.syncStatus = "pending";
    await target.save();

    // Source orderlarni HARD-DELETE QILMAYMIZ — o'chirish global'ga propagatsiya bo'lmaydi
    // (sync faqat o'zgargan orderlarni push qiladi) → global'da qolib, tushum 2x sanaladi.
    // Buning o'rniga: bekor (merge) belgilab syncStatus=pending → push global'ni ham tozalaydi.
    const targetNo = parseInt(String(target.receiptNumber || "").split("-").pop(), 10) || 0;
    await orderModel.updateMany(
      { _id: { $in: mergedOrderIds } },
      {
        $set: {
          isCancel: true,
          cancelType: "cancel",
          cancelReason: `Объединён с заказом №${targetNo}`,
          cancelledBy: req.userData.id || req.userData.userId || req.userData._id || null,
          cancelledAt: new Date(),
          syncStatus: "pending",
        },
      },
    );

    const tableDoc = target.table ? await tableModel.findById(target.table) : null;
    return res.json({
      success: true,
      message: sources.length === 1 ? "Заказ присоединён" : `${sources.length} заказа присоединены`,
      data: { order: mapOrder(target, tableDoc), mergedOrderIds },
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
});

// ===== Заказы ro'yxati (umumiy yuklash) =====
async function loadOrders(branch, shiftId) {
  const filter = { branch };
  if (shiftId) {
    filter.shift = shiftId;
  } else {
    const shift = await shiftModel.findOne({ branch, isActive: true });
    if (shift) filter.shift = shift._id;
  }
  const orders = await orderModel.find(filter).sort({ createdAt: -1 }).limit(200);
  const tableIds = [...new Set(orders.map((o) => String(o.table)).filter((x) => x && x !== "null"))];
  const tables = await tableModel.find({ _id: { $in: tableIds } });
  const tmap = new Map(tables.map((t) => [String(t._id), t]));
  return orders.map((o) => mapOrder(o, tmap.get(String(o.table))));
}

// Frontend Заказы ro'yxati SHU endpointni chaqiradi: GET /api/orders/today?shiftId=
// MUHIM: bu route GET /:id dan OLDIN turishi SHART — aks holda Express uni
// /:id (id='today') deb ushlab, CastError beradi va ro'yxat BO'SH chiqadi.
router.get("/today", async (req, res) => {
  try {
    const orders = await loadOrders(req.userData.branch, req.query.shiftId);
    return res.json({ success: true, data: { orders } });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
});

// Alias (mening python testlarim uchun; frontend /today ishlatadi)
router.get("/", async (req, res) => {
  try {
    const orders = await loadOrders(req.userData.branch, req.query.shiftId);
    return res.json({ success: true, data: orders });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
});

// ===== Bitta заказ =====
router.get("/:id", async (req, res) => {
  try {
    const o = await orderModel.findOne({ _id: req.params.id, branch: req.userData.branch });
    if (!o) return res.status(404).json({ success: false, error: { message: "Заказ не найден" } });
    const tableDoc = o.table ? await tableModel.findById(o.table) : null;
    return res.json({ success: true, data: mapOrder(o, tableDoc) });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
});

// ===== +Блюдо (mavjud orderga taom qo'shish) =====
router.post("/:id/items", async (req, res) => {
  try {
    const order = await orderModel.findOne({ _id: req.params.id, branch: req.userData.branch });
    if (!order) return res.status(404).json({ success: false, error: { message: "Заказ не найден" } });
    if (order.paymentStatus === "paid") return res.status(400).json({ success: false, error: { message: "Заказ уже оплачен" } });

    const newFoods = await buildFoods(req.body.items, req.userData.branch);
    // SKLAD: qo'shilayotgan taomlar uchun O1 tekshiruv
    const stockChk = await checkStockAvailability(req.userData.restaurantId, order.branch, newFoods);
    if (!stockChk.ok) {
      return res.status(400).json({
        success: false,
        error: { code: "STOCK_INSUFFICIENT", message: stockErrorMessage(stockChk.missing) },
      });
    }
    order.foods.push(...newFoods);
    calculateOrderTotals(order);
    order.syncStatus = "pending";
    await order.save();
    deductForOrder(order, newFoods, req.userData.id || req.userData._id); // sklad chiqim
    // Qo'shilgan taomlar → povar (kuxnya) "ДОБАВЛЕНО ×N" cheki (faqat yangilari)
    firePrintKitchen(
      String(order._id),
      newFoods.map((f) => ({ foodId: String(f.foodId), name: f.foodName, delta: Number(f.quantity) || 0 })),
    );

    const tableDoc = order.table ? await tableModel.findById(order.table) : null;
    return res.json({ success: true, data: mapOrder(order, tableDoc) });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
});

// ===== Order chegirma/service o'zgartirish (PATCH /orders/:id) =====
// Frontend setOrderDiscount/setOrderCharges → PATCH {discountPercent, serviceChargePercent}.
// Backend = yagona haqiqat manbai → recalc → grandTotal (ekran/chek/hisobot bir xil).
router.patch("/:id", async (req, res) => {
  try {
    const order = await orderModel.findOne({ _id: req.params.id, branch: req.userData.branch });
    if (!order) return res.status(404).json({ success: false, error: { message: "Заказ не найден" } });
    if (order.paymentStatus === "paid") return res.status(400).json({ success: false, error: { message: "Заказ уже оплачен" } });

    const { discountPercent, serviceChargePercent } = req.body;

    if (discountPercent !== undefined) {
      const p = Math.max(0, Math.min(100, Number(discountPercent) || 0));
      const cur = order.discount?.toObject?.() || order.discount || {};
      order.discount = { ...cur, type: "percent", percent: p, amount: null };
    }
    if (serviceChargePercent !== undefined && order.orderType === "dineIn") {
      const p = Math.max(0, Math.min(100, Number(serviceChargePercent) || 0));
      const cur = order.service?.toObject?.() || order.service || {};
      order.service = { ...cur, percent: p, waived: p === 0 };
    }

    calculateOrderTotals(order);
    order.syncStatus = "pending";
    await order.save();

    const tableDoc = order.table ? await tableModel.findById(order.table) : null;
    return res.json({ success: true, data: mapOrder(order, tableDoc) });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
});

// ===== Item miqdorini o'zgartirish (PATCH /orders/:id/items/:itemId/quantity) =====
router.patch("/:id/items/:itemId/quantity", async (req, res) => {
  try {
    const order = await orderModel.findOne({ _id: req.params.id, branch: req.userData.branch });
    if (!order) return res.status(404).json({ success: false, error: { message: "Заказ не найден" } });
    if (order.paymentStatus === "paid") return res.status(400).json({ success: false, error: { message: "Заказ уже оплачен" } });

    const item = order.foods.id(req.params.itemId);
    if (!item) return res.status(404).json({ success: false, error: { message: "Блюдо не найдено" } });
    if (item.isPaid === true) {
      return res.status(400).json({ success: false, error: { message: "Оплаченное блюдо нельзя изменить" } });
    }

    const prevQty = effQty(item); // o'zgarishdan oldingi (effektiv) miqdor
    const qty = Math.max(1, Number(req.body.quantity) || 1);
    // Oshxona boshlagan taomni KAMAYTIRISH → manager PIN (graceful)
    if (qty < prevQty && kitchenStarted(item)) {
      const chk = await checkManagerPin(order.branch, req.body?.pin);
      if (!chk.ok) return pinError(res, req.body?.pin);
    }
    // SKLAD: miqdor OSHSA — qo'shimcha qism uchun O1 tekshiruv
    if (qty > prevQty) {
      const stockChk = await checkStockAvailability(req.userData.restaurantId, order.branch, [
        { foodId: item.foodId, quantity: qty - prevQty },
      ]);
      if (!stockChk.ok) {
        return res.status(400).json({
          success: false,
          error: { code: "STOCK_INSUFFICIENT", message: stockErrorMessage(stockChk.missing) },
        });
      }
    }
    item.quantity = qty;
    item.cancels = []; // to'g'ridan-to'g'ri miqdor → inc/dec tarixini tozalaymiz

    calculateOrderTotals(order);
    order.syncStatus = "pending";
    await order.save();
    // Miqdor o'zgarsa povarga xabar: oshsa "ДОБАВЛЕНО ×N", kamaysa "ОТМЕНЕНО ×N"
    // (left = qancha qoldi → povar yakuniy nechta qilishni biladi).
    const delta = qty - prevQty;
    // SKLAD: oshgan qism chiqim, kamaygan qism qaytim
    if (delta > 0) deductForOrder(order, [{ foodId: item.foodId, quantity: delta }], req.userData.id || req.userData._id);
    else if (delta < 0) restoreForOrder(order, [{ foodId: item.foodId, quantity: -delta }], req.userData.id || req.userData._id);
    if (delta !== 0) {
      firePrintKitchen(String(order._id), [
        { foodId: String(item.foodId), name: item.foodName, delta, left: qty },
      ]);
    }

    const tableDoc = order.table ? await tableModel.findById(order.table) : null;
    return res.json({ success: true, data: mapOrder(order, tableDoc) });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
});

// ===== Itemni bekor qilish (DELETE /orders/:id/items/:itemId) =====
// "dec" cancel qo'shadi → effektiv miqdor 0 → mapOrder uni chiqarmaydi, total
// kamayadi (calculateOrderTotals effectiveQuantity'ni o'qiydi). foods array bo'sh
// QOLMAYDI (validatsiya saqlanadi) + tarix saqlanadi (cancel-refund modeli).
router.delete("/:id/items/:itemId", async (req, res) => {
  try {
    const order = await orderModel.findOne({ _id: req.params.id, branch: req.userData.branch });
    if (!order) return res.status(404).json({ success: false, error: { message: "Заказ не найден" } });
    if (order.paymentStatus === "paid") return res.status(400).json({ success: false, error: { message: "Заказ уже оплачен" } });
    if (order.isCancel) return res.status(400).json({ success: false, error: { message: "Заказ отменён" } });

    const item = order.foods.id(req.params.itemId);
    if (!item) return res.status(404).json({ success: false, error: { message: "Блюдо не найдено" } });
    if (item.isPaid === true) return res.status(400).json({ success: false, error: { message: "Оплаченное блюдо нельзя отменить" } });

    const cur = effQty(item);
    // Allaqachon bekor — idempotent (xato bermaymiz)
    if (cur > 0) {
      // Oxirgi aktiv taomni o'chirib bo'lmaydi — buning o'rniga butun orderni bekor qilish kerak
      const activeLeft = (order.foods || []).filter((f) => String(f._id) !== String(item._id) && effQty(f) > 0).length;
      if (activeLeft === 0) {
        return res.status(400).json({ success: false, error: { message: "Нельзя отменить последнее блюдо — отмените весь заказ" } });
      }
      // Oshxona taomni boshlagan → manager PIN (firibgarlik-nazorati.md). PIN
      // sozlanmagan filialda talab qilinmaydi (graceful).
      let approver = null;
      if (kitchenStarted(item)) {
        const chk = await checkManagerPin(order.branch, req.body?.pin);
        if (!chk.ok) return pinError(res, req.body?.pin);
        approver = chk.approver;
      }
      item.cancels.push({
        status: "dec",
        changeVal: cur,
        changeReason: req.body?.reason || "Отмена позиции",
        changedBy: req.userData.id || req.userData.userId || req.userData._id || null,
        approvedBy: approver,
        changedAt: new Date(),
      });
      calculateOrderTotals(order);
      order.syncStatus = "pending";
      await order.save();
      restoreForOrder(order, [{ foodId: item.foodId, quantity: cur }], req.userData.id || req.userData._id); // sklad qaytim
      // Povarga "ОТМЕНЕНО ×cur" cheki (osha stol/taom to'liq bekor qilindi)
      firePrintKitchen(String(order._id), [
        { foodId: String(item.foodId), name: item.foodName, delta: -cur, left: 0 },
      ]);
    }

    const tableDoc = order.table ? await tableModel.findById(order.table) : null;
    return res.json({ success: true, data: mapOrder(order, tableDoc) });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
});

// ===== Orderni bekor qilish (POST /orders/:id/cancel) =====
// isCancel=true → mapOrder status "cancelled" qaytaradi; stol band-ligi ochiq
// (paymentStatus=pending, isCancel≠true) orderlardan kelib chiqadi → avtomatik bo'shaydi.
router.post("/:id/cancel", async (req, res) => {
  try {
    const order = await orderModel.findOne({ _id: req.params.id, branch: req.userData.branch });
    if (!order) return res.status(404).json({ success: false, error: { message: "Заказ не найден" } });
    if (order.paymentStatus === "paid") return res.status(400).json({ success: false, error: { message: "Оплаченный заказ нельзя отменить (нужен возврат)" } });

    if (!order.isCancel) {
      // Bekor qilishdan OLDIN aktiv taomlarni olamiz (povar "ОТМЕНЕНО" cheki uchun)
      const activeFoods = (order.foods || []).filter((f) => !f.isDeleted && effQty(f) > 0);
      const cancelItems = activeFoods.map((f) => ({ foodId: String(f.foodId), name: f.foodName, delta: -effQty(f), left: 0 }));

      // Oshxona biror taomni boshlagan → manager PIN (graceful — PIN sozlanmagan
      // filialda talab qilinmaydi)
      if (activeFoods.some(kitchenStarted)) {
        const chk = await checkManagerPin(order.branch, req.body?.pin);
        if (!chk.ok) return pinError(res, req.body?.pin);
        order.cancelApprovedBy = chk.approver;
      }

      order.isCancel = true;
      order.cancelType = req.body?.cancelType === "void" ? "void" : "cancel";
      order.cancelReason = req.body?.reason || null;
      order.cancelledBy = req.userData.id || req.userData.userId || req.userData._id || null;
      order.cancelledAt = new Date();
      order.syncStatus = "pending";
      await order.save();

      restoreForOrder(order, null, req.userData.id || req.userData._id); // sklad to'liq qaytim (movement kompensatsiya)
      // Povarga butun zakaz bekor qilingani — barcha taomlar "ОТМЕНЕНО",
      // sarlavha "ЗАКАЗ ОТМЕНЁН" (osha stoldagi hamma narsani to'xtatadi).
      if (cancelItems.length) {
        firePrintKitchen(String(order._id), cancelItems, { title: "ЗАКАЗ ОТМЕНЁН" });
      }
    }

    const tableDoc = order.table ? await tableModel.findById(order.table) : null;
    return res.json({ success: true, data: mapOrder(order, tableDoc) });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
});

// ===== To'lov (POST /orders/:id/pay) — kepket processPayment =====
// To'lov DOIM butun order uchun (to'liq summa). paymentType QANDAY to'lashni
// bildiradi (cash/card/click/mixed). Qisman summa qabul qilinmaydi — mixed
// uchun split = grandTotal bo'lishi SHART (foydalanuvchi talabi: 100000 ga
// 5000 o'tib ketmasin).
const KEPKET_PAY_TYPES = ["cash", "card", "click", "mixed"];

router.post("/:id/pay", async (req, res) => {
  try {
    const branch = req.userData.branch;
    const { paymentType, paymentSplit } = req.body;

    if (!paymentType || !KEPKET_PAY_TYPES.includes(paymentType)) {
      return res.status(400).json({ success: false, error: { message: "Укажите способ оплаты" } });
    }

    const order = await orderModel.findOne({ _id: req.params.id, branch });
    if (!order) return res.status(404).json({ success: false, error: { message: "Заказ не найден" } });
    if (order.isCancel) return res.status(400).json({ success: false, error: { message: "Заказ отменён" } });
    if (order.paymentStatus === "paid") {
      return res.status(400).json({ success: false, error: { message: "Заказ уже оплачен" } });
    }

    // Услуга = stol xizmati → FAQAT dineIn. To'lov payti filial servisidan stamp
    // (order yaratilganda o'chiq bo'lib, keyin yoqilgan bo'lsa ham qo'shiladi).
    if (order.orderType === "dineIn" && !order.service?.waived) {
      const svc = await serviceModel.findOne({ branch, isActive: true });
      if (svc) {
        order.service = {
          ...(order.service?.toObject?.() || order.service || {}),
          serviceId: svc._id,
          percent: svc.servicePercent,
        };
      }
    } else if (order.orderType !== "dineIn" && order.service) {
      order.service.percent = 0; // saboy/takeaway — servis yo'q
    }

    // Soatlik taomlarni MUZLATISH — to'lov payti vaqt to'xtaydi (summa endi oshmaydi)
    const nowFreeze = new Date();
    for (const f of order.foods || []) {
      if (f.isHourly && !(f.hourlyFinalAmount > 0)) {
        const start = f.hourlyStartedAt
          ? new Date(f.hourlyStartedAt).getTime()
          : f.addedAt
            ? new Date(f.addedAt).getTime()
            : nowFreeze.getTime();
        const diffMs = Math.max(0, nowFreeze.getTime() - start);
        f.hourlyStoppedAt = nowFreeze;
        f.hourlyFinalAmount = Math.round((diffMs / 3600000) * (f.hourlyPrice || 0) * (f.quantity || 1));
      }
    }

    // Итог qayta hisoblanadi (items o'zgargan/soatlik muzlatildi)
    calculateOrderTotals(order);

    // Qisman to'langan order — qolgan summagina to'lanadi (Σ payments == totalPrice)
    const prevPaid = (order.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
    const required = Math.max(0, (order.totalPrice || 0) - prevPaid);

    // TO'LIQ SUMMA VALIDATSIYA — mixed (aralash) uchun split = qolgan summa bo'lishi
    // shart. KESHBEK qismi (s.cashback) ham yig'indiga kiradi — POS uni spend
    // tasdiqlangach yuboradi (balans GLOBAL'da allaqachon kamaytirilgan).
    if (paymentType === "mixed") {
      const s = paymentSplit || {};
      const cb = Number(s.cashback) || 0;
      const sum = (Number(s.cash) || 0) + (Number(s.card) || 0) + (Number(s.click) || 0) + cb;
      if (Math.abs(sum - required) >= 100) {
        return res.status(400).json({
          success: false,
          error: { message: `Сумма оплаты (${sum}) должна равняться итогу заказа (${required})` },
        });
      }
      order.mixed = { cash: Number(s.cash) || 0, card: Number(s.card) || 0, transfer: Number(s.click) || 0, kaspi: 0, cashback: cb };
      if (cb > 0) {
        order.cashback = {
          ...(order.cashback?.toObject?.() || order.cashback || {}),
          spent: cb,
          clientPhone: req.body.cashbackPhone || order.cashback?.clientPhone || null,
        };
      }
    }

    const payerId = req.userData.id || req.userData.userId || null;
    const paidNow = new Date();

    // Barcha aktiv taomlar to'landi deb belgilanadi (pay-items bilan izchil)
    for (const f of order.foods || []) {
      if (!f.isPaid && effQty(f) > 0) {
        f.isPaid = true;
        f.paidAt = paidNow;
        f.itemPaymentType = paymentType;
      }
    }

    if (prevPaid > 0) {
      // Oldin qisman sessiyalar bo'lgan — yakuniy sessiya yozib, usulni agregatlaymiz
      const s = paymentSplit || {};
      order.payments.push({
        amount: required,
        method: toLocalPayMethod(paymentType),
        mixed:
          paymentType === "mixed"
            ? { cash: Number(s.cash) || 0, card: Number(s.card) || 0, transfer: Number(s.click) || 0 }
            : { cash: 0, card: 0, transfer: 0 },
        itemIds: [],
        comment: null,
        paidAt: paidNow,
        paidBy: payerId,
      });
      finalizePayments(order);
    } else {
      order.paymentMethod = toLocalPayMethod(paymentType);
    }

    order.paymentStatus = "paid";
    order.paidAt = paidNow;
    order.paidBy = payerId;
    order.syncStatus = "pending";
    await order.save();
    createEarnSession(order); // KESHBEK earn QR sessiya (toggle yoqiq bo'lsa) — fire-and-forget

    // Chek POS tomonidan chop etiladi (PrinterAPI.printPayment → POST /print/payment).
    // Backend bu yerda chop ETMAYDI — aks holda ikki marta chiqardi.

    // Stol avtomatik bo'shaydi: paid order endi openOrders (paymentStatus=pending)
    // ro'yxatiga tushmaydi → tables endpoint uni band ko'rsatmaydi.
    const tableDoc = order.table ? await tableModel.findById(order.table) : null;
    return res.json({ success: true, data: { order: mapOrder(order, tableDoc) } });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
});

// Sessiyalardan yakuniy paymentMethod/mixed: hammasi bir usul → o'sha usul;
// har xil → "mixed" (split = sessiyalar yig'indisi) → smena breakdown to'g'ri
// (computeShiftTotals mixed bo'yicha cash/card/transfer'ga taqsimlaydi).
function finalizePayments(order) {
  const pays = order.payments || [];
  if (!pays.length) return;
  const methods = new Set(pays.map((p) => p.method));
  if (methods.size === 1 && !methods.has("mixed")) {
    order.paymentMethod = pays[0].method;
    return;
  }
  const agg = { cash: 0, card: 0, transfer: 0, kaspi: 0, cashback: 0 };
  for (const p of pays) {
    if (p.method === "mixed") {
      agg.cash += p.mixed?.cash || 0;
      agg.card += p.mixed?.card || 0;
      agg.transfer += p.mixed?.transfer || 0;
    } else if (agg[p.method] !== undefined) {
      agg[p.method] += p.amount || 0;
    }
  }
  order.paymentMethod = "mixed";
  order.mixed = agg;
}

// Soatlik taomni muzlatish (to'lovdan keyin summa oshmasin)
function freezeHourly(f, now) {
  if (!f.isHourly || f.hourlyFinalAmount > 0) return;
  const start = f.hourlyStartedAt
    ? new Date(f.hourlyStartedAt).getTime()
    : f.addedAt
      ? new Date(f.addedAt).getTime()
      : now.getTime();
  f.hourlyStoppedAt = now;
  f.hourlyFinalAmount = Math.round((Math.max(0, now.getTime() - start) / 3600000) * (f.hourlyPrice || 0) * (f.quantity || 1));
}

// ===== Qisman to'lov (POST /orders/:id/pay-items) — kepket processPartialPayment =====
// Tanlangan taomlar to'lanadi (foods[].isPaid=true) + payments[] sessiya yoziladi.
// OXIRGI sessiya (to'lanmagan taom qolmasa) orderni yopadi: amount = totalPrice −
// oldingi sessiyalar (услуга/chegirma/tarif yakuniyda hisoblashadi) → Σ payments == totalPrice.
router.post("/:id/pay-items", async (req, res) => {
  try {
    const branch = req.userData.branch;
    const { itemIds, paymentType, paymentSplit, comment } = req.body;

    if (!paymentType || !KEPKET_PAY_TYPES.includes(paymentType)) {
      return res.status(400).json({ success: false, error: { message: "Укажите способ оплаты" } });
    }
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ success: false, error: { message: "Выберите блюда для оплаты" } });
    }

    const order = await orderModel.findOne({ _id: req.params.id, branch });
    if (!order) return res.status(404).json({ success: false, error: { message: "Заказ не найден" } });
    if (order.isCancel) return res.status(400).json({ success: false, error: { message: "Заказ отменён" } });
    if (order.paymentStatus === "paid" || order.paymentStatus === "refunded") {
      return res.status(400).json({ success: false, error: { message: "Заказ уже закрыт" } });
    }

    // Tanlanganlar — mavjud, aktiv (effQty>0) va hali to'lanmagan bo'lishi shart
    const wanted = new Set(itemIds.map(String));
    const selected = (order.foods || []).filter((f) => wanted.has(String(f._id)));
    if (selected.length !== wanted.size) {
      return res.status(404).json({ success: false, error: { message: "Блюдо не найдено" } });
    }
    for (const f of selected) {
      if (effQty(f) <= 0) {
        return res.status(400).json({ success: false, error: { message: `«${f.foodName}» отменено — оплата невозможна` } });
      }
      if (f.isPaid === true) {
        return res.status(400).json({ success: false, error: { message: `«${f.foodName}» уже оплачено` } });
      }
    }

    const nowFreeze = new Date();
    for (const f of selected) freezeHourly(f, nowFreeze);

    // UI shartnomasi (Payment.tsx partial: serviceFee=0, discountAmt=0): qisman to'lov
    // oqimida услуга/chegirma OLINMAYDI. Birinchi sessiyadayoq waive — UI stamped % ham
    // 0 ko'radi, /pay qoldiq hisobi mos keladi, Σ payments == totalPrice invariant.
    if (order.service) {
      order.service.waived = true;
      order.service.percent = 0;
    }
    if (order.discount) {
      order.discount.percent = 0;
      order.discount.amount = 0;
    }

    // OXIRGI sessiyami? (tanlanganidan keyin to'lanmagan aktiv taom qolmaydi)
    const isFinal = (order.foods || []).every(
      (f) => wanted.has(String(f._id)) || f.isPaid === true || effQty(f) <= 0,
    );
    if (isFinal) {
      for (const f of order.foods || []) freezeHourly(f, nowFreeze);
    }

    calculateOrderTotals(order);

    // Sessiya summasi: oraliq — tanlangan taom qatorlari; yakuniy — qolgan butun summa
    const lineAmount = (f) => (f.isHourly ? f.hourlyFinalAmount || 0 : (f.foodPrice || 0) * effQty(f));
    const paidSoFar = (order.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
    const amount = isFinal
      ? Math.max(0, (order.totalPrice || 0) - paidSoFar)
      : selected.reduce((s, f) => s + lineAmount(f), 0);

    // Aralash — split sessiya summasiga teng bo'lishi shart
    let mixedEntry = null;
    if (paymentType === "mixed") {
      const s = paymentSplit || {};
      const sum = (Number(s.cash) || 0) + (Number(s.card) || 0) + (Number(s.click) || 0);
      if (Math.abs(sum - amount) >= 100) {
        return res.status(400).json({
          success: false,
          error: { message: `Сумма оплаты (${sum}) должна равняться сумме блюд (${amount})` },
        });
      }
      mixedEntry = { cash: Number(s.cash) || 0, card: Number(s.card) || 0, transfer: Number(s.click) || 0 };
    }

    const byUser = req.userData.id || req.userData.userId || req.userData._id || null;
    for (const f of selected) {
      f.isPaid = true;
      f.paidAt = nowFreeze;
      f.itemPaymentType = paymentType;
    }
    order.payments.push({
      amount,
      method: toLocalPayMethod(paymentType),
      mixed: mixedEntry || { cash: 0, card: 0, transfer: 0 },
      itemIds: [...wanted],
      comment: comment || null,
      paidAt: nowFreeze,
      paidBy: byUser,
    });

    if (isFinal) {
      finalizePayments(order);
      order.paymentStatus = "paid";
      order.paidAt = nowFreeze;
      order.paidBy = byUser;
    } else {
      order.paymentStatus = "partiallyPaid";
    }
    order.syncStatus = "pending";
    await order.save();
    if (isFinal) createEarnSession(order); // KESHBEK earn QR — yakuniy to'lovda

    const tableDoc = order.table ? await tableModel.findById(order.table) : null;
    return res.json({
      success: true,
      data: {
        order: mapOrder(order, tableDoc),
        paymentSession: order.payments[order.payments.length - 1],
      },
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
});

// ===== Vozvrat (refund) — to'langan orderni qaytarish (paymentStatus → refunded) =====
// Refunded order revenue/kassaga kirmaydi (paid emas) → smena totals avtomatik to'g'ri.
// syncStatus pending → global'ga ham push bo'ladi.
router.post("/:id/refund", async (req, res) => {
  try {
    const order = await orderModel.findOne({ _id: req.params.id, branch: req.userData.branch });
    if (!order) return res.status(404).json({ success: false, error: { message: "Заказ не найден" } });
    if (order.paymentStatus !== "paid") {
      return res.status(400).json({ success: false, error: { message: "Возврат возможен только для оплаченного заказа" } });
    }
    // Vozvrat — pul qaytariladi → HAR DOIM manager PIN (graceful: PIN sozlanmagan
    // filialda talab qilinmaydi)
    const chk = await checkManagerPin(order.branch, req.body?.pin);
    if (!chk.ok) return pinError(res, req.body?.pin);

    order.paymentStatus = "refunded";
    order.refundedAt = new Date();
    order.refundedBy = req.userData.id || req.userData.userId || req.userData._id || null;
    order.refundApprovedBy = chk.approver;
    order.refundReason = req.body?.reason || null;
    order.syncStatus = "pending";
    await order.save();
    const tableDoc = order.table ? await tableModel.findById(order.table) : null;
    return res.json({ success: true, data: mapOrder(order, tableDoc) });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
});

export default router;
