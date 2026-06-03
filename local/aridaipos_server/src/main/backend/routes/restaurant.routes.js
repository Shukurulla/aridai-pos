import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import serviceModel from "../models/service.model.js";
import branchesModel from "../models/branches.model.js";
import restaurantsModel from "../models/restaurants.model.js";
import orderModel from "../models/order.model.js";
import { calculateOrderTotals } from "../utils/order-calc.js";
import config from "../config/index.js";

// Kepket restoran sozlamalari (услуга% / chegирма%) — Settings ekrani + Payment.
const router = express.Router();
router.use(authMiddleware);

// ===== GET /api/restaurant/settings =====
router.get("/settings", async (req, res) => {
  try {
    const branch = req.userData.branch;
    const [svc, branchDoc, rest] = await Promise.all([
      serviceModel.findOne({ branch, isActive: true }),
      branchesModel.findById(branch).select("name"),
      restaurantsModel.findById(req.userData.restaurantId).select("currency brand"),
    ]);
    return res.json({
      success: true,
      data: {
        branchName: branchDoc?.name || "",
        name: branchDoc?.name || rest?.brand || "",
        serviceChargeEnabled: !!svc && svc.servicePercent > 0,
        serviceChargePercent: svc?.servicePercent || 0,
        discountPercent: 0,
        currency: rest?.currency || "KZT",
      },
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
});

// ===== PUT /api/restaurant/settings =====
router.put("/settings", async (req, res) => {
  try {
    const branch = req.userData.branch;
    const { serviceChargeEnabled, serviceChargePercent } = req.body;
    const enabled = serviceChargeEnabled === true;
    const pct = Math.max(0, Math.min(100, Number(serviceChargePercent) || 0));

    let svc = await serviceModel.findOne({ branch, isActive: true });
    if (svc) {
      svc.servicePercent = enabled ? pct : 0;
      svc.syncStatus = "pending";
      await svc.save();
    } else if (enabled && pct > 0) {
      svc = await serviceModel.create({
        branch,
        restaurantId: req.userData.restaurantId,
        servicePercent: pct,
        isActive: true,
        applyTo: ["dineIn"],
        syncStatus: "pending",
      });
    }

    // Usluga branch-wide sozlama → barcha OCHIQ (to'lanmagan) dineIn orderlarni
    // yangi foizga moslaymiz (waived qilinganlar tegilmaydi). To'langan orderlar
    // TARIXIY (tegilmaydi). Shunda Settings'da o'chirsa/yoqsa — darhol ta'sir qiladi.
    const newPct = enabled ? pct : 0;
    const openOrders = await orderModel.find({
      branch,
      paymentStatus: { $ne: "paid" },
      isCancel: { $ne: true },
      orderType: "dineIn",
    });
    let updated = 0;
    for (const o of openOrders) {
      if (o.service?.waived) continue; // kassir ataylab bekor qilgan — tegmaymiz
      o.service = {
        ...(o.service?.toObject?.() || o.service || {}),
        serviceId: svc?._id || o.service?.serviceId || null,
        percent: newPct,
      };
      calculateOrderTotals(o);
      o.syncStatus = "pending";
      await o.save();
      updated += 1;
    }

    // MUHIM: o'zgarishni GLOBAL'ga push qilamiz. Aks holda keyingi bootstrap PULL
    // (har 10s) local service'ni global'dagi eski qiymatga qaytarib qo'yardi (revert bug).
    if (config.branchToken) {
      try {
        await fetch(`${config.globalUrl}/api/sync/service`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${config.branchToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ _id: svc?._id, serviceChargeEnabled: enabled, serviceChargePercent: pct }),
        });
      } catch {
        /* offline — global yo'q; local qiymat online bo'lgach keyingi tahrirda push bo'ladi */
      }
    }

    return res.json({
      success: true,
      data: {
        serviceChargeEnabled: enabled && pct > 0,
        serviceChargePercent: enabled ? pct : 0,
        discountPercent: Math.max(0, Math.min(100, Number(req.body.discountPercent) || 0)),
      },
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
});

export default router;
