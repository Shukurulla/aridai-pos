import express from "express";
import usersModel from "../models/users.model.js";
import branchesModel from "../models/branches.model.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import restoranMiddleware from "../middlewares/restoranAuth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { tenantGuard, assertBranchInRestaurant } from "../middlewares/tenant.middleware.js";
import upload from "../middlewares/upload.middleware.js";
import { hashPassword, comparePassword, dummyCompare } from "../utils/password.js";
import { normalizePhone, countryFromCurrency } from "../utils/phone.js";
import { signUserToken, signRefreshToken } from "../utils/token.js";
import { audit } from "../utils/audit.js";
import { BRANCH_ROLES } from "../config/constants.js";

const router = express.Router();

// Xodim qo'shimcha maydonlari (maosh + cook taomlari) — JSON yoki multipart (string) ikkalasi.
//   salary: { mode, amount }  yoki  salaryMode + salaryAmount
//   assignedCategories / assignedFoods: massiv yoki JSON-string yoki "id,id"
const SALARY_MODES = ["none", "daily", "monthly", "percent"];
function parseStaffExtras(body) {
  const out = {};
  const mode = body?.salary?.mode ?? body?.salaryMode;
  const amount = body?.salary?.amount ?? body?.salaryAmount;
  if (mode !== undefined || amount !== undefined) {
    out.salary = {
      mode: SALARY_MODES.includes(mode) ? mode : "none",
      amount: Math.max(0, Number(amount) || 0),
    };
  }
  const parseIds = (v) => {
    if (v === undefined) return undefined;
    if (Array.isArray(v)) return v.filter(Boolean);
    if (typeof v === "string") {
      try {
        const a = JSON.parse(v);
        if (Array.isArray(a)) return a.filter(Boolean);
      } catch {
        return v.split(",").map((s) => s.trim()).filter(Boolean);
      }
    }
    return undefined;
  };
  const cats = parseIds(body?.assignedCategories);
  const foods = parseIds(body?.assignedFoods);
  if (cats !== undefined) out.assignedCategories = cats;
  if (foods !== undefined) out.assignedFoods = foods;
  return out;
}

