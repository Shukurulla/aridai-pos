// SKLAD service yadrosi — obsidian/04-toollar/sklad.md
// Order yaratilganda retsept (BOM) bo'yicha avtomatik kamayish, O1 oversell-blok,
// bekorda qaytarish. GLOBAL va LOCAL'da BIR XIL fayl (nusxa sync qilinadi).
//
// Movement = append-only event (delta imzoli). Balans $inc bilan o'zgaradi —
// local↔global sync'da movement bir marta qo'llanadi (_id idempotent) → additive.
import restaurantsModel from "../models/restaurants.model.js";
import foodModel from "../models/food.model.js";
import { ingredientModel, stockModel, stockMovementModel } from "../models/sklad.model.js";

// Restoran uchun sklad yoqilganmi + config (3 qatlam tekshiruvning service qatlami)
export async function skladConfig(restaurantId) {
  try {
    const r = await restaurantsModel.findById(restaurantId).select("features");
    const entry = r?.features?.get ? r.features.get("sklad") : r?.features?.["sklad"];
    if (!entry || !entry.enabled) return { enabled: false, config: {} };
    return {
      enabled: true,
      config: {
        autoDeductOnOrder: entry.config?.autoDeductOnOrder !== false,
        blockOrderIfOutOfStock: entry.config?.blockOrderIfOutOfStock !== false,
        ...entry.config,
      },
    };
  } catch {
    return { enabled: false, config: {} };
  }
}

// items: [{foodId, quantity}] → retseptlardan ingredient ehtiyoji (Map id→qty)
async function requiredIngredients(branch, items) {
  const ids = [...new Set((items || []).map((i) => String(i.foodId)).filter(Boolean))];
  if (!ids.length) return new Map();
  const foods = await foodModel.find({ _id: { $in: ids }, branch }).select("recipe name");
  const byId = new Map(foods.map((f) => [String(f._id), f]));
  const need = new Map(); // ingredientId → { qty, unit }
  for (const it of items || []) {
    const f = byId.get(String(it.foodId));
    if (!f || !Array.isArray(f.recipe)) continue;
    const q = Number(it.quantity) || 0;
    for (const r of f.recipe) {
      if (!r.ingredientId || !(r.quantity > 0)) continue;
      const key = String(r.ingredientId);
      const cur = need.get(key) || { qty: 0, unit: r.unit };
      cur.qty += r.quantity * q;
      need.set(key, cur);
    }
  }
  return need;
}

// O1 oversell tekshiruvi: yetishmasa { ok:false, missing:[{name, need, have, unit}] }
export async function checkStockAvailability(restaurantId, branch, items) {
  const { enabled, config } = await skladConfig(restaurantId);
  if (!enabled || !config.blockOrderIfOutOfStock) return { ok: true, missing: [] };
  const need = await requiredIngredients(branch, items);
  if (!need.size) return { ok: true, missing: [] };

  const ingIds = [...need.keys()];
  const [stocks, ings] = await Promise.all([
    stockModel.find({ branch, ingredientId: { $in: ingIds } }),
    ingredientModel.find({ _id: { $in: ingIds } }).select("name unit"),
  ]);
  const balById = new Map(stocks.map((s) => [String(s.ingredientId), s.balance || 0]));
  const ingById = new Map(ings.map((i) => [String(i._id), i]));

  const missing = [];
  for (const [id, n] of need) {
    const have = balById.get(id) || 0;
    if (have < n.qty) {
      const ing = ingById.get(id);
      missing.push({ name: ing?.name || "ingredient", need: n.qty, have, unit: ing?.unit || n.unit || "" });
    }
  }
  return { ok: missing.length === 0, missing };
}

// Movement'larni qo'llash: jurnal + balans $inc (stock yo'q bo'lsa upsert)
export async function applyMovements(docs) {
  for (const m of docs) {
    await stockMovementModel.create(m);
    await stockModel.updateOne(
      { branch: m.branch, ingredientId: m.ingredientId },
      {
        $inc: { balance: m.delta },
        $set: { lastMovementAt: new Date(), restaurantId: m.restaurantId, syncStatus: "pending" },
      },
      { upsert: true },
    );
  }
}

// Order taomlari uchun kamaytirish (chiqim). items: [{foodId, quantity}].
// fire-and-forget chaqiriladi — xato order oqimini BUZMAYDI (spec: flow buzilmaydi).
export async function deductForOrder(order, items, by) {
  try {
    const { enabled, config } = await skladConfig(order.restaurantId);
    if (!enabled || !config.autoDeductOnOrder) return;
    const need = await requiredIngredients(order.branch, items);
    if (!need.size) return;
    const docs = [...need.entries()].map(([ingredientId, n]) => ({
      branch: order.branch,
      restaurantId: order.restaurantId,
      ingredientId,
      direction: "out",
      delta: -n.qty,
      quantity: n.qty,
      unit: n.unit || null,
      reason: `order:${order._id}`,
      refOrderId: order._id,
      createdBy: by || null,
    }));
    await applyMovements(docs);
  } catch (e) {
    console.warn("[sklad] deduct xato:", e?.message);
  }
}

