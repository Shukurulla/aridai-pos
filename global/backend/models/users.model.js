import mongoose from "mongoose";
import { syncMetaPlugin } from "../utils/sync-meta.plugin.js";
import { ROLE_LIST } from "../config/constants.js";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true }, // E.164 normalize (obsidian/07-nozik-nuqtalar/telefon-normalizatsiya.md)
    password: { type: String, required: true, select: false }, // bcrypt hash
    image: { type: String },

    // Multi-tenant (obsidian/02-arxitektura/xavfsizlik/tenant-izolyatsiyasi.md)
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

    // RBAC (obsidian/02-arxitektura/xavfsizlik/role-based-access.md)
    role: { type: String, enum: ROLE_LIST, required: true, index: true },

    // ===== Xodim maoshi (asosan waiter) — obsidian/.../xodim-maosh.md =====
    //   none    — maosh sozlanmagan
    //   daily   — kunlik fiks summa (amount)
    //   monthly — oylik fiks summa (amount)
    //   percent — o'zi qabul qilgan/yopgan orderlar summasidan % (amount)
    salary: {
      mode: { type: String, enum: ["none", "daily", "monthly", "percent"], default: "none" },
      amount: { type: Number, default: 0, min: 0 }, // daily/monthly: summa; percent: foiz (0–100)
    },

    // ===== Cook biriktirilgan taomlar — cook FAQAT shularni ko'radi/qabul qiladi =====
    // Bo'sh (ikkalasi ham) → cook barcha taomlarni ko'radi. To'ldirilgan → faqat shu
    // kategoriya yoki taomlar (kategoriya = qulay guruh, food = nuqtaviy qo'shimcha).
    assignedCategories: [{ type: mongoose.Schema.Types.ObjectId, ref: "category" }],
    assignedFoods: [{ type: mongoose.Schema.Types.ObjectId, ref: "food" }],

    // Auth
    tokenVersion: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true, index: true },
    lastLoginAt: { type: Date },
    lastLoginIp: { type: String },

    // Firibgarlik nazorati: manager tasdig'i PIN (obsidian/.../firibgarlik-nazorati.md)
    managerPin: { type: String, select: false, default: null }, // hash
    // Tezkor POS almashish PIN (obsidian/07-nozik-nuqtalar/order-operatsion-edge.md)
    pin: { type: String, select: false, default: null }, // hash
  },
  { timestamps: true },
);

userSchema.plugin(syncMetaPlugin);

// Telefon faqat o'chirilmagan userlar orasida unique (soft delete'dan keyin qayta ishlatish mumkin)
userSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
userSchema.index({ branch: 1, role: 1 });
userSchema.index({ restaurantId: 1, role: 1 });
userSchema.index({ restaurantId: 1, isActive: 1 });

export default mongoose.model("user", userSchema);
