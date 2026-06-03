// Mavjud tizim adminiga telefon + (ixtiyoriy) yangi parol o'rnatish.
// Ishlatish: node scripts/set-admin-phone.js [+phone] [password]
import mongoose from "mongoose";
import config from "../config/index.js";
import systemAdminModel from "../models/system_admin.model.js";
import { hashPassword } from "../utils/password.js";

const PHONE = process.argv[2] || "+77005000900";
const PASS = process.argv[3] || "admin12345";

async function run() {
  await mongoose.connect(config.mongoUrl);
  const admin = await systemAdminModel.findOne({});
  if (!admin) {
    console.log("⚠️  Tizim admini yo'q. Avval: node scripts/seed-system-admin.js");
    process.exit(1);
  }
  admin.phone = PHONE;
  admin.password = await hashPassword(PASS);
  await admin.save();
  console.log("✅ Tizim admini yangilandi:");
  console.log(`   telefon: ${PHONE}`);
  console.log(`   parol:   ${PASS}`);
  console.log(`   (eski username: ${admin.username || "—"})`);
  process.exit(0);
}

run().catch((e) => {
  console.error("❌ Xato:", e.message);
  process.exit(1);
});
