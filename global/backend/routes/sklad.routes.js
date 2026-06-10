import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { requireFeature } from "../features/middleware.js";
import { ingredientModel, stockModel, stockMovementModel } from "../models/sklad.model.js";
import { applyMovements } from "../utils/sklad.js";
import { audit } from "../utils/audit.js";

// SKLAD (inventory) API — obsidian/04-toollar/sklad.md
// requireFeature("sklad"): toggle O'CHIQ bo'lsa hammasi 404 FEATURE_DISABLED
// (spec: "API 404 qaytaradi"). Bu — requireFeature'ning birinchi REAL ulanishi.
const router = express.Router();
router.use(authMiddleware);
router.use(requireFeature("sklad"));

const ADMIN = ["branch_admin", "owner", "system_admin"];
const branchOf = (req) => req.userData.branch || req.query.branch || req.body.branch;

// ===== Ingredientlar =====
router.get("/ingredients", async (req, res) => {
  try {
    const list = await ingredientModel.find({ branch: branchOf(req), isActive: { $ne: false } }).sort({ name: 1 });
    return res.json({ status: "success", data: list });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

router.post("/ingredients", requireRole(...ADMIN), async (req, res) => {
  try {
    const { name, unit, category, lowAlertThreshold } = req.body;
    if (!name || !unit) return res.status(400).json({ status: "error", message: "name/unit required" });
    const branch = branchOf(req);
    const ing = await ingredientModel.create({
      branch,
      restaurantId: req.userData.restaurantId,
      name: String(name).trim(),
      unit,
      category: category || "asosiy",
    });
    await stockModel.create({
      branch,
      restaurantId: req.userData.restaurantId,
      ingredientId: ing._id,
      balance: 0,
      lowAlertThreshold: Number(lowAlertThreshold) || 10,
    });
    return res.json({ status: "success", data: ing });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

router.put("/ingredients/:id", requireRole(...ADMIN), async (req, res) => {
  try {
    const ing = await ingredientModel.findOne({ _id: req.params.id, branch: branchOf(req) });
    if (!ing) return res.status(404).json({ status: "error", message: "Ингредиент не найден" });
    const { name, unit, category, isActive } = req.body;
    if (name !== undefined) ing.name = String(name).trim();
    if (unit !== undefined) ing.unit = unit;
    if (category !== undefined) ing.category = category;
    if (isActive !== undefined) ing.isActive = isActive === true || isActive === "true";
    await ing.save();
    return res.json({ status: "success", data: ing });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

// ===== Stock =====
// Joriy balanslar (ingredient bilan birga)
router.get("/stock", async (req, res) => {
  try {
    const branch = branchOf(req);
    const [stocks, ings] = await Promise.all([
      stockModel.find({ branch }),
      ingredientModel.find({ branch }).select("name unit category isActive"),
    ]);
    const ingById = new Map(ings.map((i) => [String(i._id), i]));
    const data = stocks
      .map((s) => {
        const ing = ingById.get(String(s.ingredientId));
        if (!ing || ing.isActive === false) return null;
        return {
          _id: s._id,
          ingredientId: s.ingredientId,
          name: ing.name,
          unit: ing.unit,
          category: ing.category,
          balance: s.balance || 0,
          lowAlertThreshold: s.lowAlertThreshold ?? 10,
          low: (s.balance || 0) <= (s.lowAlertThreshold ?? 10),
          lastMovementAt: s.lastMovementAt,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
    return res.json({ status: "success", data });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

// Kirish (yangi partiya keldi)
router.post("/stock/in", requireRole(...ADMIN), async (req, res) => {
  try {
    const { ingredientId, quantity, price } = req.body;
    const qty = Number(quantity);
    if (!ingredientId || !(qty > 0)) return res.status(400).json({ status: "error", message: "ingredientId/quantity required" });
    const branch = branchOf(req);
    const ing = await ingredientModel.findOne({ _id: ingredientId, branch });
    if (!ing) return res.status(404).json({ status: "error", message: "Ингредиент не найден" });

    await applyMovements([
      {
        branch,
        restaurantId: req.userData.restaurantId,
        ingredientId,
        direction: "in",
        delta: qty,
        quantity: qty,
        unit: ing.unit,
        price: Number(price) || null,
        reason: "manual",
        createdBy: req.userData._id,
      },
    ]);
    await audit.log({ kind: "sklad_stock_in", restaurantId: req.userData.restaurantId, branchId: branch, actor: { type: "user", id: String(req.userData._id), role: req.userData.role }, message: `${ing.name}: +${qty} ${ing.unit}` });
    const stock = await stockModel.findOne({ branch, ingredientId });
    return res.json({ status: "success", data: stock });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

// Inventarizatsiya (haqiqiy qoldiqni kiritish) — farq adjustment bo'lib yoziladi
router.post("/stock/adjustment", requireRole(...ADMIN), async (req, res) => {
  try {
    const { ingredientId, newBalance, reason } = req.body;
    const nb = Number(newBalance);
    if (!ingredientId || Number.isNaN(nb) || nb < 0) {
      return res.status(400).json({ status: "error", message: "ingredientId/newBalance required" });
    }
    const branch = branchOf(req);
    const [ing, stock] = await Promise.all([
      ingredientModel.findOne({ _id: ingredientId, branch }),
      stockModel.findOne({ branch, ingredientId }),
    ]);
    if (!ing) return res.status(404).json({ status: "error", message: "Ингредиент не найден" });
    const delta = nb - (stock?.balance || 0);
    if (delta !== 0) {
      await applyMovements([
        {
          branch,
          restaurantId: req.userData.restaurantId,
          ingredientId,
          direction: "adjustment",
          delta,
          quantity: Math.abs(delta),
          unit: ing.unit,
          reason: reason || "inventory",
          createdBy: req.userData._id,
        },
      ]);
      await audit.log({ kind: "sklad_adjustment", restaurantId: req.userData.restaurantId, branchId: branch, actor: { type: "user", id: String(req.userData._id), role: req.userData.role }, message: `${ing.name}: ${delta > 0 ? "+" : ""}${delta} ${ing.unit} (${reason || "inventory"})` });
    }
    const updated = await stockModel.findOne({ branch, ingredientId });
    return res.json({ status: "success", data: updated });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

// Low-alert chegarasini o'zgartirish
router.put("/stock/:ingredientId/threshold", requireRole(...ADMIN), async (req, res) => {
  try {
    const t = Math.max(0, Number(req.body.lowAlertThreshold) || 0);
    const stock = await stockModel.findOneAndUpdate(
      { branch: branchOf(req), ingredientId: req.params.ingredientId },
      { $set: { lowAlertThreshold: t } },
      { new: true },
    );
    if (!stock) return res.status(404).json({ status: "error", message: "Stock не найден" });
    return res.json({ status: "success", data: stock });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

// ===== Harakatlar jurnali =====
router.get("/movements", async (req, res) => {
  try {
    const limit = Math.min(200, Number(req.query.limit) || 50);
    const filter = { branch: branchOf(req) };
    if (req.query.ingredientId) filter.ingredientId = req.query.ingredientId;
    const list = await stockMovementModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("ingredientId", "name unit");
    return res.json({ status: "success", data: list });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

// Past balanslar (admin ogohlantirish ro'yxati)
router.get("/low-alerts", async (req, res) => {
  try {
    const branch = branchOf(req);
    const stocks = await stockModel.find({ branch }).populate("ingredientId", "name unit isActive");
    const data = stocks
      .filter((s) => s.ingredientId && s.ingredientId.isActive !== false && (s.balance || 0) <= (s.lowAlertThreshold ?? 10))
      .map((s) => ({
        ingredientId: s.ingredientId._id,
        name: s.ingredientId.name,
        unit: s.ingredientId.unit,
        balance: s.balance || 0,
        lowAlertThreshold: s.lowAlertThreshold ?? 10,
      }));
    return res.json({ status: "success", data });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

export default router;
