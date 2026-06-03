import mongoose from "mongoose";
import { syncMetaPlugin } from "../utils/sync-meta.plugin.js";
import { ORDER_MODES } from "../config/constants.js";

const branchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    address: { type: String },

    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "restaurant",
      required: true,
      index: true,
    },

    // Chek raqami prefiksi (obsidian/07-nozik-nuqtalar/chek-raqamlash.md)
    receiptPrefix: { type: String, maxlength: 4, uppercase: true },

    // Lokal backend ulanishi (obsidian/02-arxitektura/xavfsizlik/auth-strategiyasi.md)
    branchToken: { type: String, select: false, default: null }, // bcrypt hash
    tokenVersion: { type: Number, default: 1 },
    tokenRevoked: { type: Boolean, default: false },
    allowedIps: { type: [String], default: [] },

    // Multi-POS (obsidian/02-arxitektura/multi-pos.md)
    posServerIp: { type: String, default: null }, // server POS LAN IP (client'lar uchun)

    // Hozirgi holat — lokal backend real-time yangilaydi (obsidian/02-arxitektura/3-rejim.md)
    currentMode: {
      type: String,
      enum: [...ORDER_MODES, "online_syncing", "possiz_returning", "unknown"],
      default: "unknown",
    },
    modeChangedAt: { type: Date },
    lastSyncedAt: { type: Date },
    outboxPending: { type: Number, default: 0 },
    lastHeartbeatAt: { type: Date },

    geo: {
      country: String,
      city: String,
      lat: Number,
      lng: Number,
    },
    workingHours: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

branchSchema.plugin(syncMetaPlugin);

branchSchema.index({ restaurant: 1, isDeleted: 1 });
branchSchema.index(
  { restaurant: 1, name: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
branchSchema.index({ currentMode: 1 });

export default mongoose.model("branch", branchSchema);
