import express from "express";
import crypto from "crypto";
import QRCode from "qrcode";
import authMiddleware from "../middlewares/auth.middleware.js";
import { requireFeature } from "../features/middleware.js";
import restaurantsModel from "../models/restaurants.model.js";
import branchesModel from "../models/branches.model.js";
import categoryModel from "../models/category.model.js";
import foodModel from "../models/food.model.js";
import tableModel from "../models/table.model.js";
import serviceModel from "../models/service.model.js";
import shiftModel from "../models/shift.model.js";
import orderModel from "../models/order.model.js";
import { qrOrderRequestModel } from "../models/qr-order.model.js";
import { calculateOrderTotals } from "../utils/order-calc.js";
import { checkStockAvailability, deductForOrder, stockErrorMessage } from "../utils/sklad.js";
import { emitToBranch } from "../utils/socket.js";
import { audit } from "../utils/audit.js";

// QR ORDER — obsidian/04-toollar/qr-order.md
// Mijoz stol QR'ini skanerlaydi → /qr/:slug sahifa (auth YO'Q) → menyu → so'rov →
// kassir tasdiqlaydi → haqiqiy order (source: "qr") → local POS sync pull bilan oladi.
// FAQAT ONLINE (spec: offline'da ishlamaydi — sodda boshlash).
const router = express.Router();

// ===== Helperlar =====
async function qrOrderConfig(restaurantId) {
  try {
    const r = await restaurantsModel.findById(restaurantId).select("features");
    const entry = r?.features?.get ? r.features.get("qrOrder") : r?.features?.["qrOrder"];
    if (!entry || !entry.enabled) return { enabled: false, config: {} };
    return {
      enabled: true,
      config: {
        pendingExpiryMinutes: Number(entry.config?.pendingExpiryMinutes) || 5,
        requireCustomerPhone: entry.config?.requireCustomerPhone === true,
        ...entry.config,
      },
    };
  } catch {
    return { enabled: false, config: {} };
  }
}

// Qisqa nadir slug (8 belgi base62) — global unique
const genSlug = () => crypto.randomBytes(6).toString("base64url").replace(/[-_]/g, "x").slice(0, 8);

// Lazy expire — scheduler o'rniga o'qish paytida (sodda va ishonchli)
async function expireStale(branch) {
  await qrOrderRequestModel.updateMany(
    { branch, status: "pending", expiresAt: { $lt: new Date() } },
    { $set: { status: "expired", decidedAt: new Date() } },
  );
}

// Sodda IP rate-limit (spec: 1 IP → 10 so'rov/daqiqa) — public /request uchun
const reqHits = new Map();
function publicRateLimit(req, res, next) {
  const now = Date.now();
  const key = req.ip || "?";
  const arr = (reqHits.get(key) || []).filter((t) => now - t < 60_000);
  if (arr.length >= 10) {
    return res.status(429).json({ status: "error", code: "RATE_LIMITED", message: "Слишком много запросов" });
  }
  arr.push(now);
  reqHits.set(key, arr);
  if (reqHits.size > 5000) reqHits.clear(); // xotira himoyasi
  next();
}

