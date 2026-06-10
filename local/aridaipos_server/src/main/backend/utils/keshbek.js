// KESHBEK (LOCAL) — obsidian/04-toollar/keshbek-tizimi.md + 2026-05-29 qaror.
// Earn: to'lovda QR sessiya LOCAL'da yaratiladi (offline ham) → sync push →
//   mijoz QR'ni keyin skanerlaydi → bot GLOBAL'da balansga qo'shadi (deferred).
// Spend: FAQAT ONLINE — global'ga proxy (balans local'da YO'Q).
import crypto from "crypto";
import config from "../config/index.js";
import restaurantsModel from "../models/restaurants.model.js";
import { cashbackQrSessionModel } from "../models/keshbek.model.js";

export async function keshbekConfig(restaurantId) {
  try {
    const r = await restaurantsModel.findById(restaurantId).select("features");
    const entry = r?.features?.get ? r.features.get("keshbek") : r?.features?.["keshbek"];
    if (!entry || !entry.enabled) return { enabled: false, config: {} };
    return {
      enabled: true,
      config: {
        percent: Number(entry.config?.percent) || 5,
        minOrderAmount: Number(entry.config?.minOrderAmount) || 0,
        qrSessionExpiryHours: Number(entry.config?.qrSessionExpiryHours) || 24,
        ...entry.config,
      },
    };
  } catch {
    return { enabled: false, config: {} };
  }
}

export const genQrToken = () => `KB_${crypto.randomBytes(12).toString("hex")}`;

// To'lovda earn-sessiya (LOCAL, syncStatus pending → push). Fire-and-forget.
export async function createEarnSession(order) {
  try {
    const { enabled, config: cfg } = await keshbekConfig(order.restaurantId);
    if (!enabled) return null;
    const total = order.totalPrice || 0;
    if (cfg.minOrderAmount && total < cfg.minOrderAmount) return null;
    const existing = await cashbackQrSessionModel.findOne({ orderId: order._id });
    if (existing) return existing; // idempotent — 1 order = 1 sessiya
    const earnAmount = Math.round((total * cfg.percent) / 100);
    if (earnAmount <= 0) return null;
    return await cashbackQrSessionModel.create({
      restaurantId: order.restaurantId,
      branch: order.branch,
      orderId: order._id,
      checkAmount: total,
      earnAmount,
      qrToken: genQrToken(),
      status: "pending",
      expiresAt: new Date(Date.now() + (cfg.qrSessionExpiryHours || 24) * 3600 * 1000),
    });
  } catch (e) {
    console.warn("[keshbek] earn session xato:", e?.message);
    return null;
  }
}

// Chekdagi QR matni: WhatsApp raqami sozlangan bo'lsa wa.me deep-link,
// aks holda global API havolasi (bot keyin shu token bilan ishlaydi).
export function qrText(session, cfg) {
  const num = String(cfg?.whatsappNumber || "").replace(/[^\d]/g, "");
  if (num) return `https://wa.me/${num}?text=${session.qrToken}`;
  const base = (cfg?.qrBaseUrl || config.globalUrl || "").replace(/\/+$/, "");
  return `${base}/api/keshbek/qr-session/${session.qrToken}`;
}

// ===== Global proxy (spend/balance — FAQAT ONLINE) =====
async function globalCall(method, path, body) {
  const res = await fetch(`${config.globalUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.branchToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { httpStatus: res.status, json };
}

export async function balanceViaGlobal(phone) {
  return globalCall("GET", `/api/keshbek/branch/balance/${encodeURIComponent(phone)}`);
}

export async function spendViaGlobal(payload) {
  return globalCall("POST", "/api/keshbek/branch/spend", payload);
}
