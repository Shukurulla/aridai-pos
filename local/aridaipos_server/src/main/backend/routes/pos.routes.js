import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import categoryModel from "../models/category.model.js";
import foodModel from "../models/food.model.js";
import tableModel from "../models/table.model.js";
import branchesModel from "../models/branches.model.js";
import serviceModel from "../models/service.model.js";
import discountModel from "../models/discount.model.js";
import shiftModel from "../models/shift.model.js";
import orderModel from "../models/order.model.js";
import restaurantsModel from "../models/restaurants.model.js";
import { calculateOrderTotals } from "../utils/order-calc.js";
import { computeShiftTotals } from "../utils/shift-totals.js";
import { audit } from "../utils/audit.js";

// ============================================================
// POS / Waiter terminali — MVP (obsidian/08-frontend/pos-electron.md)
// Order berish, service qo'shish/olib tashlash, chegirma berish/bermaslik, to'lov.
// Auth: user token (waiter/cashier/branch_admin). branch — token'dan (req.userData.branch).
// Total — HAR DOIM serverda hisoblanadi (order-calc.js), client total'i e'tiborga olinmaydi.
// ============================================================

const router = express.Router();

router.use(authMiddleware);
router.use(requireRole("waiter", "cashier", "branch_admin"));

// req.userData.branch bo'lishi shart (waiter/cashier/branch_admin'da bor)
router.use((req, res, next) => {
  if (!req.userData?.branch) {
    return res.status(403).json({ status: "error", code: "NO_BRANCH", message: "Foydalanuvchi filialga biriktirilmagan" });
  }
  next();
});

const branchId = (req) => req.userData.branch;

// ---------- Helperlar ----------
async function getOpenShift(branch) {
  return shiftModel.findOne({ branch, isActive: true });
}

async function generateReceiptNumber(branch) {
  const b = await branchesModel.findById(branch).select("receiptPrefix");
  const prefix = b?.receiptPrefix || "POS";
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const count = await orderModel.countDocuments({ branch, createdAt: { $gte: start } });
  return `${prefix}-${ymd}-${String(count + 1).padStart(4, "0")}`;
}

async function buildFoodSnapshot(items, branch) {
  if (!Array.isArray(items) || items.length === 0) {
    throw { http: 400, code: "FOODS_REQUIRED", message: "Kamida bitta taom kerak" };
  }
  const out = [];
  for (const it of items) {
    const qty = Number(it.quantity) || 0;
    if (qty < 1) throw { http: 400, code: "INVALID_QTY", message: "Miqdor noto'g'ri" };
    const food = await foodModel.findOne({ _id: it.foodId, branch, isActive: true });
    if (!food) throw { http: 404, code: "FOOD_NOT_FOUND", message: "Taom topilmadi" };
    // Stop-list (O1 qaror: tugasa BLOK)
    if (food.availability?.stopped) {
      throw { http: 409, code: "FOOD_STOPPED", message: `"${food.name}" stop-listda` };
    }
    if (food.availability?.dailyLimit != null) {
      const sold = food.availability.soldToday || 0;
      if (sold + qty > food.availability.dailyLimit) {
        throw { http: 409, code: "FOOD_LIMIT", message: `"${food.name}" kunlik limiti tugadi` };
      }
    }
    out.push({
      foodId: food._id,
      foodName: food.name,
      foodPrice: food.price,
      quantity: qty,
      note: it.note || null,
      cancels: [],
    });
  }
  return out;
}

async function buildServiceSnapshot(serviceId, branch) {
  if (!serviceId) return { serviceId: null, percent: 0, amount: 0, waived: false };
  const s = await serviceModel.findOne({ _id: serviceId, branch, isActive: true });
  if (!s) throw { http: 404, code: "SERVICE_NOT_FOUND", message: "Xizmat haqi topilmadi" };
  return { serviceId: s._id, percent: s.servicePercent, amount: 0, waived: false };
}

