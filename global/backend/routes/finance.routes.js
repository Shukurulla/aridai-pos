import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import { tenantGuard } from "../middlewares/tenant.middleware.js";
import expenseModel from "../models/expense.model.js";
import advanceModel from "../models/advance.model.js";

// Расходы/Авансы (kassa harakati) — READ-ONLY (global hisobotlar uchun).
// Data POS'da yaratiladi, sync orqali global'ga keladi (sync.routes /push).
// Yozish global'da YO'Q — faqat o'qish (owner/admin hisobotlari).
// Tenant: authMiddleware + tenantGuard (params.branchId token bilan mos kelishi shart).
const router = express.Router();

router.get("/expenses/:branchId", authMiddleware, tenantGuard, async (req, res) => {
  try {
    const { branchId } = req.params;
    const list = await expenseModel.find({ branch: branchId }).sort({ createdAt: -1 }).limit(1000).lean();
    return res.status(200).json({ status: "success", data: list });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

router.get("/advances/:branchId", authMiddleware, tenantGuard, async (req, res) => {
  try {
    const { branchId } = req.params;
    const list = await advanceModel.find({ branch: branchId }).sort({ createdAt: -1 }).limit(1000).lean();
    return res.status(200).json({ status: "success", data: list });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
