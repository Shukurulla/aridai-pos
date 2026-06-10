import mongoose from "mongoose";

// POSSIZ sessiya auditi — obsidian/02-arxitektura/rejimlar/possiz-rejim.md
// Admin possiz'ni yoqqanda ochiladi, o'chirganda yopiladi. Davr ichida yaratilgan
// orderlar/to'lovlar soni yozuvda qotiriladi — tizim admini keyin tekshiradi.
// v1 (Variant A, hujjatlashtirilgan): koordinator = GLOBAL VPS (mobil internet
// orqali) — alohida telefon-koordinator kerak emas, /place allaqachon global'da.
const possizSessionSchema = new mongoose.Schema(
  {
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "restaurant", required: true, index: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "branch", required: true, index: true },

    startedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    startedAt: { type: Date, required: true },
    endedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    endedAt: { type: Date, default: null },

    // Yopilganda hisoblanadi (davr ichidagi possiz orderlar)
    ordersCreated: { type: Number, default: 0 },
    paymentsAccepted: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
  },
  { timestamps: true },
);
possizSessionSchema.index({ branch: 1, startedAt: -1 });

export const possizSessionModel = mongoose.model("possiz_session", possizSessionSchema);
