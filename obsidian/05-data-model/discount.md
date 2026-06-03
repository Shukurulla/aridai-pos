---
tags: [data-model, entity]
created: 2026-05-28
entity: discount
---

# Entity: discount (chegirma)

## Maqsadi

Restoran chegirmalari — order'ga qo'llaniladigan foiz yoki absolut summa. Joriy modelda faqat foiz. Kelajakda — promo kodlar, vaqtga bog'liq (happy hour), summa-based ("100k'dan ko'p bo'lsa 10%").

> [!important] Qaror (2026-05-29): admin yaratadi, kassir toggle qiladi
> Chegirmalarni **admin oldindan yaratadi**. Kassir order ustida **toggle orqali** yoqadi/o'chiradi — **qo'lda erkin** % yoki summa kirita olmaydi. Default: bir order = bitta chegirma. Tafsilot: [[../07-nozik-nuqtalar/chegirma-service-qollanishi]]

## Schema (joriy + tavsiya)

```javascript
const discountSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  discountPercent: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },

  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'branch',
    required: true,
  },
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'restaurant',
    index: true,
  },

  // Kelajakka kengaytirish
  type: {
    type: String,
    enum: ['percent', 'amount'],
    default: 'percent',
  },
  amount: Number,    // type='amount' uchun

  // Shartlar (kelajakda)
  conditions: {
    minOrderAmount: Number,
    applyTo: { type: [String], enum: ['dineIn', 'takeaway', 'delivery'] },
    validFrom: Date,
    validTo: Date,
    timeRange: {
      start: String,   // "14:00"
      end: String,     // "17:00"
    },
    daysOfWeek: [Number],   // 0-6
  },

  // Promo code (kelajakda)
  promoCode: {
    type: String,
    sparse: true,
    unique: true,
  },
  usageLimit: Number,         // necha marta ishlatilishi mumkin
  usageCount: { type: Number, default: 0 },

  isActive: {
    type: Boolean,
    default: true,
  },

  // Sync metadata
  clientId: { type: String, sparse: true, unique: true },
  version: { type: Number, default: 1 },
  syncStatus: { type: String, default: 'synced' },
  lastModifiedAt: { type: Date, default: Date.now },
  lastModifiedBy: { userId: mongoose.Schema.Types.ObjectId, origin: String },
  deleted: { type: Boolean, default: false },

}, {
  timestamps: true,
});

discountSchema.index({ branch: 1, isActive: 1 });
discountSchema.index({ restaurantId: 1 });
discountSchema.index({ promoCode: 1 }, { sparse: true, unique: true });
```

## Joriy holatdan farqi

Hozirgi [discount.model.js](../../../global/backend/models/discount.model.js) faqat `title`, `discountPercent`, `branch`. Tavsiya etilgan kengaytirishlar — kelajakda bosqichma-bosqich.

## Field'lar tafsiloti

| Field | Tur | Tavsif |
|---|---|---|
| `title` | string | Chegirma nomi (masalan "Doimiy mijozlar uchun") |
| `discountPercent` | number | Foiz |
| `type` | enum | percent / amount |
| `amount` | number | type='amount' bo'lsa absolut summa |
| `conditions` | object | Qo'llanish shartlari |
| `promoCode` | string | Mijoz kiritadigan kod (kelajakda) |
| `usageLimit` | number | Necha marta ishlatish mumkin |
| `usageCount` | number | Hozirgacha qancha ishlatildi |
| `isActive` | boolean | Yoqilganmi |

## Order'da snapshot

Order yaratilganda discount qo'llanilsa, **snapshot** olinadi:

```javascript
order.discount = {
  discountId: discount._id,
  title: discount.title,           // SNAPSHOT
  type: discount.type,
  percent: discount.discountPercent,  // SNAPSHOT
  amount: discount.amount,          // SNAPSHOT (agar amount type)
};
order.discountAmount = calculateDiscountAmount(order);
```

`discountAmount` — hisoblangan, integer (so'm/tenge).

## Hisoblash

```javascript
function calculateDiscountAmount(order) {
  if (!order.discount) return 0;

  if (order.discount.type === 'amount') {
    return Math.min(order.discount.amount, order.subTotal);
  }

  // percent
  return Math.round(order.subTotal * (order.discount.percent / 100));
}
```

> [!note] Diskon va xizmat haqqi tartibi
> Diskon avval qo'llanadimi yoki xizmat haqqi avval? Qarang: [[biznes-mantiq/total-hisoblash]]

## Shartlar tekshirish

```javascript
function canApplyDiscount(discount, order) {
  if (!discount.isActive) return false;
  if (discount.usageLimit && discount.usageCount >= discount.usageLimit) return false;

  const c = discount.conditions || {};
  if (c.minOrderAmount && order.subTotal < c.minOrderAmount) return false;
  if (c.applyTo && !c.applyTo.includes(order.orderType)) return false;
  if (c.validFrom && new Date() < c.validFrom) return false;
  if (c.validTo && new Date() > c.validTo) return false;

  if (c.timeRange) {
    const now = new Date();
    const hour = now.getHours() + now.getMinutes() / 60;
    const start = parseHour(c.timeRange.start);
    const end = parseHour(c.timeRange.end);
    if (hour < start || hour > end) return false;
  }

  if (c.daysOfWeek && !c.daysOfWeek.includes(new Date().getDay())) return false;

  return true;
}
```

## Discount bekor qilish

Order yaratilgach discount qo'llanilgan, lekin keyin admin shu discount'ni o'chirsa — **eski order'da discount qoladi** (snapshot). Hisobotda eski discount ko'rinadi.

Yangi order'larda yangi discount qo'llaniladi.

## Multi-tenant guard

```javascript
discountModel.findInTenant(req.userData)
  .where({ branch: req.userData.branchId, isActive: true });
```

## Sample documents

### Oddiy foizli
```json
{
  "_id": "65fa1d2e3f4a5b6c7d8e9f0a",
  "title": "Doimiy mijozlar uchun 10%",
  "discountPercent": 10,
  "type": "percent",
  "branch": "65f2b3c4d5e6f7a8b9c0d1e2",
  "restaurantId": "65f1a2b3c4d5e6f7a8b9c0d1",
  "conditions": {
    "minOrderAmount": 50000
  },
  "isActive": true,
  "version": 1,
  "deleted": false
}
```

### Happy hour
```json
{
  "_id": "65fa2d3e4f5a6b7c8d9e0f1b",
  "title": "Happy Hour — 20% off",
  "discountPercent": 20,
  "type": "percent",
  "conditions": {
    "applyTo": ["dineIn"],
    "timeRange": { "start": "14:00", "end": "17:00" },
    "daysOfWeek": [1, 2, 3, 4]
  },
  "isActive": true
}
```

### Promo code
```json
{
  "title": "NEW2026 — 5000 tenge",
  "type": "amount",
  "amount": 5000,
  "promoCode": "NEW2026",
  "usageLimit": 1000,
  "usageCount": 47,
  "isActive": true
}
```

## Bog'liq

- [[_MOC]]
- [[order]]
- [[snapshot-strategiyasi]]
- [[biznes-mantiq/total-hisoblash]]
