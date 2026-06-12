import express from "express";
import crypto from "crypto";
import authMiddleware from "../middlewares/auth.middleware.js";
import branchAuth from "../middlewares/branchAuth.middleware.js";
import { requireFeature } from "../features/middleware.js";
import { keshbekConfig, capturePhone, spendCashback, refundCashbackForOrder } from "../utils/keshbek.js";
import {
  cashbackBalanceModel,
  cashbackMovementModel,
  cashbackQrSessionModel,
} from "../models/keshbek.model.js";
import restaurantsModel from "../models/restaurants.model.js";
import config from "../config/index.js";
import { normalizePhone, countryFromCurrency } from "../utils/phone.js";
import { audit } from "../utils/audit.js";

// KESHBEK API — obsidian/04-toollar/keshbek-tizimi.md
// Uch xil kirish:
//  1) PUBLIC (bot/web) — /qr-session/:token. Mijoz QR'ni skanerlasa shu URL ochiladi.
//     Brauzer (Accept: text/html) → TELEFON SO'RAYDIGAN HTML sahifa qaytadi;
//     API client (fetch/bot, Accept: */*) → JSON. Auth YO'Q — token o'zi maxfiy.
//     WhatsApp raqami sozlangan bo'lsa QR wa.me'ga ketadi (bot), aks holda shu web.
//  2) BRANCH (local) — /branch/* branchToken bilan: local server proxy (POS spend
//     FAQAT ONLINE — local o'zi balans saqlamaydi, 2026-05-29 qaror).
//  3) USER (admin)   — balanslar/harakatlar ro'yxati (filial_admin sahifa).
const router = express.Router();

