import mongoose from "mongoose";

// Printerga biriktirilgan xodim logini — login ROLI nimani chop etishni belgilaydi:
//   povar (cook) → kuxnya cheki; kassir → to'lov cheki / hisobotlar.
// Lokal (sync qilinmaydi) — har PC o'z printer↔login bog'lanishlari.
const printerLoginSchema = new mongoose.Schema(
  {
    printer: { type: mongoose.Schema.Types.ObjectId, ref: "printer", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    phone: { type: String, default: "" },
    staff_name: { type: String, default: "" },
    role: { type: String, default: "" },
    // Povar uchun — qaysi kategoriya/taomlar shu printerga (JSON array string)
    category_ids: { type: String, default: "[]" },
    food_ids: { type: String, default: "[]" },
  },
  { timestamps: true },
);

export default mongoose.model("printer_login", printerLoginSchema);
