import mongoose from "mongoose";
import { syncMetaPlugin } from "../utils/sync-meta.plugin.js";

// ===== KESHBEK moduli modellari — obsidian/04-toollar/keshbek-tizimi.md =====
// MUHIM (2026-05-29 qaror): balans RESTORAN bo'yicha umumiy va FAQAT GLOBAL'da
// saqlanadi/o'zgaradi. Offline'da spend YO'Q (double-spend xavfi) — local hech
// qachon balansga tegmaydi. Earn — QR sessiya orqali deferred (mijoz keyin
// skanerlaydi → bot global API'ga uradi → balans global'da oshadi).

// ---- Balans (restoran + telefon — unique) ----
const cashbackBalanceSchema = new mongoose.Schema(
  {
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "restaurant", required: true, index: true },
    clientPhone: { type: String, required: true },
    balance: { type: Number, default: 0, min: 0 },
    totalEarned: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    lastActivityAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
cashbackBalanceSchema.index({ restaurantId: 1, clientPhone: 1 }, { unique: true });

// ---- Harakatlar jurnali (earn/spend — audit iz) ----
const cashbackMovementSchema = new mongoose.Schema(
  {
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "restaurant", required: true, index: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "branch", default: null },
    clientPhone: { type: String, required: true, index: true },
    direction: { type: String, enum: ["earn", "spend"], required: true },
    amount: { type: Number, required: true, min: 0 },
    refOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "order", default: null },
    reason: { type: String, default: null }, // null=oddiy earn/spend; "refund"=vozvrat kompensatsiyasi
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
  },
  { timestamps: true },
);
cashbackMovementSchema.index({ restaurantId: 1, clientPhone: 1, createdAt: -1 });

// ---- QR sessiya (chekdagi QR → WhatsApp bot → phone capture) ----
// LOCAL'da ham yaratiladi (offline earn, deferred) va sync push bilan global'ga
// keladi (append-only, _id idempotent) — shuning uchun syncMetaPlugin bor.
const cashbackQrSessionSchema = new mongoose.Schema(
  {
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "restaurant", required: true, index: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "branch", required: true, index: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "order", required: true },
    checkAmount: { type: Number, required: true },
    earnAmount: { type: Number, required: true },
    qrToken: { type: String, required: true, unique: true },
    status: { type: String, enum: ["pending", "phone_captured", "expired"], default: "pending", index: true },
    capturedPhone: { type: String, default: null },
    capturedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);
cashbackQrSessionSchema.plugin(syncMetaPlugin);
cashbackQrSessionSchema.index({ branch: 1, orderId: 1 });

export const cashbackBalanceModel = mongoose.model("cashback_balance", cashbackBalanceSchema);
export const cashbackMovementModel = mongoose.model("cashback_movement", cashbackMovementSchema);
export const cashbackQrSessionModel = mongoose.model("cashback_qr_session", cashbackQrSessionSchema);
