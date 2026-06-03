---
tags: [tool]
created: 2026-05-28
toolKey: qrOrder
status: 📝
default: OFF
---

# Tool: QR Order (Mijoz QR orqali buyurtma)

## Meta

- **Key:** `qrOrder`
- **Status:** 📝 dizayn
- **Default:** OFF
- **Version:** 1
- **requires:** core (table)
- **excludes:** —

## Maqsad

Har stolda QR kod. Mijoz QR'ni telefonida skanerlasa — shu filialning menyusi ochiladi. Tanlab "Buyurtma berish" bossa, order POS monitor'ga **tasdiqlash uchun** yuboriladi (haqiqatan stolda odam bormi?). Cashier tasdiqlasa — order yaratiladi.

## Foydalanuvchi senariolari

### Senariy 1: Mijoz stol QR'sini skanerladi
1. Mijoz telefoni kameraga ko'rsatadi
2. URL: `https://order.aridai.com/{branchSlug}/{tableId}`
3. Brauzerda menyu ochiladi (filial brendingi bilan)
4. Mijoz "Osh, mantı" tanlaydi → "Buyurtma berish"
5. POS monitor'ga "Stol 5 — yangi order kelmoqda" push
6. Cashier "Tasdiqlash" yoki "Rad qilish"

### Senariy 2: Cashier tasdiqladi
- Order odatdagi singari yaratiladi (waiterId=null, source='qr')
- Cook'ga boradi
- Stolga yetkaziladi

### Senariy 3: Cashier rad qildi (hech kim yo'q)
- Mijoz brauzerida "rad qilindi" xabari
- Order yaratilmaydi

## UI o'zgarishlar

| Role | UI |
|---|---|
| Admin (web) | "Stollar" sahifasida har stolga QR yaratish + PDF chop etish |
| Cashier (POS) | "Yangi QR order" notification banner + tasdiqlash modal |
| Mijoz (brauzer) | Hech qanday auth talab qilmaydigan menyu sahifa |

## Data model

`table` modeliga qo'shimcha:
```javascript
table.qrEnabled: Boolean
table.qrSlug: String     // unique per branch, qisqa
table.qrLastReset: Date  // qayta yaratilgan sanasi
```

Yangi entity:
```javascript
// qr_order_request — tasdiqlanmagan order
{
  _id, restaurantId, branchId, tableId, qrSlug,
  customerData: { name?, phone? },  // optional
  items: [ { foodId, quantity, foodNameSnap, foodPriceSnap } ],
  status: 'pending' | 'approved' | 'rejected' | 'expired',
  requestedAt: Date,
  decidedAt: Date,
  decidedBy: ObjectId,    // cashier
  approvedOrderId: ObjectId,  // agar approved
  expiresAt: Date,         // 5 minut keyin auto-expire
}
```

## API endpoint'lar

| Method | Path | Auth | Tavsif |
|---|---|---|---|
| GET | `/api/qr-order/menu/:branchSlug/:tableId` | Yo'q | Menyu (public) |
| POST | `/api/qr-order/request` | Yo'q | Yangi qr request |
| GET | `/api/qr-order/request/:id/status` | Yo'q | Mijoz status'ni so'raydi |
| GET | `/api/qr-order/pending/:branchId` | cashier | Tasdiqlash kutayotganlar |
| POST | `/api/qr-order/:id/approve` | cashier | Tasdiqlash |
| POST | `/api/qr-order/:id/reject` | cashier | Rad |
| POST | `/api/qr-order/tables/:id/regenerate` | admin | QR qayta yaratish (compromise paytda) |

## Socket eventlar

| Yo'nalish | Event | Maqsad |
|---|---|---|
| G → role:cashier | `qrOrder.pending` | Yangi tasdiqlash |
| G → public (subscription) | `qrOrder.status_changed` | Mijoz brauzeri |
| G → barchaga | `qrOrder.approved` → `order.created` chiqaradi |

## Rejimlar ichida xatti-harakati

### Online
- To'liq ishlaydi

### Offline
- Mijoz QR'ni skanerlaganda menyu lokal backend'dan ochilishi mumkin (agar lokal webserver bo'lsa)
- Hozircha — offline'da QR order **ishlamaydi** (sodda boshlash)
- Kelajakda — lokal webserver, mijoz lokal Wi-Fi'da bo'lsa ishlaydi

### Possiz
- Ishlamaydi (mobile cashier orqali qabul qilish mumkin emas — boshqacha oqim kerak)

## Boshqa toollarga bog'liqlik

- `requires`: core (table — stol bo'lmasa QR yo'q)
- `excludes`: —
- Optional integration:
  - `qrPay` — mijoz menyu'dan to'g'ridan-to'g'ri tolovga o'tishi mumkin

## O'chirilganda — nima bo'ladi?

- QR public URL 404
- Cashier'da "Yangi QR order" notification yo'q
- Stollardagi qog'oz QR'lar ishlamaydi (lekin ma'lumotda saqlanib qoladi)
- POS order berish odatdagicha

## Lifecycle hook'lar

### onInstall
```javascript
async function qrOrderOnInstall(restaurantId) {
  await db.createCollection('qr_order_requests');
  await db.createIndex('qr_order_requests', { branchId: 1, status: 1, requestedAt: -1 });
  // Mavjud stollarga qrSlug generatsiya
  await tablesModel.find({ restaurantId, qrSlug: null }).each(async (t) => {
    t.qrSlug = generateShortSlug();
    await t.save();
  });
}
```

### onEnable
```javascript
async function qrOrderOnEnable(restaurantId) {
  // Public route'ni aktiv qilish
  scheduler.schedule(`qrOrder_expire_${restaurantId}`, '* * * * *', expirePendingRequests);
}
```

## Konfiguratsiya

```javascript
features.qrOrder.config = {
  requireCustomerPhone: false,
  pendingExpiryMinutes: 5,
  autoApprove: false,        // har order'ni cashier tasdiqlasinmi?
  publicUrlBase: 'order.aridai.com',
  brandedSubdomain: null,    // 'restoran-X.aridai.com' (premium)
}
```

## Xavfsizlik

- QR slug qisqa lekin nadir (8 belgi, base62, ~218 trillion variants per branch)
- Rate limit: 1 IP / minutiga 10 ta order request
- Mijozdan telefon raqami — optional lekin keshbek bilan bog'lansa kerakli

## Test rejasi

- [ ] Default OFF, public route 404
- [ ] Yoqilgan, mijoz menyu'ga kira oladi
- [ ] Order request → cashier'ga push
- [ ] Approve: order yaratiladi
- [ ] Reject: order yaratilmaydi, mijozga xabar
- [ ] Auto-expire 5 minut
- [ ] O'chirilgan: QR public URL 404
- [ ] Multi-tenant: A restoran QR'i B'ning menyu'sini ochmaydi
- [ ] Rate limit ishlaydi
- [ ] QR regenerate: eski slug 404

## Bog'liq

- [[_MOC]]
- [[qr-pay-kaspi]] (mijoz menyu'dan tolov ham qilishi mumkin)
- [[../03-tool-strategiyasi/feature-toggle-tizimi]]
