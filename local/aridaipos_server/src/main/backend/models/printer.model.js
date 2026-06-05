import mongoose from "mongoose";

// Lokal printer konfiguratsiyasi — shu PC'ga ulangan printerlar (kassa/kuxnya/bar).
// Faqat lokal (sync qilinmaydi) — har filial PC'sida o'z printerlari.
// device_name = OS'dagi printer nomi (getPrintersAsync'dan tanlanadi).
const printerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // ko'rinadigan nom ("Касса 1")
    device_name: { type: String, default: "" }, // OS printer nomi
    kind: { type: String, enum: ["cashier", "kitchen", "bar", "custom"], default: "cashier" },
    is_default: { type: Boolean, default: false },
    ip_address: { type: String, default: null }, // tarmoq printeri uchun (rezerv)
  },
  { timestamps: true },
);

export default mongoose.model("printer", printerSchema);