async function buildDiscountSnapshot(discountId, branch) {
  if (!discountId) return null;
  const d = await discountModel.findOne({ _id: discountId, branch, isActive: true });
  if (!d) throw { http: 404, code: "DISCOUNT_NOT_FOUND", message: "Chegirma topilmadi" };
  return {
    discountId: d._id,
    title: d.title,
    type: d.type,
    percent: d.discountPercent,
    amount: d.amount,
  };
}

const populateOrder = (q) => q.populate("table").populate("foods.foodId");

// Helper xatolarni HTTP javobga aylantirish
function sendErr(res, e) {
  if (e?.http) return res.status(e.http).json({ status: "error", code: e.code, message: e.message });
  return res.status(500).json({ status: "error", message: e.message });
}

// ==================== MENYU / KATALOG ====================
router.get("/menu", async (req, res) => {
  try {
    const branch = branchId(req);
    const [categories, foods] = await Promise.all([
      categoryModel.find({ branch, isActive: true }).sort({ sortOrder: 1, title: 1 }),
      foodModel.find({ branch, isActive: true }).sort({ sortOrder: 1, name: 1 }),
    ]);
    return res.status(200).json({ status: "success", data: { categories, foods } });
  } catch (e) {
    return sendErr(res, e);
  }
});

router.get("/tables", async (req, res) => {
  try {
    const tables = await tableModel.find({ branch: branchId(req), isActive: true }).sort({ number: 1 });
    return res.status(200).json({ status: "success", data: tables });
  } catch (e) {
    return sendErr(res, e);
  }
});

router.get("/services", async (req, res) => {
  try {
    const services = await serviceModel.find({ branch: branchId(req), isActive: true });
    return res.status(200).json({ status: "success", data: services });
  } catch (e) {
    return sendErr(res, e);
  }
});

router.get("/discounts", async (req, res) => {
  try {
    const discounts = await discountModel.find({ branch: branchId(req), isActive: true });
    return res.status(200).json({ status: "success", data: discounts });
  } catch (e) {
    return sendErr(res, e);
  }
});

// ==================== SMENA ====================
router.get("/shift/current", async (req, res) => {
  try {
    const shift = await getOpenShift(branchId(req));
    return res.status(200).json({ status: "success", data: shift });
  } catch (e) {
    return sendErr(res, e);
  }
});

router.post("/shift/open", async (req, res) => {
  try {
    const branch = branchId(req);
    const existing = await getOpenShift(branch);
    if (existing) {
      return res.status(400).json({ status: "error", code: "SHIFT_ALREADY_OPEN", data: existing });
    }
    const shift = await shiftModel.create({
      branch,
      restaurantId: req.userData.restaurantId,
      openedBy: req.userData._id,
      openingCash: Number(req.body.openingCash) || 0,
    });
    await audit.log({ kind: "shift_opened", restaurantId: req.userData.restaurantId, branchId: branch, actor: { type: "user", id: String(req.userData._id), role: req.userData.role } });
    return res.status(200).json({ status: "success", data: shift });
  } catch (e) {
    return sendErr(res, e);
  }
});

router.post("/shift/close", async (req, res) => {
  try {
    const branch = branchId(req);
    const shift = await getOpenShift(branch);
    if (!shift) return res.status(400).json({ status: "error", code: "NO_OPEN_SHIFT" });

    const allOrders = await orderModel.find({ shift: shift._id });
    const totals = computeShiftTotals(allOrders);

    shift.totals = totals;
    shift.isActive = false;
    shift.closedBy = req.userData._id;
    shift.closedAt = new Date();
    if (req.body.closingCash !== undefined) {
      shift.closingCash = Number(req.body.closingCash);
      const expectedCash = (shift.openingCash || 0) + totals.cashRevenue;
      shift.closingDiscrepancy = shift.closingCash - expectedCash;
    }
    if (req.body.notes) shift.notes = req.body.notes;
    await shift.save();

    await audit.log({ kind: "shift_closed", restaurantId: req.userData.restaurantId, branchId: branch, actor: { type: "user", id: String(req.userData._id), role: req.userData.role }, message: `revenue: ${totals.revenue}` });
    return res.status(200).json({ status: "success", data: shift });
  } catch (e) {
    return sendErr(res, e);
  }
});

