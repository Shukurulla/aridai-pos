import express from "express";
import branchesModel from "../models/branches.model.js";
import restoranMiddleware from "../middlewares/restoranAuth.middleware.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import { signBranchToken } from "../utils/token.js";
import { hashPassword } from "../utils/password.js";
import { audit } from "../utils/audit.js";

const router = express.Router();

// ===== Filial yaratish (owner) =====
router.post("/create", restoranMiddleware, async (req, res) => {
  try {
    const { name, address, receiptPrefix } = req.body;
    if (!name) return res.status(400).json({ status: "error", code: "NAME_REQUIRED" });

    const exists = await branchesModel.findOne({ name, restaurant: req.restoranData._id });
    if (exists) {
      return res.status(400).json({ status: "error", code: "ALREADY_EXISTS", message: "Bunday filial mavjud" });
    }

    const branch = await branchesModel.create({
      name,
      address,
      receiptPrefix: receiptPrefix?.toUpperCase().slice(0, 4),
      restaurant: req.restoranData._id,
    });

    await audit.log({ kind: "branch_created", restaurantId: req.restoranData._id, branchId: branch._id, message: name });
    return res.status(200).json({ status: "success", data: branch });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ===== POS uchun branchToken generatsiya (owner) — obsidian/.../auth-strategiyasi.md =====
router.post("/:id/token", restoranMiddleware, async (req, res) => {
  try {
    const branch = await branchesModel.findOne({ _id: req.params.id, restaurant: req.restoranData._id });
    if (!branch) return res.status(404).json({ status: "error", code: "BRANCH_NOT_FOUND" });

    const token = signBranchToken(branch);
    branch.branchToken = await hashPassword(token); // hash saqlanadi
    branch.tokenRevoked = false;
    await branch.save();

    await audit.log({ kind: "branch_token_issued", restaurantId: req.restoranData._id, branchId: branch._id });
    // Token FAQAT shu yerda ko'rsatiladi (qaytadan ko'rsatilmaydi)
    return res.status(200).json({ status: "success", branchToken: token });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ===== Owner o'z filiallari ro'yxati =====
router.get("/all", restoranMiddleware, async (req, res) => {
  try {
    const branches = await branchesModel.find({ restaurant: req.restoranData._id });
    return res.status(200).json({ status: "success", data: branches });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ===== Bitta filial (owner yoki shu filial user) =====
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const branch = await branchesModel.findById(req.params.id);
    if (!branch) return res.status(404).json({ status: "error", code: "BRANCH_NOT_FOUND" });
    if (String(branch.restaurant) !== String(req.userPayload.restaurantId)) {
      return res.status(403).json({ status: "error", code: "TENANT_BOUNDARY_VIOLATION" });
    }
    return res.status(200).json({ status: "success", data: branch });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ===== Filial yangilash (owner) =====
router.put("/:id", restoranMiddleware, async (req, res) => {
  try {
    const { name, address, receiptPrefix, workingHours, allowedIps, posServerIp } = req.body;
    const updateData = {};
    if (name) updateData.name = name;
    if (address !== undefined) updateData.address = address;
    if (receiptPrefix) updateData.receiptPrefix = receiptPrefix.toUpperCase().slice(0, 4);
    if (workingHours) updateData.workingHours = workingHours;
    if (allowedIps) updateData.allowedIps = allowedIps;
    if (posServerIp !== undefined) updateData.posServerIp = posServerIp;

    const branch = await branchesModel.findOneAndUpdate(
      { _id: req.params.id, restaurant: req.restoranData._id },
      updateData,
      { new: true },
    );
    if (!branch) return res.status(404).json({ status: "error", code: "BRANCH_NOT_FOUND" });
    return res.status(200).json({ status: "success", data: branch });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// ===== Filial soft delete (owner) =====
router.delete("/:id", restoranMiddleware, async (req, res) => {
  try {
    const branch = await branchesModel.findOne({ _id: req.params.id, restaurant: req.restoranData._id });
    if (!branch) return res.status(404).json({ status: "error", code: "BRANCH_NOT_FOUND" });

    await branchesModel.softDelete(req.params.id, null);
    await branchesModel.updateOne({ _id: req.params.id }, { tokenRevoked: true }, { includeDeleted: true });
    await audit.log({ kind: "branch_deleted", restaurantId: req.restoranData._id, branchId: req.params.id });
    return res.status(200).json({ status: "success", message: "Filial o'chirildi (soft delete)" });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
