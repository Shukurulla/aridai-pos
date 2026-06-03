import mongoose from "mongoose";
import { syncMetaPlugin } from "../utils/sync-meta.plugin.js";
import { ORDER_TYPES } from "../config/constants.js";

const serviceSchema = new mongoose.Schema(
  {
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

    servicePercent: { type: Number, required: true, min: 0, max: 100 },
    isActive: { type: Boolean, default: true },
    // Qaysi order turlariga qo'llaniladi (obsidian/05-data-model/service.md)
    applyTo: { type: [String], enum: ORDER_TYPES, default: ["dineIn"] },
  },
  { timestamps: true },
);

serviceSchema.plugin(syncMetaPlugin);

serviceSchema.index({ branch: 1, isActive: 1 });
// restaurantId — field-level index:true (takroriy .index() olib tashlandi)

export default mongoose.model("service", serviceSchema);
