import mongoose from "mongoose";
import { syncMetaPlugin } from "../utils/sync-meta.plugin.js";
import { ORDER_TYPES } from "../config/constants.js";

const discountSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    discountPercent: { type: Number, min: 0, max: 100 },

    // Tur (obsidian/05-data-model/discount.md)
    type: { type: String, enum: ["percent", "amount"], default: "percent" },
    amount: { type: Number, min: 0 }, // type='amount' uchun

    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "branch",
      required: true,
      index: true,
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "restaurant",
      required: true,
      index: true,
    },

    // Shartlar (ixtiyoriy)
    conditions: {
      minOrderAmount: Number,
      applyTo: { type: [String], enum: ORDER_TYPES },
      validFrom: Date,
      validTo: Date,
      timeRange: { start: String, end: String },
      daysOfWeek: [Number],
    },

    // Promo (kelajak) — default null EMAS (partial unique index null'larni indekslamasligi uchun)
    promoCode: { type: String },
    usageLimit: { type: Number, default: null },
    usageCount: { type: Number, default: 0 },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

discountSchema.plugin(syncMetaPlugin);

discountSchema.index({ branch: 1, isActive: 1 });
// restaurantId — field-level index:true (takroriy .index() olib tashlandi)
discountSchema.index(
  { promoCode: 1 },
  { unique: true, partialFilterExpression: { promoCode: { $type: "string" } } },
);

export default mongoose.model("discount", discountSchema);
