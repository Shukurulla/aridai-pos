---
tags: [data-model, performance]
created: 2026-05-28
---

# Index strategiyasi

## Asosiy printsiplar

1. **Har query'da `restaurantId` birinchi** — multi-tenant guard
2. **Compound index'lar** — bir nechta field bir vaqtda
3. **Sparse index'lar** — nullable field'lar uchun
4. **Unique constraints** — tenant doirasida unique
5. **TTL index'lar** — eskirishi kerak bo'lgan ma'lumotlar uchun

## Index ro'yxati (har entity bo'yicha)

### restaurant
```javascript
restaurantSchema.index({ 'owner.phone': 1 }, { unique: true });
restaurantSchema.index({ brand: 1 });  // search
restaurantSchema.index({ deleted: 1 });
```

### branch
```javascript
branchSchema.index({ restaurant: 1, deleted: 1 });
branchSchema.index({ restaurant: 1, name: 1 }, { unique: true }); // tenant bo'yicha unique
branchSchema.index({ currentMode: 1 });   // online/offline filial filter
```

### user
```javascript
userSchema.index({ phone: 1 }, { unique: true });
userSchema.index({ branch: 1, role: 1 });
userSchema.index({ restaurantId: 1, role: 1 });    // restoran boyicha barcha admin'lar
userSchema.index({ restaurantId: 1, isActive: 1 });
```

### food
```javascript
foodSchema.index({ restaurantId: 1, branch: 1, deleted: 1 });
foodSchema.index({ branch: 1, category: 1, isActive: 1, sortOrder: 1 }); // menyu ko'rsatish
foodSchema.index({ branch: 1, name: 1 });  // search
foodSchema.index({ clientId: 1 }, { sparse: true, unique: true });
```

### category
```javascript
categorySchema.index({ branch: 1, sortOrder: 1, isActive: 1 });
categorySchema.index({ restaurantId: 1, branch: 1 });
categorySchema.index({ branch: 1, title: 1 }, { unique: true });
```

### table
```javascript
tableSchema.index({ branch: 1, number: 1 }, { unique: true });
tableSchema.index({ branch: 1, type: 1 });
tableSchema.index({ qrSlug: 1 }, { unique: true, sparse: true });
tableSchema.index({ restaurantId: 1, branch: 1 });
```

### order (eng murakkab)
```javascript
// asosiy
orderSchema.index({ branch: 1, createdAt: -1 });
orderSchema.index({ branch: 1, shift: 1, createdAt: -1 });
orderSchema.index({ branch: 1, paymentStatus: 1 });
orderSchema.index({ branch: 1, orderType: 1 });
orderSchema.index({ branch: 1, isCancel: 1 });
orderSchema.index({ branch: 1, table: 1, paymentStatus: 1 });  // stol'dagi tolanmagan order

// multi-tenant
orderSchema.index({ restaurantId: 1, branch: 1, createdAt: -1 });

// waiter o'z orderlari
orderSchema.index({ waiter: 1, createdAt: -1 });

// shift yopish — pending order'lar
orderSchema.index({ shift: 1, paymentStatus: 1 });

// sync
orderSchema.index({ syncStatus: 1, branch: 1 });
orderSchema.index({ clientId: 1 }, { sparse: true, unique: true });

// hisobotlar
orderSchema.index({ branch: 1, paymentStatus: 1, createdAt: -1 });
orderSchema.index({ restaurantId: 1, createdAt: -1 });

// keshbek
orderSchema.index({ 'cashback.clientPhone': 1 }, { sparse: true });
```

### shift
```javascript
shiftSchema.index({ branch: 1, isActive: 1 });
shiftSchema.index({ branch: 1, openedAt: -1 });
shiftSchema.index({ restaurantId: 1, openedAt: -1 });
```

### discount
```javascript
discountSchema.index({ branch: 1, isActive: 1 });
discountSchema.index({ restaurantId: 1 });
```

### service
```javascript
serviceSchema.index({ branch: 1, isActive: 1 });
serviceSchema.index({ restaurantId: 1 });
```

## Tool entity'lar uchun

