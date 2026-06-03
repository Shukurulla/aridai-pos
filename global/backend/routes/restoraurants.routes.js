import express from "express";
import restaurantsModel from "../models/restaurants.model.js";
import upload from "../middlewares/upload.middleware.js";
import restoranMiddleware from "../middlewares/restoranAuth.middleware.js";
import { hashPassword, comparePassword, dummyCompare } from "../utils/password.js";
import { normalizePhone } from "../utils/phone.js";
import { signOwnerToken, signRefreshToken } from "../utils/token.js";
import { getFeature, validateEnable, validateDisable } from "../features/registry.js";
import { audit } from "../utils/audit.js";

const router = express.Router();

const getOwnerData = (body) => {
  if (typeof body.owner === "string") {
    try {
      return JSON.parse(body.owner);
    } catch {
      return {};
    }
  }
  return {
    ...(body.owner || {}),
    name: body.ownerName || body["owner.name"] || body["owner[name]"] || body.owner?.name,
    phone: body.ownerPhone || body["owner.phone"] || body["owner[phone]"] || body.owner?.phone,
    password:
      body.ownerPassword || body["owner.password"] || body["owner[password]"] || body.owner?.password,
  };
};

// Restoran YARATISH/O'CHIRISH — tizim admini qiladi: /api/system/restaurants
// (obsidian/08-frontend/web-admin.md). Bu fayl faqat OWNER-facing.

// ===== Restoran egasi login (JWT) — obsidian/.../restoran-auth-tuzatish.md =====
router.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ status: "error", code: "CREDENTIALS_REQUIRED" });
    }

    // owner.password select:false → endi aniq tanlaymiz
    const restaurant = await restaurantsModel
      .findOne({ "owner.phone": normalizePhone(phone) })
      .select("+owner.password");

    if (!restaurant) {
      await dummyCompare(); // timing attack oldini olish
      return res.status(401).json({ status: "error", code: "INVALID_CREDENTIALS" });
    }

    const ok = await comparePassword(password, restaurant.owner.password);
    if (!ok) {
      await audit.log({ kind: "restaurant_login_fail", restaurantId: restaurant._id, ip: req.ip });
      return res.status(401).json({ status: "error", code: "INVALID_CREDENTIALS" });
    }

    const ownerToken = signOwnerToken(restaurant);
    const refreshToken = signRefreshToken({
      kind: "restaurant",
      id: restaurant._id,
      tokenVersion: restaurant.tokenVersion,
    });

    await audit.log({ kind: "restaurant_login_success", restaurantId: restaurant._id, ip: req.ip });

    const data = restaurant.toObject();
    delete data.owner.password;
    return res.status(200).json({ status: "success", data, ownerToken, refreshToken });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ===== Feature toggle yoqish/o'chirish — obsidian/.../feature-toggle-tizimi.md =====
router.patch("/:id/features/:key", restoranMiddleware, async (req, res) => {
  try {
    const { id, key } = req.params;
    const { enabled, config } = req.body;

    // Faqat o'z restorani
    if (String(req.restoranData._id) !== String(id)) {
      return res.status(403).json({ status: "error", code: "TENANT_BOUNDARY_VIOLATION" });
    }

    const def = getFeature(key);
    if (!def) {
      return res.status(404).json({ status: "error", code: "UNKNOWN_FEATURE" });
    }

    const restaurant = req.restoranData;
    const current = Object.fromEntries(restaurant.features || new Map());

    if (enabled === true) {
      const v = validateEnable(key, current);
      if (!v.ok) return res.status(400).json({ status: "error", code: v.code, message: v.reason });
    } else if (enabled === false) {
      const v = validateDisable(key, current);
      if (!v.ok) {
        return res.status(409).json({ status: "error", code: v.code, message: v.reason, cascade: v.cascade });
      }
    }

    // Plain obyekt bilan ishlaymiz (mongoose subdoc ichki maydonlarini chiqarmaslik uchun)
    const existing = restaurant.features.get(key);
    const entry = existing
      ? (existing.toObject ? existing.toObject() : { ...existing })
      : { enabled: false, config: def.defaultConfig || {}, installedVersion: 0, enabledAt: null, disabledAt: null };

    if (enabled !== undefined) {
      entry.enabled = !!enabled;
      entry[enabled ? "enabledAt" : "disabledAt"] = new Date();
      if (enabled && !entry.installedVersion) entry.installedVersion = def.version;
    }
    if (config && typeof config === "object") {
      entry.config = { ...(entry.config || {}), ...config };
    }
    restaurant.features.set(key, entry);
    await restaurant.save();

    await audit.log({
      kind: "feature_toggle_changed",
      restaurantId: restaurant._id,
      message: `${key} → ${entry.enabled ? "ON" : "OFF"}`,
      actor: { type: "owner", id: String(restaurant._id), role: "owner" },
    });

    // TODO (Phase 3): def.onEnable/onDisable hook + lokal backendlarga broadcast

    return res.status(200).json({ status: "success", data: { key, ...entry } });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ===== Restoran ma'lumotini olish (owner) =====
router.get("/:id", restoranMiddleware, async (req, res) => {
  try {
    if (String(req.restoranData._id) !== String(req.params.id)) {
      return res.status(403).json({ status: "error", code: "TENANT_BOUNDARY_VIOLATION" });
    }
    return res.status(200).json({ status: "success", data: req.restoranData });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ===== Restoran ma'lumotini yangilash (owner) — currency immutable =====
router.put("/:id", restoranMiddleware, upload.single("logo"), async (req, res) => {
  try {
    if (String(req.restoranData._id) !== String(req.params.id)) {
      return res.status(403).json({ status: "error", code: "TENANT_BOUNDARY_VIOLATION" });
    }
    const { brand, timezone } = req.body;
    const owner = getOwnerData(req.body);
    const updateData = {};

    if (brand) updateData.brand = brand;
    if (timezone) updateData.timezone = timezone;
    if (req.file) updateData.logo = `/uploads/${req.file.filename}`;
    if (owner?.name) updateData["owner.name"] = owner.name;
    if (owner?.phone) updateData["owner.phone"] = normalizePhone(owner.phone);
    if (owner?.password) updateData["owner.password"] = await hashPassword(owner.password);
    // currency — immutable, o'zgartirilmaydi

    const restaurant = await restaurantsModel.findByIdAndUpdate(req.params.id, updateData, { new: true });
    return res.status(200).json({ status: "success", data: restaurant });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// Restoran o'chirish — tizim admini: DELETE /api/system/restaurants/:id

export default router;