// ===== Xodim yaratish (owner) — obsidian/.../role-based-access.md =====
router.post("/register", restoranMiddleware, upload.single("image"), async (req, res) => {
  try {
    const { name, phone, branch, role, password } = req.body;
    if (!name || !phone || !branch || !role || !password) {
      return res.status(400).json({ status: "error", code: "FIELDS_REQUIRED" });
    }
    if (!BRANCH_ROLES.includes(role)) {
      return res.status(400).json({ status: "error", code: "INVALID_ROLE", message: `role: ${BRANCH_ROLES.join("/")}` });
    }

    // Filial owner restoraniga tegishlimi?
    const check = await assertBranchInRestaurant(branch, req.restoranData._id);
    if (!check.ok) {
      return res.status(check.code === "BRANCH_NOT_FOUND" ? 404 : 403).json({ status: "error", code: check.code });
    }

    const normPhone = normalizePhone(phone, countryFromCurrency(req.restoranData.currency));
    const exists = await usersModel.findOne({ phone: normPhone });
    if (exists) {
      return res.status(400).json({ status: "error", code: "PHONE_TAKEN", message: "Bu telefon ro'yxatdan o'tgan" });
    }

    const user = await usersModel.create({
      name,
      phone: normPhone,
      branch,
      restaurantId: req.restoranData._id,
      role,
      image: req.file ? `/uploads/${req.file.filename}` : req.body.image,
      password: await hashPassword(password),
      ...parseStaffExtras(req.body), // maosh + cook taomlari
    });

    await audit.log({ kind: "user_created", restaurantId: req.restoranData._id, branchId: branch, message: `${role}: ${name}` });

    const data = user.toObject();
    delete data.password;
    return res.status(200).json({ status: "success", data });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ===== Filial admin: O'Z filialiga xodim qo'shish (waiter/cook/cashier) =====
// Owner emas, FILIAL ADMIN ham xodim qo'sha oladi (mobil app + filial_admin). branch_admin
// faqat o'z filialiga; owner/system_admin body.branch berishi mumkin.
router.post("/staff", authMiddleware, requireRole("branch_admin", "owner", "system_admin"), upload.single("image"), async (req, res) => {
  try {
    const { name, phone, password, role } = req.body;
    if (!name || !phone || !password || !role) {
      return res.status(400).json({ status: "error", code: "FIELDS_REQUIRED" });
    }
    if (!BRANCH_ROLES.includes(role)) {
      return res.status(400).json({ status: "error", code: "INVALID_ROLE", message: `role: ${BRANCH_ROLES.join("/")}` });
    }
    // branch_admin → faqat o'z filiali; owner/system_admin → body.branch ham bera oladi
    const branch = req.userData.role === "branch_admin" ? String(req.userData.branch) : req.body.branch || String(req.userData.branch);
    const restaurantId = req.userData.restaurantId;

    const normPhone = normalizePhone(phone);
    const exists = await usersModel.findOne({ phone: normPhone });
    if (exists) {
      return res.status(400).json({ status: "error", code: "PHONE_TAKEN", message: "Bu telefon ro'yxatdan o'tgan" });
    }

    const user = await usersModel.create({
      name,
      phone: normPhone,
      branch,
      restaurantId,
      role,
      image: req.file ? `/uploads/${req.file.filename}` : req.body.image,
      password: await hashPassword(password),
      ...parseStaffExtras(req.body), // maosh (waiter) + biriktirilgan taomlar (cook)
    });

    await audit.log({
      kind: "user_created",
      restaurantId,
      branchId: branch,
      actor: { type: "user", id: String(req.userData._id), role: req.userData.role },
      message: `${role}: ${name}`,
    });
    const data = user.toObject();
    delete data.password;
    return res.status(200).json({ status: "success", data });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ===== Xodim login (JWT) =====
router.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ status: "error", code: "CREDENTIALS_REQUIRED" });
    }

    const user = await usersModel.findOne({ phone: normalizePhone(phone) }).select("+password");
    if (!user || user.isActive === false) {
      await dummyCompare();
      return res.status(401).json({ status: "error", code: "INVALID_CREDENTIALS" });
    }

    const ok = await comparePassword(password, user.password);
    if (!ok) {
      await audit.log({ kind: "login_fail", restaurantId: user.restaurantId, branchId: user.branch, ip: req.ip });
      return res.status(401).json({ status: "error", code: "INVALID_CREDENTIALS" });
    }

    user.lastLoginAt = new Date();
    user.lastLoginIp = req.ip;
    await user.save();

    const token = signUserToken(user);
    const refreshToken = signRefreshToken({ kind: "user", id: user._id, tokenVersion: user.tokenVersion });

    await audit.log({ kind: "login_success", actor: { type: "user", id: String(user._id), role: user.role }, restaurantId: user.restaurantId, branchId: user.branch, ip: req.ip });

    const data = user.toObject();
    delete data.password;
    return res.status(200).json({ status: "success", data, token, refreshToken });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ============================================================
// OWNER-scoped xodim boshqaruvi (owner token / restoranMiddleware)
// Owner panel uchun — xodim ro'yxati/tahrir/o'chirish.
// (Xodim YARATISH allaqachon POST /register orqali, owner token bilan.)
// ============================================================

// ===== Owner: filial xodimlari ro'yxati =====
router.get("/owner/branch/:branchId", restoranMiddleware, async (req, res) => {
  try {
    const check = await assertBranchInRestaurant(req.params.branchId, req.restoranData._id);
    if (!check.ok) {
      return res.status(check.code === "BRANCH_NOT_FOUND" ? 404 : 403).json({ status: "error", code: check.code });
    }
    const users = await usersModel
      .find({ branch: req.params.branchId, restaurantId: req.restoranData._id })
      .select("-password -managerPin -pin")
      .sort({ createdAt: -1 });
    return res.status(200).json({ status: "success", data: users });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ===== Owner: xodim tahrirlash =====
router.put("/owner/:id", restoranMiddleware, upload.single("image"), async (req, res) => {
  try {
    const target = await usersModel.findById(req.params.id);
    if (!target) return res.status(404).json({ status: "error", code: "NOT_FOUND" });
    if (String(target.restaurantId) !== String(req.restoranData._id)) {
      return res.status(403).json({ status: "error", code: "TENANT_BOUNDARY_VIOLATION" });
    }

    const updateData = {};
    const { name, role, isActive } = req.body;
    if (name) updateData.name = name;
    if (role && BRANCH_ROLES.includes(role)) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive === true || isActive === "true";
    if (req.file) updateData.image = `/uploads/${req.file.filename}`;
    if (req.body.password) updateData.password = await hashPassword(req.body.password);
    Object.assign(updateData, parseStaffExtras(req.body)); // maosh + cook taomlari

    // Parol/role/isActive o'zgarsa — barcha tokenlar bekor (tokenVersion++)
    if (updateData.password || updateData.role || updateData.isActive === false) {
      updateData.$inc = { tokenVersion: 1 };
    }

    const user = await usersModel
      .findByIdAndUpdate(req.params.id, updateData, { new: true })
      .select("-password -managerPin -pin");

    await audit.log({ kind: "user_updated", restaurantId: req.restoranData._id, branchId: target.branch, actor: { type: "owner", id: String(req.restoranData._id), role: "owner" } });
    return res.status(200).json({ status: "success", data: user });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ===== Owner: xodim o'chirish (soft delete + tokenVersion++) =====
router.delete("/owner/:id", restoranMiddleware, async (req, res) => {
  try {
    const target = await usersModel.findById(req.params.id);
    if (!target) return res.status(404).json({ status: "error", code: "NOT_FOUND" });
    if (String(target.restaurantId) !== String(req.restoranData._id)) {
      return res.status(403).json({ status: "error", code: "TENANT_BOUNDARY_VIOLATION" });
    }

    await usersModel.softDelete(req.params.id, null);
    await usersModel.updateOne({ _id: req.params.id }, { $inc: { tokenVersion: 1 } }, { includeDeleted: true });
    await audit.log({ kind: "user_deleted", restaurantId: req.restoranData._id, branchId: target.branch, actor: { type: "owner", id: String(req.restoranData._id), role: "owner" } });
    return res.status(200).json({ status: "success", message: "Xodim o'chirildi (soft delete)" });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ===== Filial xodimlari ro'yxati =====
router.get("/all/:branchId", authMiddleware, tenantGuard, async (req, res) => {
  try {
    const users = await usersModel
      .find({ branch: req.params.branchId })
      .populate("branch")
      .select("-password -managerPin -pin");
    return res.status(200).json({ status: "success", data: users });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const user = await usersModel.findById(req.params.id).populate("branch").select("-password -managerPin -pin");
    if (!user) return res.status(404).json({ status: "error", code: "NOT_FOUND" });
    // Boshqa restoran user'ini ko'rsatmaslik
    if (String(user.restaurantId) !== String(req.userPayload.restaurantId)) {
      return res.status(403).json({ status: "error", code: "TENANT_BOUNDARY_VIOLATION" });
    }
    return res.status(200).json({ status: "success", data: user });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ===== Xodim yangilash (owner/branch_admin) =====
router.put(
  "/:id",
  authMiddleware,
  requireRole("owner", "branch_admin", "system_admin"),
  upload.single("image"),
  async (req, res) => {
    try {
      const target = await usersModel.findById(req.params.id);
      if (!target) return res.status(404).json({ status: "error", code: "NOT_FOUND" });
      if (String(target.restaurantId) !== String(req.userPayload.restaurantId)) {
        return res.status(403).json({ status: "error", code: "TENANT_BOUNDARY_VIOLATION" });
      }

      const updateData = {};
      const { name, role, isActive } = req.body;
      if (name) updateData.name = name;
      if (role && BRANCH_ROLES.includes(role)) updateData.role = role;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (req.file) updateData.image = `/uploads/${req.file.filename}`;
      if (req.body.password) updateData.password = await hashPassword(req.body.password);
      Object.assign(updateData, parseStaffExtras(req.body)); // maosh + cook taomlari

      // Parol/role/isActive o'zgarsa — barcha tokenlar bekor (tokenVersion++)
      if (updateData.password || updateData.role || updateData.isActive === false) {
        updateData.$inc = { tokenVersion: 1 };
      }

      const user = await usersModel
        .findByIdAndUpdate(req.params.id, updateData, { new: true })
        .select("-password -managerPin -pin");
      return res.status(200).json({ status: "success", data: user });
    } catch (error) {
      return res.status(500).json({ status: "error", message: error.message });
    }
  },
);

// ===== Xodim o'chirish (soft delete + tokenVersion++) =====
router.delete("/:id", authMiddleware, requireRole("owner", "branch_admin", "system_admin"), async (req, res) => {
  try {
    const target = await usersModel.findById(req.params.id);
    if (!target) return res.status(404).json({ status: "error", code: "NOT_FOUND" });
    if (String(target.restaurantId) !== String(req.userPayload.restaurantId)) {
      return res.status(403).json({ status: "error", code: "TENANT_BOUNDARY_VIOLATION" });
    }

    await usersModel.softDelete(req.params.id, req.userData._id);
    await usersModel.updateOne({ _id: req.params.id }, { $inc: { tokenVersion: 1 } }, { includeDeleted: true });
    await audit.log({ kind: "user_deleted", restaurantId: target.restaurantId, branchId: target.branch });

    return res.status(200).json({ status: "success", message: "Xodim o'chirildi (soft delete)" });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
