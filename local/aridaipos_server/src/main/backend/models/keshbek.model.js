import mongoose from "mongoose";
import { syncMetaPlugin } from "../utils/sync-meta.plugin.js";

// KESHBEK — LOCAL'da FAQAT QR sessiya saqlanadi (chek QR + offline earn deferred).
// Balans/harakatlar GLOBAL'da (2026-05-29 qaror: offline spend YO'Q, double-spend
// xavfi). Sessiya append-only → sync push (insert-if-absent) bilan global'ga boradi.
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

export const cashbackQrSessionModel = mongoose.model("cashback_qr_session", cashbackQrSessionSchema);
