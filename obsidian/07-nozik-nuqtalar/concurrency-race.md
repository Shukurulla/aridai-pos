---
tags: [nozik-nuqta, concurrency, muhim]
created: 2026-05-29
---

# Concurrency va race conditions

## Muammo

Restoran tizimida bir nechta odam bir vaqtda ishlaydi. Bir xil ma'lumotni parallel o'zgartirish — race condition. Tizim buzilmasligi shart.

## Race 1: Ikki cashier bir order'ni tolashi

Stol 5 order'ini ikki kassir bir vaqtda "tolandi" bosadi → ikki marta tolov yoziladi?

### Yechim: optimistic locking (version)

```javascript
async function payOrder(orderId, paymentData, cashier, expectedVersion) {
  const result = await orderModel.findOneAndUpdate(
    {
      _id: orderId,
      version: expectedVersion,         // version mos kelsa
      paymentStatus: { $ne: 'paid' },   // hali tolanmagan bo'lsa
    },
    {
      $set: { paymentStatus: 'paid', paymentMethod: paymentData.method, paidAt: new Date(), paidBy: cashier._id },
      $inc: { version: 1 },
    },
    { returnDocument: 'after' }
  );

  if (!result) {
    // version mos kelmadi yoki allaqachon paid
    throw new Error('Order allaqachon o\'zgartirilgan yoki tolangan. Yangilang.');
  }
  return result;
}
```

Birinchi cashier muvaffaqiyatli, ikkinchisi `null` oladi → "allaqachon tolangan" xabari.

## Race 2: Order pishirilayotganda bekor qilinishi

Cook "tayyorlash" bosdi, shu paytda cashier "bekor qilish" bosdi.

### Yechim

- Cancel atomik: `findOneAndUpdate({ _id, isCancel: false, paymentStatus: { $ne: 'paid' } }, { isCancel: true })`
- Cook'ga real-time `order.cancelled` event — "to'xtang"
- Cook UI: bekor qilingan order qizil, "Bu order bekor qilindi"
- Agar cook allaqachon tayyorlagan bo'lsa — bu biznes muammo (ovqat isrof), tizim emas. Audit log'da ko'rinadi.

## Race 3: Stock manfiyga tushishi (sklad)

Ikki order bir vaqtda oxirgi 1 kg un'ni ishlatadi.

### Yechim: atomic decrement with guard

```javascript
async function decrementStock(stockId, qty) {
  const result = await stockModel.findOneAndUpdate(
    { _id: stockId, balance: { $gte: qty } },  // yetarli bo'lsa
    { $inc: { balance: -qty } },
    { returnDocument: 'after' }
  );
  if (!result) {
    // Yetarli emas → order RAD ETILADI (O1 qaror — oversell yo'q)
    throw new Error('STOCK_INSUFFICIENT: ingredient tugagan');
  }
  return result;
}
```

