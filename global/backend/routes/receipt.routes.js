import express from "express";
import crypto from "crypto";
import QRCode from "qrcode";
import config from "../config/index.js";
import orderModel from "../models/order.model.js";
import restaurantsModel from "../models/restaurants.model.js";
import branchesModel from "../models/branches.model.js";
import tableModel from "../models/table.model.js";
import { cashbackQrSessionModel } from "../models/keshbek.model.js";
import { keshbekConfig } from "../utils/keshbek.js";

// ELEKTRON CHEK sahifasi — possiz-rejim.md "PDF check generatsiya" o'rnida v1:
// server-rendered HTML chek (telefon brauzerida ochiladi, mijozga ko'rsatiladi /
// havola ulashiladi). Imzo (HMAC) bilan — orderId'ni taxminlash yetarli emas.
// Possiz orderda "Выдан в режиме POSSIZ" belgisi (spec: rasmiyatni belgilash).
export const receiptSig = (orderId) =>
  crypto.createHmac("sha256", config.jwt.secret).update(String(orderId)).digest("hex").slice(0, 16);

export const receiptUrl = (orderId, base) =>
  `${String(base || "").replace(/\/+$/, "")}/receipt/${orderId}/${receiptSig(orderId)}`;

const CUR = (c) => ({ KZT: "₸", UZS: "сум", RUB: "₽", USD: "$" }[String(c || "").toUpperCase()] || c || "");
const fmt = (n) => Number(n || 0).toLocaleString("ru-RU");
const esc = (s) => String(s ?? "").replace(/[<>&]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[ch]));
const PAY_RU = { cash: "Наличные", card: "Карта", transfer: "Перевод", kaspi: "Kaspi", mixed: "Смешанная", cashback: "Кешбэк" };

const effQty = (f) => {
  const c = Array.isArray(f.cancels) ? f.cancels : [];
  const inc = c.filter((x) => x.status === "inc").reduce((s, x) => s + x.changeVal, 0);
  const dec = c.filter((x) => x.status === "dec").reduce((s, x) => s + x.changeVal, 0);
  return Math.max(0, (f.quantity || 0) + inc - dec);
};

export const receiptPageRouter = express.Router();

