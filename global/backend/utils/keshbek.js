// KESHBEK service yadrosi — obsidian/04-toollar/keshbek-tizimi.md
// Balans FAQAT GLOBAL'da o'zgaradi (2026-05-29 qaror: offline spend YO'Q).
// Earn — QR sessiya (deferred): to'lovda sessiya yaratiladi, mijoz QR'ni
// skanerlab telefonini bot orqali yuborganda balans oshadi.
import crypto from "crypto";
import restaurantsModel from "../models/restaurants.model.js";
import orderModel from "../models/order.model.js";
import {
  cashbackBalanceModel,
  cashbackMovementModel,
  cashbackQrSessionModel,
} from "../models/keshbek.model.js";

// Toggle + config (registry defaultConfig: percent 5, minOrderAmount 1000)
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
        maxBalance: Number(entry.config?.maxBalance) || 0, // 0 = cheksiz
        qrSessionExpiryHours: Number(entry.config?.qrSessionExpiryHours) || 24,
        ...entry.config,
      },
    };
  } catch {
    return { enabled: false, config: {} };
  }
}

export const genQrToken = () => `KB_${crypto.randomBytes(12).toString("hex")}`;

// To'lov paytida earn-sessiya yaratish (GLOBAL'da to'langan orderlar uchun).
// LOCAL o'zi yaratadi (offline ham ishlasin) va sync push qiladi — bu funksiya
// faqat global to'lov yo'lida (pos.routes /pay) chaqiriladi. Fire-and-forget.
export async function createEarnSession(order) {
  try {
    const { enabled, config } = await keshbekConfig(order.restaurantId);
    if (!enabled) return null;
    const total = order.totalPrice || 0;
    if (config.minOrderAmount && total < config.minOrderAmount) return null;
    const existing = await cashbackQrSessionModel.findOne({ orderId: order._id });
    if (existing) return existing; // idempotent — 1 order = 1 sessiya
    const earnAmount = Math.round((total * config.percent) / 100);
    if (earnAmount <= 0) return null;
    const session = await cashbackQrSessionModel.create({
      restaurantId: order.restaurantId,
      branch: order.branch,
      orderId: order._id,
      checkAmount: total,
      earnAmount,
      qrToken: genQrToken(),
      status: "pending",
      expiresAt: new Date(Date.now() + (config.qrSessionExpiryHours || 24) * 3600 * 1000),
      syncStatus: "synced", // global'da yaratildi — push shart emas
    });
    return session;
  } catch (e) {
    console.warn("[keshbek] earn session xato:", e?.message);
    return null;
  }
}

// Bot phone capture: sessiya pending + muddati o'tmagan → balans += earn (atomik).
// Idempotent: findOneAndUpdate status pending → phone_captured (ikkinchi urinish ta'sirsiz).
export async function capturePhone(token, rawPhone) {
  const phone = String(rawPhone || "").replace(/[^\d+]/g, "");
  if (!phone || phone.length < 9) return { error: "INVALID_PHONE" };

  const session = await cashbackQrSessionModel.findOneAndUpdate(
    { qrToken: token, status: "pending", expiresAt: { $gt: new Date() } },
    { $set: { status: "phone_captured", capturedPhone: phone, capturedAt: new Date() } },
    { new: true },
  );
  if (!session) {
    const any = await cashbackQrSessionModel.findOne({ qrToken: token });
    if (!any) return { error: "NOT_FOUND" };
    if (any.status === "phone_captured") return { error: "ALREADY_CAPTURED" };
    return { error: "EXPIRED" };
  }

  // Qaytarilgan (refund) order cheki — earn YO'Q, sessiya expired
  const ord = await orderModel.findById(session.orderId).select("paymentStatus");
  if (ord && ord.paymentStatus === "refunded") {
    await cashbackQrSessionModel.updateOne({ _id: session._id }, { $set: { status: "expired", capturedPhone: null, capturedAt: null } });
    return { error: "EXPIRED" };
  }

  // Toggle O'CHIQ (capture paytida) — earn YO'Q. Sessiyani PENDING'ga qaytaramiz
  // (re-enable bo'lsa keyin yig'ilsin). Bu YAGONA gate — web POST ham, WhatsApp
  // webhook ham shu yerdan o'tadi ("OFF => earn yo'q" har bir kanalda kafolat).
  const { enabled, config } = await keshbekConfig(session.restaurantId);
  if (!enabled) {
    await cashbackQrSessionModel.updateOne({ _id: session._id }, { $set: { status: "pending", capturedPhone: null, capturedAt: null } });
    return { error: "FEATURE_DISABLED" };
  }
  const bal = await cashbackBalanceModel.findOneAndUpdate(
    { restaurantId: session.restaurantId, clientPhone: phone },
    {
      $inc: { balance: session.earnAmount, totalEarned: session.earnAmount },
      $set: { lastActivityAt: new Date() },
    },
    { upsert: true, new: true },
  );
  // maxBalance chegarasi (sodda: oshib ketgan qism kuyadi)
  if (config.maxBalance > 0 && bal.balance > config.maxBalance) {
    await cashbackBalanceModel.updateOne({ _id: bal._id }, { $set: { balance: config.maxBalance } });
    bal.balance = config.maxBalance;
  }
  await cashbackMovementModel.create({
    restaurantId: session.restaurantId,
    branch: session.branch,
    clientPhone: phone,
    direction: "earn",
    amount: session.earnAmount,
    refOrderId: session.orderId,
  });
  return { session, balance: bal.balance, earned: session.earnAmount };
}

