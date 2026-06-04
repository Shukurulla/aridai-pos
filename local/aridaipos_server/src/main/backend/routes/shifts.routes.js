import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import shiftModel from "../models/shift.model.js";
import orderModel from "../models/order.model.js";
import usersModel from "../models/users.model.js";

// Kepket frontend kutgan shift (smena) endpointlari:
//   GET  /api/shifts/active
//   POST /api/shifts/open      { openingCash, openingNotes }
//   POST /api/shifts/:id/close { closingCash, closingNotes }
//   GET  /api/shifts/available-cash
// Javob formati: { success, data }
const router = express.Router();
router.use(authMiddleware);

async function mapShift(s) {
  if (!s) return null;
  let firstName = "";
  let lastName = "";
  if (s.openedBy) {
    const u = await usersModel.findById(s.openedBy).select("name");
    const parts = (u?.name || "").trim().split(" ");
    firstName = parts[0] || "";
    lastName = parts.slice(1).join(" ");
  }
  return {
    _id: s._id,
    restaurantId: s.restaurantId,
    shiftNumber: s.shiftNumber || 0,
    status: s.isActive ? "active" : "closed",
    openedAt: s.openedAt,
    closedAt: s.closedAt,
    openedBy: { _id: s.openedBy, firstName, lastName },
    openingCash: s.openingCash || 0,
    closingCash: s.closingCash,
    expectedClosingCash: (s.openingCash || 0) + (s.totals?.cashRevenue || 0),
    cashDifference: s.closingDiscrepancy,
    stats: s.totals,
    openingNotes: s.notes,
    closingNotes: s.notes,
  };
}

router.get("/active", async (req, res) => {
  try {
    const s = await shiftModel.findOne({ branch: req.userData.branch, isActive: true });
    return res.json({ success: true, data: await mapShift(s) });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
});

router.post("/open", async (req, res) => {
  try {
    const branch = req.userData.branch;
    const existing = await shiftModel.findOne({ branch, isActive: true });
    if (existing) return res.json({ success: true, data: await mapShift(existing) });

    const count = await shiftModel.countDocuments({ branch });
    const shift = await shiftModel.create({
      branch,
      restaurantId: req.userData.restaurantId,
      openedBy: req.userData._id,
      openingCash: Number(req.body.openingCash) || 0,
      notes: req.body.openingNotes || undefined,
      shiftNumber: count + 1,
      syncStatus: "pending",
    });
    return res.json({ success: true, data: await mapShift(shift) });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
});

router.post("/:id/close", async (req, res) => {
  try {
    const shift = await shiftModel.findOne({ _id: req.params.id, branch: req.userData.branch });
    if (!shift) return res.status(404).json({ success: false, error: { message: "Смена не найдена" } });

    // Ochiq (to'lanmagan) orderlar bo'lsa — smena yopilmaydi (tushum/kassa noto'g'ri bo'ladi)
    const openOrders = await orderModel.countDocuments({
      shift: shift._id,
      isCancel: { $ne: true },
      paymentStatus: { $ne: "paid" },
    });
    if (openOrders > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: "OPEN_ORDERS",
          openOrders,
          message: `Нельзя закрыть смену: есть открытые заказы (${openOrders}). Завершите оплату или отмените их.`,
        },
      });
    }

    const paid = await orderModel.find({ shift: shift._id, paymentStatus: "paid", isCancel: { $ne: true } });
    const t = { ordersCount: paid.length, revenue: 0, cashRevenue: 0, cardRevenue: 0, transferRevenue: 0, discountTotal: 0, serviceTotal: 0 };
    for (const o of paid) {
      t.revenue += o.totalPrice || 0;
      t.discountTotal += o.discountAmount || 0;
      t.serviceTotal += o.service?.amount || 0;
      const m = o.paymentMethod;
      if (m === "cash") t.cashRevenue += o.totalPrice;
      else if (m === "card") t.cardRevenue += o.totalPrice;
      else if (m === "transfer") t.transferRevenue += o.totalPrice;
    }
    shift.totals = t;
    shift.isActive = false;
    shift.closedBy = req.userData._id;
    shift.closedAt = new Date();
    if (req.body.closingCash !== undefined) {
      shift.closingCash = Number(req.body.closingCash);
      shift.closingDiscrepancy = shift.closingCash - ((shift.openingCash || 0) + t.cashRevenue);
    }
    if (req.body.closingNotes) shift.notes = req.body.closingNotes;
    shift.syncStatus = "pending";
    await shift.save();
    return res.json({ success: true, data: await mapShift(shift) });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
});

router.get("/available-cash", async (req, res) => {
  try {
    const shift = await shiftModel.findOne({ branch: req.userData.branch, isActive: true });
    return res.json({
      success: true,
      data: {
        availableCash: shift?.openingCash || 0,
        openingCash: shift?.openingCash || 0,
        cashPayments: 0,
        totalExpenses: 0,
        totalAdvances: 0,
        hasActiveShift: !!shift,
      },
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
});

export default router;
