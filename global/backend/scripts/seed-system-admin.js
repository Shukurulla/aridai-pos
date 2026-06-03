// Birinchi tizim adminini yaratish (TELEFON bo'yicha login)
// Ishlatish: node scripts/seed-system-admin.js [+phone] [password] [name]
import mongoose from "mongoose";
import config from "../config/index.js";
import systemAdminModel from "../models/system_admin.model.js";
import { hashPassword } from "../utils/password.js";
import { normalizePhone } from "../utils/phone.js";

const phone = normalizePhone(process.argv[2] || "+77005000900");
const password = process.argv[3] || "admin12345";
const name = process.argv[4] || "Super Admin";

async function run() {
  await mongoose.connect(config.mongoUrl);
  const exists = await systemAdminModel.findOne({ phone });
  if (exists) {
    console.log(`⚠️  '${phone}' allaqachon mavjud. Hech narsa qilinmadi.`);
    process.exit(0);
  }
  await systemAdminModel.create({ name, phone, password: await hashPassword(password) });
  console.log("✅ Tizim admini yaratildi:");
  console.log(`   telefon: ${phone}`);
  console.log(`   parol:   ${password}`);
  console.log("   (parolni keyin almashtiring!)");
  process.exit(0);
}

run().catch((e) => {
  console.error("❌ Xato:", e.message);
  process.exit(1);
});
