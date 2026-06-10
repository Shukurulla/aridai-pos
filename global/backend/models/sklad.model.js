import mongoose from "mongoose";
import { syncMetaPlugin } from "../utils/sync-meta.plugin.js";

// ===== SKLAD (inventory) moduli modellari — obsidian/04-toollar/sklad.md =====
// Uch kolleksiya: ingredient (ma'lumotnoma), stock (joriy balans),
// stock_movement (APPEND-ONLY harakatlar jurnali).
//
// SYNC printsipi (offline additive, spec "Rejimlar ichida"): movement'lar
// o'zgarmas EVENT'lar — bir xil _id ikki marta qo'llanmaydi (idempotent),
// balans = movement deltalari yig'indisi → local↔global konfliktsiz qo'shiladi.

// ---- Ingredient (un, go'sht, ichimlik...) ----
const ingredientSchema = new mongoose.Schema(
  {
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "branch", required: true, index: true },
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "restaurant", required: true, index: true },
    name: { type: String, required: true },
    unit: { type: String, required: true, default: "kg" }, // kg | g | l | ml | dona
    category: { type: String, default: "asosiy" }, // asosiy | yordamchi | spice
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
ingredientSchema.plugin(syncMetaPlugin);
ingredientSchema.index({ branch: 1, name: 1 });

// ---- Stock (ingredient joriy balansi — movement'lardan hosilaviy) ----
const stockSchema = new mongoose.Schema(
  {
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "branch", required: true, index: true },
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "restaurant", required: true, index: true },
    ingredientId: { type: mongoose.Schema.Types.ObjectId, ref: "ingredient", required: true },
    balance: { type: Number, default: 0 }, // ingredient.unit birligida
    lowAlertThreshold: { type: Number, default: 10 },
    lastMovementAt: { type: Date, default: null },
  },
  { timestamps: true },
);
stockSchema.plugin(syncMetaPlugin);
stockSchema.index({ branch: 1, ingredientId: 1 }, { unique: true });

// ---- Stock movement (append-only jurnal) ----
const stockMovementSchema = new mongoose.Schema(
  {
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "branch", required: true, index: true },
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "restaurant", required: true, index: true },
    ingredientId: { type: mongoose.Schema.Types.ObjectId, ref: "ingredient", required: true },
    direction: { type: String, enum: ["in", "out", "adjustment"], required: true },
    // delta — balansga QO'SHILADIGAN imzoli qiymat (in:+, out:−, adjustment:±).
    // Idempotent qayta qo'llash uchun yagona haqiqat manbai shu.
    delta: { type: Number, required: true },
    quantity: { type: Number, required: true }, // |delta| (UI uchun)
    unit: { type: String, default: null },
    price: { type: Number, default: null }, // umumiy narx (in uchun)
    reason: { type: String, default: "manual" }, // order:{id} | manual | inventory | cancel:{id}
    refOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "order", default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    // Sync push'da ikki bosqich (create → $inc) atomik emas — applied flag bilan
    // yarim-qo'llangan movement keyingi push'da balansга yetkaziladi (#review-9).
    applied: { type: Boolean, default: true },
  },
  { timestamps: true },
);
stockMovementSchema.plugin(syncMetaPlugin);
stockMovementSchema.index({ branch: 1, createdAt: -1 });
stockMovementSchema.index({ branch: 1, ingredientId: 1, createdAt: -1 });

export const ingredientModel = mongoose.model("ingredient", ingredientSchema);
export const stockModel = mongoose.model("stock", stockSchema);
export const stockMovementModel = mongoose.model("stock_movement", stockMovementSchema);
