import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import categoryModel from "../models/category.model.js";
import foodModel from "../models/food.model.js";
import tableModel from "../models/table.model.js";
import orderModel from "../models/order.model.js";
import usersModel from "../models/users.model.js";
import shiftModel from "../models/shift.model.js";

// Kepket frontend kutgan menyu/kategoriya/stol endpointlari (format: { success, data })

// ===== /api/foods/menu, (kelajakda /api/foods) =====
export const foodsRouter = express.Router();
foodsRouter.use(authMiddleware);

foodsRouter.get("/menu", async (req, res) => {
  try {
    const branch = req.userData.branch;
    const [cats, foods] = await Promise.all([
      categoryModel.find({ branch, isActive: true }).sort({ sortOrder: 1, title: 1 }),
      foodModel.find({ branch, isActive: true }).sort({ sortOrder: 1, name: 1 }),
    ]);
    const menu = cats.map((c) => ({
      _id: c._id,
      name: c.title,
      foods: foods
        .filter((f) => String(f.category) === String(c._id))
        .map((f) => ({
          _id: f._id,
          name: f.name,
          price: f.price,
          category: c._id,
          available: !f.availability?.stopped,
          isHourly: f.isHourly === true, // soatlik taom (PlayStation/kabina)
        })),
    }));
    return res.json({ success: true, data: menu });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
});

// ===== /api/categories =====
export const categoriesRouter = express.Router();
categoriesRouter.use(authMiddleware);

categoriesRouter.get("/", async (req, res) => {
  try {
    const cats = await categoryModel
      .find({ branch: req.userData.branch, isActive: true })
      .sort({ sortOrder: 1, title: 1 });
    return res.json({ success: true, data: cats.map((c) => ({ _id: c._id, name: c.title, title: c.title })) });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
});

// ===== /api/tables (band stollar bilan) =====
export const tablesRouter = express.Router();
tablesRouter.use(authMiddleware);

tablesRouter.get("/", async (req, res) => {
  try {
    const branch = req.userData.branch;
    // Band stol FAQAT joriy ochiq smena bo'yicha aniqlansin (eski smenadagi order'lar band ko'rsatmasin)
    const shift = await shiftModel.findOne({ branch, isActive: true });
    const orderFilter = { branch, orderType: "dineIn", paymentStatus: "pending", isCancel: { $ne: true } };
    if (shift) orderFilter.shift = shift._id;
    const openOrders = await orderModel.find(orderFilter).select("table");
    const occupied = new Map();
    for (const o of openOrders) if (o.table) occupied.set(String(o.table), String(o._id));

    const tables = await tableModel.find({ branch, isActive: true }).sort({ number: 1 });
    const data = tables.map((t) => {
      const activeOrderId = occupied.get(String(t._id)) || null;
      return {
        _id: t._id,
        number: t.number,
        title: t.title || `Стол ${t.number}`,
        status: activeOrderId ? "occupied" : "free",
        occupied: !!activeOrderId,
        activeOrderId,
        categoryTitle: "",
      };
    });
    return res.json({ success: true, data });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
});

// ===== /api/staff (ofitsiantlar — order'da tanlash uchun) =====
export const staffRouter = express.Router();
staffRouter.use(authMiddleware);

staffRouter.get("/", async (req, res) => {
  try {
    const filter = { branch: req.userData.branch, isActive: { $ne: false } };
    if (req.query.role) filter.role = req.query.role;
    const users = await usersModel.find(filter).select("name phone role");
    const data = users.map((u) => {
      const parts = (u.name || "").trim().split(" ");
      return {
        _id: u._id,
        firstName: parts[0] || "",
        lastName: parts.slice(1).join(" "),
        name: u.name,
        phone: u.phone,
        role: u.role,
      };
    });
    return res.json({ success: true, data });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
});
