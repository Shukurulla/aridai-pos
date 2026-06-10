import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import { keshbekConfig, balanceViaGlobal, spendViaGlobal } from "../utils/keshbek.js";

// KESHBEK (LOCAL → POS) — spend/balance GLOBAL'ga proxy (2026-05-29 qaror:
// offline'da spend YO'Q — internet bo'lmasa aniq xato qaytadi, POS tugmani
// disabled ko'rsatadi).
const router = express.Router();
router.use(authMiddleware);

// POS: modul yoqiqmi (tugma ko'rsatish uchun) + foiz
router.get("/status", async (req, res) => {
  try {
    const { enabled, config } = await keshbekConfig(req.userData.restaurantId);
    return res.json({ success: true, data: { enabled, percent: config.percent || 0 } });
  } catch (e) {
    return res.json({ success: true, data: { enabled: false, percent: 0 } });
  }
});

router.get("/balance/:phone", async (req, res) => {
  try {
    const { enabled } = await keshbekConfig(req.userData.restaurantId);
    if (!enabled) return res.status(404).json({ success: false, error: { message: "Кешбэк выключен" } });
    const r = await balanceViaGlobal(req.params.phone);
    if (r.json?.status === "success") return res.json({ success: true, data: r.json.data });
    return res.status(r.httpStatus || 502).json({
      success: false,
      error: { message: r.json?.message || "Ошибка проверки баланса" },
    });
  } catch {
    // Offline — global'ga yetib bo'lmadi
    return res.status(503).json({
      success: false,
      error: { code: "KESHBEK_OFFLINE", message: "Кешбэк недоступен офлайн. Оплатите наличными или картой." },
    });
  }
});

router.post("/spend", async (req, res) => {
  try {
    const { enabled } = await keshbekConfig(req.userData.restaurantId);
    if (!enabled) return res.status(404).json({ success: false, error: { message: "Кешбэк выключен" } });
    const { phone, amount, orderId } = req.body || {};
    const r = await spendViaGlobal({ phone, amount, orderId });
    if (r.json?.status === "success") return res.json({ success: true, data: r.json.data });
    return res.status(r.httpStatus || 502).json({
      success: false,
      error: { message: r.json?.message || "Не удалось списать кешбэк" },
    });
  } catch {
    return res.status(503).json({
      success: false,
      error: { code: "KESHBEK_OFFLINE", message: "Кешбэк недоступен офлайн. Оплатите наличными или картой." },
    });
  }
});

export default router;
