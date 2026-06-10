import mongoose from "mongoose";
import { syncMetaPlugin } from "../utils/sync-meta.plugin.js";
import {
  ORDER_TYPES,
  PAYMENT_METHODS,
  PAYMENT_STATUS,
  COOKING_STATUS,
  ORDER_MODES,
  CANCEL_TYPES,
  CURRENCIES,
} from "../config/constants.js";

// Order — markaziy entity (obsidian/05-data-model/order.md)
const orderSchema = new mongoose.Schema(
  {
    // ===== Multi-tenant =====
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "branch", required: true, index: true },
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "restaurant", required: true, index: true },
    shift: { type: mongoose.Schema.Types.ObjectId, ref: "shift", required: true, index: true },

    // ===== Chek raqami (inson o'qiydigan) — obsidian/07-nozik-nuqtalar/chek-raqamlash.md =====
    receiptNumber: { type: String, required: true }, // PREFIX-YYYYMMDD-NNNN
    currency: { type: String, enum: CURRENCIES }, // restaurant.currency snapshot
    parentOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "order", default: null }, // split/keyin qo'shilgan

    orderType: { type: String, enum: ORDER_TYPES, required: true, index: true },

    // ===== Waiter (snapshot) — obsidian/05-data-model/snapshot-strategiyasi.md =====
    waiter: {
      waiterId: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
      name: { type: String, default: null },
      phone: { type: String, default: null },
    },

    // ===== Stol (dineIn) =====
    table: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "table",
      default: null,
      required: function () {
        return this.orderType === "dineIn";
      },
    },
    linkedTables: [{ type: mongoose.Schema.Types.ObjectId, ref: "table" }], // stol birlashtirish

    // ===== Service (snapshot) =====
    service: {
      serviceId: { type: mongoose.Schema.Types.ObjectId, ref: "service", default: null },
      percent: { type: Number, default: 0 },
      amount: { type: Number, default: 0 },
      waived: { type: Boolean, default: false },
      waivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
      waiveReason: { type: String, default: null },
    },

    // ===== Stol tarifi snapshot =====
    selectedTariff: {
      name: { type: String, default: null },
      price: { type: Number, default: 0 },
      chargeType: { type: String, default: null }, // hourly | fixed | daily
      duration: { type: Number },
      startedAt: { type: Date },
      totalAmount: { type: Number, default: 0 },
    },

    // ===== Taomlar =====
    foods: {
      type: [
        {
          foodId: { type: mongoose.Schema.Types.ObjectId, ref: "food", required: true },
          foodName: { type: String, required: true }, // snapshot
          foodPrice: { type: Number, required: true, min: 0 }, // snapshot
          quantity: { type: Number, required: true, min: 1 },
          note: { type: String, default: null }, // "piyozsiz", allergiya

          // miqdor o'zgarishlari (inc/dec) — obsidian/05-data-model/biznes-mantiq/cancel-refund.md
          cancels: [
            {
              status: { type: String, enum: ["inc", "dec"], required: true },
              changeVal: { type: Number, required: true, min: 1 },
              changeReason: { type: String, default: null },
              changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
              approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null }, // manager PIN
              changedAt: { type: Date, default: Date.now },
            },
          ],

          // Cook integratsiyasi
          cookingStatus: { type: String, enum: COOKING_STATUS, default: "waiting" },
          cookingStartedAt: { type: Date },
          readyAt: { type: Date },
          servedAt: { type: Date },
          cookId: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
        },
      ],
      validate: [
        { validator: (v) => Array.isArray(v) && v.length > 0, message: "Kamida bitta taom kerak" },
      ],
    },

    // ===== Chegirma (snapshot) =====
    discount: {
      discountId: { type: mongoose.Schema.Types.ObjectId, ref: "discount", default: null },
      title: { type: String, default: null },
      type: { type: String, default: null }, // percent | amount
      percent: { type: Number },
      amount: { type: Number },
    },
    discountAmount: { type: Number, default: 0, min: 0 },

    // ===== Hisoblar =====
    subTotal: { type: Number, default: 0, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },

    // ===== Cancel / Void =====
    isCancel: { type: Boolean, default: false, index: true },
    cancelType: { type: String, enum: CANCEL_TYPES, default: null }, // void | cancel
    cancelReason: { type: String, default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    cancelApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null }, // manager
    cancelledAt: { type: Date },

    // ===== Tolov =====
    paymentStatus: { type: String, enum: PAYMENT_STATUS, default: "pending", index: true },
    paymentMethod: { type: String, enum: [...PAYMENT_METHODS, null], default: null },
    paidAt: { type: Date },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },

    // ===== Vozvrat (refund) — to'langan orderni qaytarish =====
    refundedAt: { type: Date, default: null },
    refundedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    refundReason: { type: String, default: null },

    mixed: {
      cash: { type: Number, default: 0 },
      card: { type: Number, default: 0 },
      transfer: { type: Number, default: 0 },
      kaspi: { type: Number, default: 0 },
      cashback: { type: Number, default: 0 },
    },

    // Naqd qaytim (yaxlitlash YO'Q) — obsidian/07-nozik-nuqtalar/naqd-tolov-qaytim.md
    cashPayment: {
      givenAmount: { type: Number },
      changeAmount: { type: Number },
    },

    // Keshbek (toggle) — obsidian/04-toollar/keshbek-tizimi.md
    cashback: {
      earned: { type: Number, default: 0 },
      spent: { type: Number, default: 0 },
      clientPhone: { type: String, default: null },
    },

    // Kaspi (toggle) — obsidian/04-toollar/qr-pay-kaspi.md
    kaspi: {
      invoiceId: { type: String, default: null },
      qrType: { type: String, enum: ["static", "dynamic", null], default: null },
      paidAmount: { type: Number },
      paidAt: { type: Date },
      webhookReceivedAt: { type: Date },
    },

    // ===== Rejim / manba =====
    createdInMode: { type: String, enum: ORDER_MODES, default: "online" },
    checkPrinted: { type: Boolean, default: false },
    checkPdfUrl: { type: String, default: null },
    source: {
      type: String,
      enum: ["pos", "waiter_mobile", "qr", "admin", "possiz_mobile"],
      default: "pos",
    },
    qrOrderRequestId: { type: mongoose.Schema.Types.ObjectId, ref: "qr_order_request", default: null },

    // Possiz/offline idempotency — client tomonda yaratilgan UUID.
    // Outbox qayta-sync qilganda yoki submit timeout bo'lib aslida o'tib
    // ketganda DUBLIKAT order yaratilmasligi uchun (obsidian/.../possiz-rejim.md).
    clientId: { type: String, default: null },

    // Pre-bill / chek (obsidian/07-nozik-nuqtalar/pre-bill-chek-print.md)
    prebillPrintedAt: { type: Date },
    prebillPrintCount: { type: Number, default: 0 },
    printCount: { type: Number, default: 0 },

    // Счёт so'rovi — ofitsiant kassirdan chek so'raydi (mobil)
    checkRequest: {
      requested: { type: Boolean, default: false },
      at: { type: Date, default: null },
      byName: { type: String, default: null },
    },

    // Qo'shimcha
    note: { type: String, default: null },
    guestCount: { type: Number },

    // Fiskal (RESERVED — obsidian/07-nozik-nuqtalar/fiskal-soliq.md)
    fiscal: {
      enabled: { type: Boolean, default: false },
      fiscalNumber: { type: String, default: null },
      ofdStatus: { type: String, default: null },
      qqs: { rate: Number, amount: Number },
    },
  },
  { timestamps: true },
);

