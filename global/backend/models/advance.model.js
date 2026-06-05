import mongoose from "mongoose";
import { syncMetaPlugin } from "../utils/sync-meta.plugin.js";

// Avans (Авансы) — ofitsiantga berilgan avans (kassadan chiqim).
// Local POS'da yaratiladi (cashier), sync orqali global'ga keladi (mirror, bir xil _id).
// Local mirror: local/aridaipos_server/.../models/advance.model.js
const advanceSchema = new mongoose.Schema(
  {
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "branch", required: true, index: true },
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "restaurant", required: true, index: true },
    shift: { type: mongoose.Schema.Types.ObjectId, ref: "shift", default: null, index: true },

    waiterId: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    waiterName: { type: String, default: null }, // snapshot

    amount: { type: Number, required: true, min: 0 },
    description: { type: String, default: null },
    paymentType: { type: String, enum: ["cash", "click"], default: "cash" },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    createdByName: { type: String, default: null }, // snapshot
  },
  { timestamps: true },
);

advanceSchema.plugin(syncMetaPlugin);
advanceSchema.index({ branch: 1, shift: 1, createdAt: -1 });
advanceSchema.index({ branch: 1, createdAt: -1 });
advanceSchema.index({ restaurantId: 1, createdAt: -1 });

export default mongoose.model("advance", advanceSchema);