// ==================== ORDERLAR ====================

// Joriy smena orderlari (ochiq + to'langan)
router.get("/orders", async (req, res) => {
  try {
    const branch = branchId(req);
    const filter = { branch };
    if (req.query.status === "open") {
      filter.paymentStatus = "pending";
      filter.isCancel = { $ne: true };
    }
    const shift = await getOpenShift(branch);
    if (shift) filter.shift = shift._id;
    const orders = await populateOrder(orderModel.find(filter).sort({ createdAt: -1 }).limit(100));
    return res.status(200).json({ status: "success", data: orders });
  } catch (e) {
    return sendErr(res, e);
  }
});

router.get("/orders/:id", async (req, res) => {
  try {
    const order = await populateOrder(orderModel.findOne({ _id: req.params.id, branch: branchId(req) }));
    if (!order) return res.status(404).json({ status: "error", code: "ORDER_NOT_FOUND" });
    return res.status(200).json({ status: "success", data: order });
  } catch (e) {
    return sendErr(res, e);
  }
});

// Order yaratish
router.post("/orders", async (req, res) => {
  try {
    const branch = branchId(req);
    const shift = await getOpenShift(branch);
    if (!shift) return res.status(400).json({ status: "error", code: "NO_OPEN_SHIFT", message: "Avval smena oching" });

    const { orderType = "dineIn", table, foods, serviceId, discountId, guestCount, note } = req.body;

    // Stol (dineIn)
    let tableId = null;
    if (orderType === "dineIn") {
      if (!table) return res.status(400).json({ status: "error", code: "TABLE_REQUIRED", message: "Stol tanlang" });
      const t = await tableModel.findOne({ _id: table, branch });
      if (!t) return res.status(404).json({ status: "error", code: "TABLE_NOT_FOUND" });
      tableId = t._id;
    }

    const foodSnap = await buildFoodSnapshot(foods, branch);
    const serviceSnap = await buildServiceSnapshot(serviceId, branch);
    const discountSnap = await buildDiscountSnapshot(discountId, branch);

    const restaurant = await restaurantsModel.findById(req.userData.restaurantId).select("currency");
    const receiptNumber = await generateReceiptNumber(branch);

    const orderData = {
      branch,
      restaurantId: req.userData.restaurantId,
      shift: shift._id,
      receiptNumber,
      currency: restaurant?.currency,
      orderType,
      waiter: { waiterId: req.userData._id, name: req.userData.name, phone: req.userData.phone },
      table: tableId,
      service: serviceSnap,
      discount: discountSnap,
      foods: foodSnap,
      guestCount: guestCount ? Number(guestCount) : undefined,
      note: note || null,
      source: req.userData.role === "waiter" ? "waiter_mobile" : "pos",
      createdInMode: "online",
      paymentStatus: "pending",
      totalPrice: 0,
    };
    calculateOrderTotals(orderData); // server authority

    const order = await orderModel.create(orderData);
    await audit.log({ kind: "order_created", restaurantId: req.userData.restaurantId, branchId: branch, actor: { type: "user", id: String(req.userData._id), role: req.userData.role }, message: `${receiptNumber}: ${order.totalPrice}` });

    const populated = await populateOrder(orderModel.findById(order._id));
    return res.status(200).json({ status: "success", data: populated });
  } catch (e) {
    return sendErr(res, e);
  }
});

