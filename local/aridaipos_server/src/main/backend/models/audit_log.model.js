import mongoose from "mongoose";

// Audit log (obsidian/02-arxitektura/xavfsizlik/audit-log.md)
// DIQQAT: bu modelga syncMetaPlugin QO'SHILMAYDI (audit yozuvlari o'chirilmaydi/sync bo'lmaydi)
const auditLogSchema = new mongoose.Schema(
  {
    kind: { type: String, required: true, index: true },
    severity: {
      type: String,
      enum: ["info", "warn", "error", "critical"],
      default: "info",
      index: true,
    },

    actor: {
      type: { type: String }, // user | restaurant_owner | branch | system | anonymous
      id: { type: String },
      role: { type: String },
    },

    restaurantId: { type: mongoose.Schema.Types.ObjectId, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, index: true },

    message: { type: String },
    data: { type: mongoose.Schema.Types.Mixed },

    ip: { type: String },
    userAgent: { type: String },
    endpoint: { type: String },
    method: { type: String },

    ts: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false },
);

auditLogSchema.index({ kind: 1, ts: -1 });
auditLogSchema.index({ severity: 1, ts: -1 });
auditLogSchema.index({ restaurantId: 1, ts: -1 });

export default mongoose.model("audit_log", auditLogSchema);
