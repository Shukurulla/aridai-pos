import express from "express";
import systemAdminModel from "../models/system_admin.model.js";
import restaurantsModel from "../models/restaurants.model.js";
import systemAuth from "../middlewares/systemAuth.middleware.js";
import upload from "../middlewares/upload.middleware.js";
import { hashPassword, comparePassword, dummyCompare } from "../utils/password.js";
import { normalizePhone, countryFromCurrency } from "../utils/phone.js";
import { signSystemToken } from "../utils/token.js";
import { buildDefaultFeatures } from "../features/registry.js";
import { audit } from "../utils/audit.js";
import { CURRENCIES, DEFAULT_TIMEZONE_BY_CURRENCY } from "../config/constants.js";

const router = express.Router();

const getOwnerData = (body) => {
  if (typeof body.owner === "string") {
    try { return JSON.parse(body.owner); } catch { return {}; }
  }
  return {
    ...(body.owner || {}),
    name: body.ownerName || body["owner.name"] || body.owner?.name,
    phone: body.ownerPhone || body["owner.phone"] || body.owner?.phone,
    password: body.ownerPassword || body["owner.password"] || body.owner?.password,
  };
};

// ===== Tizim admini login =====
router.post("/login", async (req, res) => {
  try {
    const { phone, username, password } = req.body;
    if ((!phone && !username) || !password) {
      return res.status(400).json({ status: "error", code: "CREDENTIALS_REQUIRED" });
    }
    // Telefon orqali (asosiy) yoki username orqali (eski, orqaga muvofiqlik)
    let admin;
    if (phone) {
      let normalized;
      try {
        normalized = normalizePhone(phone);
      } catch {
        normalized = String(phone).trim();
      }
      admin = await systemAdminModel.findOne({ phone: normalized }).select("+password");
    } else {
      admin = await systemAdminModel.findOne({ username }).select("+password");
    }
    if (!admin || admin.isActive === false) {
      await dummyCompare();
      return res.status(401).json({ status: "error", code: "INVALID_CREDENTIALS" });
    }
    const ok = await comparePassword(password, admin.password);
    if (!ok) {
      await audit.log({ kind: "system_login_fail", actor: { type: "system", id: String(admin._id) }, ip: req.ip });
      return res.status(401).json({ status: "error", code: "INVALID_CREDENTIALS" });
    }
    admin.lastLoginAt = new Date();
    admin.lastLoginIp = req.ip;
    await admin.save();

    const token = signSystemToken(admin);
    await audit.log({ kind: "system_login_success", actor: { type: "system", id: String(admin._id) }, ip: req.ip });

    const data = admin.toObject();
    delete data.password;
    return res.status(200).json({ status: "success", data, token });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// Quyidagi barcha endpointlar — faqat tizim admini
router.use(systemAuth);

// ===== Restoranlar ro'yxati (qidiruv + pagination) =====
router.get("/restaurants", async (req, res) => {
  try {
    const search = (req.query.search || "").trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);

    const q = {};
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      q.$or = [{ brand: rx }, { "owner.phone": rx }, { "owner.name": rx }];
    }

    const [items, total] = await Promise.all([
      restaurantsModel.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      restaurantsModel.countDocuments(q),
    ]);

    return res.status(200).json({ status: "success", data: items, total, page, limit });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ===== Restoran yaratish =====
router.post("/restaurants", upload.single("logo"), async (req, res) => {
  try {
    const { brand, logo, currency } = req.body;
    const owner = getOwnerData(req.body);

    if (!brand || (!req.file && !logo)) {
      return res.status(400).json({ status: "error", code: "BRAND_LOGO_REQUIRED" });
    }
    if (!owner.name || !owner.phone || !owner.password) {
      return res.status(400).json({ status: "error", code: "OWNER_REQUIRED" });
    }

    const cur = CURRENCIES.includes(currency) ? currency : "UZS";
    const phone = normalizePhone(owner.phone, countryFromCurrency(cur));

    const exists = await restaurantsModel.findOne({ "owner.phone": phone });
    if (exists) {
      return res.status(400).json({ status: "error", code: "ALREADY_EXISTS", message: "Bunday telefon bilan restoran mavjud" });
    }

    const restaurant = await restaurantsModel.create({
      brand,
      logo: req.file ? `/uploads/${req.file.filename}` : logo,
      currency: cur,
      timezone: DEFAULT_TIMEZONE_BY_CURRENCY[cur],
      features: buildDefaultFeatures(),
      createdBy: req.systemAdmin._id,
      owner: { name: owner.name, phone, password: await hashPassword(owner.password) },
    });

    await audit.log({
      kind: "restaurant_created",
      actor: { type: "system", id: String(req.systemAdmin._id) },
      restaurantId: restaurant._id,
      message: brand,
    });

    const data = restaurant.toObject();
    delete data.owner.password;
    return res.status(200).json({ status: "success", data });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ===== Bitta restoran =====
router.get("/restaurants/:id", async (req, res) => {
  try {
    const restaurant = await restaurantsModel.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ status: "error", code: "NOT_FOUND" });
    return res.status(200).json({ status: "success", data: restaurant });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ===== Restoran tahrirlash (currency immutable) =====
router.put("/restaurants/:id", upload.single("logo"), async (req, res) => {
  try {
    const { brand, timezone, businessDayStartHour, isActive } = req.body;
    const owner = getOwnerData(req.body);
    const updateData = {};

    if (brand) updateData.brand = brand;
    if (timezone) updateData.timezone = timezone;
    if (businessDayStartHour !== undefined) updateData.businessDayStartHour = Number(businessDayStartHour);
    if (isActive !== undefined) updateData.isActive = isActive === true || isActive === "true";
    if (req.file) updateData.logo = `/uploads/${req.file.filename}`;
    if (owner?.name) updateData["owner.name"] = owner.name;
    if (owner?.phone) updateData["owner.phone"] = normalizePhone(owner.phone);
    if (owner?.password) {
      updateData["owner.password"] = await hashPassword(owner.password);
      updateData.$inc = { tokenVersion: 1 }; // parol o'zgarsa eski tokenlar bekor
    }

    const restaurant = await restaurantsModel.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!restaurant) return res.status(404).json({ status: "error", code: "NOT_FOUND" });

    await audit.log({ kind: "restaurant_updated", actor: { type: "system", id: String(req.systemAdmin._id) }, restaurantId: restaurant._id });
    return res.status(200).json({ status: "success", data: restaurant });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ===== Restoran soft delete =====
router.delete("/restaurants/:id", async (req, res) => {
  try {
    const restaurant = await restaurantsModel.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ status: "error", code: "NOT_FOUND" });

    await restaurantsModel.softDelete(req.params.id, req.systemAdmin._id);
    await audit.log({ kind: "restaurant_deleted", actor: { type: "system", id: String(req.systemAdmin._id) }, restaurantId: req.params.id });
    return res.status(200).json({ status: "success", message: "Restoran o'chirildi (soft delete)" });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
