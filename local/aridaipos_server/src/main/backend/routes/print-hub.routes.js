import express from "express";
import printerModel from "../models/printer.model.js";
import printerLoginModel from "../models/printer_login.model.js";
import restaurantsModel from "../models/restaurants.model.js";
import localConfigModel from "../models/local_config.model.js";
import orderModel from "../models/order.model.js";
import { buildReceiptHtml, buildTestReceiptHtml, buildReportHtml } from "../../receipt-template.js";
import { printViaHook } from "../print-hook.js";
import QRCode from "qrcode";
import { cashbackQrSessionModel } from "../models/keshbek.model.js";
import { keshbekConfig, qrText } from "../utils/keshbek.js";

// Printer-hub HTTP API — POS monitor (aridaipos_monitor) shu yerga ulanadi
// (localhost:4561, /print/*, /printers, /health — auth YO'Q, lokal ishonchli).
// Haqiqiy print: printViaHook → main process (Electron: puppeteer→PDF→lp/pdf-to-printer).
const router = express.Router();

const PAY_LABEL = { cash: "Наличные", card: "Карта", transfer: "Перевод", click: "Перевод", mixed: "Смешанная", kaspi: "Kaspi" };

// Restoran BRENDI + valyutasi (chekda filial nomi emas, RESTORAN brendi chiqadi).
async function getRestaurant() {
  try {
    const [r, cfg] = await Promise.all([
      restaurantsModel.findOne().select("brand currency"),
      localConfigModel.findOne().select("logo logoEnabled"),
    ]);
    return {
      brand: r?.brand || "",
      currency: r?.currency || "UZS",
      logo: cfg?.logoEnabled !== false ? cfg?.logo || null : null,
    };
  } catch {
    return { brand: "", currency: "UZS", logo: null };
  }
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
    const { brand, currency, logo } = await getRestaurant();

    // Prichek (predchek) — to'lanmagan: to'lov turi YO'Q, pastda "ПРЕДВАРИТЕЛЬНЫЙ СЧЁТ".
    // To'lov cheki — order'dan to'lov turi/aralash split/status.
    const isPrecheck = b.docType === "precheck";
    let paymentLabel, mixedSplit, statusLabel;
    if (isPrecheck) {
      statusLabel = "ПРЕДВАРИТЕЛЬНЫЙ СЧЁТ";
    } else if (b.orderId) {
      const ord = await orderModel
        .findById(b.orderId)
        .select("paymentMethod mixed paymentStatus isCancel")
        .catch(() => null);
      if (ord) {
        if (ord.paymentMethod) paymentLabel = PAY_LABEL[ord.paymentMethod];
        if (ord.paymentMethod === "mixed" && ord.mixed) {
          mixedSplit = { cash: ord.mixed.cash, card: ord.mixed.card, transfer: ord.mixed.transfer };
        }
        if (ord.isCancel) statusLabel = "ОТМЕНЕНО";
        else if (ord.paymentStatus === "paid") statusLabel = "ОПЛАЧЕНО";
      }
    }
    if (!isPrecheck && !paymentLabel && b.paymentType) paymentLabel = PAY_LABEL[b.paymentType];

    const items = (b.items || []).map((it) => ({
      name: it.foodName,
      qty: it.quantity,
      price: it.price,
      lineTotal: (Number(it.price) || 0) * (Number(it.quantity) || 0),
    }));

    // KESHBEK QR — to'lov chekida (prichek emas). Sessiya to'lov payti yaratilgan
    // (offline ham). QR → WhatsApp bot → mijoz telefonini yuboradi → balans GLOBAL'da.
    let cashbackQr = null;
    if (!isPrecheck && b.orderId) {
      try {
        const sess = await cashbackQrSessionModel.findOne({ orderId: b.orderId });
        if (sess && sess.status === "pending" && sess.expiresAt > new Date()) {
          // Toggle YOQIQ bo'lsagina QR. O'chirilsa (eski pending sessiya qolsa ham)
          // chekda QR chiqmaydi (foydalanuvchi talabi). enabled — local mirror'dan.
          const { enabled, config: kcfg } = await keshbekConfig(sess.restaurantId);
          if (enabled) {
            const dataUrl = await QRCode.toDataURL(qrText(sess, kcfg), { margin: 1, width: 240 });
            cashbackQr = { dataUrl, earnAmount: sess.earnAmount };
          }
        }
      } catch (qe) {
        console.warn("[keshbek] chek QR xato:", qe?.message);
      }
    }

    const html = buildReceiptHtml({
      brand: brand || b.restaurantName || "AridaiPOS",
      logo,
      tableName: b.tableName,
      currency,
      receiptNumber: b.orderNumber,
      sellerName: b.waiterName,
      items,
      subtotal: Number(b.itemsTotal) || 0,
      discountTotal: Number(b.discount) || 0,
      discountPercent: Number(b.discountPercent) || 0,
      serviceAmount: Number(b.serviceFee) || 0,
      servicePercent: Number(b.serviceFeePercent ?? b.serviceChargePercent) || 0,
      total: Number(b.totalPrice) || 0,
      paymentLabel,
      mixedSplit,
      statusLabel,
      cashbackQr,
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
    const { brand, currency } = await getRestaurant();
    const html = buildTestReceiptHtml({ restaurantName: brand || b.restaurantName, currency });
    const r = await printViaHook(html, device);
    return res.json(r);
  } catch (e) {
    return res.json({ success: false, error: e.message });
  }
});

