import express from "express";
import mongoose from "mongoose";
import authMiddleware from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import branchesModel from "../models/branches.model.js";
import orderModel from "../models/order.model.js";

// ============================================================
// OWNER (restoran egasi) — mobil app uchun. user-token (role owner).
// Barcha filiallar + tushum statistikasi (kun/hafta/oy/yil + filiallar taqqoslash).
// ============================================================
const router = express.Router();
router.use(authMiddleware);
router.use(requireRole("owner", "system_admin"));

function periodStart(period) {
  const now = new Date();
  if (period === "today") {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === "7d") return new Date(now.getTime() - 7 * 86400000);
  if (period === "30d") return new Date(now.getTime() - 30 * 86400000);
  if (period === "year") return new Date(now.getFullYear(), 0, 1);
  return new Date(now.getTime() - 7 * 86400000); // default 7 kun
}

// ===== Owner filiallari =====
router.get("/branches", async (req, res) => {
  try {
    const branches = await branchesModel
      .find({ restaurant: req.userData.restaurantId })
      .select("name address isActive receiptPrefix");
    return res.status(200).json({ status: "success", data: branches });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ===== Tushum statistikasi (barcha filiallar) =====
// GET /api/owner/stats?period=today|7d|30d|year
router.get("/stats", async (req, res) => {
  try {
    const restaurantId = new mongoose.Types.ObjectId(String(req.userData.restaurantId));
    const period = req.query.period || "7d";
    const from = periodStart(period);
    const paidMatch = { restaurantId, createdAt: { $gte: from }, paymentStatus: "paid", isCancel: { $ne: true } };

    const [byBranchAgg, byMethodAgg, dailyAgg, topFoodsAgg, cancelledCount, branches] = await Promise.all([
      orderModel.aggregate([{ $match: paidMatch }, { $group: { _id: "$branch", revenue: { $sum: "$totalPrice" }, count: { $sum: 1 } } }]),
      orderModel.aggregate([{ $match: paidMatch }, { $group: { _id: "$paymentMethod", total: { $sum: "$totalPrice" } } }]),
      orderModel.aggregate([
        { $match: paidMatch },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, revenue: { $sum: "$totalPrice" } } },
        { $sort: { _id: 1 } },
      ]),
      orderModel.aggregate([
        { $match: paidMatch },
        { $unwind: "$foods" },
        { $group: { _id: "$foods.foodName", qty: { $sum: "$foods.quantity" }, sum: { $sum: { $multiply: ["$foods.foodPrice", "$foods.quantity"] } } } },
        { $sort: { qty: -1 } },
        { $limit: 10 },
      ]),
      orderModel.countDocuments({ restaurantId, createdAt: { $gte: from }, isCancel: true }),
      branchesModel.find({ restaurant: restaurantId }).select("name"),
    ]);

    const nameMap = new Map(branches.map((b) => [String(b._id), b.name]));
    const byBranch = byBranchAgg
      .map((b) => ({ branchId: String(b._id), branchName: nameMap.get(String(b._id)) || "—", revenue: b.revenue, ordersCount: b.count }))
      .sort((a, b) => b.revenue - a.revenue);

    const revenue = byBranch.reduce((s, b) => s + b.revenue, 0);
    const ordersCount = byBranch.reduce((s, b) => s + b.ordersCount, 0);
    const byMethod = { cash: 0, card: 0, transfer: 0, kaspi: 0, mixed: 0 };
    byMethodAgg.forEach((m) => { if (m._id && byMethod[m._id] !== undefined) byMethod[m._id] = m.total; });

    return res.status(200).json({
      status: "success",
      data: {
        period,
        revenue,
        ordersCount,
        avgCheck: ordersCount ? Math.round(revenue / ordersCount) : 0,
        cancelledCount,
        branchesCount: branches.length,
        byBranch,
        byMethod,
        topFoods: topFoodsAgg.map((f) => ({ name: f._id, qty: f.qty, sum: f.sum })),
        daily: dailyAgg.map((d) => ({ date: d._id, revenue: d.revenue })),
      },
    });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
