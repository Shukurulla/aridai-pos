---
tags: [nozik-nuqta, data, arxivlash]
created: 2026-05-29
---

# Data o'sishi va arxivlash

## Muammo

Restoran tizimi har kuni yuzlab order yaratadi. Vaqt o'tishi bilan:
- Lokal MongoDB (POS PC) cheksiz o'sadi → disk to'ladi
- Global MongoDB o'sadi → query sekinlashadi, RAM yetmaydi
- Outbox to'planadi (sync qilingan event'lar)
- Audit log o'sadi

## Lokal MongoDB o'sishi (POS PC)

POS PC kichik (40-120 GB SSD). Lokal Mongo'da faqat kerakli:

### Qaror: lokal'da faqat oxirgi 90 kun

```javascript
// Lokal cron — har kuni 03:00
const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
// 90 kundan eski synced order'lar lokal'dan o'chiriladi
await localOrderModel.deleteMany({
  createdAt: { $lt: cutoff },
  syncStatus: 'synced',   // FAQAT sync bo'lganlar
});
```

> [!warning] Faqat synced o'chiriladi
> `syncStatus: 'pending'` order'lar HECH QACHON o'chirilmaydi (hali global'ga yetmagan). Faqat global'da tasdiqlangan (synced) order'lar lokal'dan o'chiriladi.

> [!important] Bu o'chirish emas — cache eviction
> Soft delete qoidasi ([[ochirish-cascade#Soft delete + 1 oylik tiklash]]) — delete tugma uchun (taom/sklad). Lokal POS'dan synced order'ni olib tashlash boshqa narsa — **disk boshqaruvi** (cache eviction): data global'da (source of truth) + PITR backup'da bor. Lokal — faqat oxirgi 90 kunlik tezkor cache.

Eski order'lar **global'da qoladi** — web admin'dan ko'rinadi (qarang [[../02-arxitektura/sinxronizatsiya/boshlangich-sync#Eski order'lar uchun strategiya]]).

### Hisoblash
- Kuniga 200 order × 90 kun = 18,000 order
- Har order ~2-5 KB = ~50-90 MB
- Lokal Mongo: orders + categories + foods + ... ~150 MB
- 40 GB disk'da bemalol

## Global MongoDB o'sishi

Global hech narsa o'chirmaydi (manba haqiqat). Lekin eski order'lar **arxiv collection**'ga:

### Qaror: 1 yildan eski → orders_archive (MOVE, delete emas)

```javascript
// Global cron — oyda bir. TRANSACTIONAL move (data yo'qolmaydi)
const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
await session.withTransaction(async () => {
  const oldOrders = await orderModel.find({ createdAt: { $lt: cutoff } }, null, { session });
  await orderArchiveModel.insertMany(oldOrders, { session });   // avval ko'chiriladi
  await orderModel.deleteMany({ createdAt: { $lt: cutoff } }, { session }); // keyin hot'dan olinadi
});
```

> [!important] Bu "hard delete" emas — cold collection'ga ko'chirish
> "Hard delete YO'Q" qoidasi ([[../09-deployment/backup-pitr]]) buzilmaydi: data `orders_archive`'ga **transactional ko'chiriladi** (avval insert, keyin hot'dan olib tashlash, bitta transaction). Data hech qachon yo'qolmaydi — archive collection + PITR backup'da bor.

- `orders` — issiq (hot), oxirgi 1 yil, tez query
- `orders_archive` — sovuq (cold), eski, **abadiy saqlanadi** (o'chirilmaydi)
- Hisobot 1 yildan eski so'rasa — archive'dan (sekinroq, OK)

> [!note] Fiskal bo'lsa
> Fiskal yoqilsa ([[fiskal-soliq]]) — 5 yil saqlanadi. Archive baribir abadiy (hard delete yo'q). S3 cold storage'ga ko'chirilishi mumkin (xarajat uchun).

## Outbox tozalash (lokal)

Sync qilingan (acked) outbox event'lar kerak emas:

```javascript
// Lokal cron — har kuni
await outboxModel.deleteMany({
  ackedAt: { $ne: null },
  ackedAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }  // 7 kun keyin
});
```

7 kun saqlash — debugging uchun. Keyin o'chiriladi.

## Audit log retention

Qarang: [[../02-arxitektura/xavfsizlik/audit-log#Retention va arxivlash]]
- info: 90 kun
- warn: 1 yil
- error/critical: 2-5 yil + S3

## Backup-restore duplikat muammosi

> [!warning] Eng nozik backup nuqtasi
> Lokal backup'dan restore qilinsa — sync qilingan order'lar qaytib keladi → global'ga yana jo'natiladi → **duplikat**.

### Qaror

Restore paytida:
1. Restore qilingan order'lar `syncStatus` tekshiriladi
2. Agar `synced` bo'lsa — outbox'ga **qayta qo'shilmaydi**
3. Faqat `pending` bo'lganlar qayta jo'natiladi
4. Global tomonda idempotency (`_id`/`clientId`) — duplikat kelса ham qabul qilmaydi

```javascript
async function afterRestore() {
  // Restore qilingan synced order'lar — outbox'ga tushmaydi
  // Faqat pending'larni qayta sync
  const pending = await localOrderModel.find({ syncStatus: 'pending' });
  for (const order of pending) {
    await outbox.upsert({ entityId: order._id, ... }); // upsert — duplikat yo'q
  }
}
```

Idempotency ([[id-generatsiya]]) backup-restore duplikatdan himoya qiladi.

## Global backup → PITR (alohida hujjat)

> [!important] Global backup strategiyasi: real-time PITR
> Global MongoDB backup'i — oddiy kunlik snapshot emas, balki **real-time Point-In-Time Recovery**: change stream → 6-soatlik oyna fayllari, per-restoran, 1 yil. To'liq dizayn: [[../09-deployment/backup-pitr]]. 1 daqiqalik data ham yo'qolmaydi.

## Lokal backup (POS) active shift paytida

Lokal POS backup olinayotganda smena ochiq, order yozilmoqda:
- `mongodump` — consistent snapshot (WiredTiger)
- Yarim yozilgan order — atomik write (yoki transaction)
- Backup paytida tizim to'xtamaydi

### Qaror (lokal) — 3 oy saqlash (foydalanuvchi, 2026-05-29)
- `mongodump` (online, lock'siz) — POS PC uchun
- Har kuni 03:00 (eng kam yuk)
- **3 oy (90 kun) lokal saqlash** (oldin 14 kun edi)
- Lokal — offline-pending va tezkor tiklash uchun; asosiy himoya global PITR'da ([[../09-deployment/backup-pitr#Lokal POS backup]])

## Restore procedure

```
1. MongoDB to'xtatish
2. Backup'dan restore (mongorestore)
3. afterRestore() — pending sync tekshiruvi
4. Lokal backend qayta ulanadi
5. Sync — pending event'lar jo'natiladi (idempotency himoya)
```

## Disk to'lganda (lokal)

POS PC disk to'lsa — falokat. Oldini olish:
- Watchdog disk space tekshiradi (har 5 min)
- < 5 GB qolganda — admin'ga alert
- < 1 GB — kritik, eski synced order'lar darhol o'chiriladi
- Mongo journal va log rotate

## Test rejasi

- [ ] Lokal 90 kun cutoff (faqat synced)
- [ ] Pending order o'chirilmaydi
- [ ] Global 1 yil → archive
- [ ] Outbox 7 kun keyin tozalash
- [ ] Backup restore → duplikat yo'q (idempotency)
- [ ] Disk space watchdog
- [ ] mongodump online (lock'siz)

## Bog'liq

- [[id-generatsiya]] — idempotency
- [[fiskal-soliq]] — retention
- [[../02-arxitektura/sinxronizatsiya/boshlangich-sync]]
- [[../02-arxitektura/xavfsizlik/audit-log]]
- [[../02-arxitektura/local-backend-stack#Backup strategiyasi]]
