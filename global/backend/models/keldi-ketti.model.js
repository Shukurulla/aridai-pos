import mongoose from "mongoose";

// KELDI-KETTI (davomat + maosh) — obsidian/04-toollar/keldi-ketti.md
// FAQAT GLOBAL (mobil xodim global'ga ulanadi; admin web ham global).
// v1 soddalashtirish (hujjatlashtirilgan): alohida schedule entity o'rniga
// kunlik jadval salary_rule.schedule ichida (har kun bir xil start/end).

// ---- Maosh qoidasi (har xodimga bitta aktiv) ----
const salaryRuleSchema = new mongoose.Schema(
  {
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "restaurant", required: true, index: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "branch", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },

    type: {
      type: String,
      enum: ["daily", "monthly", "perDish", "percentService", "fixedShift"],
      required: true,
    },
    // type'ga qarab:
    amount: { type: Number, default: 0 }, // daily (kun), monthly (oy), fixedShift (smena)
    percent: { type: Number, default: 0 }, // percentService — shu waiter orderlaridan %
    perDishMap: [
      // perDish (cook) — taom boshiga summa
      {
        foodId: { type: mongoose.Schema.Types.ObjectId, ref: "food", required: true },
        foodName: { type: String, default: null }, // snapshot (UI)
        amount: { type: Number, required: true, min: 0 },
      },
    ],

    // Kunlik jadval (kechikish hisobi uchun) — "10:00"/"22:00"; null = jadvalsiz
    schedule: {
      start: { type: String, default: null },
      end: { type: String, default: null },
    },
    lateGraceMinutes: { type: Number, default: 5 },
    penaltyPerMinute: { type: Number, default: 0 }, // 0 = shtraf yo'q

    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
salaryRuleSchema.index({ branch: 1, userId: 1, active: 1 });

// ---- Davomat (kun bo'yicha bitta yozuv) ----
const attendanceSchema = new mongoose.Schema(
  {
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "restaurant", required: true, index: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "branch", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    userName: { type: String, default: null }, // snapshot (hisobot UI)
    role: { type: String, default: null },

    date: { type: String, required: true }, // "YYYY-MM-DD" (filial mahalliy kuni)
    scheduledStart: { type: String, default: null },
    scheduledEnd: { type: String, default: null },
    arrivedAt: { type: Date, default: null },
    leftAt: { type: Date, default: null },

    isLate: { type: Boolean, default: false },
    lateMinutes: { type: Number, default: 0 },
    penalty: { type: Number, default: 0 },
    nightShift: { type: Boolean, default: false },

    source: { type: String, enum: ["mobile", "admin"], default: "mobile" }, // admin = qo'lda yozildi
    notes: { type: String, default: null },
  },
  { timestamps: true },
);
attendanceSchema.index({ branch: 1, date: 1 });
attendanceSchema.index({ userId: 1, date: 1 }, { unique: true }); // 1 xodim = 1 kun 1 yozuv

// ---- Payroll (davr xulosasi, qayta hisoblash idempotent) ----
const payrollSchema = new mongoose.Schema(
  {
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "restaurant", required: true, index: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "branch", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    userName: { type: String, default: null },
    role: { type: String, default: null },

    period: { type: String, required: true }, // "YYYY-MM"
    ruleType: { type: String, default: null },
    workedDays: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    breakdown: [
      {
        label: { type: String, required: true }, // "Кунлик (22 кун)" / "Сервис 6%" / "Штраф"
        amount: { type: Number, required: true },
      },
    ],
    calculatedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
  },
  { timestamps: true },
);
payrollSchema.index({ branch: 1, period: 1 });
payrollSchema.index({ userId: 1, period: 1 }, { unique: true }); // qayta hisob = yangilash

export const salaryRuleModel = mongoose.model("salary_rule", salaryRuleSchema);
export const attendanceModel = mongoose.model("attendance", attendanceSchema);
export const payrollModel = mongoose.model("payroll", payrollSchema);
