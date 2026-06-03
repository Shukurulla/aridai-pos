import mongoose from "mongoose";
import { syncMetaPlugin } from "../utils/sync-meta.plugin.js";

// Rasxod/Prixod (Расходы/Приходы) — kassa harakati. Kepket Expense ko'chirildi.
const expenseSchema = new mongoose.Schema(
  {
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "branch", required: true, index: true },
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "restaurant", required: true, index: true },
    shift: { type: mongoose.Schema.Types.ObjectId, ref: "shift", default: null, index: true },

    type: { type: String, enum: ["expense", "income"], default: "expense", index: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "expense_category", default: null },
    categoryName: { type: String, default: null }, // snapshot

    description: { type: String, default: null },
    amount: { type: Number, required: true, min: 0 },
    paymentType: { type: String, enum: ["cash", "click"], default: "cash" },
    source: { type: String, default: "cashier" }, // cashier | admin

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    createdByName: { type: String, default: null }, // snapshot
  },
  { timestamps: true },
);

expenseSchema.plugin(syncMetaPlugin);
expenseSchema.index({ branch: 1, shift: 1, createdAt: -1 });
expenseSchema.index({ branch: 1, createdAt: -1 });

export default mongoose.model("expense", expenseSchema);
