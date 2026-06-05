import express from "express";
import printerModel from "../models/printer.model.js";
import printerLoginModel from "../models/printer_login.model.js";
import restaurantsModel from "../models/restaurants.model.js";
import orderModel from "../models/order.model.js";
import { buildReceiptHtml, buildTestReceiptHtml } from "../../receipt-template.js";
import { printViaHook } from "../print-hook.js";

// Printer-hub HTTP API — POS monitor (aridaipos_monitor) shu yerga ulanadi
// (localhost:4561, /print/*, /printers, /health — auth YO'Q, lokal ishonchli).
// Haqiqiy print: printViaHook → main process (Electron: puppeteer→PDF→lp/pdf-to-printer).
const router = express.Router();

const PAY_LABEL = { cash: "Наличные", card: "Карта", transfer: "Перевод", click: "Перевод", mixed: "Смешанная", kaspi: "Kaspi" };

async function getCurrency() {
  try {
    const r = await restaurantsModel.findOne().select("currency");
    if (r?.currency) return r.currency;
  } catch {
    /* ignore */
  }
  return "UZS";
}

// Chek qaysi printerga: body.printerName berilsa — o'sha; aks holda kassir
// roli bog'langan printer; aks holda default printer.
async function resolveDevice(printerName) {
  if (printerName) {
    const p = await printerModel.findOne({ $or: [{ name: printerName }, { device_name: printerName }] });
    return p?.device_name || printerName;
  }
  const login = await printerLoginModel.findOne({ role: { $in: ["cashier", "kassir"] } });
  if (login) {
    const p = await printerModel.findById(login.printer);
    if (p?.device_name) return p.device_name;
  }
  const def = (await printerModel.findOne({ is_default: true })) || (await printerModel.findOne());
  return def?.device_name || null;
}

// ===== Health (POS: checkConnection) =====
router.get("/health", (req, res) => res.json({ success: true, status: "ok", service: "aridai-print-hub" }));

// ===== Printerlar ro'yxati (saqlangan konfiguratsiya) =====
router.get("/printers", async (req, res) => {
  try {
    const list = await printerModel.find().sort({ createdAt: 1 });
    return res.json({
      success: true,
      data: list.map((p) => ({ name: p.device_name, displayName: p.name, kind: p.kind, isDefault: p.is_default })),
    });
  } catch (e) {
    return res.json({ success: false, error: e.message, data: [] });
  }
});

// ===== To'lov cheki (POS: printPayment, "Чек" tugma) =====
router.post("/print/payment", async (req, res) => {
  try {
    const b = req.body || {};
    const device = await resolveDevice(b.printerName);
    if (!device) {
      return res.json({ success: false, error: "Принтер не настроен. Привяжите логин кассира к принтеру в Local Server." });
    }
    const currency = await getCurrency();

    // To'lov turi — order'dan (POS full-pay'da paymentType yubormaydi)
    let paymentLabel;
    if (b.orderId) {
      const ord = await orderModel.findById(b.orderId).select("paymentMethod").catch(() => null);
      if (ord?.paymentMethod) paymentLabel = PAY_LABEL[ord.paymentMethod];
    }
    if (!paymentLabel && b.paymentType) paymentLabel = PAY_LABEL[b.paymentType];

    const items = (b.items || []).map((it) => ({
      name: it.foodName,
      qty: it.quantity,
      price: it.price,
      lineTotal: (Number(it.price) || 0) * (Number(it.quantity) || 0),
    }));

    const html = buildReceiptHtml({
      brand: b.restaurantName || "AridaiPOS",
      tableName: b.tableName,
      currency,
      receiptNumber: b.orderNumber,
      sellerName: b.waiterName,
      items,
      subtotal: Number(b.itemsTotal) || 0,
      discountTotal: Number(b.discount) || 0,
      discountPercent: Number(b.discountPercent) || 0,
      serviceAmount: Number(b.serviceFee) || 0,
      total: Number(b.totalPrice) || 0,
      paymentLabel,
      footer: "Спасибо за покупку!",
    });

    const r = await printViaHook(html, device);
    return res.json(r);
  } catch (e) {
    return res.json({ success: false, error: e.message });
  }
});

// ===== Test chek (POS: printTest) =====
router.post("/print/test", async (req, res) => {
  try {
    const b = req.body || {};
    const device = await resolveDevice(b.printerName);
    if (!device) return res.json({ success: false, error: "Принтер не настроен." });
    const currency = await getCurrency();
    const html = buildTestReceiptHtml({ restaurantName: b.restaurantName, currency });
    const r = await printViaHook(html, device);
    return res.json(r);
  } catch (e) {
    return res.json({ success: false, error: e.message });
  }
});

// ===== Kuxnya / hisobot cheklari — keyingi bosqich (hozircha no-op, xato bermaydi) =====
const soon = (req, res) => res.json({ success: true, skipped: true, note: "в разработке" });
router.post("/print/by-kitchen", soon);
router.post("/print/sold-foods", soon);
router.post("/print/revenue", soon);
router.post("/print/cancelled", soon);
router.post("/print/waiters", soon);
router.post("/print/act-real", soon);
router.post("/print/raw", soon);

export default router;
