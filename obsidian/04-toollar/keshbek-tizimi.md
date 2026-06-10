---
tags: [tool]
created: 2026-05-28
toolKey: keshbek
status: ✅ core implemented (2026-06-10)
default: OFF
---

# Tool: Keshbek tizimi

## Meta

- **Key:** `keshbek`
- **Status:** ✅ core implemented (2026-06-10) — earn QR (chek, deferred) + spend online (POS СМЕШАННАЯ) + admin balanslar. Qoldi: WhatsApp bot integratsiyasi (webhook stub), SMS, expire scheduler
- **Default:** OFF
- **Version:** 1
- **requires:** core (payment, order)
- **excludes:** —

## Maqsad

Har tolov chekida QR. Mijoz QR'ni skanerlasa — WhatsApp botga o'tadi. Bot mijozning telefon raqamini oladi, mijozga shu tolovdan **necha foiz keshbek berilgani** haqida SMS yuboradi. Keshbek balansi — restoran ichida saqlanadi. Keyingi tolovlarda **keshbek balansidan to'lash** mumkin (faqat keshbek yoki gibrid naqt+keshbek, karta+keshbek).

## Foydalanuvchi senariolari

### Senariy 1: Mijoz birinchi marta keldi
1. 5000 tenge'lik ovqatlandi, naqd toladi
2. Chekda QR chiqdi (default 5% keshbek = 250 tenge)
3. Telefonda QR'ni skanerladi → WhatsApp bot ochildi
4. Bot: "Telefon raqamingizni jo'nating tugmasi"
5. Mijoz jo'natdi: +998901234567
6. Bot: "Sizga 250 tenge keshbek berildi! Keyingi tashriﬁgizda foydalanishingiz mumkin."
7. `keshbek_balance[+998901234567] += 250`

### Senariy 2: Mijoz qaytadan keldi
1. 3000 tenge'lik ovqat
2. Cashier'ga "Keshbek bor" deydi
3. Cashier "Tolov turi: Keshbek" tanlaydi
4. Telefon raqamini kiritadi → balansi 250 tenge ekan
5. "250 tenge keshbek + 2750 tenge naqd" gibrid
6. Order paid, paymentMethod='cashback', mixed: { cash: 2750, cashback: 250 }
7. Balans nolga tushdi
8. Yangi chekka qo'shimcha keshbek qo'shiladi (3000 * 5% = 150)

### Senariy 3: Faqat keshbek bilan
1. Mijoz balansi 5000 tenge
2. 4000 tenge'lik ovqat
3. To'liq keshbek bilan tolaydi
4. Balansi 1000 tenge qoladi (+ yangi 200 = 1200)

## UI o'zgarishlar

| Role | UI |
|---|---|
| Admin (web) | Sozlamalar → Keshbek: %, WhatsApp bot ulanishi, SMS sozlamalari |
| Admin (web) | Yangi sahifa: "Keshbek balanslari" — mijozlar va qoldiqlari |
| Cashier (POS) | Tolov turi'da yangi: "Keshbek" (gibrid imkonida) |
| Mijoz (WhatsApp bot) | Tashqi UI — biz nazorat qilamiz |

## Data model

> [!note] Customer entity bilan bog'liq
> Keshbek telefon raqami orqali ishlaydi. Shu telefon **customer** entity'siga ham bog'lanadi (mijoz tarixi, tolovlar) — [[../05-data-model/customer]]. Telefon WhatsApp orqali olinadi → customer upsert + cashback_balance.

```javascript
// cashback_balance
{
  _id, restaurantId,    // restoran ichida (filiallar orasida bo'linmasligi mumkin)
  clientPhone: String,  // unique per restoran, customer.phone bilan bog'lanadi
  balance: Number,
  totalEarned: Number,
  totalSpent: Number,
  lastActivityAt: Date,
}

// cashback_movement
{
  _id, restaurantId, branchId, clientPhone,
  direction: 'earn' | 'spend',
  amount: Number,
  refOrderId: ObjectId,
  createdAt,
}

// cashback_qr_session — bot session
{
  _id, restaurantId, branchId,
  orderId, checkAmount, earnAmount,
  qrToken: String,    // QR'da kodlangan
  status: 'pending' | 'phone_captured' | 'expired',
  capturedPhone: String,
  createdAt, expiresAt, capturedAt,
}

// order.cashback (mavjud modelga qo'shimcha)
order.cashback: {
  earned: Number,
  spent: Number,
  clientPhone: String,
}
```

