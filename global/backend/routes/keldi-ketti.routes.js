import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { requireFeature } from "../features/middleware.js";
import usersModel from "../models/users.model.js";
import orderModel from "../models/order.model.js";
import { salaryRuleModel, attendanceModel, payrollModel } from "../models/keldi-ketti.model.js";
import { audit } from "../utils/audit.js";

// KELDI-KETTI (davomat + maosh) — obsidian/04-toollar/keldi-ketti.md
// Xodim mobil'dan "Keldim/Ketdim"; admin davomatni qo'lda ham yozadi (offline
// fallback — spec). Payroll: daily/monthly/fixedShift/percentService/perDish.
// requireFeature("keldiKetti") — toggle o'chiq bo'lsa butun API 404.
const router = express.Router();
router.use(authMiddleware);
router.use(requireFeature("keldiKetti"));

const ADMIN = ["branch_admin", "owner", "system_admin"];

// Filial mahalliy kuni "YYYY-MM-DD" (server TZ — filiallar bir TZ'da deb olamiz, v1)
const dayOf = (d = new Date()) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

// "HH:MM" → shu kunning Date'i
function timeOn(dateStr, hhmm) {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(`${dateStr}T00:00:00`);
  d.setHours(h, m, 0, 0);
  return d;
}

// Tungi smena: kelish 22:00 dan keyin yoki 06:00 dan oldin
const isNight = (d) => {
  const h = new Date(d).getHours();
  return h >= 22 || h < 6;
};