// Order yangilash — taomlar, service (qo'shish/olib tashlash), chegirma (berish/bermaslik)
router.patch("/orders/:id", async (req, res) => {
  try {
    const branch = branchId(req);
    const order = await orderModel.findOne({ _id: req.params.id, branch });
    if (!order) return res.status(404).json({ status: "error", code: "ORDER_NOT_FOUND" });
    if (order.paymentStatus === "paid") return res.status(400).json({ status: "error", code: "ALREADY_PAID", message: "To'langan orderni o'zgartirib bo'lmaydi" });
    if (order.isCancel) return res.status(400).json({ status: "error", code: "CANCELLED", message: "Bekor qilingan order" });

    const { foods, serviceId, discountId, removeService, removeDiscount, note, guestCount } = req.body;

    if (foods !== undefined) order.foods = await buildFoodSnapshot(foods, branch);

    // Service: olib tashlash yoki qo'shish
    if (removeService === true) {
      order.service = { serviceId: null, percent: 0, amount: 0, waived: false };
    } else if (serviceId !== undefined) {
      order.service = await buildServiceSnapshot(serviceId, branch);
    }

    // Chegirma: bermaslik yoki berish
    if (removeDiscount === true) {
      order.discount = null;
    } else if (discountId !== undefined) {
      order.discount = await buildDiscountSnapshot(discountId, branch);
    }

    if (note !== undefined) order.note = note;
    if (guestCount !== undefined) order.guestCount = Number(guestCount);

    calculateOrderTotals(order); // qayta hisoblash (server authority)
    await order.save();

    const populated = await populateOrder(orderModel.findById(order._id));
    return res.status(200).json({ status: "success", data: populated });
  } catch (e) {
    return sendErr(res, e);
  }
});

// To'lov
router.post("/orders/:id/pay", async (req, res) => {
  try {
    const branch = branchId(req);
    const order = await orderModel.findOne({ _id: req.params.id, branch });
    if (!order) return res.status(404).json({ status: "error", code: "ORDER_NOT_FOUND" });
    if (order.isCancel) return res.status(400).json({ status: "error", code: "CANCELLED" });
    if (order.paymentStatus === "paid") return res.status(400).json({ status: "error", code: "ALREADY_PAID" });

    const { paymentMethod, mixed, cashGiven } = req.body;
    const allowed = ["cash", "card", "transfer", "kaspi", "mixed"];
    if (!allowed.includes(paymentMethod)) {
      return res.status(400).json({ status: "error", code: "INVALID_PAYMENT_METHOD" });
    }

    order.paymentStatus = "paid";
    order.paymentMethod = paymentMethod;
    order.paidAt = new Date();
    order.paidBy = req.userData._id;

    if (paymentMethod === "mixed" && mixed) {
      order.mixed = {
        cash: Number(mixed.cash) || 0,
        card: Number(mixed.card) || 0,
        transfer: Number(mixed.transfer) || 0,
        kaspi: Number(mixed.kaspi) || 0,
        cashback: 0,
      };
    }
    if (paymentMethod === "cash" && cashGiven != null) {
      order.cashPayment = { givenAmount: Number(cashGiven), changeAmount: Number(cashGiven) - order.totalPrice };
    }

    await order.save();
    await audit.log({ kind: "order_paid", restaurantId: req.userData.restaurantId, branchId: branch, actor: { type: "user", id: String(req.userData._id), role: req.userData.role }, message: `${order.receiptNumber}: ${paymentMethod} ${order.totalPrice}` });
    return res.status(200).json({ status: "success", data: order });
  } catch (e) {
    return sendErr(res, e);
  }
});

// Bekor qilish (void/cancel)
router.post("/orders/:id/cancel", async (req, res) => {
  try {
    const branch = branchId(req);
    const order = await orderModel.findOne({ _id: req.params.id, branch });
    if (!order) return res.status(404).json({ status: "error", code: "ORDER_NOT_FOUND" });
    if (order.paymentStatus === "paid") return res.status(400).json({ status: "error", code: "ALREADY_PAID", message: "To'langan orderni bekor qilib bo'lmaydi (refund kerak)" });
    if (order.isCancel) return res.status(400).json({ status: "error", code: "ALREADY_CANCELLED" });

    order.isCancel = true;
    order.cancelType = req.body.cancelType === "cancel" ? "cancel" : "void";
    order.cancelReason = req.body.reason || null;
    order.cancelledBy = req.userData._id;
    order.cancelledAt = new Date();
    await order.save();

    await audit.log({ kind: "order_cancelled", restaurantId: req.userData.restaurantId, branchId: branch, actor: { type: "user", id: String(req.userData._id), role: req.userData.role }, message: order.receiptNumber });
    return res.status(200).json({ status: "success", data: order });
  } catch (e) {
    return sendErr(res, e);
  }
});

export default router;