receiptPageRouter.get("/:orderId/:sig", async (req, res) => {
  try {
    const { orderId, sig } = req.params;
    if (sig !== receiptSig(orderId)) return res.status(404).send("Not found");
    const order = await orderModel.findById(orderId);
    if (!order) return res.status(404).send("Not found");

    const [rest, branchDoc, tableDoc] = await Promise.all([
      restaurantsModel.findById(order.restaurantId).select("brand currency"),
      branchesModel.findById(order.branch).select("name"),
      order.table ? tableModel.findById(order.table).select("title number") : null,
    ]);
    const cur = CUR(order.currency || rest?.currency);
    const items = (order.foods || []).filter((f) => effQty(f) > 0);
    const isPossiz = order.createdInMode === "possiz" || order.source === "possiz_mobile";

    // Keshbek QR (pending sessiya bo'lsa)
    let kbBlock = "";
    try {
      const sess = await cashbackQrSessionModel.findOne({ orderId: order._id, status: "pending", expiresAt: { $gt: new Date() } });
      if (sess) {
        const { config: kc } = await keshbekConfig(order.restaurantId);
        const num = String(kc?.whatsappNumber || "").replace(/[^\d]/g, "");
        const link = num
          ? `https://wa.me/${num}?text=${sess.qrToken}`
          : `${(kc?.qrBaseUrl || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "")}/api/keshbek/qr-session/${sess.qrToken}`;
        const dataUrl = await QRCode.toDataURL(link, { margin: 1, width: 220 });
        kbBlock = `<div class="sep"></div><div style="text-align:center;">
          <div style="font-weight:900;">КЕШБЭК ${fmt(sess.earnAmount)} ${cur}</div>
          <img src="${dataUrl}" style="width:160px;height:160px;margin:6px 0;"/>
          <div style="font-size:11px;color:#555;">Отсканируйте QR и отправьте номер телефона</div>
        </div>`;
      }
    } catch { /* keshbek ixtiyoriy */ }

    const mixed = order.paymentMethod === "mixed" && order.mixed ? order.mixed : null;
    const rows = items
      .map(
        (f) => `<div class="row"><span>${esc(f.foodName)} × ${effQty(f)}</span><span>${fmt(
          f.isHourly ? f.hourlyFinalAmount || 0 : (f.foodPrice || 0) * effQty(f),
        )} ${cur}</span></div>`,
      )
      .join("");

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(`<!doctype html><html lang="ru"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Чек ${esc(order.receiptNumber)}</title>
<style>
  body{font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;background:#f4f1ea;margin:0;padding:18px;display:flex;justify-content:center}
  .chk{background:#fff;max-width:380px;width:100%;padding:22px 20px;border:1px solid #d8d2c2;font-size:14px;color:#111}
  h1{font-size:20px;text-align:center;margin:0 0 2px;letter-spacing:1px}
  .sub{text-align:center;color:#666;font-size:12px;margin-bottom:8px}
  .sep{border-top:2px dotted #000;margin:10px 0}
  .row{display:flex;justify-content:space-between;margin:5px 0}
  .tot{font-weight:900;font-size:17px}
  .meta{color:#444;font-size:12px;margin:2px 0}
  .possiz{background:#7f1d1d;color:#fff;text-align:center;font-weight:800;font-size:12px;padding:6px;margin-bottom:10px;letter-spacing:.5px}
  .foot{text-align:center;font-weight:800;margin-top:10px}
</style></head><body><div class="chk">
  ${isPossiz ? `<div class="possiz">ВЫДАН В РЕЖИМЕ POSSIZ (без POS)</div>` : ""}
  <h1>${esc(rest?.brand || "Ресторан")}</h1>
  <div class="sub">${esc(branchDoc?.name || "")}</div>
  <div class="meta"><b>Заказ:</b> ${esc(order.receiptNumber)}</div>
  <div class="meta"><b>Дата:</b> ${new Date(order.paidAt || order.createdAt).toLocaleString("ru-RU")}</div>
  ${tableDoc ? `<div class="meta"><b>Стол:</b> ${esc(tableDoc.title || tableDoc.number)}</div>` : ""}
  ${order.waiter?.name ? `<div class="meta"><b>Официант:</b> ${esc(order.waiter.name)}</div>` : ""}
  <div class="sep"></div>
  ${rows}
  <div class="sep"></div>
  <div class="row"><span>Подытог</span><span>${fmt(order.subTotal)} ${cur}</span></div>
  ${order.discountAmount > 0 ? `<div class="row"><span>Скидка</span><span>−${fmt(order.discountAmount)} ${cur}</span></div>` : ""}
  ${order.service?.amount > 0 ? `<div class="row"><span>Обслуживание${order.service?.percent ? ` (${order.service.percent}%)` : ""}</span><span>${fmt(order.service.amount)} ${cur}</span></div>` : ""}
  <div class="row tot"><span>ИТОГО</span><span>${fmt(order.totalPrice)} ${cur}</span></div>
  ${
    mixed
      ? ["cash", "card", "transfer", "kaspi", "cashback"]
          .filter((k) => (mixed[k] || 0) > 0)
          .map((k) => `<div class="row" style="font-style:italic"><span>${PAY_RU[k] || k}</span><span>${fmt(mixed[k])} ${cur}</span></div>`)
          .join("")
      : order.paymentMethod
        ? `<div class="row" style="font-style:italic"><span>${PAY_RU[order.paymentMethod] || order.paymentMethod}</span><span>${fmt(order.totalPrice)} ${cur}</span></div>`
        : ""
  }
  ${kbBlock}
  <div class="sep"></div>
  <div class="foot">${order.isCancel ? "ОТМЕНЕНО" : order.paymentStatus === "refunded" ? "ВОЗВРАТ" : order.paymentStatus === "paid" ? "ОПЛАЧЕНО · Спасибо!" : "НЕ ОПЛАЧЕНО"}</div>
</div></body></html>`);
  } catch (e) {
    return res.status(500).send("Error");
  }
});
