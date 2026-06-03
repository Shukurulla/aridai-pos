---
tags: [tool]
created: 2026-05-28
toolKey: qrPay
status: 📝
default: OFF
---

# Tool: QR Pay (Kaspi)

## Meta

- **Key:** `qrPay`
- **Status:** 📝 dizayn
- **Default:** OFF
- **Version:** 1
- **requires:** core (payment, order)
- **excludes:** possiz (Kaspi internet kerak)

## Maqsad

Mijoz Kaspi Pay QR kodini stol/check'da skanerlaydi → telefondan tolov qiladi → POS'da order avtomatik `paid` deb belgilanadi, `paymentMethod='kaspi'`.

## Foydalanuvchi senariolari

### Senariy 1: Stol QR (statik)
1. Stolga Kaspi Merchant QR yopishtirilgan
2. Mijoz Kaspi ilovasida QR skanerlaydi → summani kiritadi → tolaydi
3. Kaspi webhook → bizning global'ga: "tolov X tenge keldi, ref: stolY"
4. POS'da o'sha stolda ochilgan order avtomatik `paid` belgilanadi
5. Cashier va waiter ekranida o'zgarish ko'rinadi

### Senariy 2: Check QR (dinamik)
1. Cashier "Tolov" tugmasini bosadi
2. POS ekranida Kaspi QR dinamik chiqadi (aniq summa kodlangan)
3. Mijoz skanerlaydi → kiritmaydi, faqat tasdiqlaydi → tolaydi
4. Webhook → POS'da darhol "Paid" + chek bosiladi

## UI o'zgarishlar

| Role | UI |
|---|---|
| Admin (web) | Sozlamalar → Kaspi: Merchant ID, secret, QR template |
| Cashier (POS) | "Tolov" usulida "Kaspi QR" tugma — dinamik QR chiqaradi |
| Mijoz | Kaspi Pay ilovasi (uchinchi tomon, biz nazorat qilmaymiz) |

## Data model

`order.paymentMethod` ga yangi qiymat: `'kaspi'`
`order.kaspi`:
```javascript
{
  invoiceId: String,     // Kaspi tomondan ref
  qrType: 'static' | 'dynamic',
  paidAmount: Number,
  paidAt: Date,
  webhookReceivedAt: Date,
}
```

Yangi entity:
```javascript
// kaspi_transaction — webhook qabul qilingan barcha
{
  _id, restaurantId, branchId,
  kaspiInvoiceId, kaspiRef,
  amount, currency,
  status: 'received' | 'matched' | 'orphan',
  matchedOrderId: ObjectId,
  rawWebhookPayload: Object,
  createdAt, matchedAt,
}
```

## API endpoint'lar

| Method | Path | Auth | Tavsif |
|---|---|---|---|
| POST | `/api/qr-pay/kaspi/webhook` | HMAC verify | Kaspi → biz (webhook) |
| POST | `/api/qr-pay/kaspi/invoice` | cashier | Dinamik QR yaratish |
| GET | `/api/qr-pay/kaspi/invoice/:id/status` | cashier | Status polling |
| GET | `/api/qr-pay/transactions/:branchId` | admin | Transaksiyalar log |
| POST | `/api/qr-pay/transactions/:id/match` | admin | Orphan'ni qo'lda order'ga bog'lash |

## Socket eventlar

| Yo'nalish | Event | Maqsad |
|---|---|---|
| G → role:cashier | `kaspi.invoice_paid` | QR tolovi keldi |
| G → role:waiter | `order.paid` | Order paid bo'ldi |
| G → admin | `kaspi.orphan_transaction` | Mos kelmaydigan tolov |

## Rejimlar ichida xatti-harakati

### Online
- To'liq ishlaydi

### Offline
- Kaspi webhook global'ga keladi — local backend qabul qila olmaydi
- POS'da "Kaspi QR" tugma disabled
- Statik QR mijozlar foydalanmasin uchun — stol QR ostiga "Hozir naqd qabul qilamiz" qog'oz

### Possiz
- `excludes`: yoqilmaydi

## Boshqa toollarga bog'liqlik

- `requires`: payment (core), order
- `excludes`: possiz
- Enhances: `keshbek` — keshbek balansidan qo'shimcha tolov qilish

## O'chirilganda — nima bo'ladi?

- "Kaspi QR" tugma POS'da yo'q
- Statik QR'lar webhook keladi → orphan log'ga, admin'ga "kaspi o'chiq" xabar
- Naqd va karta tolovlari odatdagicha

## Lifecycle hook'lar

### onInstall
```javascript
async function kaspiOnInstall(restaurantId) {
  await db.createCollection('kaspi_transactions');
  await db.createIndex('kaspi_transactions', { kaspiInvoiceId: 1 }, { unique: true });
}
```

### onEnable
```javascript
async function kaspiOnEnable(restaurantId, config) {
  if (!config.merchantId || !config.secret) {
    throw new Error('Kaspi merchant credentials kerak');
  }
  // Webhook URL ro'yxatdan o'tkazish (Kaspi tomon)
  await kaspiSdk.registerWebhook(config.merchantId, webhookUrlFor(restaurantId));
  eventBus.on(`kaspi.webhook:${restaurantId}`, matchTransactionToOrder);
}
```

### onDisable
```javascript
async function kaspiOnDisable(restaurantId) {
  eventBus.off(`kaspi.webhook:${restaurantId}`, matchTransactionToOrder);
  // Webhook bekor qilinishi mumkin yoki saqlab qolinishi (orphan log uchun)
}
```

## Konfiguratsiya

```javascript
features.qrPay.config = {
  provider: 'kaspi',          // kelajakda payme, click, ...
  merchantId: '...',
  secret: '...',
  qrType: 'dynamic',          // dynamic | static
  staticQrPerTable: false,    // har stolga statik QR
  autoMatchByTable: true,     // statik QR — stol bo'yicha
}
```

## Webhook xavfsizligi

- HMAC SHA-256 signature tekshiruv
- IP whitelist (Kaspi serverlari)
- Replay attack — `kaspiInvoiceId` unique constraint
- Timestamp tolerance (5 minut)

## Test rejasi

- [ ] Default OFF
- [ ] Yoqildi: webhook URL ro'yxatga oldi
- [ ] Dinamik QR yaratish ishlaydi
- [ ] Webhook qabul → order paid
- [ ] HMAC noto'g'ri — webhook rad
- [ ] Replay — ikkinchi marta hech narsa qilmaydi
- [ ] Orphan transaction admin'ga ko'rinadi
- [ ] O'chirildi: tugma yo'q, naqd ishlaydi
- [ ] Offline'da disabled
- [ ] Possiz rejimda yoqib bo'lmaydi (validation)

## Bog'liq

- [[_MOC]]
- [[keshbek-tizimi]] (enhances)
- [[cook-waiter-possiz-rejim]] (excludes)
