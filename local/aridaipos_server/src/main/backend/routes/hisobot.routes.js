import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import orderModel from "../models/order.model.js";
import foodModel from "../models/food.model.js";
import serviceModel from "../models/service.model.js";
import shiftModel from "../models/shift.model.js";
import { itemLineAmount, effectiveQuantity } from "../utils/order-calc.js";

// To'liq hisobot (kepket FullReport) — POS "Отчёты" ekrani (obsidian
// hisobotlar-analitika.md). Smena (shiftId) yoki bugungi kun bo'yicha lokal
// orderlardan hisoblanadi — offline ham ishlaydi.
const router = express.Router();
router.use(authMiddleware);

const dayStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

router.get("/", async (req, res) => {
  try {
    const branch = req.userData.branch;
    const { shiftId } = req.query;

    const filter = { branch };
    if (shiftId) filter.shift = shiftId;
    else filter.createdAt = { $gte: dayStart() };

    const orders = await orderModel.find(filter);
    const live = orders.filter((o) => !o.isCancel);
    const paid = live.filter((o) => o.paymentStatus === "paid");

    // ===== Sotuvlar =====
    let foodRevenue = 0;
    let hourlyChargeRevenue = 0;
    for (const o of paid) {
      for (const f of o.foods || []) {
        if (effectiveQuantity(f) <= 0) continue;
        const amt = itemLineAmount(f);
        if (f.isHourly) hourlyChargeRevenue += amt;
        else foodRevenue += amt;
      }
    }
    const serviceRevenue = paid.reduce((s, o) => s + (o.service?.amount || 0), 0);
    const totalRevenue = paid.reduce((s, o) => s + (o.totalPrice || 0), 0);
    const totalChecks = paid.length;

    // ===== To'lov usullari (mixed split taqsimlanadi) =====
    const pm = {
      cash: { total: 0, count: 0, percentage: 0 },
      card: { total: 0, count: 0, percentage: 0 },
      click: { total: 0, count: 0, percentage: 0 },
      mixed: { count: 0 },
    };
    for (const o of paid) {
      const m = o.paymentMethod;
      const t = o.totalPrice || 0;
      if (m === "cash") { pm.cash.total += t; pm.cash.count++; }
      else if (m === "card") { pm.card.total += t; pm.card.count++; }
      else if (m === "transfer") { pm.click.total += t; pm.click.count++; }
      else if (m === "mixed") {
        pm.mixed.count++;
        pm.cash.total += o.mixed?.cash || 0;
        pm.card.total += o.mixed?.card || 0;
        pm.click.total += o.mixed?.transfer || 0;
      } else if (m === "cashback") {
        // keshbek — pul kassaga kirmaydi, usul taqsimotiga qo'shilmaydi
      } else { pm.cash.total += t; pm.cash.count++; }
    }
    const pmSum = pm.cash.total + pm.card.total + pm.click.total;
    if (pmSum > 0) {
      pm.cash.percentage = Math.round((pm.cash.total / pmSum) * 100);
      pm.card.percentage = Math.round((pm.card.total / pmSum) * 100);
      pm.click.percentage = Math.round((pm.click.total / pmSum) * 100);
    }

    // ===== Ofitsiantlar =====
    const svc = await serviceModel.findOne({ branch, isActive: true });
    const svcPct = svc?.servicePercent || 0;
    const wMap = new Map();
    for (const o of paid) {
      const id = String(o.waiter?.waiterId || o.waiter?.name || "—");
      const w = wMap.get(id) || {
        _id: id,
        name: o.waiter?.name || "Без официанта",
        totalOrders: 0,
        totalRevenue: 0,
        serviceRevenue: 0,
        cashRevenue: 0,
        cardRevenue: 0,
        salary: 0,
        averageCheck: 0,
      };
      w.totalOrders++;
      w.totalRevenue += o.totalPrice || 0;
      w.serviceRevenue += o.service?.amount || 0;
      if (o.paymentMethod === "cash") w.cashRevenue += o.totalPrice || 0;
      else if (o.paymentMethod === "card") w.cardRevenue += o.totalPrice || 0;
      else if (o.paymentMethod === "mixed") {
        w.cashRevenue += o.mixed?.cash || 0;
        w.cardRevenue += o.mixed?.card || 0;
      }
      wMap.set(id, w);
    }
    const waiters = [...wMap.values()].map((w) => ({
      ...w,
      // Ofitsiant haqi = услуга yig'indisi (kepket semantikasi)
      salary: w.serviceRevenue,
      averageCheck: w.totalOrders ? Math.round(w.totalRevenue / w.totalOrders) : 0,
    }));
    const totalWaiterSalary = waiters.reduce((s, w) => s + w.salary, 0);

    // ===== Taomlar + kategoriyalar =====
    const foodIds = new Set();
    for (const o of paid) for (const f of o.foods || []) if (f.foodId) foodIds.add(String(f.foodId));
    const foodDocs = foodIds.size
      ? await foodModel.find({ _id: { $in: [...foodIds] } }).select("category").populate("category", "title")
      : [];
    const catOf = new Map(foodDocs.map((f) => [String(f._id), f.category?.title || "Без категории"]));

    const fMap = new Map();
    for (const o of paid) {
      for (const f of o.foods || []) {
        const q = effectiveQuantity(f);
        if (q <= 0) continue;
        const id = String(f.foodId || f.foodName);
        const it = fMap.get(id) || {
          _id: id,
          name: f.foodName,
          categoryName: catOf.get(String(f.foodId)) || "Без категории",
          totalQuantity: 0,
          totalRevenue: 0,
          orderCount: 0,
          price: f.foodPrice || 0,
        };
        it.totalQuantity += q;
        it.totalRevenue += itemLineAmount(f);
        it.orderCount++;
        fMap.set(id, it);
      }
    }
    const foodItems = [...fMap.values()].sort((a, b) => b.totalQuantity - a.totalQuantity);

    const cMap = new Map();
    for (const it of foodItems) {
      const c = cMap.get(it.categoryName) || {
        _id: it.categoryName,
        name: it.categoryName,
        totalQuantity: 0,
        totalRevenue: 0,
        itemCount: 0,
        percentage: 0,
      };
      c.totalQuantity += it.totalQuantity;
      c.totalRevenue += it.totalRevenue;
      c.itemCount++;
      cMap.set(it.categoryName, c);
    }
    const catItems = [...cMap.values()].sort((a, b) => b.totalRevenue - a.totalRevenue);
    const catSum = catItems.reduce((s, c) => s + c.totalRevenue, 0);
    for (const c of catItems) c.percentage = catSum ? Math.round((c.totalRevenue / catSum) * 100) : 0;

    // ===== Soatlik yuklama =====
    const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, orderCount: 0, revenue: 0 }));
    for (const o of paid) {
      const h = new Date(o.createdAt).getHours();
      hourly[h].orderCount++;
      hourly[h].revenue += o.totalPrice || 0;
    }
    const maxOrders = Math.max(...hourly.map((x) => x.orderCount));
    const maxRevenue = Math.max(...hourly.map((x) => x.revenue));
    const peakHours = hourly.filter((x) => x.orderCount === maxOrders && maxOrders > 0).map((x) => x.hour);

    return res.json({
      success: true,
      data: {
        period: { type: shiftId ? "shift" : "today" },
        sales: {
          totalRevenue,
          foodRevenue,
          serviceRevenue,
          hourlyChargeRevenue,
          totalChecks,
          averageCheck: totalChecks ? Math.round(totalRevenue / totalChecks) : 0,
        },
        paymentMethods: pm,
        staff: { waiters, totalWaiterSalary, totalWaiters: waiters.length },
        foods: {
          items: foodItems,
          totalFoodTypes: foodItems.length,
          totalSold: foodItems.reduce((s, f) => s + f.totalQuantity, 0),
        },
        categories: { items: catItems, totalCategories: catItems.length },
        hourly: { data: hourly, peakHours, maxRevenue, maxOrders },
        profit: {
          netProfit: totalRevenue - totalWaiterSalary,
          totalRevenue,
          waiterSalary: totalWaiterSalary,
          waiterSalaryPercent: svcPct,
        },
      },
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: { message: e.message } });
  }
});

export default router;