orderSchema.plugin(syncMetaPlugin);

// INDEXLAR (obsidian/05-data-model/index-strategiyasi.md)
orderSchema.index({ branch: 1, createdAt: -1 });
orderSchema.index({ branch: 1, shift: 1, createdAt: -1 });
orderSchema.index({ branch: 1, paymentStatus: 1 });
orderSchema.index({ branch: 1, table: 1, paymentStatus: 1 });
orderSchema.index({ branch: 1, isCancel: 1 });
orderSchema.index({ shift: 1, paymentStatus: 1 });
orderSchema.index({ "waiter.waiterId": 1, createdAt: -1 });
orderSchema.index({ restaurantId: 1, createdAt: -1 });
orderSchema.index({ branch: 1, receiptNumber: 1 }, { unique: true });
// Possiz/offline idempotency — faqat haqiqiy (string) clientId'lar unique
orderSchema.index(
  { branch: 1, clientId: 1 },
  { unique: true, partialFilterExpression: { clientId: { $type: "string" } } },
);
orderSchema.index({ "cashback.clientPhone": 1 }, { sparse: true });
orderSchema.index({ "kaspi.invoiceId": 1 }, { sparse: true });
orderSchema.index({ parentOrderId: 1 }, { sparse: true });

export default mongoose.model("order", orderSchema);
