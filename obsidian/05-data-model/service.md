---
tags: [data-model, entity]
created: 2026-05-28
entity: service
---

# Entity: service (xizmat haqqi)

## Maqsadi

Restoran "xizmat haqqi" foizi — order'da ofitsiantning xizmati uchun avtomatik qo'shiladigan summa. Joriy modelda har filialga bitta service bor (oddiy faiz). Kelajakda — order turi bo'yicha alohida (dineIn uchun 6%, takeaway uchun 0%).

## Schema (joriy)

```javascript
const serviceSchema = new mongoose.Schema({
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
  servicePercent: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  isActive: {
    type: Boolean,
    default: true,
  },

  // Kelajakda kengaytirish uchun
  applyTo: {
    type: [String],
    enum: ['dineIn', 'takeaway', 'delivery'],
    default: ['dineIn'],
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

serviceSchema.index({ branch: 1, isActive: 1 });
serviceSchema.index({ restaurantId: 1 });
```

## Joriy holatdan farqi

Hozirgi [service.model.js](../../../global/backend/models/service.model.js) faqat `branch` va `servicePercent` bor. Yangi field'lar qo'shilishi tavsiya etiladi:
- `restaurantId` (denorm)
- `isActive`
- `applyTo[]`
- Sync metadata

## Field'lar tafsiloti

| Field | Tur | Tavsif |
|---|---|---|
| `branch` | ObjectId | Filial |
| `restaurantId` | ObjectId | Denorm |
| `servicePercent` | number | Foiz (6 ma'nosi 6%) |
| `isActive` | boolean | Yoqilganmi |
| `applyTo[]` | enum array | Qaysi order turlariga qo'llaniladi |

## Service necha dona bo'ladi?

Joriy ko'rinishda: bitta filial = bitta service.

Kelajakdagi muammolar:
- Kunduzgi 8% va tungi 10% — ikkita rule kerak (vaqtga bog'liq)
- VIP zal uchun 12%, normal uchun 6% — stol turi bog'liqligi

Hozircha — soddalik uchun **bitta service per branch**. Murakkablik kelajakka.

## Order'da snapshot

Order yaratilganda — service `servicePercent` snapshot olinadi:

```javascript
order.service = {
  serviceId: service._id,
  percent: service.servicePercent,     // SNAPSHOT
  amount: subTotal * (service.servicePercent / 100),  // hisoblangan
};
```

Service o'zgartirilsa — eski order'da eski foiz qoladi.

## Hisoblash

```javascript
function calculateServiceCharge(order) {
  if (!order.service || !order.service.percent) return 0;
  return Math.round(order.subTotal * (order.service.percent / 100));
}
```

Service charge:
- DineIn order'larida default qo'shiladi
- Takeaway/delivery'da default qo'shilmaydi (lekin `applyTo`'da bo'lsa qo'shiladi)
- Discount qo'llanishidan **keyin** hisoblanadi yoki **avval** — qaror kerak. Qarang: [[biznes-mantiq/total-hisoblash]]

## Service charge ofitsiantga

[[../04-toollar/keldi-ketti|Keldi-ketti tool]]da waiter foiz haqqi bor:
```javascript
salaryRule.config.percent = 6;
// = waiter shu smenadagi order'lar service charge'idan 6% oladi
```

Lekin **service.percent != waiter percent** — alohida narsalar.

## Foydalanish

Joriy backend'da [order.routes.js](../../../global/backend/routes/order.routes.js)'da service ref saqlanadi, lekin amount hisoblanmaydi. Tuzatish kerak — order yaratilganda service snapshot olinishi.

## Multi-tenant guard

```javascript
serviceModel.findInTenant(req.userData)
  .where({ branch: req.userData.branchId, isActive: true });
```

## Sample document

```json
{
  "_id": "65f9c0d1e2f3a4b5c6d7e8f9",
  "branch": "65f2b3c4d5e6f7a8b9c0d1e2",
  "restaurantId": "65f1a2b3c4d5e6f7a8b9c0d1",
  "servicePercent": 6,
  "isActive": true,
  "applyTo": ["dineIn"],
  "syncStatus": "synced",
  "version": 1,
  "deleted": false
}
```

## Bog'liq

- [[_MOC]]
- [[order]]
- [[snapshot-strategiyasi]]
- [[biznes-mantiq/total-hisoblash]]
- [[../04-toollar/keldi-ketti]]