## API endpoint'lar

| Method | Path | Auth |
|---|---|---|
| POST | `/api/keshbek/qr-session` | system (chek generatsiya paytida) |
| GET | `/api/keshbek/qr-session/:token` | public — bot WhatsApp tomondan |
| POST | `/api/keshbek/qr-session/:token/phone` | public — bot phone kiritadi |
| GET | `/api/keshbek/balance/:phone` | cashier |
| POST | `/api/keshbek/spend` | cashier (tolov payti) |
| GET | `/api/keshbek/movements/:phone` | admin |
| POST | `/api/keshbek/whatsapp/webhook` | HMAC verify (WhatsApp Cloud API) |

## Socket eventlar

| Yo'nalish | Event | Maqsad |
|---|---|---|
| G → role:cashier | `keshbek.balance_loaded` | Cashier balans so'rasagina |
| G → admin | `keshbek.new_client` | Yangi keshbek mijoz |
| G → barchaga | `order.paid` (cashback paymentMethod bilan) |

## Rejimlar ichida xatti-harakati

### Online
- To'liq ishlaydi
- Chek QR generatsiya, WhatsApp webhook
- Spend tekshiruv real-time

### Offline

> [!important] QAROR (foydalanuvchi, 2026-05-29): Offline'da keshbek bilan TOLASH ishlamaydi
> Keshbek balansi restoran bo'yicha umumiy, offline'da uni xavfsiz kamaytirib bo'lmaydi (double-spend xavfi). Shuning uchun **offline rejimda keshbek bilan tolash butunlay o'chiriladi.**

**Spend (tolash) — offline'da YO'Q:**
- POS tolov panelida "Keshbek" tugmasi offline'da **disabled** ko'rinadi
- Mijozga: "Keshbek bilan tolash hozir mavjud emas. Internet qaytganda ishlatasiz."
- Mijoz naqd / karta bilan tolaydi
- Hech qanday cached balans tekshiruvi yo'q, hech qanday reconcile yo'q — sodda va xavfsiz

**Earn (qo'shish) — offline'da ISHLAYDI (deferred):**
- Chekka QR offline'da chiqadi (lokal token, outbox'da)
- Mijoz QR'ni keyinroq (o'z internetida) skanerlaydi → WhatsApp bot global'ga uradi
- Filial sync bo'lgach token global'da bo'ladi → keshbek hisoblanadi
- Additive (+) → har doim xavfsiz

> [!note] Nima uchun earn ishlaydi, spend yo'q
> Earn = balansni **oshiradi** (+), QR-skanerlash orqali global'da hisoblanadi — offline filial faqat QR chop etadi, balansga to'g'ridan-to'g'ri tegmaydi. Spend = balansni **kamaytiradi** (−), umumiy hisoblagichni offline o'zgartirish xavfli. Shuning uchun asimmetrik: earn ✅, spend ❌.

### Possiz
- Possiz = offline turi → **keshbek bilan tolash YO'Q** (offline kabi)
- Cashier mobile'da "Keshbek" tugmasi disabled
- Earn: PDF chekka QR qo'yiladi (mijoz keyin skanerlaydi)
- Naqd / transfer bilan tolanadi

## Boshqa toollarga bog'liqlik

- `requires`: payment, order
- `excludes`: —
- Enhances:
  - `qrPay` — keshbek Kaspi tolovida ham hisoblanadi
  - Order check'ga QR qo'shilishi

## O'chirilganda — nima bo'ladi?

- Chek QR'siz chiqadi
- Tolov turlari'dan "Keshbek" yo'qoladi
- WhatsApp webhook'lar — orphan qabul qilinadi, hech narsa qilinmaydi
- Mavjud balanslar **saqlanib qoladi**
- Re-enable: eski balanslar ishlatilishi mumkin

## Lifecycle hook'lar

### onInstall
```javascript
async function keshbekOnInstall(restaurantId) {
  await db.createCollection('cashback_balances');
  await db.createCollection('cashback_movements');
  await db.createCollection('cashback_qr_sessions');
  await db.createIndex('cashback_balances', { restaurantId: 1, clientPhone: 1 }, { unique: true });
}
```

