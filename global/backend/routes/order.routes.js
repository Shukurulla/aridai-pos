import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import branchesModel from "../models/branches.model.js";
import orderModel from "../models/order.model.js";
import shiftModel from "../models/shift.model.js";
import foodModel from "../models/food.model.js";
import tableModel from "../models/table.model.js";
import serviceModel from "../models/service.model.js";
import usersModel from "../models/users.model.js";
import { emitToBranch } from "../utils/socket.js";
import { pushAsync } from "../utils/push.js";

const router = express.Router();

// Filialdagi cook'larga "Новый заказ" push (assigned filtr — bo'sh bo'lsa hammasiga)
async function notifyCooks(branch, order) {
  try {
    const cooks = await usersModel
      .find({ branch, role: "cook", isActive: true, "pushTokens.0": { $exists: true } })
      .select("pushTokens assignedFoods assignedCategories");
    const foodIds = (order.foods || []).map((f) => String(f.foodId));
    const tokens = [];
    for (const c of cooks) {
      const aF = (c.assignedFoods || []).map(String);
      const aC = (c.assignedCategories || []).map(String);
      // biriktirilgan bo'lsa — order taomlaridan biri mosmi tekshiramiz (oddiy: food bo'yicha)
      const relevant = aF.length === 0 && aC.length === 0 ? true : foodIds.some((id) => aF.includes(id));
      if (relevant) tokens.push(...(c.pushTokens || []));
    }
    if (tokens.length) {
      const where = order.orderType === "dineIn" ? "Зал" : order.orderType === "takeaway" ? "Собой" : "Доставка";
      pushAsync(tokens, { title: "Новый заказ", body: `${where} · ${order.receiptNumber}` }, { orderId: String(order._id), kind: "new_order" });
    }
  } catch {
    /* push xatosi order'ni to'xtatmasin */
  }
}

// Chek raqami: PREFIX-YYYYMMDD-NNNN (kunlik hisoblagich)
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

const populateOrder = (query) =>
  query
    .populate("branch")
    .populate("shift")
    .populate("table")
    .populate("foods.foodId");

const round = Math.round;

// Item effektiv miqdori (inc/dec cancels bilan)
function effQty(item) {
  const c = Array.isArray(item.cancels) ? item.cancels : [];
  const inc = c.filter((x) => x.status === "inc").reduce((s, x) => s + x.changeVal, 0);
  const dec = c.filter((x) => x.status === "dec").reduce((s, x) => s + x.changeVal, 0);
  return Math.max(0, (item.quantity || 0) + inc - dec);
}

// Order totallarini qayta hisoblash (foydalanuvchi formulasi):
//   service = subTotal × svc%;  discount = (subTotal + service) × disc%;  total = subTotal + tariff + service − discount
function recalcOrder(order) {
  const foods = Array.isArray(order.foods) ? order.foods : [];
  const subTotal = foods.reduce((s, it) => s + (it.foodPrice || 0) * effQty(it), 0);
  const servicePercent = order.service?.waived ? 0 : order.service?.percent || 0;
  const serviceAmount = servicePercent > 0 ? round((subTotal * servicePercent) / 100) : 0;
  if (order.service) order.service.amount = serviceAmount;

  const base = subTotal + serviceAmount;
  let discountAmount = 0;
  if (order.discount && (order.discount.percent || order.discount.amount)) {
    discountAmount =
      order.discount.type === "amount"
        ? Math.min(order.discount.amount || 0, base)
        : round((base * (order.discount.percent || 0)) / 100);
  }
  discountAmount = Math.max(0, Math.min(discountAmount, base));
  order.discountAmount = discountAmount;
  order.subTotal = subTotal;
  const tariff = order.selectedTariff?.totalAmount || 0;
  order.totalPrice = Math.max(0, subTotal + tariff + serviceAmount - discountAmount);
  return order;
}

