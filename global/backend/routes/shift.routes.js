import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import branchesModel from "../models/branches.model.js";
import shiftModel from "../models/shift.model.js";
import orderModel from "../models/order.model.js";

const router = express.Router();

// ===== Smena ochish — bitta filialda bitta aktiv smena =====
router.post("/create", authMiddleware, async (req, res) => {
  try {
    const { branch, openingCash } = req.body;

    const findBranch = await branchesModel.findById(branch);
    if (!findBranch)
      return res
        .status(404)
        .json({ status: "error", message: "Bunday filial topilmadi" });
    if (String(findBranch.restaurant) !== String(req.userData.restaurantId)) {
      return res.status(403).json({ status: "error", code: "TENANT_MISMATCH" });
    }

    const active = await shiftModel.findOne({ branch, isActive: true });
    if (active) {
      return res.status(409).json({ status: "error", code: "SHIFT_ALREADY_OPEN", message: "Смена уже открыта" });
    }

    const count = await shiftModel.countDocuments({ branch });
    const shift = await shiftModel.create({
      branch,
      restaurantId: req.userData.restaurantId,
      isActive: true,
      shiftNumber: count + 1,
      openedBy: req.userData._id,
      openedAt: new Date(),
      openingCash: Number(openingCash) || 0,
    });

    return res.status(200).json({ status: "success", data: shift });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ===== Smena yopish — orderlardan totals hisoblanadi + kassa discrepancy =====
router.put("/:id/close", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { closingCash } = req.body;

    const shift = await shiftModel.findById(id);
    if (!shift) return res.status(404).json({ status: "error", message: "Bunday smena topilmadi" });
    if (String(shift.restaurantId) !== String(req.userData.restaurantId)) {
      return res.status(403).json({ status: "error", code: "TENANT_MISMATCH" });
    }
    if (!shift.isActive) return res.status(400).json({ status: "error", message: "Смена уже закрыта" });

    let orders = await orderModel.find({ shift: id });

    // Ochiq (to'lanmagan, bekor qilinmagan) orderlar.
    const openList = orders.filter((o) => !o.isCancel && o.paymentStatus !== "paid");
    // force=false → smena yopilmaydi (tushum/kassa noto'g'ri hisoblanmasligi uchun).
    // force=true (admin) → ochiq orderlarni avtomatik bekor qilib, smenani majburan yopadi
    //   (osilib qolgan smenalarni tozalash uchun).
    if (openList.length > 0 && !req.body.force) {
      return res.status(400).json({
        status: "error",
        code: "OPEN_ORDERS",
        openOrders: openList.length,
        message: `Нельзя закрыть смену: есть открытые заказы (${openList.length}). Завершите оплату или отмените их.`,
      });
    }
    if (openList.length > 0 && req.body.force) {
      await orderModel.updateMany(
        { _id: { $in: openList.map((o) => o._id) } },
        {
          $set: {
            isCancel: true,
            cancelType: "cancel",
            cancelReason: "Закрытие смены администратором",
            cancelledBy: req.userData._id,
            cancelledAt: new Date(),
          },
        },
      );
      orders = await orderModel.find({ shift: id }); // totals to'g'ri bo'lishi uchun qayta o'qiymiz
    }

    const sum = (arr, f) => arr.reduce((s, o) => s + (f(o) || 0), 0);
    const paid = orders.filter((o) => !o.isCancel && o.paymentStatus === "paid");
    const direct = (m) => sum(paid.filter((o) => o.paymentMethod === m), (o) => o.totalPrice || 0);
    const mixed = (field) => sum(paid.filter((o) => o.paymentMethod === "mixed"), (o) => o.mixed?.[field] || 0);

    const totals = {
      ordersCount: orders.filter((o) => !o.isCancel).length,
      revenue: sum(paid, (o) => o.totalPrice || 0),
      cashRevenue: direct("cash") + mixed("cash"),
      cardRevenue: direct("card") + mixed("card"),
      transferRevenue: direct("transfer") + mixed("transfer"),
      kaspiRevenue: direct("kaspi") + mixed("kaspi"),
      cashbackUsed: sum(paid, (o) => o.cashback?.spent || 0),
      discountTotal: sum(paid, (o) => o.discountAmount || 0),
      serviceTotal: sum(paid, (o) => o.service?.amount || 0),
      cancelledOrders: orders.filter((o) => o.isCancel).length,
    };

    shift.isActive = false;
    shift.closedBy = req.userData._id;
    shift.closedAt = new Date();
    shift.totals = totals;
    if (closingCash !== undefined && closingCash !== null && closingCash !== "") {
      shift.closingCash = Number(closingCash) || 0;
      shift.closingDiscrepancy = shift.closingCash - ((shift.openingCash || 0) + totals.cashRevenue);
    }
    await shift.save();

    return res.status(200).json({ status: "success", data: shift });
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

    const shifts = await shiftModel.find({ branch: branchId }).populate("branch");

    return res.status(200).json({ status: "success", data: shifts });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const shift = await shiftModel.findById(id).populate("branch");
    if (!shift)
      return res
        .status(404)
        .json({ status: "error", message: "Bunday smena topilmadi" });

    return res.status(200).json({ status: "success", data: shift });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { branch } = req.body;

    if (branch) {
      const findBranch = await branchesModel.findById(branch);
      if (!findBranch)
        return res
          .status(404)
          .json({ status: "error", message: "Bunday filial topilmadi" });
    }

    const shift = await shiftModel.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    if (!shift)
      return res
        .status(404)
        .json({ status: "error", message: "Bunday smena topilmadi" });

    return res.status(200).json({ status: "success", data: shift });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const shift = await shiftModel.findByIdAndDelete(id);
    if (!shift)
      return res
        .status(404)
        .json({ status: "error", message: "Bunday smena topilmadi" });

    return res
      .status(200)
      .json({ status: "success", message: "Smena o'chirildi" });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