### onEnable
```javascript
async function keshbekOnEnable(restaurantId, config) {
  if (!config.whatsappToken) throw new Error('WhatsApp bot credential kerak');
  eventBus.on(`order.paid:${restaurantId}`, earnCashbackOnPayment);
  scheduler.schedule(`keshbek_expire_${restaurantId}`, '0 0 * * *', expireOldSessions);
}
```

### onDisable
- Listener'lar detach
- Schedulerlar cancel
- Balanslar **qoladi**

## Konfiguratsiya

```javascript
features.keshbek.config = {
  percent: 5,                  // foiz
  minOrderAmount: 1000,        // min order to earn
  maxBalance: 100000,          // max accumulation
  whatsappToken: '...',
  whatsappPhoneNumberId: '...',
  smsGateway: 'eskiz',         // eskiz | playmobile
  smsApiKey: '...',
  qrSessionExpiryHours: 24,
  expireUnusedAfterDays: 365,  // 1 yil ishlatilmasa keshbek yo'qoladi
}
```

## Hisoblash misol

Order 5000 tenge. Konfig 5%, min 1000.
- Earn: 5000 * 0.05 = 250 tenge
- Mijoz QR skanerlaydi, phone jo'natadi
- Balans += 250

Keyingi order 3000 tenge, mijoz keshbek bilan:
- Available balance: 250
- Tolov: 250 keshbek + 2750 naqd
- Yangi earn: 3000 * 0.05 = 150
- Balans = 0 + 150 = 150

> [!note] Keshbekdan kelgan tolovga keshbek beriladimi?
> Konfiguratsiya: `earnOnCashbackPortion: false` — keshbek qismi qaytadan keshbek bermaydi (chunki bu marketing pul). Standart shunday.

## Xavfsizlik

- WhatsApp webhook HMAC tekshirish
- QR token — short-lived (24 soat)
- Phone fraud: 1 phone uchun 1 chek = 1 marta capture
- Balans manipulyatsiyasi — faqat admin va system mantiqi
- Multi-tenant: A restoran phone B restoranga ko'rinmaydi

## WhatsApp bot oqimi

```
[Mijoz QR'ni skanerladi]
  ↓
WhatsApp ochiladi: ?text=KESHBEK_TOKEN_xxxxx
  ↓
Bot xabarni qabul qiladi, token'ni parse qiladi
  ↓
Bot: "Salom! Tolovingiz tasdiqlandi.
      Keshbek hisoblash uchun telefon raqamingizni jo'nating."
      [Telefon raqamini jo'natish] tugmasi
  ↓
Mijoz tugmani bosadi, telefon raqami avtomatik jo'natiladi
  ↓
Bot bizning API'ga: POST /qr-session/{token}/phone
  ↓
API: balansga qo'shadi, SMS yuboradi
  ↓
Bot: "Sizga {amount} tenge keshbek berildi.
      Joriy balans: {balance} tenge."
```

## Test rejasi

- [ ] Default OFF
- [ ] Yoqildi: chek'da QR chiqadi
- [ ] WhatsApp webhook: phone capture
- [ ] Balans qo'shildi
- [ ] SMS yuborildi (mock)
- [ ] Spend (ONLINE): cashier balans tekshiradi, qisman ishlatadi
- [ ] Gibrid tolov (ONLINE): cashback + cash
- [ ] To'liq cashback tolov (ONLINE)
- [ ] ⭐ Offline'da "Keshbek" tugma DISABLED (spend mutlaqo ishlamaydi)
- [ ] ⭐ Offline'da earn ishlaydi (QR chek'da chiqadi, deferred)
- [ ] ⭐ Possiz'da spend disabled, earn QR PDF chek'da
- [ ] O'chirildi: QR yo'q, balanslar saqlangan
- [ ] Re-enable: eski balans ishlaydi
- [ ] Multi-tenant: phone A→A'da bor, B'ga ko'rinmaydi
- [ ] Expire 365 kun

## Bog'liq

- [[_MOC]]
- [[qr-pay-kaspi]] (enhances)
- [[../03-tool-strategiyasi/feature-toggle-tizimi]]