// ===== XODIM: keldim / ketdim / bugungi holat =====
router.post("/check-in", async (req, res) => {
  try {
    const u = req.userData;
    const date = dayOf();
    const existing = await attendanceModel.findOne({ userId: u._id, date });
    if (existing?.arrivedAt) {
      return res.status(400).json({ status: "error", code: "ALREADY_IN", message: "Вы уже отметились сегодня" });
    }

    const rule = await salaryRuleModel.findOne({ userId: u._id, active: true });
    const now = new Date();
    let isLate = false;
    let lateMinutes = 0;
    let penalty = 0;
    if (rule?.schedule?.start) {
      const sched = timeOn(date, rule.schedule.start);
      const grace = (rule.lateGraceMinutes ?? 5) * 60_000;
      if (sched && now.getTime() > sched.getTime() + grace) {
        isLate = true;
        lateMinutes = Math.round((now.getTime() - sched.getTime()) / 60_000);
        penalty = Math.max(0, lateMinutes - (rule.lateGraceMinutes ?? 5)) * (rule.penaltyPerMinute || 0);
      }
    }

    const att = await attendanceModel.findOneAndUpdate(
      { userId: u._id, date },
      {
        $set: {
          restaurantId: u.restaurantId,
          branch: u.branch,
          userName: u.name,
          role: u.role,
          scheduledStart: rule?.schedule?.start || null,
          scheduledEnd: rule?.schedule?.end || null,
          arrivedAt: now,
          isLate,
          lateMinutes,
          penalty,
          nightShift: isNight(now),
          source: "mobile",
        },
      },
      { upsert: true, new: true },
    );
    return res.json({ status: "success", data: att });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

router.post("/check-out", async (req, res) => {
  try {
    const date = dayOf();
    const att = await attendanceModel.findOne({ userId: req.userData._id, date });
    if (!att?.arrivedAt) {
      return res.status(400).json({ status: "error", code: "NOT_IN", message: "Сначала отметьте приход" });
    }
    if (att.leftAt) {
      return res.status(400).json({ status: "error", code: "ALREADY_OUT", message: "Вы уже отметили уход" });
    }
    att.leftAt = new Date();
    await att.save();
    return res.json({ status: "success", data: att });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

router.get("/me/today", async (req, res) => {
  try {
    const att = await attendanceModel.findOne({ userId: req.userData._id, date: dayOf() });
    return res.json({ status: "success", data: att || null });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

// ===== ADMIN: davomat ro'yxati + qo'lda yozish =====
router.get("/attendance", requireRole(...ADMIN), async (req, res) => {
  try {
    const branch = req.userData.branch;
    const filter = { branch };
    if (req.query.date) filter.date = String(req.query.date);
    else if (req.query.month) filter.date = { $regex: `^${String(req.query.month)}` }; // "YYYY-MM"
    else filter.date = dayOf();
    const list = await attendanceModel.find(filter).sort({ arrivedAt: 1 });
    return res.json({ status: "success", data: list });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

// Admin qo'lda keldi/ketdi (offline fallback — spec): body {userId, action: in|out}
router.post("/attendance/manual", requireRole(...ADMIN), async (req, res) => {
  try {
    const { userId, action } = req.body || {};
    const target = await usersModel.findOne({ _id: userId, branch: req.userData.branch });
    if (!target) return res.status(404).json({ status: "error", message: "Сотрудник не найден" });
    const date = dayOf();
    const now = new Date();
    if (action === "out") {
      const att = await attendanceModel.findOne({ userId, date });
      if (!att?.arrivedAt) return res.status(400).json({ status: "error", message: "Приход не отмечен" });
      att.leftAt = now;
      await att.save();
      return res.json({ status: "success", data: att });
    }
    const att = await attendanceModel.findOneAndUpdate(
      { userId, date },
      {
        $set: {
          restaurantId: target.restaurantId,
          branch: target.branch,
          userName: target.name,
          role: target.role,
          arrivedAt: now,
          nightShift: isNight(now),
          source: "admin",
        },
      },
      { upsert: true, new: true },
    );
    return res.json({ status: "success", data: att });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

// ===== ADMIN: maosh qoidalari =====
router.get("/salary-rules", requireRole(...ADMIN), async (req, res) => {
  try {
    const list = await salaryRuleModel.find({ branch: req.userData.branch, active: true });
    return res.json({ status: "success", data: list });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

// Upsert (har xodimga bitta aktiv qoida)
router.post("/salary-rules", requireRole(...ADMIN), async (req, res) => {
  try {
    const { userId, type, amount, percent, perDishMap, schedule, lateGraceMinutes, penaltyPerMinute } = req.body || {};
    const target = await usersModel.findOne({ _id: userId, branch: req.userData.branch });
    if (!target) return res.status(404).json({ status: "error", message: "Сотрудник не найден" });
    if (!["daily", "monthly", "perDish", "percentService", "fixedShift"].includes(type)) {
      return res.status(400).json({ status: "error", message: "Неверный тип оплаты" });
    }
    const rule = await salaryRuleModel.findOneAndUpdate(
      { userId, branch: req.userData.branch, active: true },
      {
        $set: {
          restaurantId: req.userData.restaurantId,
          type,
          amount: Math.max(0, Number(amount) || 0),
          percent: Math.max(0, Math.min(100, Number(percent) || 0)),
          perDishMap: Array.isArray(perDishMap)
            ? perDishMap
                .filter((p) => p.foodId && Number(p.amount) > 0)
                .map((p) => ({ foodId: p.foodId, foodName: p.foodName || null, amount: Number(p.amount) }))
            : [],
          schedule: { start: schedule?.start || null, end: schedule?.end || null },
          lateGraceMinutes: lateGraceMinutes == null ? 5 : Math.max(0, Number(lateGraceMinutes) || 0),
          penaltyPerMinute: Math.max(0, Number(penaltyPerMinute) || 0),
        },
      },
      { upsert: true, new: true },
    );
    return res.json({ status: "success", data: rule });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

// ===== ADMIN: payroll =====
// Hisoblash — IDEMPOTENT (qayta bosish yangilaydi). period: "YYYY-MM".
router.post("/payroll/calculate", requireRole(...ADMIN), async (req, res) => {
  try {
    const branch = req.userData.branch;
    const period = String(req.body?.period || "").trim();
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ status: "error", message: "period: YYYY-MM" });
    }
    const from = new Date(`${period}-01T00:00:00`);
    const to = new Date(from);
    to.setMonth(to.getMonth() + 1);

    const rules = await salaryRuleModel.find({ branch, active: true });
    const results = [];

    for (const rule of rules) {
      const user = await usersModel.findById(rule.userId).select("name role isActive");
      if (!user || user.isActive === false) continue;

      const atts = await attendanceModel.find({ userId: rule.userId, date: { $regex: `^${period}` } });
      const workedDays = atts.filter((a) => a.arrivedAt).length;
      const penaltyTotal = atts.reduce((s, a) => s + (a.penalty || 0), 0);

      const breakdown = [];
      let total = 0;

      if (rule.type === "daily") {
        const base = workedDays * (rule.amount || 0);
        breakdown.push({ label: `Дневная ставка × ${workedDays} дн.`, amount: base });
        total += base;
      } else if (rule.type === "monthly") {
        breakdown.push({ label: "Оклад (месяц)", amount: rule.amount || 0 });
        total += rule.amount || 0;
      } else if (rule.type === "fixedShift") {
        const nights = atts.filter((a) => a.arrivedAt && a.nightShift).length;
        const base = nights * (rule.amount || 0);
        breakdown.push({ label: `Ночная смена × ${nights}`, amount: base });
        total += base;
      } else if (rule.type === "percentService") {
        // Shu OYda TO'LANGAN, bekor qilinmagan, shu waiter'ning orderlari
        const orders = await orderModel
          .find({
            branch,
            "waiter.waiterId": rule.userId,
            paymentStatus: "paid",
            isCancel: { $ne: true },
            paidAt: { $gte: from, $lt: to },
          })
          .select("totalPrice");
        const revenue = orders.reduce((s, o) => s + (o.totalPrice || 0), 0);
        const base = Math.round((revenue * (rule.percent || 0)) / 100);
        breakdown.push({ label: `Сервис ${rule.percent}% (выручка ${revenue.toLocaleString("ru-RU")})`, amount: base });
        total += base;
      } else if (rule.type === "perDish") {
        // v1 (hujjatlashtirilgan): cook'ga biriktirish aniqlanmasa — sotilgan
        // (paid, bekor qilinmagan) taomlar soni bo'yicha (order.foods qty).
        const map = new Map((rule.perDishMap || []).map((p) => [String(p.foodId), p]));
        if (map.size) {
          const orders = await orderModel
            .find({ branch, paymentStatus: "paid", isCancel: { $ne: true }, paidAt: { $gte: from, $lt: to } })
            .select("foods.foodId foods.quantity foods.cancels");
          const counts = new Map();
          for (const o of orders) {
            for (const f of o.foods || []) {
              const key = String(f.foodId);
              if (!map.has(key)) continue;
              const c = Array.isArray(f.cancels) ? f.cancels : [];
              const inc = c.filter((x) => x.status === "inc").reduce((s, x) => s + x.changeVal, 0);
              const dec = c.filter((x) => x.status === "dec").reduce((s, x) => s + x.changeVal, 0);
              counts.set(key, (counts.get(key) || 0) + Math.max(0, (f.quantity || 0) + inc - dec));
            }
          }
          for (const [foodId, p] of map) {
            const n = counts.get(foodId) || 0;
            if (!n) continue;
            const base = n * p.amount;
            breakdown.push({ label: `${p.foodName || "Блюдо"} × ${n}`, amount: base });
            total += base;
          }
        }
      }

      if (penaltyTotal > 0) {
        breakdown.push({ label: "Штрафы за опоздания", amount: -penaltyTotal });
        total -= penaltyTotal;
      }
      total = Math.max(0, total);

      const doc = await payrollModel.findOneAndUpdate(
        { userId: rule.userId, period },
        {
          $set: {
            restaurantId: rule.restaurantId,
            branch,
            userName: user.name,
            role: user.role,
            ruleType: rule.type,
            workedDays,
            totalAmount: total,
            breakdown,
            calculatedAt: new Date(),
          },
        },
        { upsert: true, new: true },
      );
      results.push(doc);
    }

    await audit.log({ kind: "payroll_calculated", restaurantId: req.userData.restaurantId, branchId: branch, actor: { type: "user", id: String(req.userData._id), role: req.userData.role }, message: `${period}: ${results.length} xodim` });
    return res.json({ status: "success", data: results });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

router.get("/payroll/:period", requireRole(...ADMIN), async (req, res) => {
  try {
    const list = await payrollModel.find({ branch: req.userData.branch, period: req.params.period }).sort({ userName: 1 });
    return res.json({ status: "success", data: list });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

router.post("/payroll/:id/pay", requireRole(...ADMIN), async (req, res) => {
  try {
    const p = await payrollModel.findOne({ _id: req.params.id, branch: req.userData.branch });
    if (!p) return res.status(404).json({ status: "error", message: "Не найдено" });
    if (p.paidAt) return res.status(400).json({ status: "error", message: "Уже выплачено" });
    p.paidAt = new Date();
    p.paidBy = req.userData._id;
    await p.save();
    await audit.log({ kind: "payroll_paid", restaurantId: req.userData.restaurantId, branchId: p.branch, actor: { type: "user", id: String(req.userData._id), role: req.userData.role }, message: `${p.userName}: ${p.totalAmount} (${p.period})` });
    return res.json({ status: "success", data: p });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

export default router;
