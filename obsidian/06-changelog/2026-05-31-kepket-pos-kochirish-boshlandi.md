---
tags: [changelog, kod, kepket, pos, migration, REJA]
date: 2026-05-31
type: implementation
status: in-progress
---

# 2026-05-31 — Kepket POS'ni ko'chirish (boshlandi)

## Qaror (foydalanuvchi)

Qayta yozish EMAS — **kepket-kz POS'ni to'liq ko'chirish**. Kepket-kz = maqsadning ~90%
tayyor ishlaydigan tizimi (POS, waiter, admin, bar, warehouse...). Fundamenti chalkash
(ayniqsa online↔offline sync — element yo'qolishi/duplikat) → biz yangidan, lekin
**barcha sahifa/funksiya AYNAN bir xil**, faqat sync toza bo'lsin.

## Mening oldingi xatolarim (foydalanuvchi ko'rsatdi)
- ❌ Order yaratish + to'lov bir vaqtda (to'g'ri: order ochiq → keyin alohida to'lov)
- ❌ "+ Заказ"da avval ovqat keyin stol (to'g'ri: avval stol, band stollar ko'rinib)
- ❌ To'lovda 100000 ga 5000 o'tib ketardi (to'g'ri: to'liq summa shart)
- ❌ Qayta yozdim (kerak: ko'chirish)

## Kepket arxitekturasi (manba)
- **Frontend**: `kepket-kz/aridai-pos-monitor` (Electron + React + TS, electron-vite)
  - Ekranlar: Dashboard(Заказы), Menu, Payment, OrderDetail, Reports, Settings, Expenses,
    Advances, ShiftOpen/Close, Login + shell(Header/SideNav), Numpad, theme, api, types
- **Backend**: `kepket-kz/restoran-backend-v2` — 20+ model, 25+ route, ERP
  - Order modeli: `items[]` (item-level `status` готовится/готов, **`isPaid`** qisman to'lov,
    `isHourly` bilyard), `serviceCharge`/`discount` (backend hisoblaydi), orderType dine-in/saboy
- api.ts: HTTP fetch (`window.__API_BASE__` || hub-url || VPS), endpoint `/api/orders`,
  `/api/foods/menu`, `/api/categories`, `/api/tables`, `/api/orders/:id/items`, `/api/shifts`,
  `/api/payments`, `/api/expenses`, `/api/advances`

## Bajarilgan (bu sessiya)
✅ Kepket POS **frontend** to'liq ko'chirildi → `local/renderer/src` (barcha ekran)
✅ vite alias `@/` → src
✅ api.ts `API_BASE_URL` → `http://localhost:4561` (Failed to fetch tuzatildi)
✅ **Login** kepket formatida ishlaydi (`auth.routes.js`): `{success, data:{staff:{firstName,
   lastName}, token, restaurant, branch}}`. Test: `+77005000831/123456` → asdsad, BrendPlov ✅

## BAJARILGAN endpointlar (kepket format, local/backend)
- ✅ `/api/auth/login` (auth.routes.js) — {success, data:{staff, token, restaurant, branch}}
- ✅ `/api/shifts/active|open|:id/close|available-cash` (shifts.routes.js) — kepket Shift format
  (status, shiftNumber, openedBy{firstName,lastName}). Shift modelga `shiftNumber` qo'shildi.
- ✅ `/api/foods/menu`, `/api/categories`, `/api/tables` (kepket.routes.js) — band stollar bilan
- ✅ `/api/staff?role=waiter` (kepket.routes.js) — ofitsiantlar (order'da tanlash)
- ✅ `/api/orders` POST(createOrder)/GET(getOrders)/:id/POST :id/items (orders.routes.js) —
  mening `foods[]` → kepket `items[]` mapping (mapOrder), genReceipt, calc. Test: order №1
  стол 1, 5720₸ ✅. Order OCHIQ yaratiladi (to'lov alohida — to'g'ri oqim).
- ✅ BrendPlov test seed (seed-brendplov.js): 3 kat, 10 taom, 8 stol, 2 waiter, service 10%

## BAJARILGAN (2-sessiya) — to'lov + Заказы tuzatildi
- ✅ **KATTA BUG topildi**: frontend `GET /api/orders/today` chaqiradi, lekin router'da
  `GET /:id` oldin edi → `/today` `id='today'` deb misroute → CastError → **Заказы DOIM
  bo'sh** edi (smena filtri sabab emas edi!). `GET /today` qo'shildi (`/:id` dan OLDIN).
- ✅ **mapOrder XOM kepket shakliga aylantirildi**: frontend transform `serviceCharge`
  (`serviceFee` emas), `waiterName` (`waiter.name` emas), item `status` (pending/preparing),
  `isPaid`, `tableNumber/tableName` flat o'qiydi. Endi waiter/service to'g'ri ko'rinadi.
- ✅ **To'lov endpointi** `POST /api/orders/:id/pay` (kepket processPayment ko'chirildi):
  - paymentType: cash/card/click/mixed → mening enum (click→transfer)
  - **TO'LIQ SUMMA majburiy**: mixed split = grandTotal (±100). Test: 5720 ga 5000 → RAD
    ("Сумма оплаты (5000) должна равняться итогу заказа (5720)") — foydalanuvchi shikoyati hal
  - paid belgilash, service to'lov payti stamp, stol AVTOMATIK bo'shaydi (paid order
    openOrders'dan chiqadi → tables band ko'rsatmaydi)
- ✅ tables band detektsiyasi joriy smenaga bog'landi (kepket.routes.js)
- ✅ To'liq oqim test: order №1 → /today (waiter/service to'g'ri) → band [1] → to'lov →
  bo'sh [] → paid. HAMMASI ishlaydi.

## BAJARILGAN (2-sessiya, davomi) — order ops + hisobot + kassa
- ✅ `PATCH /api/orders/:id` (setOrderDiscount/setOrderCharges) — chegirma%/service% →
  recalc → grandTotal. Test: 5720 → chegirma10% → 5148 (service chegirmadan KEYIN: 468)
- ✅ `PATCH /api/orders/:id/items/:itemId/quantity` (updateItemQuantity) — miqdor → recalc
- ✅ `reports.routes.js`: `GET /api/reports/dashboard` (header ВЫРУЧКА — totalRevenue/
  totalOrders/completedOrders) + `GET /api/reports/payments` (paymentBreakdown cash/card/
  click, mixed split bilan, transfer→click). Joriy smena bo'yicha.
- ✅ `restaurant.routes.js`: `GET/PUT /api/restaurant/settings` (услуга% — serviceModel'dan;
  Settings ekrani + Payment oldindan ko'rsatish)
- ✅ **Расходы/Авансы** to'liq: `expense.model.js`, `advance.model.js`, `finance.routes.js`
  (`GET/POST /api/expenses`, `/api/advances`, `GET /api/expense-categories`→[]). shiftId yoki
  startDate/endDate filtri. Test: расход 3000 cash, аванс 5000 (Нодира) ✓
- ✅ server.js: reports/restaurant/expenses/advances/expense-categories routerlar ulandi

## ENDI ISHLAYDIGAN to'liq oqim (backend, kepket format)
login → smena → menyu/stol → **+Заказ** (stol→ovqat) → **Заказы** (/today, waiter/service
to'g'ri) → order ochiq → **+Блюдо**/miqdor/chegирма → **Оплата** (TO'LIQ summa shart) →
paid → stol bo'shadi → **header ВЫРУЧКА** yangilanadi → **Расходы/Авансы** kassada

## BAJARILGAN (3-sessiya) — Local Server alohida folderga ajratildi
Kepket'da POS (`aridai-pos-monitor`) va Local Server (`aridai-local-server`) ALOHIDA
electron ilovalar. Bizда ham shunday qildik (foydalanuvchi: "electron local serverni
huddi electron-pos kabi alohida folderga yozib ber").

**Yangi folder**: `aridai-local-server/` (repo ildizida)
- `src/main/index.js` — electron main: mening Mongo backendimni boot qiladi (dynamic
  import `./backend/server.js`, .env oldin yuklanadi), oyna + tray + IPC handlerlar
- `src/main/backend/` — mening backendim NUSXASI (server.js, config, models, routes,
  sync, utils). Plain ESM → `import.meta.url` ishlaydi (bundling YO'Q, ishonchli)
- `src/preload/index.cjs` — kepket `aridai` bridge (auth/status/zoom/printers/foods/
  categories/sync/updates) — faithful
- `src/renderer/` — kepket status UI KO'CHIRILDI (Login, Shell, StatusPage, PrintersPage,
  SettingsPage, theme)
- `vite.config.js` (renderer, dev:5273) + `package.json` (electron-builder win/mac) + `.env`

**Qaror (foydalanuvchi tasdiqladi)**:
- DB: **Mongo qoladi** (kepket sqlite EMAS) — global↔local bir xil schema (v2 dizayni)
- UI: **kepket status UI ko'chirildi**
- Toolchain: electron-vite EMAS, plain Vite + ESM electron (mening ISHLAYOTGAN mexanizmim)
  — 46 fayllik mongoose backend bundling xavfini oldini olish uchun. Struktura bir xil.

**IPC**: auth (HTTP→/api/auth/login, admin/owner only) · status (mongoose countlar +
VPS heartbeat) · zoom · foods/categories (mongoose) — REAL. printers/updates/purge — STUB
(keyingi bosqich: printer-hub, auto-update, to'liq sync).

**Eslatma**: eski `local/` (backend+electron+renderer aralash) hozircha qoladi (POS test
uchun). Yangi `aridai-local-server/` mustaqil ishlaydi.

### `local/` TOZALANDI — faqat 2 folder (foydalanuvchi talabi)
`local/` ichidagi aralash fayllar (backend/electron/renderer/node_modules/configs) o'rniga
endi FAQAT ikki mustaqil ilova (kepket pos-monitor + local-server kabi):
```
local/
├── aridaipos_monitor/   ← POS terminal (kassa). Electron UI-only, backend YO'Q.
│   └── src/{main,preload,renderer}  · serverga ulanadi (localhost:4561 || hub-url)
└── aridaipos_server/    ← LOCAL SERVER. Backend kodi shu yerda.
    └── src/main/backend/ (Express+Mongo+routes+sync) + status UI (renderer) + electron main
```
- `aridai-local-server/` (root) → `local/aridaipos_server/` ga ko'chirildi
- POS electron+renderer → `local/aridaipos_monitor/` (UI-only, server'ga HTTP)
- Eski local/{backend,electron,renderer,node_modules,package.json...} O'CHIRILDI
- Tekshirildi: server backend yangi joydan boot ✅, monitor renderer build (install keyin)
- Run: `cd local/aridaipos_server && npm run dev` (server) + `cd local/aridaipos_monitor && npm run dev` (kassa)

## BAJARILGAN (3-sessiya, davomi) — POS endi LOCAL serverga ulanadi (kepket VPS emas)
**Muammo**: POS monitor `wss://kz.kepket.uz/socket.io/` ga ulanishga urinardi (502) —
ko'chirilgan koddagi hardcode qoldiq. Loyiha global serverga deploy qilinmagan.
**Tuzatildi** (`aridaipos_monitor/src/renderer/src`):
- `CashierApp.tsx` socket `API_URL`: `kz.kepket.uz` → `__API_BASE__ || hub-url || localhost:4561`
  (api.ts bilan bir xil). Endi socket LOCAL serverga (4561) ulanadi.
- `Settings.tsx` `DEFAULT_HUB`: 3011 → **4561** (foydalanuvchi saqlasa to'g'ri portga)
- `printer.ts` default: 3011 → 4561
- Tekshirildi: socket.io client → localhost:4561 → **ULANDI** ✅; build toza (78 modul)
**Offline rejim**: local server backend boot'da global'ga UMUMAN ulanmaydi (standalone).
Electron main faqat status UI uchun global'ni ping qiladi (try/catch → "Оффлайн" ko'rsatadi,
crash yo'q). Ya'ni server hech qanday global topmasa ham ishlayveradi.

## BAJARILGAN (3-sessiya, davomi) — ServerGate (ulanish xatosi sahifasi)
**Talab**: local server bilan aloqa bo'lmasa, POS "Откройте смену"/login EMAS,
**"ulanish xatosi"** sahifasini ko'rsatishi kerak.
**Yechim** (`aridaipos_monitor`):
- `api.ts`: `pingServer()` (GET /api/health, 2.5s timeout) + `getApiBaseUrl()` qo'shildi
- `main.jsx`: **ServerGate** wrapper — har 4s health tekshiradi:
  - `checking` → "Подключение к серверу…"
  - `offline` → **ConnectionError** sahifasi (kepket dizayn): "Нет связи с сервером",
    joriy manzil, **server IP kiritish** inputi (hub-url → client PC uchun), "Повторить" +
    "Сохранить и подключиться" tugmalar, avto-qayta-tekshirish
  - `online` → app (AuthProvider → Login/CashierApp)
- Online'da bitta xato (blink) offline qilmaydi — 2 ketma-ket xato kerak
- Server qaytsa 4s ichida avto-tiklanadi (token localStorage'da → qayta login shart emas)
- Tekshirildi: server o'chiq→pingServer=false→error sahifa; yoniq→true→app. Build 78 modul ✅

## BAJARILGAN (3-sessiya, davomi) — usluga toggle ochiq orderlarga ta'sir qiladi
**Muammo**: Settings'da uslugani o'chirdim, lekin mavjud order summasi o'zgarmadi.
Sabab: usluga order yaratilganda "stamp" qilinadi (service.percent=10), branch sozlamasi
o'zgarsa MAVJUD orderlar yangilanmasdi.
**Yechim** (`aridaipos_server/.../routes/restaurant.routes.js`): `PUT /settings` endi service
saqlangandan keyin **barcha OCHIQ (to'lanmagan) dineIn orderlarni** yangi foizga moslaydi
(waived qilinganlar tegilmaydi; to'langanlar TARIXIY). recalc → grandTotal.
- Test: order №1 (6700) → usluga o'chirdim → **6700** (service 0) → yoqdim 10% → **7370** →
  o'chirdim → **6700**. Toggle endi DARHOL ta'sir qiladi ✅
- NEW order ham to'g'ri: createOrder joriy active service (0 yoki 10%) ni o'qiydi.

## BAJARILGAN (3-sessiya, davomi) — skidka USLUGA QO'SHILGAN summadan
**Muammo**: skidka subtotaldan hisoblanardi (2900×10%=290), foydalanuvchi esa usluga
qo'shilgan summadan xohlaydi: (2900+1450)×10%=435. Plus frontend/backend formulalari
HAR XIL edi (frontend total 4060, backend 3915 — mos kelmasdi).
**Yangi YAGONA tartib** (order-calc.js + Payment.tsx):
  1) subTotal
  2) **service = subTotal × svc%** (chegirmadan oldin)
  3) **discount = (subTotal + service) × disc%** (usluga QO'SHILGANdan keyin)
  4) total = subTotal + tariff + service − discount
- Test: 2900 + service50%=1450 → discount=(2900+1450)×10%=**435** → total=**3915** ✅
- Backend + frontend endi BIR XIL (display = haqiqiy charge)
- PUT /settings recompute mavjud orderlarni yangi formulaga o'tkazdi (№2: 435/3915)

## BAJARILGAN (3-sessiya, davomi) — Сабой (на вынос): 404 + OCHIQ order
**Muammo 1**: saboy yaratishda "Ошибка 404" — backend'da `POST /api/orders/saboy` yo'q edi.
**Muammo 2** (foydalanuvchi): saboy darhol TO'LANGAN bo'lib qolardi — noto'g'ri. Saboy ham
oddiy order kabi OCHIQ yaratilishi, oshpaz tayyorlashi, KEYIN to'lanishi kerak.
**Yechim**:
- `orders.routes.js` `POST /saboy`: OCHIQ takeaway order (paymentStatus=**pending**, to'lovsiz).
  Stol YO'Q, usluga YO'Q. Itemlar cookingStatus=waiting → oshpaz ko'radi. To'lov KEYIN (/pay).
- `Menu.tsx` SaboyScreen: to'lov tanlash (НАЛИЧНЫЕ/КАРТА/ПЕРЕВОД) OLIB TASHLANDI — faqat
  "Создать сабой". Oqim: dine-in kabi (stolsiz).
- Test: saboy → active/pending, Заказы'da ko'rinadi → keyin /pay → paid ✅

## BAJARILGAN (3-sessiya, davomi) — Объединение (merge) endpointi (404)
**Muammo**: orderlarni birlashtirishda "Ошибка 404" — `POST /api/orders/merge` yo'q edi.
**Yechim** (`orders.routes.js`): `POST /merge` `{targetOrderId, sourceOrderIds}`:
- Source orderlarning taomlari target'ga (★ asosiy) ko'chadi → target recalc
- Source orderlar O'CHIRILADI (stollari bo'shaydi, hisobotdan/ro'yxatdan chiqadi)
- Faqat to'lanmagan orderlar (merge = to'lov amaliyoti). Test: A(1)+B(2)→target 3 item,
  subtotal birlashdi, B o'chdi, stol bo'shadi ✅

## BAJARILGAN (3-sessiya, davomi) — Soatlik taomlar (PlayStation/kabinka)
**Talab**: kabina/PlayStation kabi soatlik to'lanadigan taomlar — narx soatiga, summa
DAQIQALARGA bo'linib (prorata) hisoblanadi.
**Yechim** (frontend kepket'da TAYYOR edi — `utils/hourly.ts`; backend qo'shildi):
- `food.model`: `isHourly` (bool). price = SOATLIK stavka.
- `order.model` foods sub-schema: `isHourly, hourlyPrice, hourlyStartedAt, hourlyStoppedAt,
  hourlyFinalAmount, addedAt`.
- `order-calc.js`: `hourlyItemAmount` / `itemLineAmount` — amount=(o'tgan_ms/1soat)×price×qty
  (frontend computeHourlyForItem bilan AYNAN bir xil). subTotal soatlik itemlarni shu bo'yicha.
- `buildFoods`: soatlik food → item.isHourly, hourlyPrice=food.price, hourlyStartedAt=now.
- `pay`: soatlik itemlar MUZLATILADI (hourlyStoppedAt + hourlyFinalAmount) — vaqt to'xtaydi.
- `mapOrder`: hourly maydonlarni emit qiladi. `/menu` endpoint isHourly qaytaradi.
- Frontend: menu kartochkada narx yoniga "/ч"; getMenuItems isHourly.
- **Seed**: PlayStation 5000/soat, Кабинка (VIP) 8000/soat ("Время" kat).
- Test: PlayStation order → 30 daqiqa → to'lovda 2501 (≈5000×0.5) muzlatildi, usluga ham qo'shildi ✅
- Backend GET snapshot, frontend JONLI (har 30s) hisoblaydi — kepket dizayni.
- **Saboy/takeaway'da soatlik taomlar YASHIRILADI** (`Menu.tsx` hideHourly): PlayStation/
  kabinka faqat dine-in (o'tirib) uchun. Saboy yaratish + saboyga +blyudo'da menyudan ham,
  "Время" kategoriyasidan ham chiqmaydi. Dine-in'da ko'rinadi.

## BAJARILGAN (3-sessiya, davomi) — System admin login: TELEFON + KZ/UZ selektor
**Talab**: system admin (restaurant_admin) login'i username ("admin") emas, TELEFON raqam
+ KZ/UZ davlat selektori bo'lishi kerak (POS login kabi).
**Yechim**:
- `system_admin.model`: `phone` qo'shildi (unique partial). username ixtiyoriy bo'ldi.
- `system.routes.js` login: `{phone, password}` qabul qiladi (normalizePhone), username fallback.
- `Login.jsx` (restaurant_admin): username input → **KZ (+7) / UZ (+998) selektor + telefon
  input**. To'liq raqam = davlat kodi + raqam.
- `api.js`/`auth.jsx`: login phone yuboradi.
- `set-admin-phone.js` + `seed-system-admin.js`: telefon o'rnatish. Mavjud admin yangilandi:
  **+77005000900 / admin12345**.
- Test: telefon login success, +siz raqam normalizatsiya, xato parol rad ✅. Build 40 modul.

## BAJARILGAN (3-sessiya, davomi) — restaurant_admin → super_admin (rename)
**Aniqlik**: `global/restaurant_admin` aslida **SUPER ADMIN** paneli (AridaiPos jamoasi,
BARCHA restoranlarni boshqaradi) — nomi chalkashtirardi (bitta restoran admini deb).
**Yechim**: folder `global/restaurant_admin` → `global/super_admin` ko'chirildi.
- package.json/lock name: restaurant-admin → super-admin
- Joriy-holat docs (glossariy, loyiha-mohiyati, web-admin, _MOC): super_admin
- Dated changeloglar (29-30 may) — tarix sifatida o'zgarmadi
- Funksiya o'zgarmadi: super admin telefon bilan kiradi (+77005000831/123456). Build toza.
- Run: `cd global/super_admin && npm run dev` (:5173)

## BAJARILGAN (3-sessiya, davomi) — SYNC ULANDI (local server ↔ global localhost:4560)
**Talab**: global hali deploy qilinmagan → local server **localhost:4560** (dev global
backend) bilan sinxronlanib tursin. Panel'da yaratilgan user/menyu local'ga tushsin.
**Yechim** (`sync-client.js` + `server.js`):
- `sync-client.js`: `startSyncLoop(20s)` / `stopSyncLoop` / `runSyncCycle` qo'shildi.
  Har tsikl: **PULL** (bootstrapSync: global→local — restaurant/branch/menyu/stol/user/
  service/discount) + **PUSH** (collectPending + pushSync: local→global order/smena).
- `server.js`: provisioning yuklangach (branchToken bor) `startSyncLoop()` boshlanadi.
  Global offline bo'lsa — xato bermay kutadi (keyingi tsikl). stopLocalBackend'da to'xtaydi.
- Global backend'da `/api/sync/bootstrap` + `/push` ALLAQACHON bor edi (faqat ulanmagan edi).
- **Test**: global'ga (Sayna) user qo'shildi → ~22s → **local'da paydo bo'ldi** ✅
- Endi super/owner panel'da yaratilgan ma'lumot (provisioned filial uchun) avtomatik local'ga.

**MUHIM eslatma**: +77005000832 — bu **BrendPlov Ayraport** (boshqa filial). Local server
**Sayna**'ga provisioned → faqat Sayna ma'lumotini sync qiladi. Ayraport'ni test qilish uchun
local serverni Ayraport'ga qayta provisioning kerak.

## BAJARILGAN (3-sessiya, davomi) — Dinamik filial login (global-verified)
**Talab (foydalanuvchi)**: local server BITTA filialga qotib qolmasligi kerak. POS'da filial
admin login qilsa — login GLOBAL orqali tekshirilsin, foydalanuvchi qaysi restoran/filial
admini bo'lsa, O'SHA filial ma'lumoti local'ga yuklanib, kiritsin. (Aks holda bir filialga
provisioned bo'lsa, boshqa filialга kira olmaslik — xato.)
**Yechim** (`auth.routes.js` login qayta yozildi):
- Login local'da topilsa → DARHOL kiradi (offline ham, tez).
- Local'da YO'Q → `provisionFromGlobal()`: global `/api/sync/provision` (branch_admin login →
  branchToken) → o'sha filialни faollashtir (branchToken) + `bootstrapSync()` (menyu/stol/
  user — parol hashi bilan) → user endi local'da → kiradi + startSyncLoop.
- Global offline + user local'da yo'q → "Birinchi kirish uchun internet kerak".
- **Test**: +77005000832 (Ayraport, local'da yo'q) → global'dan yuklandi → KIRDI (Ayraport,
  menyu 0). +77005000831 (Sayna, local'da bor) → darhol KIRDI (Sayna, 12 taom). Har admin
  O'Z filiali ma'lumotini ko'radi (branch filtri). Noto'g'ri parol → rad ✅.
- Endi local DB'da ikkala filial useri bor; data endpointlar token'dagi filialga filtrlaydi.
**Eslatma**: prod'da 1 local server = 1 filial (fizik). Dinamik yuklash — qaysi admin kirsa,
o'sha filial. Sync loop oxirgi faollashtirilgan filialни tortadi (multi-branch continuous
sync — keyingi refinement).

### TUZATISH — filial izchilligi (1 local server = 1 AKTIV filial)
**Muammo (foydalanuvchi)**: status UI'ga +832 (Ayraport), POS'ga +831 (Sayna) bilan kirdim —
ikkalasi ham ishladi. Lekin local server va POS BOSHQA-BOSHQA filial bo'lishi NOTO'G'RI.
Sabab: dinamik login juda erkin edi (local'da ikkala filial useri bor → ikkalasi kirardi).
**Yechim** (`auth.routes.js`): login qurilmaning **AKTIV filiali** (`config.branchId`) ichida
qidiriladi:
- Aktiv filial useri (admin yoki xodim) → kiradi.
- Boshqa filial **ADMIN**i → provisionFromGlobal qurilmani O'SHA filialga **O'TKAZADI**
  (status UI + POS + sync hammasi bitta filial bo'ladi).
- Boshqa filial **XODIMI** (waiter) → provision rad etadi (faqat admin o'tkaza oladi) → RAD.
- Test: Sayna admin→Sayna; Sayna waiter→Sayna OK; Ayraport admin→qurilma Ayraport'ga;
  Sayna waiter→Ayraport qurilmasiga RAD; Sayna admin→qaytib Sayna ✅.
Endi har vaqt qurilma BITTA filial — status UI va POS izchil.

## BAJARILGAN (3-sessiya, davomi) — Filial admin web paneli (global/filial_admin)
**Talab**: filial admin web sayti, kepket POS dizayni, `global/backend` (4560) ga ulanadi.
Filial admin kategoriya/taom/kabina/stol yaratadi, import/export. Kelajakda seyf/sklad.
**Yechim** — yangi `global/filial_admin/` (React+Vite, kepket krem/qizil dizayn, Manrope):
- `vite.config`: /api → 4560 proksi, port 5175. Login: `/api/users/login` (branch admin,
  KZ/UZ selektor). Token branchId/restaurantId — filial admin o'z filialini boshqaradi.
- Sahifalar: **Меню** (Foods CRUD + isHourly + CSV import/export), **Категории** (CRUD),
  **Столы и кабины** (CRUD, type стол/кабина). Сейф/Склад — "скоро" placeholder.
- Backend tuzatishlari (global): food model'ga `isHourly` qo'shildi; `POST /api/tables/create`
  (branch-admin uchun, authMiddleware — eski /table/create owner token kutardi); create'larga
  restaurantId (token'dan/body'dan).
- Test: login → kategoriya/taom(isHourly)/stol(cabin) CREATE ✅. Frontend build toza (161KB).
- **Oqim**: filial admin global'ga yozadi → sync (20s) → local server → POS'da ko'rinadi.
- Run: `cd global/filial_admin && npm run dev` (:5175). Login: +77005000831/123456 (Sayna).

## BAJARILGAN (3-sessiya, davomi) — REAL-TIME menyu sinxronlash (socket)
**Talab**: global'da (filial admin panel) menyu/kategoriya o'zgarsa — POS'da dasturni qayta
ishga tushirmasdan, REAL-TIME o'zgarishi kerak.
**Muammo**: sync global→local'ga olib kelardi, lekin POS renderer eski menyuni keshlab turardi.
**Yechim** (4 fayl):
- `sync-client.js`: bootstrap'da menyu **signaturasi** (categories/foods/tables/services
  title/narx/isHourly...). runSyncCycle signatura O'ZGARSA → `onChange` callback (har tsiklda emas).
- `server.js`: o'zgarishda `io.emit("menu:updated", counts)` (local socket → POS).
- `CashierApp.tsx`: socket `menu:updated` → `loadData()` + `window` event `aridai:menu-updated`.
- `Menu.tsx` (MenuScreen): `aridai:menu-updated` → menyu+kategoriyani qayta yuklaydi.
- Sync interval 20s → **10s** (tezroq his). POS event'da DARHOL yangilanadi.
- **Test**: 4s o'zgarishsiz → 0 emit (keraksiz refresh yo'q); global kategoriya o'zgardi →
  EMIT #1 (t=15s) → POS qayta yuklaydi ✅. Faqat haqiqiy o'zgarishda.
**Oqim**: filial admin → global → sync(≤10s, signatura) → socket → POS menyu REAL-TIME.

## QOLGAN — keyingi katta qadamlar (tartib)
1. **`/api/orders`** (getOrders, createOrder) + order modeli → kepket `items[]` (item-level
   status/isPaid, hourly, orderType dine-in/saboy) — **eng katta**. Mening `foods[]` modeli.
2. **`/api/orders/:id/items`** (addItems), `updateItemQuantity`, `setOrderDiscount/Charges`
3. **`/api/payments`** (processPayment) — to'liq summa validatsiya; partial payment (item isPaid)
4. **getDailySummary** (`/api/orders/daily-summary` yoki shift stats) — header ВЫРУЧКА
5. **Expenses/Advances** model + endpoint (Расходы/Авансы)
6. **Sync** order/shift push local↔global, online↔offline toza
7. Boshqa ilovalar (waiter, admin, bar, warehouse) — keyin

## Test holati (yangilangan)
- Login `+77005000831`/`123456` (asdsad) → smena ochiladi → menyu/stol ko'rinadi ✅
- Order/to'lov hali yo'q (keyingi qadam: order modeli `items[]`)

## Test holati
- Local backend: 4561, BrendPlov Sayna provisioned, login `+77005000831`/`123456`
- BrendPlov'da menyu YO'Q (foods:0) — POS bo'sh ko'rinadi, menyu qo'shilishi kerak
- Frontend renderer: `local/renderer/src` (kepket), build toza (78 modul)
- Mening eski renderer zaxira: `local/renderer/src_my_backup`

## Bog'liq
- kepket-kz/aridai-pos-monitor (frontend manba)
- kepket-kz/restoran-backend-v2 (backend manba)
- [[../02-arxitektura/sinxronizatsiya/offline-to-online-otish]] — sync (asosiy muammo)