// ===== HISOBOT cheklari (POS "Отчёты") — buildReportHtml orqali real chop =====
// POS payload tuzadi (printer.ts strukturasi), server faqat render + print.
async function printReport(req, res, mapToSections) {
  try {
    const b = req.body || {};
    const device = await resolveDevice(b.printerName);
    if (!device) return res.json({ success: false, error: "Принтер не настроен." });
    const { sections, grandTotal, grandLabel } = mapToSections(b);
    const html = buildReportHtml({
      header: b.header || {},
      currency: b.currency || "",
      sections,
      grandTotal,
      grandLabel,
    });
    return res.json(await printViaHook(html, device));
  } catch (e) {
    return res.json({ success: false, error: e.message });
  }
}

const moneyRow = (label, n, cur, opts = {}) => ({ label, value: `${Number(n || 0).toLocaleString("ru-RU")}${cur ? " " + cur : ""}`, ...opts });

// Sotilgan taomlar (kategoriya bo'yicha)
router.post("/print/sold-foods", (req, res) =>
  printReport(req, res, (b) => ({
    sections: (b.categories || []).map((c) => ({
      title: c.name,
      rows: (c.items || []).map((i) => moneyRow(`${i.name} × ${i.qty}`, i.total, b.currency)),
      subtotal: c.subtotal,
    })),
    grandTotal: b.grandTotal,
  })),
);

// Kuxnyalar bo'yicha
router.post("/print/by-kitchen", (req, res) =>
  printReport(req, res, (b) => ({
    sections: (b.kitchens || []).map((k) => ({
      title: k.name,
      rows: (k.items || []).map((i) => moneyRow(`${i.name} × ${i.qty}`, i.total, b.currency)),
      subtotal: k.subtotal,
    })),
    grandTotal: b.grandTotal,
  })),
);

// Tushum (sections: rows amount+count yoki value)
router.post("/print/revenue", (req, res) =>
  printReport(req, res, (b) => ({
    sections: (b.sections || []).map((sec) => ({
      title: sec.title,
      rows: (sec.rows || []).map((r) =>
        r.value !== undefined
          ? { label: r.label, value: String(r.value) }
          : moneyRow(r.count != null ? `${r.label} (${r.count})` : r.label, r.amount, b.currency),
      ),
      subtotal: sec.subtotal,
    })),
    grandTotal: b.grandTotal,
  })),
);

