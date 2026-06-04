import dotenv from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

// Local backend config — filial POS PC'da ishlaydi.
// Haqiqiy mahsulotda bu qiymatlar C:\ProgramData\AridaiPos\config\local.json dan keladi
// (installer kiritadi). Dev'da .env dan.
export const config = {
  env: process.env.NODE_ENV || "development",
  role: "local",

  // Local backend porti (POS renderer va LAN clientlar shu yerga ulanadi)
  port: Number(process.env.LOCAL_PORT) || 4561,

  // Lokal MongoDB — haqiqiy mahsulotda Windows Service (127.0.0.1:27017, faqat lokal)
  mongoUrl: process.env.LOCAL_MONGO_URL || "mongodb://127.0.0.1:27017/aridai_local",

  // Global VPS (sync uchun) — deploy qilingan production backend
  globalUrl: process.env.GLOBAL_URL || "https://api.asadbek-durdana.uz",

  // Filial identifikatsiyasi (installer/admin kiritadi)
  branchId: process.env.BRANCH_ID || null,
  branchToken: process.env.BRANCH_TOKEN || null,
  restaurantId: process.env.RESTAURANT_ID || null,

  // JWT — token verify uchun GLOBAL bilan BIR XIL secret bo'lishi shart
  jwt: {
    secret: process.env.JWT_SECRET || "dev_secret_change_me",
    branchSecret: process.env.BRANCH_SECRET || process.env.JWT_SECRET || "dev_secret_change_me",
    userTokenTtl: "7d",
    refreshTtl: "30d",
    branchTtl: "365d",
  },

  uploadsDir: resolve(__dirname, "../uploads"),
  isProd() {
    return this.env === "production";
  },
};

export default config;
