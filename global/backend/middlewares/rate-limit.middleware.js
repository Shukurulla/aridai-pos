import rateLimit from "express-rate-limit";
import { audit } from "../utils/audit.js";

// obsidian/02-arxitektura/xavfsizlik/rate-limiting.md
// Phase 0: in-memory store. Phase 2 (multi-instance): Redis store.

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${req.body?.phone || "?"}`,
  handler: (req, res) => {
    audit.log({
      kind: "login_rate_limited",
      ip: req.ip,
      endpoint: req.path,
      data: { phone: req.body?.phone },
    });
    res.status(429).json({
      status: "error",
      code: "RATE_LIMITED",
      message: "Juda ko'p urinish. 15 daqiqadan keyin urinib ko'ring.",
    });
  },
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  // Bitta filialda bir nechta POS + waiter telefonlar + 2s sync (push/pull) bitta
  // IP ortidan ko'p so'rov yuboradi → cheklov yuqori (testing + multi-POS uchun).
  max: (req) => (req.method === "GET" ? 5000 : 2000),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userData?._id?.toString() || req.ip,
  handler: (req, res) =>
    res.status(429).json({ status: "error", code: "RATE_LIMITED" }),
});
