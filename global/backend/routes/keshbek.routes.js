import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import branchAuth from "../middlewares/branchAuth.middleware.js";
import { requireFeature } from "../features/middleware.js";
import { keshbekConfig, capturePhone, spendCashback } from "../utils/keshbek.js";
import {
  cashbackBalanceModel,
  cashbackMovementModel,
  cashbackQrSessionModel,
} from "../models/keshbek.model.js";
import { audit } from "../utils/audit.js";

// KESHBEK API — obsidian/04-toollar/keshbek-tizimi.md
// Uch xil kirish:
//  1) PUBLIC (bot)   — /qr-session/:token (read + phone capture). Auth YO'Q —
//     token o'zi maxfiy (24h short-lived). Toggle o'chiq → no-op (spec: orphan).
//  2) BRANCH (local) — /branch/* branchToken bilan: local server proxy (POS spend
//     FAQAT ONLINE — local o'zi balans saqlamaydi, 2026-05-29 qaror).
//  3) USER (admin)   — balanslar/harakatlar ro'yxati (filial_admin sahifa).
const router = express.Router();

const normPhone = (p) => String(p || "").replace(/[^\d+]/g, "");

// ===== 1) PUBLIC — WhatsApp bot =====
router.get("/qr-session/:token", async (req, res) => {
  try {
    const s = await cashbackQrSessionModel.findOne({ qrToken: req.params.token });
    if (!s) return res.status(404).json({ status: "error", code: "NOT_FOUND" });
    const { enabled } = await keshbekConfig(s.restaurantId);
    if (!enabled) return res.status(404).json({ status: "error", code: "FEATURE_DISABLED" });
    return res.json({
      status: "success",
      data: {
        checkAmount: s.checkAmount,
        earnAmount: s.earnAmount,
        status: s.expiresAt < new Date() && s.status === "pending" ? "expired" : s.status,
      },
    });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

router.post("/qr-session/:token/phone", async (req, res) => {
  try {
    const s = await cashbackQrSessionModel.findOne({ qrToken: req.params.token });
    if (!s) return res.status(404).json({ status: "error", code: "NOT_FOUND" });
    const { enabled } = await keshbekConfig(s.restaurantId);
    if (!enabled) return res.status(404).json({ status: "error", code: "FEATURE_DISABLED" });

    const r = await capturePhone(req.params.token, req.body?.phone);
    if (r.error) {
      const msg = {
        INVALID_PHONE: "Неверный номер телефона",
        ALREADY_CAPTURED: "Кешбэк по этому чеку уже начислен",
        EXPIRED: "Срок действия QR истёк",
        NOT_FOUND: "Чек не найден",
      }[r.error];
      return res.status(400).json({ status: "error", code: r.error, message: msg });
    }
    return res.json({ status: "success", data: { earned: r.earned, balance: r.balance } });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

// WhatsApp Cloud API webhook — keyingi bosqich (HMAC + bot oqimi). Hozircha
// verifikatsiya echo (Meta talabi) + xabarlar no-op qabul qilinadi.
router.get("/whatsapp/webhook", (req, res) => res.send(req.query["hub.challenge"] || "ok"));
router.post("/whatsapp/webhook", (req, res) => res.json({ status: "success" }));

// ===== 2) BRANCH (local server proxy — branchToken) =====
const branchRouter = express.Router();
branchRouter.use(branchAuth);

branchRouter.get("/balance/:phone", async (req, res) => {
  try {
    const restaurantId = req.branch.restaurant;
    const { enabled, config } = await keshbekConfig(restaurantId);
    if (!enabled) return res.status(404).json({ status: "error", code: "FEATURE_DISABLED" });
    const bal = await cashbackBalanceModel.findOne({ restaurantId, clientPhone: normPhone(req.params.phone) });
    return res.json({
      status: "success",
      data: { balance: bal?.balance || 0, percent: config.percent },
    });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

branchRouter.post("/spend", async (req, res) => {
  try {
    const restaurantId = req.branch.restaurant;
    const { enabled } = await keshbekConfig(restaurantId);
    if (!enabled) return res.status(404).json({ status: "error", code: "FEATURE_DISABLED" });
    const { phone, amount, orderId } = req.body || {};
    const r = await spendCashback({
      restaurantId,
      branch: req.branch._id,
      phone: normPhone(phone),
      amount,
      orderId,
    });
    if (r.error) {
      const msg = r.error === "INSUFFICIENT" ? "Недостаточно кешбэка на балансе" : "Неверная сумма";
      return res.status(400).json({ status: "error", code: r.error, message: msg });
    }
    await audit.log({ kind: "keshbek_spend", restaurantId, branchId: req.branch._id, message: `${normPhone(phone)}: -${r.spent}` });
    return res.json({ status: "success", data: r });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

router.use("/branch", branchRouter);

// ===== 3) USER (admin web) =====
const adminRouter = express.Router();
adminRouter.use(authMiddleware);
adminRouter.use(requireFeature("keshbek"));

// Balanslar ro'yxati (filial_admin "Кешбэк" sahifasi)
adminRouter.get("/balances", async (req, res) => {
  try {
    const list = await cashbackBalanceModel
      .find({ restaurantId: req.userData.restaurantId })
      .sort({ lastActivityAt: -1 })
      .limit(500);
    return res.json({ status: "success", data: list });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

adminRouter.get("/balance/:phone", async (req, res) => {
  try {
    const bal = await cashbackBalanceModel.findOne({
      restaurantId: req.userData.restaurantId,
      clientPhone: normPhone(req.params.phone),
    });
    return res.json({ status: "success", data: { balance: bal?.balance || 0 } });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

adminRouter.get("/movements/:phone", async (req, res) => {
  try {
    const list = await cashbackMovementModel
      .find({ restaurantId: req.userData.restaurantId, clientPhone: normPhone(req.params.phone) })
      .sort({ createdAt: -1 })
      .limit(100);
    return res.json({ status: "success", data: list });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

router.use("/", adminRouter);

export default router;