### sklad
```javascript
ingredientSchema.index({ restaurantId: 1, name: 1 });
stockSchema.index({ branchId: 1, ingredientId: 1 }, { unique: true });
stockSchema.index({ branchId: 1, balance: 1 });  // low stock alert
stockMovementSchema.index({ stockId: 1, createdAt: -1 });
stockMovementSchema.index({ branchId: 1, createdAt: -1 });
stockMovementSchema.index({ refOrderId: 1 });
```

### keldi-ketti
```javascript
attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ branchId: 1, date: 1 });
payrollSchema.index({ userId: 1, period: 1 }, { unique: true });
payrollSchema.index({ branchId: 1, period: 1 });
```

### qr-order
```javascript
qrOrderRequestSchema.index({ tableId: 1, status: 1 });
qrOrderRequestSchema.index({ branchId: 1, status: 1, requestedAt: -1 });
qrOrderRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL
```

### qr-pay
```javascript
kaspiTransactionSchema.index({ kaspiInvoiceId: 1 }, { unique: true });
kaspiTransactionSchema.index({ branchId: 1, status: 1 });
kaspiTransactionSchema.index({ matchedOrderId: 1 });
```

### keshbek
```javascript
cashbackBalanceSchema.index({ restaurantId: 1, clientPhone: 1 }, { unique: true });
cashbackBalanceSchema.index({ restaurantId: 1, lastActivityAt: -1 });
cashbackMovementSchema.index({ clientPhone: 1, createdAt: -1 });
cashbackMovementSchema.index({ refOrderId: 1 });
cashbackQrSessionSchema.index({ qrToken: 1 }, { unique: true });
cashbackQrSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL
```

### audit_log
```javascript
auditLogSchema.index({ ts: -1 });
auditLogSchema.index({ kind: 1, ts: -1 });
auditLogSchema.index({ severity: 1, ts: -1 });
auditLogSchema.index({ restaurantId: 1, ts: -1 });
auditLogSchema.index({ 'actor.id': 1, ts: -1 });
// Eski log'lar uchun TTL — alohida cron, severity'ga qarab
```

### outbox (lokal MongoDB)
```javascript
outboxSchema.index({ sentAt: 1, createdAt: 1 });   // jo'natilmaganlar tartibi
outboxSchema.index({ ackedAt: 1 });                 // ack kelmaganlar
outboxSchema.index({ entityId: 1 });                // entity bo'yicha
```

## Index hajmi xavotirlari

Order — eng katta collection. Index'lari ham eng ko'p. RAM'da sig'magan index — disk'dan o'qish (sekin).

Hisoblash:
- 1 ta order index entry ~80 bayt
- 1 million order × 10 index = 800 MB index hajmi
- 1 GB RAM cache yetishi mumkin, lekin yoshlikda

Optimallashtirish:
- Eski order'larni alohida `orders_archive` collection'ga ko'chirish (1 yildan eski)
- Yoki: time-based sharding (kelajakda)

## Index analizi

```javascript
// Slow query'ni topish (production'da)
db.setProfilingLevel(1, { slowms: 100 });
db.system.profile.find().sort({ ts: -1 }).limit(10);

// Index ishlatilganligini tekshirish
db.orders.find({ branch: ..., createdAt: { $gt: ... } }).explain('executionStats');
```

## Index qo'shish/o'chirish background

Live production'da:
```javascript
db.orders.createIndex({...}, { background: true });
```

Yangi index — background'da quriladi, ammo katta collection'da soatlar olishi mumkin. Ehtiyot bilan.

## Compound index buyrugi

```
{ branch: 1, shift: 1, createdAt: -1 }
```

Kuchli query'lar:
- ✅ `{ branch, shift }` — to'liq prefix
- ✅ `{ branch, shift, createdAt }` — to'liq mos
- ✅ `{ branch }` — prefix
- ✅ `{ branch, createdAt }` — equality + sort
- ❌ `{ shift }` (yolg'iz) — index ishlatilmaydi
- ❌ `{ shift, branch }` — tartib noto'g'ri

Tartib muhim: equality field'lar → range/sort field'lar.

## Bog'liq

- [[_MOC]]
- [[../02-arxitektura/multi-tenant-xavfsizlik]]
- [[order]]
