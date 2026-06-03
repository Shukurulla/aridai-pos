import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import expenseModel from "../models/expense.model.js";
import advanceModel from "../models/advance.model.js";
import shiftModel from "../models/shift.model.js";
import usersModel from "../models/users.model.js";

// Kepket Расходы/Авансы (kassa harakati). Format: { success, data: [...] }

// Sana/smena filtri (frontend ?shiftId= YOKI ?startDate=&endDate=)
function buildDateFilter(query, branch) {
  const filter = { branch };
  if (query.shiftId) {
    filter.shift = query.shiftId;
    return filter;
  }
  if (query.startDate || query.endDate) {
    filter.createdAt = {};
    if (query.startDate) {
      const s = new Date(query.startDate);
      s.setHours(0, 0, 0, 0);
      filter.createdAt.$gte = s;
    }
    if (query.endDate) {
      const e = new Date(query.endDate);
      e.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = e;
    }
  }
  return filter;
}

async function activeShiftId(branch) {
  const shift = await shiftModel.findOne({ branch, isActive: true });
  return shift?._id || null;
}

// ===================== EXPENSES (/api/expenses) =====================
export const expensesRouter = express.Router();
expensesRouter.use(authMiddleware);

const mapExpense = (e) => ({
  _id: e._id,
  type: e.type,
  amount: e.amount,
  paymentType: e.paymentType,
  description: e.description,
  category: e.category,
  categoryName: e.categoryName,
  source: e.source,
  createdAt: e.createdAt,
  createdByName: e.createdByName,
});

expensesRouter.get("/", async (req, res) => {
  try {
    const filter = buildDateFilter(req.query, req.userData.branch);
    const list = await expenseModel.find(filter).sort({ createdAt: -1 }).limit(500);
    return res.json({ success: true, data: list.map(mapExpense) });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
});

expensesRouter.post("/", async (req, res) => {
  try {
    const branch = req.userData.branch;
    const { categoryId, amount, description, type, paymentType, source } = req.body;
    const amt = Number(amount);
    if (!amt || amt <= 0) return res.status(400).json({ success: false, error: { message: "Укажите сумму" } });

    const doc = await expenseModel.create({
      branch,
      restaurantId: req.userData.restaurantId,
      shift: await activeShiftId(branch),
      type: type === "income" ? "income" : "expense",
      category: categoryId || null,
      description: description || null,
      amount: amt,
      paymentType: paymentType === "click" ? "click" : "cash",
      source: source || "cashier",
      createdBy: req.userData._id,
      createdByName: req.userData.name || null,
      syncStatus: "pending",
    });
    return res.json({ success: true, data: mapExpense(doc) });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
});

// ===================== ADVANCES (/api/advances) =====================
export const advancesRouter = express.Router();
advancesRouter.use(authMiddleware);

const mapAdvance = (a) => ({
  _id: a._id,
  amount: a.amount,
  paymentType: a.paymentType,
  description: a.description,
  waiterId: a.waiterId,
  waiterName: a.waiterName,
  createdAt: a.createdAt,
  createdByName: a.createdByName,
});

advancesRouter.get("/", async (req, res) => {
  try {
    const filter = buildDateFilter(req.query, req.userData.branch);
    const list = await advanceModel.find(filter).sort({ createdAt: -1 }).limit(500);
    return res.json({ success: true, data: list.map(mapAdvance) });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
});

advancesRouter.post("/", async (req, res) => {
  try {
    const branch = req.userData.branch;
    const { waiterId, amount, description, paymentType } = req.body;
    const amt = Number(amount);
    if (!amt || amt <= 0) return res.status(400).json({ success: false, error: { message: "Укажите сумму" } });

    let waiterName = null;
    if (waiterId) {
      const w = await usersModel.findById(waiterId).select("name");
      waiterName = w?.name || null;
    }

    const doc = await advanceModel.create({
      branch,
      restaurantId: req.userData.restaurantId,
      shift: await activeShiftId(branch),
      waiterId: waiterId || null,
      waiterName,
      amount: amt,
      description: description || null,
      paymentType: paymentType === "click" ? "click" : "cash",
      createdBy: req.userData._id,
      createdByName: req.userData.name || null,
      syncStatus: "pending",
    });
    return res.json({ success: true, data: mapAdvance(doc) });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
});

// ============== EXPENSE CATEGORIES (/api/expense-categories) ==============
// Hozircha kategoriyalar modeli yo'q — bo'sh ro'yxat (forma ixtiyoriy kategoriya).
export const expenseCategoriesRouter = express.Router();
expenseCategoriesRouter.use(authMiddleware);
expenseCategoriesRouter.get("/", async (req, res) => {
  return res.json({ success: true, data: [] });
});