router.post("/create", authMiddleware, async (req, res) => {
  try {
    const { branch, shift } = req.body;

    const findBranch = await branchesModel.findById(branch);
    if (!findBranch)
      return res
        .status(404)
        .json({ status: "error", message: "Bunday filial topilmadi" });

    const findShift = await shiftModel.findOne({ _id: shift, branch });
    if (!findShift)
      return res
        .status(404)
        .json({ status: "error", message: "Bunday smena topilmadi" });

    const order = await orderModel.create(req.body);

    return res.status(200).json({ status: "success", data: order });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ===== Buyurtma berish (waiter mobil) — sodda format =====
// body: { tableId?, items:[{foodId, quantity, note?}], orderType ("dineIn"|"takeaway"|"delivery"), note?, guestCount? }
// Backend snapshot/total/chek hisoblaydi. Yaratilgach socket "orders:changed" → POS/cook/cashier
// jonli ko'radi; local server orders-since PULL bilan ~2s ichida tortib oladi (POS monitor).
router.post("/place", authMiddleware, async (req, res) => {
  try {
    const branch = req.userData.branch;
    const restaurantId = req.userData.restaurantId;
    const { tableId, items, orderType, note, guestCount, clientId, possiz } = req.body;

    // Idempotency — possiz/offline outbox qayta-yuborsa (yoki submit timeout
    // bo'lib aslida o'tib ketsa) DUBLIKAT order yaratmaymiz: o'shani qaytaramiz.
    if (clientId) {
      const dup = await orderModel.findOne({ branch, clientId });
      if (dup) {
        const populatedDup = await populateOrder(orderModel.findById(dup._id));
        return res
          .status(200)
          .json({ status: "success", data: populatedDup, idempotent: true });
      }
    }

    const shift = await shiftModel.findOne({ branch, isActive: true });
    if (!shift) return res.status(400).json({ status: "error", message: "Сначала откройте смену" });
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ status: "error", message: "Добавьте блюда" });
    }

    const oType = orderType === "delivery" ? "delivery" : orderType === "takeaway" || orderType === "saboy" ? "takeaway" : "dineIn";

    // Taom snapshotlari
    const foods = [];
    for (const it of items) {
      const food = await foodModel.findOne({ _id: it.foodId, branch });
      if (!food) continue;
      const f = {
        foodId: food._id,
        foodName: food.name,
        foodPrice: food.price,
        quantity: Math.max(1, Number(it.quantity) || 1),
        note: it.note || null,
        cancels: [],
        cookingStatus: "waiting",
      };
      if (food.isHourly) {
        f.isHourly = true;
        f.hourlyPrice = food.price;
        f.hourlyStartedAt = new Date();
      }
      foods.push(f);
    }
    if (foods.length === 0) return res.status(400).json({ status: "error", message: "Блюда не найдены" });

    // Stol (dineIn — shart)
    let table = null;
    if (oType === "dineIn") {
      if (!tableId) return res.status(400).json({ status: "error", message: "Выберите стол" });
      const t = await tableModel.findOne({ _id: tableId, branch });
      if (!t) return res.status(404).json({ status: "error", message: "Стол не найден" });
      table = t._id;
    }

    // Service (dineIn) — filial sozlamasidan
    let service = { percent: 0, amount: 0, waived: false };
    if (oType === "dineIn") {
      const svc = await serviceModel.findOne({ branch, isActive: true });
      if (svc && svc.servicePercent > 0) service = { serviceId: svc._id, percent: svc.servicePercent, amount: 0, waived: false };
    }

    const orderData = {
      branch,
      restaurantId,
      shift: shift._id,
      receiptNumber: await genReceipt(branch),
      orderType: oType,
      waiter: { waiterId: req.userData._id, name: req.userData.name, phone: req.userData.phone },
      table,
      service,
      discount: null,
      foods,
      paymentStatus: "pending",
      totalPrice: 0,
      source: possiz ? "possiz_mobile" : "waiter_mobile",
      createdInMode: possiz ? "possiz" : undefined,
      clientId: clientId || null,
      note: note || null,
      guestCount: guestCount || undefined,
      syncStatus: "pending",
    };
    recalcOrder(orderData);
    const order = await orderModel.create(orderData);

    emitToBranch(branch, "orders:changed", { orderId: String(order._id), kind: "created" });
    notifyCooks(branch, order); // FCM: cook'larga "Новый заказ"

    const populated = await populateOrder(orderModel.findById(order._id));
    return res.status(200).json({ status: "success", data: populated });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ===== Mavjud ochiq orderga taom qo'shish (waiter "+ Блюдо") =====
router.post("/:id/items", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { items } = req.body;
    const order = await orderModel.findById(id);
    if (!order) return res.status(404).json({ status: "error", message: "Bunday order topilmadi" });
    if (String(order.restaurantId) !== String(req.userData.restaurantId)) {
      return res.status(403).json({ status: "error", code: "TENANT_MISMATCH" });
    }
    if (order.isCancel) return res.status(400).json({ status: "error", message: "Заказ отменён" });
    if (order.paymentStatus === "paid") return res.status(400).json({ status: "error", message: "Заказ уже оплачен" });
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ status: "error", message: "Добавьте блюда" });
    }

    let added = 0;
    for (const it of items) {
      const food = await foodModel.findOne({ _id: it.foodId, branch: order.branch });
      if (!food) continue;
      const f = {
        foodId: food._id,
        foodName: food.name,
        foodPrice: food.price,
        quantity: Math.max(1, Number(it.quantity) || 1),
        note: it.note || null,
        cancels: [],
        cookingStatus: "waiting",
      };
      if (food.isHourly) {
        f.isHourly = true;
        f.hourlyPrice = food.price;
        f.hourlyStartedAt = new Date();
      }
      order.foods.push(f);
      added += 1;
    }
    if (!added) return res.status(400).json({ status: "error", message: "Блюда не найдены" });

    recalcOrder(order);
    order.syncStatus = "pending";
    await order.save();

    emitToBranch(order.branch, "orders:changed", { orderId: String(order._id) });
    const populated = await populateOrder(orderModel.findById(id));
    return res.status(200).json({ status: "success", data: populated });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

router.get("/all/:branchId", authMiddleware, async (req, res) => {
  try {
    const { branchId } = req.params;

    const findBranch = await branchesModel.findById(branchId);
    if (!findBranch)
      return res
        .status(404)
        .json({ status: "error", message: "Bunday filial topilmadi" });

    const orders = await populateOrder(orderModel.find({ branch: branchId }));

    return res.status(200).json({ status: "success", data: orders });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ===== Oshxona navbati (cook) — tayyorlash kerak bo'lgan itemlar =====
// Ochiq (bekor emas, to'lanmagan) orderlardagi waiting/cooking itemlar, cook bo'lsa
// FAQAT unga biriktirilgan taom/kategoriyalar (assignedFoods/assignedCategories). Bo'sh → hammasi.
router.get("/kitchen/:branchId", authMiddleware, async (req, res) => {
  try {
    const { branchId } = req.params;
    const orders = await orderModel
      .find({ branch: branchId, isCancel: { $ne: true }, paymentStatus: { $ne: "paid" } })
      .populate("table", "number title")
      .populate("foods.foodId", "name category")
      .sort({ createdAt: 1 })
      .lean();

    const isCook = req.userData.role === "cook";
    const aFoods = (req.userData.assignedFoods || []).map(String);
    const aCats = (req.userData.assignedCategories || []).map(String);
    const filterAssigned = isCook && (aFoods.length > 0 || aCats.length > 0);

    // includeReady=1 → "ready" (tayyor, hali served emas) itemlarni ham qaytarish
    // (cook handoff ko'rinishi). Default — faqat waiting/cooking (eski xatti-harakat).
    const includeReady = ["1", "true", "yes"].includes(
      String(req.query.includeReady || "").toLowerCase(),
    );
    const allowed = includeReady
      ? ["waiting", "cooking", "ready"]
      : ["waiting", "cooking"];

    const items = [];
    for (const o of orders) {
      for (const f of o.foods || []) {
        const cs = f.cookingStatus || "waiting";
        if (!allowed.includes(cs)) continue; // navbatdan tashqari (served / boshqa)
        if (effQty(f) <= 0) continue; // bekor qilingan item
        const foodId = f.foodId?._id ? String(f.foodId._id) : String(f.foodId || "");
        const catId = f.foodId?.category ? String(f.foodId.category) : null;
        if (filterAssigned && !(aFoods.includes(foodId) || (catId && aCats.includes(catId)))) continue;
        items.push({
          orderId: String(o._id),
          itemId: String(f._id),
          receiptNumber: o.receiptNumber,
          orderType: o.orderType,
          tableNumber: o.table?.number ?? null,
          tableTitle: o.table?.title ?? null,
          foodName: f.foodName,
          quantity: effQty(f),
          note: f.note || null,
          cookingStatus: cs,
          createdAt: o.createdAt,
        });
      }
    }
    return res.status(200).json({ status: "success", data: items });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const order = await populateOrder(orderModel.findById(id));
    if (!order)
      return res
        .status(404)
        .json({ status: "error", message: "Bunday order topilmadi" });

    return res.status(200).json({ status: "success", data: order });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { branch, shift } = req.body;

    if (branch) {
      const findBranch = await branchesModel.findById(branch);
      if (!findBranch)
        return res
          .status(404)
          .json({ status: "error", message: "Bunday filial topilmadi" });
    }

    if (shift) {
      const findShift = await shiftModel.findById(shift);
      if (!findShift)
        return res
          .status(404)
          .json({ status: "error", message: "Bunday smena topilmadi" });
    }

    const order = await orderModel.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    if (!order)
      return res
        .status(404)
        .json({ status: "error", message: "Bunday order topilmadi" });

    return res.status(200).json({ status: "success", data: order });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const order = await orderModel.findByIdAndDelete(id);
    if (!order)
      return res
        .status(404)
        .json({ status: "error", message: "Bunday order topilmadi" });

    return res
      .status(200)
      .json({ status: "success", message: "Order o'chirildi" });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ===== Buyurtmani bekor qilish (void/cancel) =====
router.patch("/:id/cancel", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, type } = req.body;

    const order = await orderModel.findById(id);
    if (!order) return res.status(404).json({ status: "error", message: "Bunday order topilmadi" });
    if (String(order.restaurantId) !== String(req.userData.restaurantId)) {
      return res.status(403).json({ status: "error", code: "TENANT_MISMATCH" });
    }
    if (order.isCancel) {
      const already = await populateOrder(orderModel.findById(id));
      return res.status(200).json({ status: "success", data: already });
    }
    if (order.paymentStatus === "paid") {
      return res.status(400).json({ status: "error", message: "Нельзя отменить оплаченный заказ" });
    }

    order.isCancel = true;
    order.cancelType = type === "void" ? "void" : "cancel";
    order.cancelReason = reason || "Отменён администратором";
    order.cancelledBy = req.userData._id;
    order.cancelledAt = new Date();
    await order.save();

    emitToBranch(order.branch, "orders:changed", { orderId: String(order._id) });
    const populated = await populateOrder(orderModel.findById(id));
    return res.status(200).json({ status: "success", data: populated });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ===== Счёт so'rovi — ofitsiant kassirdan chek so'raydi (requested: true/false) =====
router.patch("/:id/request-check", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const requested = req.body.requested !== false; // default — true
    const order = await orderModel.findById(id);
    if (!order)
      return res.status(404).json({ status: "error", message: "Bunday order topilmadi" });
    if (String(order.restaurantId) !== String(req.userData.restaurantId)) {
      return res.status(403).json({ status: "error", code: "TENANT_MISMATCH" });
    }
    if (order.isCancel || order.paymentStatus === "paid") {
      return res.status(400).json({ status: "error", message: "Заказ уже закрыт" });
    }
    order.checkRequest = {
      requested,
      at: requested ? new Date() : null,
      byName: requested ? req.userData.name || null : null,
    };
    await order.save();
    emitToBranch(order.branch, "orders:changed", {
      orderId: String(order._id),
      kind: "check-request",
    });
    const populated = await populateOrder(orderModel.findById(id));
    return res.status(200).json({ status: "success", data: populated });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ===== Bitta itemni bekor qilish (qolgan miqdorni dec → 0) + total qayta hisoblash =====
router.patch("/:id/items/:itemId/cancel", authMiddleware, async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { reason } = req.body;

    const order = await orderModel.findById(id);
    if (!order) return res.status(404).json({ status: "error", message: "Bunday order topilmadi" });
    if (String(order.restaurantId) !== String(req.userData.restaurantId)) {
      return res.status(403).json({ status: "error", code: "TENANT_MISMATCH" });
    }
    if (order.isCancel) {
      return res.status(400).json({ status: "error", message: "Заказ уже отменён" });
    }
    if (order.paymentStatus === "paid") {
      return res.status(400).json({ status: "error", message: "Нельзя изменять оплаченный заказ" });
    }

    const item = order.foods.id(itemId);
    if (!item) return res.status(404).json({ status: "error", message: "Позиция не найдена" });

    const q = effQty(item);
    if (q <= 0) return res.status(400).json({ status: "error", message: "Позиция уже отменена" });

    item.cancels.push({
      status: "dec",
      changeVal: q,
      changeReason: reason || "Отмена позиции",
      changedBy: req.userData._id,
      changedAt: new Date(),
    });

    recalcOrder(order);

    // Hech qaysi item qolmasa — butun order ham bekor
    const anyLeft = order.foods.some((f) => effQty(f) > 0);
    if (!anyLeft) {
      order.isCancel = true;
      order.cancelType = "cancel";
      order.cancelReason = "Все позиции отменены";
      order.cancelledBy = req.userData._id;
      order.cancelledAt = new Date();
    }
    await order.save();

    emitToBranch(order.branch, "orders:changed", { orderId: String(order._id) });
    const populated = await populateOrder(orderModel.findById(id));
    return res.status(200).json({ status: "success", data: populated });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ===== Item miqdorini o'zgartirish (kamaytirish/ko'paytirish) =====
router.patch("/:id/items/:itemId/quantity", authMiddleware, async (req, res) => {
  try {
    const { id, itemId } = req.params;

    const order = await orderModel.findById(id);
    if (!order) return res.status(404).json({ status: "error", message: "Bunday order topilmadi" });
    if (String(order.restaurantId) !== String(req.userData.restaurantId)) {
      return res.status(403).json({ status: "error", code: "TENANT_MISMATCH" });
    }
    if (order.isCancel) {
      return res.status(400).json({ status: "error", message: "Заказ отменён" });
    }
    if (order.paymentStatus === "paid") {
      return res.status(400).json({ status: "error", message: "Нельзя изменять оплаченный заказ" });
    }

    const item = order.foods.id(itemId);
    if (!item) return res.status(404).json({ status: "error", message: "Позиция не найдена" });

    const qty = Math.max(1, Math.floor(Number(req.body.quantity) || 1));
    item.quantity = qty;
    item.cancels = []; // to'g'ridan-to'g'ri miqdor → inc/dec tarixini tozalaymiz

    recalcOrder(order);
    await order.save();

    emitToBranch(order.branch, "orders:changed", { orderId: String(order._id) });
    const populated = await populateOrder(orderModel.findById(id));
    return res.status(200).json({ status: "success", data: populated });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ===== Cook: taom tayyorlash statusi (waiting → cooking → ready) =====
const COOK_STATUSES = ["waiting", "cooking", "ready", "served"];
router.patch("/:id/items/:itemId/cooking", authMiddleware, async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { status } = req.body;
    if (!COOK_STATUSES.includes(status)) {
      return res.status(400).json({ status: "error", code: "INVALID_STATUS", message: `status: ${COOK_STATUSES.join("/")}` });
    }

    const order = await orderModel.findById(id);
    if (!order) return res.status(404).json({ status: "error", message: "Bunday order topilmadi" });
    if (String(order.restaurantId) !== String(req.userData.restaurantId)) {
      return res.status(403).json({ status: "error", code: "TENANT_MISMATCH" });
    }

    const item = order.foods.id(itemId);
    if (!item) return res.status(404).json({ status: "error", message: "Позиция не найдена" });

    item.cookingStatus = status;
    if (status === "cooking" && !item.cookingStartedAt) item.cookingStartedAt = new Date();
    if (status === "ready") item.readyAt = new Date();
    if (status === "served") item.servedAt = new Date();
    item.cookId = req.userData._id;
    order.syncStatus = "pending";
    await order.save();

    emitToBranch(order.branch, "orders:changed", { orderId: String(order._id), kind: "kitchen" });
    // FCM: taom tayyor bo'lsa — orderning waiter'iga "Блюдо готово"
    if (status === "ready" && order.waiter?.waiterId) {
      usersModel
        .findById(order.waiter.waiterId)
        .select("pushTokens")
        .then((w) => {
          if (w?.pushTokens?.length) {
            pushAsync(w.pushTokens, { title: "Блюдо готово", body: `${item.foodName} · ${order.receiptNumber}` }, { orderId: String(order._id), kind: "ready" });
          }
        })
        .catch(() => {});
    }
    return res.status(200).json({ status: "success", data: { itemId, cookingStatus: status } });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ===== To'lov (cashier) — butun order uchun (to'liq summa) =====
// mixed bo'lsa split = totalPrice bo'lishi SHART. To'lov stored totalPrice bo'yicha.
const PAY_METHODS = ["cash", "card", "transfer", "kaspi", "mixed"];
router.patch("/:id/pay", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethod, mixed } = req.body;
    if (!PAY_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ status: "error", code: "INVALID_METHOD", message: `способ: ${PAY_METHODS.join("/")}` });
    }

    const order = await orderModel.findById(id);
    if (!order) return res.status(404).json({ status: "error", message: "Bunday order topilmadi" });
    if (String(order.restaurantId) !== String(req.userData.restaurantId)) {
      return res.status(403).json({ status: "error", code: "TENANT_MISMATCH" });
    }
    if (order.isCancel) return res.status(400).json({ status: "error", message: "Заказ отменён" });
    if (order.paymentStatus === "paid") return res.status(400).json({ status: "error", message: "Заказ уже оплачен" });

    const total = order.totalPrice || 0;
    if (paymentMethod === "mixed") {
      const s = mixed || {};
      const sum = (Number(s.cash) || 0) + (Number(s.card) || 0) + (Number(s.transfer) || 0) + (Number(s.kaspi) || 0);
      if (Math.abs(sum - total) >= 1) {
        return res.status(400).json({ status: "error", message: `Сумма оплаты (${sum}) должна равняться итогу (${total})` });
      }
      order.mixed = { cash: Number(s.cash) || 0, card: Number(s.card) || 0, transfer: Number(s.transfer) || 0, kaspi: Number(s.kaspi) || 0, cashback: 0 };
    }

    order.paymentStatus = "paid";
    order.paymentMethod = paymentMethod;
    order.paidAt = new Date();
    order.paidBy = req.userData._id;
    order.syncStatus = "pending";
    await order.save();

    emitToBranch(order.branch, "orders:changed", { orderId: String(order._id) });
    const populated = await populateOrder(orderModel.findById(id));
    return res.status(200).json({ status: "success", data: populated });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
