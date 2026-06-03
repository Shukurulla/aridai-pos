import mongoose from "mongoose";
import { syncMetaPlugin } from "../utils/sync-meta.plugin.js";

// Tizim admini — AridaiPos jamoasi (restoranlarni boshqaradi)
// obsidian/02-arxitektura/xavfsizlik/role-based-access.md
const systemAdminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    username: { type: String, required: true }, // login (username yoki email)
    password: { type: String, required: true, select: false }, // bcrypt hash
    tokenVersion: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    lastLoginIp: { type: String },
  },
  { timestamps: true },
);

systemAdminSchema.plugin(syncMetaPlugin);

systemAdminSchema.index(
  { username: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);

export default mongoose.model("system_admin", systemAdminSchema);