// Bekor/kamaytirishda qaytarish. items berilsa — shu taomlar uchun (retseptdan);
// items=null — BUTUN order: mavjud out-movement'larni kompensatsiya qiladi
// (retsept keyin o'zgargan bo'lsa ham aniq qaytadi).
export async function restoreForOrder(order, items, by) {
  try {
    const { enabled } = await skladConfig(order.restaurantId);
    if (!enabled) return;
    let docs = [];
    if (items === null) {
      const outs = await stockMovementModel.find({ refOrderId: order._id, direction: "out" });
      // Avval qaytarilganini ayirib tashlaymiz (ikki marta restore bo'lmasin)
      const backs = await stockMovementModel.find({ refOrderId: order._id, direction: "in", reason: `cancel:${order._id}` });

      // FALLBACK: bu tomonda OUT movement YO'Q (order BOSHQA tomonda yaratilgan —
      // masalan waiter/QR global'da, cancel esa POS'da). Retsept bo'yicha qaytaramiz:
      // 'in' movementlar push orqali global'ga boradi va u yerdagi 'out'larni
      // kompensatsiya qiladi. backs bo'lsa allaqachon qaytarilgan — qaytmaymiz.
      if (!outs.length && !backs.length) {
        const activeItems = (order.foods || [])
          .map((f) => {
            const c = Array.isArray(f.cancels) ? f.cancels : [];
            const inc = c.filter((x) => x.status === "inc").reduce((s, x) => s + x.changeVal, 0);
            const dec = c.filter((x) => x.status === "dec").reduce((s, x) => s + x.changeVal, 0);
            return { foodId: f.foodId, quantity: Math.max(0, (f.quantity || 0) + inc - dec) };
          })
          .filter((x) => x.quantity > 0);
        const need = await requiredIngredients(order.branch, activeItems);
        const fdocs = [...need.entries()].map(([ingredientId, n]) => ({
          branch: order.branch,
          restaurantId: order.restaurantId,
          ingredientId,
          direction: "in",
          delta: n.qty,
          quantity: n.qty,
          unit: n.unit || null,
          reason: `cancel:${order._id}`,
          refOrderId: order._id,
          createdBy: by || null,
        }));
        if (fdocs.length) await applyMovements(fdocs);
        return;
      }

      const restored = new Map();
      for (const b of backs) {
        const k = String(b.ingredientId);
        restored.set(k, (restored.get(k) || 0) + (b.delta || 0));
      }
      const byIng = new Map();
      for (const o of outs) {
        const k = String(o.ingredientId);
        byIng.set(k, (byIng.get(k) || 0) + -(o.delta || 0)); // chiqim miqdori (musbat)
      }
      docs = [...byIng.entries()]
        .map(([ingredientId, qty]) => ({ ingredientId, qty: qty - (restored.get(ingredientId) || 0) }))
        .filter((x) => x.qty > 0)
        .map((x) => ({
          branch: order.branch,
          restaurantId: order.restaurantId,
          ingredientId: x.ingredientId,
          direction: "in",
          delta: x.qty,
          quantity: x.qty,
          reason: `cancel:${order._id}`,
          refOrderId: order._id,
          createdBy: by || null,
        }));
    } else {
      const need = await requiredIngredients(order.branch, items);
      docs = [...need.entries()].map(([ingredientId, n]) => ({
        branch: order.branch,
        restaurantId: order.restaurantId,
        ingredientId,
        direction: "in",
        delta: n.qty,
        quantity: n.qty,
        unit: n.unit || null,
        reason: `cancel:${order._id}`,
        refOrderId: order._id,
        createdBy: by || null,
      }));
    }
    if (docs.length) await applyMovements(docs);
  } catch (e) {
    console.warn("[sklad] restore xato:", e?.message);
  }
}

// O1 xato javobi matni (POS/waiter alert'da ko'rinadi)
export function stockErrorMessage(missing) {
  const rows = (missing || [])
    .slice(0, 4)
    .map((m) => `${m.name}: нужно ${m.need}${m.unit ? " " + m.unit : ""}, есть ${m.have}`)
    .join("; ");
  return `Недостаточно продуктов на складе — ${rows}`;
}