// Otkazlar (bekor qilinganlar)
router.post("/print/cancelled", (req, res) =>
  printReport(req, res, (b) => ({
    sections: [
      {
        rows: (b.items || []).flatMap((i) => {
          const rows = [moneyRow(`${i.time} ${i.tableName} · ${i.foodName} × ${i.qty}`, i.total, b.currency)];
          const meta = [i.cancelledBy, i.reason].filter(Boolean).join(" — ");
          if (meta) rows.push({ label: meta, value: "", indent: true });
          return rows;
        }),
      },
      { rows: [{ label: "Позиций отменено", value: String(b.totalCount || 0), bold: true }] },
    ],
    grandTotal: b.grandTotal,
    grandLabel: "СУММА ОТКАЗОВ",
  })),
);

// Ofitsiantlar
router.post("/print/waiters", (req, res) =>
  printReport(req, res, (b) => ({
    sections: [
      {
        rows: (b.waiters || []).flatMap((w) => {
          const rows = [moneyRow(`${w.name} (${w.ordersCount})`, w.totalRevenue, b.currency, { bold: true })];
          if (w.averageCheck != null) rows.push(moneyRow("средний чек", w.averageCheck, b.currency, { indent: true }));
          return rows;
        }),
      },
    ],
    grandTotal: b.grandTotal,
  })),
);

// Akt sverki (act-real) — eng to'liq smena akti
router.post("/print/act-real", (req, res) =>
  printReport(req, res, (b) => {
    const cur = b.currency;
    const sections = [];
    if (b.shift?.from || b.shift?.to) {
      sections.push({ rows: [{ label: "Смена", value: `${b.shift.from || ""} — ${b.shift.to || ""}` }] });
    }
    if ((b.items || []).length) {
      sections.push({
        title: "Блюда",
        rows: b.items.map((i) => moneyRow(`${i.name} × ${i.qty}`, i.sum, cur)),
        subtotal: b.totals?.sum,
        subtotalLabel: `Итого (${b.totals?.qty || 0} шт)`,
      });
    }
    if (b.summary) {
      const sm = b.summary;
      sections.push({
        title: "Сводка",
        rows: [
          { label: "Чеков", value: String(sm.totalChecks || 0) },
          { label: "Позиций", value: String(sm.orderPositions || 0) },
          { label: "Отказы (чеков)", value: String(sm.refusalChecks || 0) },
          moneyRow("Сумма отказов", sm.refusalSum, cur),
          { label: "Гостей", value: String(sm.guests || 0) },
        ],
      });
    }
    if ((b.payments || []).length) {
      sections.push({
        title: "Оплаты",
        rows: b.payments.map((pp) => moneyRow(pp.name, pp.sum, cur)),
        subtotal: b.paymentsTotal,
      });
    }
    if ((b.staff || []).length) {
      sections.push({
        title: "Официанты",
        rows: b.staff.map((st) => moneyRow(`${st.name} (${st.count})`, st.sum, cur)),
      });
    }
    if ((b.subdivisions || []).length) {
      sections.push({
        title: "Подразделения",
        rows: b.subdivisions.map((sd) => moneyRow(`${sd.name} (${sd.count})`, sd.sum, cur)),
        subtotal: b.subTotal?.sum,
      });
    }
    if ((b.clients || []).length) {
      sections.push({
        title: "Клиенты",
        rows: b.clients.map((c) => moneyRow(`${c.name} (${c.checks})`, c.sum, cur)),
      });
    }
    return { sections, grandTotal: b.paymentsTotal ?? b.totals?.sum, grandLabel: "ИТОГО ПО СМЕНЕ" };
  }),
);

// Raw matn — kerak bo'lmadi (POS strukturali endpointlardan foydalanadi)
router.post("/print/raw", (req, res) => res.json({ success: true, skipped: true, note: "не используется" }));

export default router;
