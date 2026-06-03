import express from "express";
import branchAuth from "../middlewares/branchAuth.middleware.js";
import restaurantsModel from "../models/restaurants.model.js";
import branchesModel from "../models/branches.model.js";
import categoryModel from "../models/category.model.js";
import foodModel from "../models/food.model.js";
import tableModel from "../models/table.model.js";
import serviceModel from "../models/service.model.js";
import discountModel from "../models/discount.model.js";
import usersModel from "../models/users.model.js";
import shiftModel from "../models/shift.model.js";
import orderModel from "../models/order.model.js";
import { audit } from "../utils/audit.js";
import { comparePassword, dummyCompare, hashPassword } from "../utils/password.js";
import { normalizePhone } from "../utils/phone.js";
import { signBranchToken } from "../utils/token.js";

// ============================================================
// SYNC — lokal backend ↔ global VPS (branchToken auth).
// obsidian/02-arxitektura/sinxronizatsiya/
//   - GET  /bootstrap : local boot bo'lganda barcha filial ma'lumotini oladi (mirror)
//   - POST /push      : local'dagi order/smena global'ga jo'natiladi ("local avval jo'natadi")
// ============================================================

const router = express.Router();

// ===== POS provisioning — filial admin login → avtomatik branchToken =====
// branchAuth'dan OLDIN (qurilmada hali token yo'q). Faqat branch_admin.
// POS exe birinchi ochilganda filial admin telefon+parol kiritadi, qurilma filialga biriktiriladi.
router.post("/provision", async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ status: "error", code: "CREDENTIALS_REQUIRED" });
    }
    const user = await usersModel
      .findOne({ phone: normalizePhone(phone), role: "branch_admin" })
      .select("+password");
    if (!user || user.isActive === false) {
      await dummyCompare();
      return res.status(401).json({ status: "error", code: "INVALID_CREDENTIALS", message: "Filial admin topilmadi yoki parol noto'g'ri" });
    }
    const ok = await comparePassword(password, user.password);
    if (!ok) {
      return res.status(401).json({ status: "error", code: "INVALID_CREDENTIALS" });
    }

    const branch = await branchesModel.findById(user.branch);
    if (!branch) {
      return res.status(404).json({ status: "error", code: "BRANCH_NOT_FOUND" });
    }

    const branchToken = signBranchToken(branch);
    branch.branchToken = await hashPassword(branchToken); // revoke nazorati uchun hash
    branch.tokenRevoked = false;
    await branch.save();

    await audit.log({
      kind: "pos_provisioned",
      restaurantId: branch.restaurant,
      branchId: branch._id,
      actor: { type: "user", id: String(user._id), role: user.role },
      message: `${branch.name} — ${user.name}`,
    });

    return res.status(200).json({
      status: "success",
      branchToken,
      branchId: String(branch._id),
      restaurantId: String(branch.restaurant),
      branchName: branch.name,
    });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

router.use(branchAuth);

