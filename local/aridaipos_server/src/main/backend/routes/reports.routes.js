import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import orderModel from "../models/order.model.js";
import shiftModel from "../models/shift.model.js";

// Kepket frontend kutgan hisobot endpointlari (header ВЫРУЧКА, getDailySummary)
const router = express.Router();
router.use(authMiddleware);

// Joriy smenani aniqlash (query shiftId yoki aktiv smena)
async function resolveShiftId(branch, queryShiftId) {
  if (queryShiftId) return queryShiftId;
  const shift = await shiftModel.findOne({ branch, isActive: true });
  return shift?._id || null;
}

// ===== GET /api/reports/dashboard?period=today&shiftId= =====
// getDailySummary header: { data: { summary: { totalRevenue, totalOrders, completedOrders } } }
router.get("/dashboard", async (req, res) => {
  try {
    const branch = req.userData.branch;
    const shiftId = await resolveShiftId(branch, req.query.shiftId);
    const filter = { branch, isCancel: { $ne: true } };
    if (shiftId) filter.shift = shiftId;

    const orders = await orderModel.find(filter).select("paymentStatus totalPrice");
    const totalOrders = orders.length;
    const paid = orders.filter((o) => o.paymentStatus === "paid");
    const completedOrders = paid.length;
    const totalRevenue = paid.reduce((s, o) => s + (o.totalPrice || 0), 0);

    return res.json({ success: true, data: { summary: { totalRevenue, totalOrders, completedOrders } } });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
});

// ===== GET /api/reports/payments?startDate=&shiftId= =====
// { data: { paymentBreakdown: [{ method:'cash'|'card'|'click', total }] } }
// To'lov turi bo'yicha tushum (mixed order split'ga bo'linadi). transfer→click.
router.get("/payments", async (req, res) => {
  try {
    const branch = req.userData.branch;
    const shiftId = await resolveShiftId(branch, req.query.shiftId);
    const filter = { branch, paymentStatus: "paid", isCancel: { $ne: true } };
    if (shiftId) filter.shift = shiftId;

    const orders = await orderModel.find(filter).select("paymentMethod totalPrice mixed");
    const totals = { cash: 0, card: 0, click: 0 };
    for (const o of orders) {
      const amt = o.totalPrice || 0;
      if (o.paymentMethod === "cash") totals.cash += amt;
      else if (o.paymentMethod === "card") totals.card += amt;
      else if (o.paymentMethod === "transfer") totals.click += amt;
      else if (o.paymentMethod === "mixed") {
        totals.cash += o.mixed?.cash || 0;
        totals.card += o.mixed?.card || 0;
        totals.click += o.mixed?.transfer || 0;
      } else {
        totals.cash += amt; // noma'lum — naqd deb hisoblaymiz
      }
    }
    const paymentBreakdown = [
      { method: "cash", total: totals.cash },
      { method: "card", total: totals.card },
      { method: "click", total: totals.click },
    ];
    return res.json({ success: true, data: { paymentBreakdown } });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
});

export default router;