> [!important] Sklad order'ni bloklaydimi? — HA (O1 qaror 2026-05-29)
> Stock yetmasa order **rad etiladi** (atomik `balance >= qty` guard → manfiy stock yo'q, oversell yo'q). Bu foydalanuvchi qarori: limitga yetganda hech qanday ortiqcha qabul qilinmaydi (POS/waiter/QR). Qarang: [[stop-list-limit#Oversell oldini olish — barcha kanal, real-time]]. (Avvalgi "bloklanmaydi" default bekor.)

## Race 4: Stol ikki marta band qilinishi

Ikki waiter bir vaqtda Stol 5 ga order yaratdi.

### Yechim

Stol holati derived (saqlanmaydi). Lekin bitta stol'da bitta active order qoidasi:

```javascript
async function createDineInOrder(input) {
  // Stol'da active order bormi?
  const existing = await orderModel.findOne({
    table: input.table,
    paymentStatus: { $in: ['pending', 'partiallyPaid'] },
    isCancel: false,
  });
  if (existing) {
    // Yangi alohida order emas — mavjud order'ga qo'shish taklif qilinadi
    return { conflict: true, existingOrderId: existing._id };
  }
  // Yangi order
}
```

UI: "Stol 5 da ochiq order bor. Unga qo'shamizmi yoki alohida?"

> [!note] Bir stolda bir nechta order?
> Ba'zi restoranlarda bitta stolda bir nechta kompaniya bo'lishi mumkin. Hozircha — **bir stol = bir active order**. Kelajakda "stol bo'limlari" (seat/area) bo'lishi mumkin.

## Race 5: Smena yopilayotganda order yaratilishi

Cashier smenani yopmoqda, shu paytda waiter yangi order yaratdi.

### Yechim

- Smena yopish — atomik, `isActive: true` sharti bilan
- Order yaratish — `shift.isActive: true` tekshiradi
- Race: order yaratish smena yopilishidan oldin tugasa — order o'sha smenaga; keyin bo'lsa — "smena yopilgan" xato

```javascript
async function createOrder(input) {
  const shift = await shiftModel.findOne({ branch: input.branch, isActive: true });
  if (!shift) throw new Error('Faol smena yo\'q');
  // Race window: shu yerda smena yopilishi mumkin
  // Lekin order shift._id bilan yoziladi. Smena yopilgan bo'lsa,
  // closeShift pending tekshiruvi buni ushlaydi (qarang shift-lifecycle)
  return orderModel.create({ ...input, shift: shift._id });
}
```

Smena yopish paytida pending order tekshiruvi ikki marta (close boshida va atomik update'da) — race window'ni yopadi.

## Race 6: Offline/online o'tishda yozish

Qarang: [[../02-arxitektura/sinxronizatsiya/online-to-offline-otish#Race conditions]]

## MongoDB transactions (multi-document)

Stock + order birga o'zgartirilganda — transaction kerak:

```javascript
const session = await mongoose.startSession();
try {
  await session.withTransaction(async () => {
    const order = await orderModel.create([orderData], { session });
    for (const item of order.foods) {
      await decrementStockInTx(item, session);
    }
  });
} finally {
  session.endSession();
}
```

> [!warning] Lokal MongoDB transaction
> MongoDB transactions **replica set** talab qiladi (standalone'da yo'q). Lokal MongoDB standalone bo'lsa — transaction ishlamaydi.
>
> **Yechim:** Lokal MongoDB'ni **single-node replica set** sifatida o'rnatish (installer sozlaydi). Bu transaction'ni yoqadi va change streams ham beradi (sync uchun foydali). Qarang: [[../02-arxitektura/local-backend-stack#Open qarorlar]] — bu endi tasdiqlanishi kerak.

## Idempotency — double-submit

Foydalanuvchi "tolandi" tugmasini ikki marta bosdi (sekin internet):
- Frontend: tugma disable qiladi submit paytida
- Backend: `version` optimistic lock (Race 1) — ikkinchi submit fail
- Yoki: idempotency key (client request UUID)

## Optimistic lock har joyda

`version` field har entity'da bor ([[../05-data-model/sync-metadata]]). Har muhim update version bilan:

```javascript
findOneAndUpdate(
  { _id, version: expectedVersion },
  { $inc: { version: 1 }, $set: {...} }
)
```

Mismatch → "yangilang, kimdir o'zgartirdi".

## Test rejasi

- [ ] Ikki parallel payOrder — bittasi fail
- [ ] Cancel paytida cook event keladi
- [ ] Stock atomic decrement (parallel)
- [ ] Stol double-booking aniqlash
- [ ] Smena yopish + order yaratish race
- [ ] Transaction (stock+order) — replica set
- [ ] Double-submit idempotent

## Bog'liq

- [[../05-data-model/sync-metadata]] — version
- [[../02-arxitektura/conflict-resolution]]
- [[../02-arxitektura/local-backend-stack]] — replica set qarori
- [[../05-data-model/biznes-mantiq/shift-lifecycle]]
