import mongoose from "mongoose";
import { syncMetaPlugin } from "../utils/sync-meta.plugin.js";

const categorySchema = new mongoose.Schema(
  {
    title: { type: String, required: true },

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

    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    icon: { type: String },
    color: { type: String },
  },
  { timestamps: true },
);

categorySchema.plugin(syncMetaPlugin);

categorySchema.index({ branch: 1, sortOrder: 1, isActive: 1 });
categorySchema.index({ restaurantId: 1, branch: 1 });
categorySchema.index(
  { branch: 1, title: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);

export default mongoose.model("category", categorySchema);
