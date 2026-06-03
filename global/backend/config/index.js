import dotenv from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// .env backend root'da (config'dan bitta yuqori)
dotenv.config({ path: resolve(__dirname, "../.env") });

function required(name, fallback) {
  const v = process.env[name] ?? fallback;
  if (v === undefined) {
    throw new Error(`Muhit o'zgaruvchisi topilmadi: ${name}`);
  }
  return v;
}

export const config = {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 4322,

  mongoUrl: required("MONGO_URL"),

  jwt: {
    // userToken va ownerToken uchun
    secret: required("JWT_SECRET"),
    // branchToken (lokal backend ulanishi) uchun alohida — bo'lmasa JWT_SECRET'ga fallback
    branchSecret: process.env.BRANCH_SECRET || process.env.JWT_SECRET,
    userTokenTtl: process.env.USER_TOKEN_TTL || "7d",
    refreshTtl: process.env.REFRESH_TTL || "30d",
    branchTtl: process.env.BRANCH_TTL || "365d",
  },

  // uploads
  uploadsDir: resolve(__dirname, "../uploads"),

  isProd() {
    return this.env === "production";
  },
};

export default config;
