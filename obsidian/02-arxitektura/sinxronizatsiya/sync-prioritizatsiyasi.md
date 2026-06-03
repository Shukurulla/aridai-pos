---
tags: [arxitektura, sinxron, performance]
created: 2026-05-28
---

# Sync prioritizatsiyasi

## Muammo

Reconnect'da outbox'da bir nechta entity turli bo'ladi:
- 50 ta order
- 10 ta menu update (admin web'dan, lokal'ga keladi)
- 3 ta stock movement
- 2 ta shift
- 100 ta heartbeat (ephemeral, jo'natilmaydi)

Hammasini bir vaqtda jo'natish — server toshib ketadi. Tartib kerak.

## Prioritet darajalari

| Darajasi | Entity / event | Tezlik |
|---|---|---|
| 🔴 P0 — Kritik | order.created, order.paid, order.cancelled | Darhol |
| 🟠 P1 — Yuqori | shift.opened, shift.closed | Darhol keyin |
| 🟡 P2 — O'rta | stock.changed (sklad), attendance.check_in | 1-2s keyin |
| 🟢 P3 — Past | food/category updates, table updates | 5s+ keyin |
| ⚪ P4 — Eng past | analytics, audit log entries | Batch (1 min) |

## Sabab — prioritetlar

### P0 — order'lar
- Mijoz tolagan, kassa kutilmoqda
- Cook'lar darhol ko'rishi kerak (real-time)
- Tolov status — pul masalasi

### P1 — shift
- Smena yopilgan/ochilgan — boshqa joydagi mijozlar darhol bilishi kerak
- "Faol smena yo'q" deb yangi order yaratishni bloklash

### P2 — stock va attendance
- Sklad past darajaga yetdimi — admin darhol bilmas, ammo soatlardan oldin
- Xodim keldi/ketdi — payroll uchun, lekin real-time emas

### P3 — menyu/stol/sozlama
- Admin menyuni o'zgartirdi — boshqa filiallar 5 sekundda bilsalar yetadi
- Yangi taom qo'shildi — darhol kerak emas

### P4 — analytics, audit
- Batch (1 minutda 1 marta jo'natish)
- Heartbeat — ephemeral, outbox'ga tushmaydi

## Implementatsiya

```javascript
const PRIORITY_MAP = {
  'order.created': 0,
  'order.updated': 0,
  'order.paid': 0,
  'order.cancelled': 0,
  'shift.opened': 1,
  'shift.closed': 1,
  'stock.changed': 2,
  'attendance.check_in': 2,
  'food.updated': 3,
  'category.updated': 3,
  'table.updated': 3,
  'audit_log.entry': 4,
};

function getPriority(eventType) {
  return PRIORITY_MAP[eventType] ?? 5; // default lowest
}
```

```javascript
// Sync engine
async function drainOutbox() {
  while (true) {
    // P0 → P1 → P2 → ...
    for (let priority = 0; priority <= 4; priority++) {
      const batch = await outboxModel
        .find({
          sentAt: null,
          eventType: { $in: getEventsForPriority(priority) }
        })
        .sort({ createdAt: 1 })
        .limit(getBatchSizeForPriority(priority))
        .lean();

      if (batch.length === 0) continue;

      try {
        const acks = await socket.emit('sync.batch', { events: batch });
        await outboxModel.updateMany(
          { _id: { $in: acks.successful } },
          { sentAt: new Date(), ackedAt: new Date() }
        );
      } catch (err) {
        await outboxModel.updateMany(
          { _id: { $in: batch.map(b => b._id) } },
          { $inc: { retryCount: 1 }, lastError: err.message }
        );
        return; // stop, retry later
      }
    }

    // Sleep biroz keyingi loop oldidan
    await sleep(100);
  }
}
```

## Batch hajmi prioritetga ko'ra

```javascript
function getBatchSizeForPriority(p) {
  return p === 0 ? 100 :   // P0 — kattaroq batch
         p === 1 ? 50 :
         p === 2 ? 25 :
         p === 3 ? 100 :
         p === 4 ? 500 : 100;
}
```

P0 catalog batch'lari katta — chunki order'lar muhim, lekin har biri kichik (~1 KB).
P4 — audit log entry'lari ko'p — katta batch.

## Sync window

Bir paytda faqat bitta batch in-flight — backpressure:
- Lokal `sync.batch` jo'natdi
- Ack keldi → keyingi batch
- Ack kelmadi 30s → retry (counter+1)
- 5 retry'dan keyin → `sync_status: 'error'`, admin'ga xabar

## Real-time vs batch

P0/P1 — har event darhol jo'natiladi (real-time):
```javascript
async function emitRealTime(event) {
  if (mode === 'online' && getPriority(event.type) <= 1) {
    try {
      await socket.emit(event.type, event.payload);
      return; // outbox'siz
    } catch {
      // fail bo'lsa fallback outbox
    }
  }
  await outboxModel.create({ ...event });
}
```

P2-P4 — har doim outbox orqali.

> [!note] Critical real-time vs reliable outbox
> Trade-off:
> - Real-time emit — bir sekund tezroq, lekin ack tasdiqlamaydi
> - Outbox — sekinroq, lekin guaranteed delivery
>
> Joriy dizayn: ikkalasini birga ishlatish. Outbox — backup. Real-time — happy path.

## Offline'da prioritet ahamiyatsiz

Offline'da hammasi outbox'ga tushadi — prioritet hech narsa qilmaydi. Reconnect'da prioritet ishlaydi.

## Global VPS tomonda

Global qabul qilayotganda ham prioritet — DB yozish navbati:
- P0 — synchronous (MongoDB acknowledged write)
- P3+ — asynchronous (write concern: 0)

Lekin bu — implementation detail. Boshlang'ich versiyada hamma uchun synchronous.

## Test rejasi

- [ ] Outbox'da turli event'lar — P0 birinchi
- [ ] Batch size to'g'ri
- [ ] Ack kelmasa retry
- [ ] 5 retry'dan keyin admin alert
- [ ] Real-time emit P0 events
- [ ] P3+ event'lar batch'da

## Bog'liq

- [[_MOC]]
- [[offline-to-online-otish]]
- [[../socket-sinxronizatsiya]]
- [[sync-monitoring]]
