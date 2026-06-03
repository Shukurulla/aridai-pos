import mongoose from "mongoose";
import { syncMetaPlugin } from "../utils/sync-meta.plugin.js";

// Smena (obsidian/05-data-model/shift.md, biznes-mantiq/shift-lifecycle.md)
const shiftSchema = new mongoose.Schema(
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

    isActive: { type: Boolean, default: true, index: true },
    shiftNumber: { type: Number, default: 0 }, // kepket: filial bo'yicha ketma-ket
    openedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    openedAt: { type: Date, default: Date.now },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    closedAt: { type: Date },

    // Kassa nazorati (obsidian/.../firibgarlik-nazorati.md — discrepancy asosiy nazorat)
    openingCash: { type: Number, default: 0 },
    closingCash: { type: Number },
    closingDiscrepancy: { type: Number },

    // Hisoblangan jami (smena yopilganda)
    totals: {
      ordersCount: { type: Number, default: 0 },
      revenue: { type: Number, default: 0 },
      cashRevenue: { type: Number, default: 0 },
      cardRevenue: { type: Number, default: 0 },
      transferRevenue: { type: Number, default: 0 },
      kaspiRevenue: { type: Number, default: 0 },
      cashbackUsed: { type: Number, default: 0 },
      discountTotal: { type: Number, default: 0 },
      serviceTotal: { type: Number, default: 0 },
      cancelledOrders: { type: Number, default: 0 },
    },

    // Kassir almashishi (obsidian/07-nozik-nuqtalar/order-operatsion-edge.md)
    handovers: [
      {
        fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
        toUserId: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
        cashCount: Number,
        at: { type: Date, default: Date.now },
      },
    ],

    notes: { type: String },
  },
  { timestamps: true },
);

shiftSchema.plugin(syncMetaPlugin);

shiftSchema.index({ branch: 1, isActive: 1 });
shiftSchema.index({ branch: 1, openedAt: -1 });
shiftSchema.index({ restaurantId: 1, openedAt: -1 });

export default mongoose.model("shift", shiftSchema);