// Telefonni restoran davlatiga ko'ra E.164 ga keltiradi (POS spend "+7…"/"+998…",
// web, WhatsApp "998…" — HAMMASI bitta kalit; balans bo'linmaydi). null = noto'g'ri.
async function normFor(restaurantId, raw) {
  try {
    const r = await restaurantsModel.findById(restaurantId).select("currency");
    return normalizePhone(raw, countryFromCurrency(r?.currency));
  } catch {
    return null;
  }
}
const CUR = (c) => ({ KZT: "₸", UZS: "сум", RUB: "₽", USD: "$" }[String(c || "").toUpperCase()] || c || "");
const esc = (s) => String(s ?? "").replace(/[<>&"]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[ch]));
const wantsHtml = (req) => String(req.headers.accept || "").includes("text/html");

// Mijoz telefonida ochiladigan keshbek sahifasi (server-rendered, JS bilan POST).
// status: pending → telefon formasi; phone_captured → "allaqachon"; expired/notfound → xato.
function renderCapturePage({ brand, cur, token, earnAmount, status, balance, whatsappNumber, message }) {
  // Token <script> ichiga kiradi — XSS oldini olish uchun faqat [A-Za-z0-9_] qoldiramiz
  // (haqiqiy token "KB_<hex>"). Xato sahifalarda token req.params'dan keladi (ishonchsiz).
  const safeToken = String(token || "").replace(/[^A-Za-z0-9_]/g, "").slice(0, 64);
  const waNum = String(whatsappNumber || "").replace(/[^\d]/g, "");
  const waBtn = waNum
    ? `<a class="wa" href="https://wa.me/${waNum}?text=${encodeURIComponent(safeToken)}">Продолжить в WhatsApp</a>`
    : "";
  let body;
  if (status === "phone_captured") {
    body = `<div class="ok">✓ Кешбэк по этому чеку уже начислен</div>`;
  } else if (status === "expired") {
    body = `<div class="bad">Срок действия QR истёк (24 часа)</div>`;
  } else if (status === "notfound") {
    body = `<div class="bad">${esc(message || "Чек не найден")}</div>`;
  } else {
    // pending — telefon formasi
    body = `
      <div class="earn">Вам начислим <b>${earnAmount} ${cur}</b> кешбэка</div>
      <div class="hint">Введите номер телефона — кешбэк зачислится на ваш баланс. В следующий визит сможете оплатить им.</div>
      <input id="ph" type="tel" inputmode="tel" placeholder="+7 700 000 00 00" autocomplete="tel" />
      <button id="go">Получить кешбэк</button>
      <div id="msg" class="msg"></div>
      ${waBtn}`;
  }
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<title>Кешбэк — ${esc(brand)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;background:#f4f1ea;margin:0;padding:20px;display:flex;justify-content:center;min-height:100vh}
  .card{background:#fff;max-width:420px;width:100%;padding:26px 22px;border:1px solid #d8d2c2;border-radius:14px;text-align:center}
  h1{font-size:22px;margin:0 0 2px;letter-spacing:.5px}
  .ok{font-weight:800;color:#15803d;font-size:18px;margin:18px 0}
  .bad{font-weight:800;color:#b91c1c;font-size:17px;margin:18px 0}
  .check{color:#15803d;font-weight:800;font-size:15px;margin:10px 0 6px}
  .earn{font-size:20px;margin:16px 0 6px}
  .earn b{color:#c2410c;font-size:24px}
  .hint{color:#666;font-size:13px;line-height:1.5;margin-bottom:16px}
  input{width:100%;height:54px;font-size:20px;text-align:center;border:2px solid #d8d2c2;border-radius:10px;padding:0 12px;font-weight:700;outline:none}
  input:focus{border-color:#c2410c}
  button{width:100%;height:54px;margin-top:12px;background:#c2410c;color:#fff;border:none;border-radius:10px;font-size:18px;font-weight:800;cursor:pointer}
  button:disabled{opacity:.5}
  .msg{margin-top:14px;font-size:15px;font-weight:700;min-height:20px}
  .msg.good{color:#15803d}.msg.err{color:#b91c1c}
  .wa{display:block;margin-top:14px;color:#16a34a;font-weight:700;text-decoration:none;font-size:14px}
</style></head><body><div class="card">
  <h1>${esc(brand)}</h1>
  <div class="check">✓ Оплата подтверждена</div>
  ${body}
</div>
<script>
(function(){
  var go=document.getElementById('go');if(!go)return;
  var ph=document.getElementById('ph'),msg=document.getElementById('msg');
  go.onclick=function(){
    var phone=(ph.value||'').replace(/[^\\d+]/g,'');
    if(phone.length<9){msg.className='msg err';msg.textContent='Введите корректный номер';return;}
    go.disabled=true;msg.className='msg';msg.textContent='Отправка…';
    fetch(${JSON.stringify(`/api/keshbek/qr-session/${safeToken}/phone`)},{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:phone})})
      .then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j};});})
      .then(function(x){
        if(x.j&&x.j.status==='success'){
          msg.className='msg good';
          msg.textContent='🎉 Начислено '+x.j.data.earned+' ${cur}. Баланс: '+x.j.data.balance+' ${cur}';
          ph.style.display='none';go.style.display='none';
        }else{go.disabled=false;msg.className='msg err';msg.textContent=(x.j&&x.j.message)||'Ошибка. Попробуйте ещё раз';}
      })
      .catch(function(){go.disabled=false;msg.className='msg err';msg.textContent='Нет связи. Попробуйте ещё раз';});
  };
  ph.addEventListener('keydown',function(e){if(e.key==='Enter')go.click();});
})();
</script>
</body></html>`;
}

// ===== 1) PUBLIC — WhatsApp bot / mijoz web sahifasi =====
router.get("/qr-session/:token", async (req, res) => {
  const html = wantsHtml(req);
  try {
    const s = await cashbackQrSessionModel.findOne({ qrToken: req.params.token });
    if (!s) {
      if (html) return res.status(404).type("html").send(renderCapturePage({ brand: "Кешбэк", cur: "", token: req.params.token, status: "notfound", message: "Чек не найден" }));
      return res.status(404).json({ status: "error", code: "NOT_FOUND" });
    }
    const { enabled, config: kc } = await keshbekConfig(s.restaurantId);
    if (!enabled) {
      if (html) return res.status(404).type("html").send(renderCapturePage({ brand: "Кешбэк", cur: "", token: req.params.token, status: "notfound", message: "Кешбэк недоступен" }));
      return res.status(404).json({ status: "error", code: "FEATURE_DISABLED" });
    }
    const effStatus = s.expiresAt < new Date() && s.status === "pending" ? "expired" : s.status;
    if (html) {
      const rest = await restaurantsModel.findById(s.restaurantId).select("brand currency");
      return res.type("html").send(
        renderCapturePage({
          brand: rest?.brand || "Ресторан",
          cur: CUR(rest?.currency),
          token: s.qrToken,
          earnAmount: s.earnAmount,
          status: effStatus,
          whatsappNumber: kc?.whatsappNumber,
        }),
      );
    }
    return res.json({
      status: "success",
      data: { checkAmount: s.checkAmount, earnAmount: s.earnAmount, status: effStatus },
    });
  } catch (e) {
    if (html) return res.status(500).type("html").send(renderCapturePage({ brand: "Кешбэк", cur: "", token: req.params.token, status: "notfound", message: "Ошибка сервера" }));
    return res.status(500).json({ status: "error", message: e.message });
  }
});

router.post("/qr-session/:token/phone", async (req, res) => {
  try {
    const s = await cashbackQrSessionModel.findOne({ qrToken: req.params.token });
    if (!s) return res.status(404).json({ status: "error", code: "NOT_FOUND" });
    const { enabled } = await keshbekConfig(s.restaurantId);
    if (!enabled) return res.status(404).json({ status: "error", code: "FEATURE_DISABLED" });

    const r = await capturePhone(req.params.token, req.body?.phone);
    if (r.error) {
      const msg = {
        INVALID_PHONE: "Неверный номер телефона",
        ALREADY_CAPTURED: "Кешбэк по этому чеку уже начислен",
        EXPIRED: "Срок действия QR истёк",
        NOT_FOUND: "Чек не найден",
        FEATURE_DISABLED: "Кешбэк недоступен",
      }[r.error] || "Ошибка";
      return res.status(400).json({ status: "error", code: r.error, message: msg });
    }
    return res.json({ status: "success", data: { earned: r.earned, balance: r.balance } });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

// ===== WhatsApp Cloud API webhook (bot oqimi) =====
// WhatsApp env config (platforma darajasida — bitta Meta app barcha restoranlar
// uchun; token sessiyada restoranni aniqlaydi). Foydalanuvchi test account bergach
// .env'ga: WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET to'ldiriladi.
const WA_VERIFY = process.env.WHATSAPP_VERIFY_TOKEN || config.whatsapp?.verifyToken || "";
const WA_SECRET = process.env.WHATSAPP_APP_SECRET || config.whatsapp?.appSecret || "";

// GET — Meta webhook tasdiqlash (hub.challenge echo, verify_token tekshiruvi bilan)
router.get("/whatsapp/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && (!WA_VERIFY || token === WA_VERIFY)) return res.send(challenge || "ok");
  if (!mode) return res.send(challenge || "ok"); // qo'lda tekshirish
  return res.sendStatus(403);
});

// Meta payloadidan token (xabar matni) + jo'natuvchi telefonini ajratadi.
// Token "KB_<hex>" — mijoz wa.me deep-link orqali avtomatik yuboradi.
function parseWhatsappMessages(payload) {
  const out = [];
  try {
    for (const entry of payload?.entry || []) {
      for (const ch of entry?.changes || []) {
        const v = ch?.value || {};
        for (const m of v?.messages || []) {
          const text = m?.text?.body || m?.button?.text || "";
          const tokenMatch = String(text).match(/KB_[a-f0-9]{8,}/i);
          const from = m?.from || (v?.contacts?.[0]?.wa_id) || "";
          if (tokenMatch && from) out.push({ token: tokenMatch[0], phone: from });
        }
      }
    }
  } catch {
    /* shakl boshqacha — bo'sh qaytaramiz */
  }
  return out;
}

// POST — kelgan xabarlar: token+telefon → capturePhone (balansga qo'shadi).
// HMAC (X-Hub-Signature-256) WA_SECRET sozlangan bo'lsa tekshiriladi. Har doim 200
// (Meta retry qilmasin). Bot javobi (SMS/WhatsApp reply) — kredensial qo'shilgach.
router.post("/whatsapp/webhook", async (req, res) => {
  try {
    // FAIL-CLOSED: WA_SECRET sozlangach imzo HAR doim talab qilinadi (rawBody yo'q
    // bo'lsa ham rad — boshqa body-parser qo'shilsa fail-open bo'lmasin). Secret
    // hali yo'q (WhatsApp ulanmagan) → token+toggle gate himoya qiladi (capturePhone).
    if (WA_SECRET) {
      if (!req.rawBody) return res.sendStatus(401);
      const sig = req.get("x-hub-signature-256") || "";
      const expected = "sha256=" + crypto.createHmac("sha256", WA_SECRET).update(req.rawBody).digest("hex");
      if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
        return res.sendStatus(401);
      }
    }
    const msgs = parseWhatsappMessages(req.body);
    for (const { token, phone } of msgs) {
      const r = await capturePhone(token, phone).catch(() => null);
      if (r?.balance != null) {
        await audit.log({ kind: "keshbek_whatsapp_capture", message: `${phone}: +${r.earned} (balans ${r.balance})` }).catch(() => {});
      }
    }
  } catch (e) {
    console.warn("[keshbek] whatsapp webhook xato:", e?.message);
  }
  return res.json({ status: "success" });
});

// ===== 2) BRANCH (local server proxy — branchToken) =====
const branchRouter = express.Router();
branchRouter.use(branchAuth);

branchRouter.get("/balance/:phone", async (req, res) => {
  try {
    const restaurantId = req.branch.restaurant;
    const { enabled, config } = await keshbekConfig(restaurantId);
    if (!enabled) return res.status(404).json({ status: "error", code: "FEATURE_DISABLED" });
    const phone = await normFor(restaurantId, req.params.phone);
    if (!phone) return res.status(400).json({ status: "error", code: "INVALID_PHONE", message: "Неверный номер телефона" });
    const bal = await cashbackBalanceModel.findOne({ restaurantId, clientPhone: phone });
    return res.json({
      status: "success",
      data: { balance: bal?.balance || 0, percent: config.percent },
    });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

branchRouter.post("/spend", async (req, res) => {
  try {
    const restaurantId = req.branch.restaurant;
    const { enabled } = await keshbekConfig(restaurantId);
    if (!enabled) return res.status(404).json({ status: "error", code: "FEATURE_DISABLED" });
    const { phone: rawPhone, amount, orderId } = req.body || {};
    const phone = await normFor(restaurantId, rawPhone);
    if (!phone) return res.status(400).json({ status: "error", code: "INVALID_PHONE", message: "Неверный номер телефона" });
    const r = await spendCashback({
      restaurantId,
      branch: req.branch._id,
      phone,
      amount,
      orderId,
    });
    if (r.error) {
      const msg = r.error === "INSUFFICIENT" ? "Недостаточно кешбэка на балансе" : "Неверная сумма";
      return res.status(400).json({ status: "error", code: r.error, message: msg });
    }
    await audit.log({ kind: "keshbek_spend", restaurantId, branchId: req.branch._id, message: `${phone}: -${r.spent}` });
    return res.json({ status: "success", data: r });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

// Vozvrat: spend qaytarish + earn sessiya void (feature-check'siz — tozalash
// har doim ishlashi kerak; modul o'chiq bo'lsa spend bo'lmagan bo'ladi).
branchRouter.post("/refund", async (req, res) => {
  try {
    const { orderId } = req.body || {};
    if (!orderId) return res.status(400).json({ status: "error", message: "orderId required" });
    const r = await refundCashbackForOrder(req.branch.restaurant, orderId);
    return res.json({ status: "success", data: r });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

router.use("/branch", branchRouter);

// ===== 3) USER (admin web) =====
const adminRouter = express.Router();
adminRouter.use(authMiddleware);
adminRouter.use(requireFeature("keshbek"));

// Balanslar ro'yxati (filial_admin "Кешбэк" sahifasi)
adminRouter.get("/balances", async (req, res) => {
  try {
    const list = await cashbackBalanceModel
      .find({ restaurantId: req.userData.restaurantId })
      .sort({ lastActivityAt: -1 })
      .limit(500);
    return res.json({ status: "success", data: list });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

adminRouter.get("/balance/:phone", async (req, res) => {
  try {
    const phone = await normFor(req.userData.restaurantId, req.params.phone);
    if (!phone) return res.status(400).json({ status: "error", code: "INVALID_PHONE", message: "Неверный номер телефона" });
    const bal = await cashbackBalanceModel.findOne({
      restaurantId: req.userData.restaurantId,
      clientPhone: phone,
    });
    return res.json({ status: "success", data: { balance: bal?.balance || 0 } });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

adminRouter.get("/movements/:phone", async (req, res) => {
  try {
    const phone = await normFor(req.userData.restaurantId, req.params.phone);
    if (!phone) return res.status(400).json({ status: "error", code: "INVALID_PHONE", message: "Неверный номер телефона" });
    const list = await cashbackMovementModel
      .find({ restaurantId: req.userData.restaurantId, clientPhone: phone })
      .sort({ createdAt: -1 })
      .limit(100);
    return res.json({ status: "success", data: list });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

router.use("/", adminRouter);

export default router;
