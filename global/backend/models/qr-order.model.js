import mongoose from "mongoose";

// QR ORDER so'rovi — obsidian/04-toollar/qr-order.md
// Mijoz stol QR'idan yuborgan TASDIQLANMAGAN buyurtma. Kassir approve qilsa
// haqiqiy order yaratiladi (source: "qr"), reject/expire bo'lsa yaratilmaydi.
// FAQAT GLOBAL (spec: offline'da QR order ishlamaydi — sodda boshlash).
const qrOrderRequestSchema = new mongoose.Schema(
  {
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "restaurant", required: true, index: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "branch", required: true, index: true },
    tableId: { type: mongoose.Schema.Types.ObjectId, ref: "table", required: true },
    qrSlug: { type: String, required: true },

    customer: {
      name: { type: String, default: null },
      phone: { type: String, default: null },
    },

    // Snapshot — narx so'rov paytidagi (approve paytida ham shu narx)
    items: [
      {
        foodId: { type: mongoose.Schema.Types.ObjectId, ref: "food", required: true },
        foodName: { type: String, required: true },
        foodPrice: { type: Number, required: true, min: 0 },
        quantity: { type: Number, required: true, min: 1 },
        note: { type: String, default: null },
      },
    ],

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "expired"],
      default: "pending",
      index: true,
    },
    rejectReason: { type: String, default: null },
    decidedAt: { type: Date, default: null },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    approvedOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "order", default: null },
    expiresAt: { type: Date, required: true }, // pending 5 daqiqadan keyin auto-expire (lazy)
  },
  { timestamps: true },
);
qrOrderRequestSchema.index({ branch: 1, status: 1, createdAt: -1 });

export const qrOrderRequestModel = mongoose.model("qr_order_request", qrOrderRequestSchema);