// Spend — FAQAT ONLINE (global). Atomik dekrement: balance >= amount sharti bilan
// (double-spend yo'q — parallel so'rovlardan biri INSUFFICIENT oladi).
export async function spendCashback({ restaurantId, branch, phone, amount, orderId, by }) {
  const amt = Math.round(Number(amount) || 0);
  if (amt <= 0) return { error: "INVALID_AMOUNT" };
  // IDEMPOTENT: shu order uchun spend allaqachon bo'lgan (retry/timeout) —
  // balansni IKKINCHI marta kamaytirmaymiz, o'sha natijani qaytaramiz.
  if (orderId) {
    const dup = await cashbackMovementModel.findOne({ refOrderId: orderId, direction: "spend" });
    if (dup) {
      const cur = await cashbackBalanceModel.findOne({ restaurantId, clientPhone: dup.clientPhone });
      return { balance: cur?.balance || 0, spent: dup.amount, already: true };
    }
  }
  const bal = await cashbackBalanceModel.findOneAndUpdate(
    { restaurantId, clientPhone: phone, balance: { $gte: amt } },
    { $inc: { balance: -amt, totalSpent: amt }, $set: { lastActivityAt: new Date() } },
    { new: true },
  );
  if (!bal) return { error: "INSUFFICIENT" };
  await cashbackMovementModel.create({
    restaurantId,
    branch,
    clientPhone: phone,
    direction: "spend",
    amount: amt,
    refOrderId: orderId || null,
    createdBy: by || null,
  });
  return { balance: bal.balance, spent: amt };
}

// Vozvrat: (1) shu order uchun YECHILGAN keshbekni balansga qaytarish — IDEMPOTENT
// (reason:"refund" kompensatsiya movement bo'lsa qayta qaytarmaydi; capture-earn
// movement reason=null bo'lgani uchun chalkashmaydi); (2) pending earn QR sessiyani
// EXPIRED qilish (qaytarilgan chekdan keshbek yig'ilmasin).
export async function refundCashbackForOrder(restaurantId, orderId) {
  const out = { restoredSpend: 0, sessionVoided: false };
  try {
    const spend = await cashbackMovementModel.findOne({ refOrderId: orderId, direction: "spend" });
    if (spend) {
      const comp = await cashbackMovementModel.findOne({ refOrderId: orderId, direction: "earn", reason: "refund" });
      if (!comp) {
        await cashbackBalanceModel.updateOne(
          { restaurantId, clientPhone: spend.clientPhone },
          { $inc: { balance: spend.amount, totalSpent: -spend.amount }, $set: { lastActivityAt: new Date() } },
          { upsert: true },
        );
        await cashbackMovementModel.create({
          restaurantId,
          branch: spend.branch,
          clientPhone: spend.clientPhone,
          direction: "earn",
          amount: spend.amount,
          refOrderId: orderId,
          reason: "refund",
        });
        out.restoredSpend = spend.amount;
      }
    }
    const v = await cashbackQrSessionModel.updateOne(
      { orderId, status: "pending" },
      { $set: { status: "expired" } },
    );
    out.sessionVoided = v.modifiedCount > 0;
  } catch (e) {
    console.warn("[keshbek] refund revert xato:", e?.message);
  }
  return out;
}
