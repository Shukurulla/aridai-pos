import mongoose from "mongoose";
import { syncMetaPlugin } from "../utils/sync-meta.plugin.js";

const tableSchema = new mongoose.Schema(
  {
    number: { type: Number, required: true },
    title: { type: String, required: true },
    type: { type: String, default: "normal" }, // normal, billiard, vip, ...

    // Tariflar (obsidian/05-data-model/table.md)
    tariffs: [
      {
        name: { type: String, required: true },
        price: { type: Number, required: true, min: 0 },
        chargeType: {
          type: String,
          enum: ["hourly", "fixed", "daily"],
          default: "fixed",
        },
        duration: { type: Number }, // hourly uchun (minut)
      },
    ],

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

    // QR Order (toggle) — obsidian/04-toollar/qr-order.md
    qrEnabled: { type: Boolean, default: false },
    qrSlug: { type: String }, // default null EMAS — partial unique index null'larni indekslamasligi uchun
    qrLastReset: { type: Date },

    position: {
      x: Number,
      y: Number,
      width: Number,
      height: Number,
    },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

tableSchema.plugin(syncMetaPlugin);

tableSchema.index(
  { branch: 1, number: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
tableSchema.index({ branch: 1, type: 1 });
tableSchema.index({ restaurantId: 1, branch: 1 });
// Faqat haqiqiy (string) qrSlug'lar unique — null/yo'q qiymatlar indekslanmaydi
tableSchema.index(
  { qrSlug: 1 },
  { unique: true, partialFilterExpression: { qrSlug: { $type: "string" } } },
);

export default mongoose.model("table", tableSchema);