// ===== PUBLIC: menyu (auth YO'Q) =====
router.get("/menu/:qrSlug", async (req, res) => {
  try {
    const table = await tableModel.findOne({ qrSlug: req.params.qrSlug, isActive: { $ne: false } });
    if (!table || table.qrEnabled === false) {
      return res.status(404).json({ status: "error", code: "NOT_FOUND" });
    }
    const { enabled } = await qrOrderConfig(table.restaurantId);
    if (!enabled) return res.status(404).json({ status: "error", code: "FEATURE_DISABLED" });

    const [rest, branchDoc, categories, foods] = await Promise.all([
      restaurantsModel.findById(table.restaurantId).select("brand currency"),
      branchesModel.findById(table.branch).select("name"),
      categoryModel.find({ branch: table.branch, isActive: true }).sort({ sortOrder: 1, title: 1 }),
      foodModel.find({ branch: table.branch, isActive: true }).sort({ sortOrder: 1, name: 1 }),
    ]);

    return res.json({
      status: "success",
      data: {
        brand: rest?.brand || "Ресторан",
        currency: rest?.currency || "KZT",
        branchName: branchDoc?.name || "",
        table: { title: table.title, number: table.number },
        categories: categories.map((c) => ({ _id: c._id, title: c.title })),
        foods: foods
          .filter((f) => !f.availability?.stopped && !f.isHourly) // soatlik xizmat QR'dan buyurtilmaydi
          .map((f) => ({
            _id: f._id,
            name: f.name,
            price: f.price,
            category: String(f.category),
            image: f.image || null,
            description: f.description || null,
          })),
      },
    });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

// ===== PUBLIC: so'rov yuborish =====
router.post("/request", publicRateLimit, async (req, res) => {
  try {
    const { qrSlug, items, customer } = req.body || {};
    const table = await tableModel.findOne({ qrSlug, isActive: { $ne: false } });
    if (!table || table.qrEnabled === false) {
      return res.status(404).json({ status: "error", code: "NOT_FOUND" });
    }
    const { enabled, config } = await qrOrderConfig(table.restaurantId);
    if (!enabled) return res.status(404).json({ status: "error", code: "FEATURE_DISABLED" });
    if (config.requireCustomerPhone && !customer?.phone) {
      return res.status(400).json({ status: "error", message: "Укажите номер телефона" });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ status: "error", message: "Выберите блюда" });
    }

    // Snapshot — narxlar DB'dan (mijoz narxiga ISHONMAYMIZ)
    const snaps = [];
    for (const it of items.slice(0, 30)) {
      const f = await foodModel.findOne({ _id: it.foodId, branch: table.branch, isActive: true });
      if (!f || f.availability?.stopped || f.isHourly) continue;
      const qty = Math.max(1, Math.min(50, Number(it.quantity) || 1));
      snaps.push({ foodId: f._id, foodName: f.name, foodPrice: f.price, quantity: qty, note: it.note || null });
    }
    if (!snaps.length) return res.status(400).json({ status: "error", message: "Блюда не найдены" });

    const reqDoc = await qrOrderRequestModel.create({
      restaurantId: table.restaurantId,
      branch: table.branch,
      tableId: table._id,
      qrSlug,
      customer: { name: customer?.name || null, phone: customer?.phone || null },
      items: snaps,
      expiresAt: new Date(Date.now() + (config.pendingExpiryMinutes || 5) * 60_000),
    });

    // Kassir/admin'larga real-time signal (filial_admin QR sahifasi poll ham qiladi)
    emitToBranch(table.branch, "qrOrder:pending", { requestId: String(reqDoc._id), table: table.title });

    return res.json({ status: "success", data: { requestId: reqDoc._id, expiresAt: reqDoc.expiresAt } });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

// ===== PUBLIC: mijoz status poll =====
router.get("/request/:id/status", async (req, res) => {
  try {
    const r = await qrOrderRequestModel.findById(req.params.id).select("status expiresAt rejectReason approvedOrderId");
    if (!r) return res.status(404).json({ status: "error", code: "NOT_FOUND" });
    let st = r.status;
    if (st === "pending" && r.expiresAt < new Date()) st = "expired";
    return res.json({ status: "success", data: { status: st, rejectReason: r.rejectReason } });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

// ===== KASSIR/ADMIN (user token + requireFeature) =====
const staffRouter = express.Router();
staffRouter.use(authMiddleware);
staffRouter.use(requireFeature("qrOrder"));

staffRouter.get("/pending", async (req, res) => {
  try {
    const branch = req.userData.branch;
    await expireStale(branch);
    const list = await qrOrderRequestModel
      .find({ branch, status: "pending" })
      .sort({ createdAt: 1 })
      .populate("tableId", "title number");
    return res.json({ status: "success", data: list });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

// Tasdiqlash → haqiqiy order yaratiladi (source: "qr") → local POS sync bilan oladi
staffRouter.post("/:id/approve", async (req, res) => {
  try {
    const branch = req.userData.branch;
    // ATOMIK CLAIM — parallel/ikki marta approve 2x order yaratmasin: pending →
    // approved birinchi bo'lib o'tkazgan g'olib; qolganlar 400 oladi.
    const r = await qrOrderRequestModel.findOneAndUpdate(
      { _id: req.params.id, branch, status: "pending", expiresAt: { $gt: new Date() } },
      { $set: { status: "approved", decidedAt: new Date(), decidedBy: req.userData._id } },
      { new: true },
    );
    if (!r) {
      return res.status(400).json({ status: "error", message: "Запрос уже обработан или истёк" });
    }
    // Quyida validatsiya yiqilsa claim QAYTARILADI (releaseClaim)
    const releaseClaim = async () => {
      await qrOrderRequestModel.updateOne(
        { _id: r._id, status: "approved", approvedOrderId: null },
        { $set: { status: "pending", decidedAt: null, decidedBy: null } },
      ).catch(() => {});
    };

    const shift = await shiftModel.findOne({ branch, isActive: true });
    if (!shift) {
      await releaseClaim();
      return res.status(400).json({ status: "error", code: "NO_OPEN_SHIFT", message: "Сначала откройте смену" });
    }

    const foods = r.items.map((it) => ({
      foodId: it.foodId,
      foodName: it.foodName,
      foodPrice: it.foodPrice,
      quantity: it.quantity,
      note: it.note || null,
      cancels: [],
      cookingStatus: "waiting",
    }));

    // SKLAD (yoqiq bo'lsa): O1 oversell-blok
    const stockChk = await checkStockAvailability(r.restaurantId, branch, foods);
    if (!stockChk.ok) {
      await releaseClaim();
      return res.status(400).json({ status: "error", code: "STOCK_INSUFFICIENT", message: stockErrorMessage(stockChk.missing) });
    }

    // Услуга (dineIn) — filial sozlamasidan
    let service = { percent: 0, amount: 0, waived: false };
    const svc = await serviceModel.findOne({ branch, isActive: true });
    if (svc && svc.servicePercent > 0) {
      service = { serviceId: svc._id, percent: svc.servicePercent, amount: 0, waived: false };
    }

    // Chek raqami (PREFIX-YYYYMMDD-NNNN)
    const b = await branchesModel.findById(branch).select("receiptPrefix");
    const now = new Date();
    const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const count = await orderModel.countDocuments({ branch, createdAt: { $gte: start } });
    const receiptNumber = `${b?.receiptPrefix || "POS"}-${ymd}-${String(count + 1).padStart(4, "0")}`;

    const rest = await restaurantsModel.findById(r.restaurantId).select("currency");
    const orderData = {
      branch,
      restaurantId: r.restaurantId,
      shift: shift._id,
      receiptNumber,
      currency: rest?.currency,
      orderType: "dineIn",
      waiter: { waiterId: null, name: r.customer?.name ? `QR: ${r.customer.name}` : "QR заказ", phone: r.customer?.phone || null },
      table: r.tableId,
      service,
      discount: null,
      foods,
      paymentStatus: "pending",
      totalPrice: 0,
      source: "qr",
      qrOrderRequestId: r._id,
      syncStatus: "pending",
    };
    calculateOrderTotals(orderData); // yagona canonical formula (Camp B)
    const order = await orderModel.create(orderData);
    deductForOrder(order, foods, req.userData._id); // sklad chiqim — fire-and-forget

    r.approvedOrderId = order._id;
    await r.save();

    emitToBranch(branch, "orders:changed", { orderId: String(order._id), kind: "qr-approved" });
    await audit.log({ kind: "qr_order_approved", restaurantId: r.restaurantId, branchId: branch, actor: { type: "user", id: String(req.userData._id), role: req.userData.role }, message: `${receiptNumber}: ${foods.length} ta taom` });

    return res.json({ status: "success", data: { order } });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

staffRouter.post("/:id/reject", async (req, res) => {
  try {
    const r = await qrOrderRequestModel.findOne({ _id: req.params.id, branch: req.userData.branch });
    if (!r) return res.status(404).json({ status: "error", message: "Запрос не найден" });
    if (r.status !== "pending") return res.status(400).json({ status: "error", message: "Запрос уже обработан" });
    r.status = "rejected";
    r.rejectReason = req.body?.reason || "Отклонено кассиром";
    r.decidedAt = new Date();
    r.decidedBy = req.userData._id;
    await r.save();
    return res.json({ status: "success", data: r });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

// Stol QR'ini olish/yaratish — slug bo'lmasa generatsiya + PNG dataURL qaytaradi
staffRouter.post("/tables/:id/qr", async (req, res) => {
  try {
    const table = await tableModel.findOne({ _id: req.params.id, branch: req.userData.branch });
    if (!table) return res.status(404).json({ status: "error", message: "Стол не найден" });
    if (!table.qrSlug) {
      table.qrSlug = genSlug();
      table.qrLastReset = new Date();
    }
    if (req.body?.regenerate === true) {
      table.qrSlug = genSlug(); // eski qog'oz QR'lar 404 bo'ladi (compromise holati)
      table.qrLastReset = new Date();
    }
    table.qrEnabled = req.body?.enabled !== false;
    await table.save();

    const base = (process.env.QR_PUBLIC_URL || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
    const url = `${base}/qr/${table.qrSlug}`;
    const png = await QRCode.toDataURL(url, { margin: 1, width: 480 });
    return res.json({ status: "success", data: { url, png, qrSlug: table.qrSlug, qrEnabled: table.qrEnabled } });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});

router.use("/", staffRouter);

export default router;

// ===== MIJOZ SAHIFASI (server-rendered, build'siz) — GET /qr/:slug =====
// Telefon brauzeri uchun yengil bitta-faylli sahifa: menyu, savat, so'rov, status poll.
export const qrPageRouter = express.Router();
qrPageRouter.get("/:slug", (req, res) => {
  const slug = String(req.params.slug || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 16);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!doctype html><html lang="ru"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Меню — заказ со стола</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;background:#f4f1ea;color:#0a0a0a;padding-bottom:120px}
  header{background:#fff;border-bottom:2px solid #0a0a0a;padding:14px 16px;position:sticky;top:0;z-index:5}
  h1{font-size:20px;font-weight:900;letter-spacing:.5px}
  .sub{font-size:13px;color:#6b6657;margin-top:2px}
  .cats{display:flex;gap:8px;overflow-x:auto;padding:10px 12px}
  .cat{flex:0 0 auto;padding:8px 14px;background:#fff;border:2px solid #d8d2c2;font-weight:800;font-size:13px;border-radius:18px}
  .cat.on{background:#d72121;color:#fff;border-color:#d72121}
  .list{padding:0 12px;display:flex;flex-direction:column;gap:8px}
  .item{background:#fff;border:1px solid #d8d2c2;padding:12px;display:flex;justify-content:space-between;align-items:center;gap:10px}
  .nm{font-weight:800;font-size:15px}
  .pr{color:#6b6657;font-size:13px;margin-top:2px}
  .qty{display:flex;align-items:center;gap:10px}
  .qty button{width:38px;height:38px;font-size:20px;font-weight:900;border:2px solid #0a0a0a;background:#fff}
  .qty span{min-width:18px;text-align:center;font-weight:900;font-size:16px}
  .bar{position:fixed;left:0;right:0;bottom:0;background:#fff;border-top:2px solid #0a0a0a;padding:12px 16px;display:flex;gap:10px;align-items:center}
  .tot{font-weight:900;font-size:18px;flex:1}
  .go{background:#d72121;color:#fff;border:none;padding:14px 22px;font-weight:900;font-size:16px;letter-spacing:.4px}
  .go:disabled{opacity:.4}
  .ov{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:20px}
  .card{background:#fff;padding:26px 22px;max-width:340px;width:100%;text-align:center;border:2px solid #0a0a0a}
  .card h2{font-size:19px;margin-bottom:8px}
  .card p{font-size:14px;color:#6b6657;line-height:1.5}
  .spin{margin:14px auto;width:34px;height:34px;border:4px solid #eee;border-top-color:#d72121;border-radius:50%;animation:r 1s linear infinite}
  @keyframes r{to{transform:rotate(360deg)}}
  .hide{display:none}
</style></head><body>
<header><h1 id="brand">Загрузка…</h1><div class="sub" id="sub"></div></header>
<div class="cats" id="cats"></div>
<div class="list" id="list"></div>
<div class="bar hide" id="bar"><div class="tot" id="tot"></div><button class="go" id="go">ЗАКАЗАТЬ</button></div>
<div class="ov hide" id="ov"><div class="card" id="ovc"></div></div>
<script>
const SLUG=${JSON.stringify(slug)};
let MENU=null,CUR='₸',cart={},activeCat=null,reqId=null,pollT=null;
const $=id=>document.getElementById(id);
const fmt=n=>(n||0).toLocaleString('ru-RU')+' '+CUR;
const curSym=c=>({KZT:'₸',UZS:'сум',RUB:'₽',USD:'$'}[c]||c);
async function load(){
  try{
    const r=await fetch('/api/qr-order/menu/'+SLUG);const j=await r.json();
    if(j.status!=='success'){$('brand').textContent='QR недействителен';$('sub').textContent='Обратитесь к официанту';return}
    MENU=j.data;CUR=curSym(MENU.currency);
    $('brand').textContent=MENU.brand;
    $('sub').textContent=(MENU.table?.title||'')+' · '+(MENU.branchName||'');
    activeCat=MENU.categories[0]?._id||null;render()
  }catch(e){$('brand').textContent='Нет соединения'}
}
function render(){
  $('cats').innerHTML=MENU.categories.map(c=>'<div class="cat'+(String(c._id)===String(activeCat)?' on':'')+'" onclick="setCat(\\''+c._id+'\\')">'+c.title+'</div>').join('');
  const foods=MENU.foods.filter(f=>String(f.category)===String(activeCat));
  $('list').innerHTML=foods.map(f=>{
    const q=cart[f._id]||0;
    return '<div class="item"><div><div class="nm">'+f.name+'</div><div class="pr">'+fmt(f.price)+'</div></div>'+
      '<div class="qty"><button onclick="add(\\''+f._id+'\\',-1)">−</button><span>'+q+'</span><button onclick="add(\\''+f._id+'\\',1)">+</button></div></div>';
  }).join('')||'<div style="padding:30px;text-align:center;color:#6b6657">Пусто</div>';
  const tot=Object.entries(cart).reduce((s,[id,q])=>{const f=MENU.foods.find(x=>String(x._id)===id);return s+(f?f.price*q:0)},0);
  const n=Object.values(cart).reduce((s,q)=>s+q,0);
  if(n>0){$('bar').classList.remove('hide');$('tot').textContent=n+' поз. · '+fmt(tot)}else{$('bar').classList.add('hide')}
}
window.setCat=id=>{activeCat=id;render()};
window.add=(id,d)=>{cart[id]=Math.max(0,(cart[id]||0)+d);if(!cart[id])delete cart[id];render()};
function overlay(html){$('ovc').innerHTML=html;$('ov').classList.remove('hide')}
function hideOverlay(){$('ov').classList.add('hide')}
window.hideOverlay=hideOverlay;
$('go').onclick=async()=>{
  const items=Object.entries(cart).map(([foodId,quantity])=>({foodId,quantity}));
  if(!items.length)return;
  $('go').disabled=true;
  try{
    const r=await fetch('/api/qr-order/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({qrSlug:SLUG,items})});
    const j=await r.json();
    if(j.status!=='success'){overlay('<h2>Ошибка</h2><p>'+(j.message||'Попробуйте позже')+'</p><br/><button class="go" onclick="hideOverlay()">OK</button>');$('go').disabled=false;return}
    reqId=j.data.requestId;
    overlay('<h2>Заказ отправлен</h2><div class="spin"></div><p>Ожидаем подтверждения кассира…</p>');
    pollT=setInterval(poll,3000)
  }catch(e){overlay('<h2>Нет соединения</h2><p>Проверьте интернет и попробуйте снова.</p><br/><button class="go" onclick="hideOverlay()">OK</button>');$('go').disabled=false}
};
async function poll(){
  try{
    const r=await fetch('/api/qr-order/request/'+reqId+'/status');const j=await r.json();
    const st=j.data&&j.data.status;
    if(st==='approved'){clearInterval(pollT);overlay('<h2>✅ Заказ принят!</h2><p>Кухня уже готовит. Приятного аппетита!</p>')}
    else if(st==='rejected'){clearInterval(pollT);overlay('<h2>Заказ отклонён</h2><p>'+((j.data&&j.data.rejectReason)||'Обратитесь к официанту')+'</p>')}
    else if(st==='expired'){clearInterval(pollT);overlay('<h2>Время истекло</h2><p>Кассир не успел подтвердить. Попробуйте ещё раз или позовите официанта.</p>')}
  }catch(e){/* keyingi poll */}
}
load();
</script></body></html>`);
});
