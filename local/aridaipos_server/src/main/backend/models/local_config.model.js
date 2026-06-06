import mongoose from "mongoose";

// Lokal qurilma konfiguratsiyasi (singleton) — provisioning natijasi shu yerda saqlanadi.
// Haqiqiy mahsulotda bu C:\ProgramData\AridaiPos\config\local.json ham bo'lishi mumkin,
// lekin lokal Mongo'da saqlash dev va restart uchun yetarli.
const localConfigSchema = new mongoose.Schema(
  {
    branchToken: { type: String, default: null },
    branchId: { type: String, default: null },
    restaurantId: { type: String, default: null },
    branchName: { type: String, default: null },
    provisionedAt: { type: Date, default: null },

    // Chek logotipi (base64 data URL) + yoqilgan/o'chirilgan
    logo: { type: String, default: null },
    logoEnabled: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model("local_config", localConfigSchema);
