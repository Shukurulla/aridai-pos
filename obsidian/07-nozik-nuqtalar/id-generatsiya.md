---
tags: [nozik-nuqta, id, sync]
created: 2026-05-29
---

# ID generatsiya — lokal vs global

## Muammo

Order ikkala tomonda yaratilishi mumkin:
- Online: global VPS yoki lokal backend
- Offline: faqat lokal backend

Ikkala tomon ham `_id` (ObjectId) generatsiya qiladi. Bular **to'qnashmasligi** shart.

## MongoDB ObjectId tuzilishi

```
ObjectId = 4-byte timestamp + 5-byte random + 3-byte counter
           (sekund)          (machine+process)   (incrementing)
```

5-byte random qism har process uchun har xil. Lokal POS PC va global VPS — har xil random → to'qnashuv ehtimoli **astronomik kichik** (~0).

### Qaror: _id yaratilgan joyda generatsiya qilinadi

- Lokal'da yaratilgan order → lokal `_id` (ObjectId)
- Global'ga sync bo'lganda → **xuddi shu `_id`** ishlatiladi (o'zgartirilmaydi)
- Global'da yaratilgan order → global `_id`

ObjectId'ning machine+random qismi to'qnashuvni oldini oladi.

## clientId — qo'shimcha xavfsizlik

`_id` yetarli, lekin `clientId` (UUID v4) qo'shimcha dedup uchun:

```javascript
// Lokal'da yaratilganda
{
  _id: new ObjectId(),        // lokal generatsiya
  clientId: uuidv4(),          // qo'shimcha dedup kalit
  syncStatus: 'pending',
}
```

Sync paytida idempotency: `_id` yoki `clientId` allaqachon ko'rilganmi (qarang [[../05-data-model/sync-metadata#Event idempotency]]).

## Nima uchun ikkalasi (_id + clientId)?

| Holat | _id yetadi | clientId kerak |
|---|---|---|
| Oddiy sync | ✅ | — |
| Lokal yaratdi, jo'natdi, ack kelmadi, qayta jo'natdi | ✅ (idempotency) | qo'shimcha |
| Lokal yaratdi, global'da ham xuddi shu narsa boshqa kanaldan | _id farq qiladi | clientId mos kelishi mumkin emas (har biri o'z UUID) |

Aslida `_id` deyarli har doim yetadi. `clientId` — paranoja darajasidagi xavfsizlik. **Default: ikkalasi ham bor.**

## ObjectId timestamp ishonchsiz (lokal soat)

ObjectId'ning birinchi 4 bayti — timestamp. Lokal soat noto'g'ri bo'lsa ([[vaqt-va-soat]]) — ObjectId timestamp ham noto'g'ri.

**Ta'sir:** ObjectId bo'yicha sort = vaqt bo'yicha sort. Lokal soat noto'g'ri bo'lsa, sort buziladi.

**Yechim:** Sort uchun `createdAt` field ishlatiladi (ObjectId emas), lekin `createdAt` ham lokal soatga bog'liq. Server time online bo'lsa to'g'rilanadi. Bu — [[vaqt-va-soat]] muammosiga bog'liq.

## Receipt number — alohida (inson o'qiydi)

`_id` mijozga ko'rsatilmaydi. Inson o'qiy oladigan raqam — `receiptNumber` (qarang [[chek-raqamlash]]). Bu butunlay alohida tizim.

## Counter ID'lar (receipt, va h.k.)

Receipt counter, va kelajakdagi boshqa sequential counter'lar — lokal backend'da atomik `$inc` (qarang [[chek-raqamlash#Counter implementatsiyasi]]).

## UUID v4 collision

UUID v4 — 122 bit random. Collision ehtimoli: 1 milliard UUID generatsiya qilsangiz, collision ehtimoli ~10^-18. Amalda **nol**.

## Test rejasi

- [ ] Lokal va global ObjectId to'qnashmaydi (stress test)
- [ ] clientId UUID v4 unique
- [ ] Sync: _id bo'yicha idempotency
- [ ] Sort createdAt bo'yicha (ObjectId emas)
- [ ] receiptNumber alohida ID tizimi

## Bog'liq

- [[../05-data-model/sync-metadata]]
- [[chek-raqamlash]]
- [[vaqt-va-soat]]
- [[../02-arxitektura/conflict-resolution]]