// ===== Boshlang'ich sync — filial mirror =====
router.get("/bootstrap", async (req, res) => {
  try {
    const branchId = req.branch._id;
    const restaurantId = req.branch.restaurant;

    const [restaurant, branch, categories, foods, tables, services, discounts, users] = await Promise.all([
      restaurantsModel.findById(restaurantId),
      branchesModel.findById(branchId),
      categoryModel.find({ branch: branchId }),
      foodModel.find({ branch: branchId }),
      tableModel.find({ branch: branchId }),
      serviceModel.find({ branch: branchId }),
      discountModel.find({ branch: branchId }),
      // Local auth uchun parol hash kerak (POS local'da login qiladi, offline ham)
      usersModel.find({ branch: branchId }).select("+password +pin +managerPin"),
    ]);

    return res.status(200).json({
      status: "success",
      data: { restaurant, branch, categories, foods, tables, services, discounts, users, syncedAt: new Date() },
    });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ===== Pull — global'da O'ZGARGAN orderlar (cancel/tahrir) local'ga qaytadi =====
// Local sync-client har ~2s shu endpointni `ts`=oxirgi sync vaqti bilan chaqiradi.
// updatedAt > ts bo'lgan orderlar qaytadi → local POS real-time yangilanadi.
router.get("/orders-since", async (req, res) => {
  try {
    const branchId = req.branch._id;
    const ts = req.query.ts ? new Date(req.query.ts) : new Date(Date.now() - 24 * 3600 * 1000);
    const orders = await orderModel
      .find({ branch: branchId, updatedAt: { $gt: ts } })
      .sort({ updatedAt: 1 })
      .limit(500)
      .lean();
    return res.status(200).json({ status: "success", data: orders, syncedAt: new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ===== Pull — global'da O'ZGARGAN smenalar (admin yopdi/ochdi) local'ga qaytadi =====
router.get("/shifts-since", async (req, res) => {
  try {
    const branchId = req.branch._id;
    const ts = req.query.ts ? new Date(req.query.ts) : new Date(Date.now() - 24 * 3600 * 1000);
    const shifts = await shiftModel
      .find({ branch: branchId, updatedAt: { $gt: ts } })
      .sort({ updatedAt: 1 })
      .limit(200)
      .lean();
    return res.status(200).json({ status: "success", data: shifts, syncedAt: new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ===== Filial услуга% — POS Settings'dan kelgan o'zgarishni global'ga yozadi =====
// Local PUT /restaurant/settings shu endpointni chaqiradi. Aks holda bootstrap PULL
// local o'zgarishni (mas. 30) global'dagi eski qiymatga (10) qaytarib qo'yardi.
router.put("/service", async (req, res) => {
  try {
    const branchId = req.branch._id;
    const restaurantId = req.branch.restaurant;
    const enabled = req.body.serviceChargeEnabled === true;
    const pct = Math.max(0, Math.min(100, Number(req.body.serviceChargePercent) || 0));
    const value = enabled ? pct : 0;
    const wantId = req.body._id;

    let svc = null;
    if (wantId) {
      svc = await serviceModel.findById(wantId).catch(() => null);
      if (svc && String(svc.branch) !== String(branchId)) svc = null; // tenant guard
    }
    if (!svc) svc = await serviceModel.findOne({ branch: branchId });

    if (svc) {
      svc.servicePercent = value;
      svc.isActive = true;
      await svc.save();
    } else {
      svc = await serviceModel.create({
        ...(wantId ? { _id: wantId } : {}),
        branch: branchId,
        restaurantId,
        servicePercent: value,
        isActive: true,
        applyTo: ["dineIn"],
      });
    }
    return res.status(200).json({ status: "success", data: { _id: svc._id, serviceChargePercent: svc.servicePercent } });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ===== Push — local order/smena global'ga (upsert, bir xil _id) =====
router.post("/push", async (req, res) => {
  try {
    const branchId = String(req.branch._id);
    const { orders = [], shifts = [] } = req.body;

    const accepted = { orders: 0, shifts: 0, rejected: [] };

    // Smenalar avval (order shift'ga bog'liq)
    for (const s of shifts) {
      if (String(s.branch) !== branchId) {
        accepted.rejected.push({ type: "shift", id: s._id, reason: "TENANT_MISMATCH" });
        continue;
      }
      s.syncStatus = "synced"; // global qabul qildi — source of truth
      await shiftModel.bulkWrite([
        { replaceOne: { filter: { _id: s._id }, replacement: s, upsert: true } },
      ]);
      accepted.shifts++;
    }

    for (const o of orders) {
      if (String(o.branch) !== branchId) {
        accepted.rejected.push({ type: "order", id: o._id, reason: "TENANT_MISMATCH" });
        continue;
      }
      o.syncStatus = "synced";
      await orderModel.bulkWrite([
        { replaceOne: { filter: { _id: o._id }, replacement: o, upsert: true } },
      ]);
      accepted.orders++;
    }

    if (accepted.orders || accepted.shifts) {
      await audit.log({
        kind: "sync_push",
        restaurantId: req.branch.restaurant,
        branchId: req.branch._id,
        message: `orders: ${accepted.orders}, shifts: ${accepted.shifts}`,
      });
    }

    return res.status(200).json({ status: "success", accepted });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
