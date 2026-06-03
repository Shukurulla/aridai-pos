---
tags: [nozik-nuqta, order, operatsion]
created: 2026-05-29
---

# Order va operatsion edge case'lar

## 1. Void vs Cancel (farq)

| Holat | Qachon | Ta'sir |
|---|---|---|
| **Void** | Oshxona tayyorlashni boshlamasdan | Stock qaytmaydi (ishlatilmagan), audit info |
| **Cancel** | Oshxona boshlagandan keyin | Stock qaytadi, isrof bo'lishi mumkin, audit warn |

```javascript
function voidOrCancel(order) {
  const cookingStarted = order.foods.some(f =>
    ['cooking', 'ready', 'served'].includes(f.cookingStatus));
  return cookingStarted ? 'cancel' : 'void';
}
```

Ikkalasi ham `isCancel: true`, lekin `cancelType: 'void' | 'cancel'`. Hisobotda farqlanadi (void — yo'qotish emas, cancel — ehtimoliy isrof).

> [!note] Joriy modelga qo'shimcha
> `order.cancelType` field qo'shiladi ([[../05-data-model/order]]). [[../05-data-model/biznes-mantiq/cancel-refund]] yangilanadi.

## 2. Order izohi / maxsus iltimos

```javascript
order.note: String,              // butun order uchun ("tez bo'lsin")
order.foods[i].note: String,     // taom uchun ("piyozsiz", "yong'oqsiz - allergiya")
```

- Oshxona chekida ko'rinadi (cook uchun)
- Allergiya — muhim, ko'zga tashlanadigan
- POS UI: har taomga izoh qo'shish

## 3. Mehmonlar soni (guest count)

```javascript
order.guestCount: Number,   // dineIn uchun
```

- Faqat analitika (o'rtacha chek/kishi)
- Funksional ta'sir yo'q
- DineIn'da ixtiyoriy kiritiladi

## 4. Chek qayta bosish (reprint)

Mijoz nusxa so'rasa:
```javascript
POST /orders/:id/reprint
// Chek "DUPLIKAT / НУСХА" belgisi bilan bosiladi
```

- Asl chek bilan farqlanadi (fiskal aralashmasligi uchun)
- Audit log (kim qayta bosdi)
- `order.printCount++`

## 5. Smena topshirish (cashier handover)

Kassir almashadi, lekin smena yopilmaydi (kun davom etadi):

```javascript
POST /shifts/:id/handover { fromUserId, toUserId, cashCount }
```

- Kassa sanaladi (cashCount) — topshirish nuqtasi
- `shift.handovers[]` — kim qachon topshirdi, kassa qancha edi
- Mas'uliyat o'tadi (keyingi kassir)
- Smena yopilmaydi, totals davom etadi

> [!note] Smena vs kassir
> Bitta smena ichida bir nechta kassir ishlashi mumkin (almashinadi). Mas'uliyat handover paytida o'tadi. Smena hisoboti — butun kun. Kassir hisoboti — har handover oralig'i.

## 6. Smena 24h+ ochiq qoldi

Kassir yopishni unutdi (ertasi kuni ochiq):

- Watchdog: smena `openedAt` > 20 soat → admin'ga ogohlantirish
- "Smena 24 soatdan ortiq ochiq. Yopishni unutdingizmi?"
- Auto-close emas (ma'lumot yo'qotmaslik), faqat eslatma
- Yoki: biznes kun o'zgarganda ([[vaqt-va-soat]]) eslatma

## 7. Renderer ↔ local backend uzilishi

Internet emas — **Electron renderer (UI) local backend (main) bilan aloqani yo'qotsa**:

| Sabab | Belgi | Yechim |
|---|---|---|
| Local backend crash (main process) | UI javob bermaydi | Electron auto-restart main, yoki app restart |
| IPC xatosi | so'rov fail | Retry, banner |
| Lokal MongoDB to'xtadi | yozish fail | MongoDB service restart |

- Bu — **internet uzilishidan boshqa** (qarang [[../02-arxitektura/rejimlar/offline-rejim]] internet haqida)
- POS UI: "Lokal server bilan aloqa yo'q — qayta urinilmoqda"
- Health check: renderer har 5s main'ni ping qiladi

## 8. Tezkor xodim almashish (PIN)

Umumiy POS terminal, bir nechta waiter:

- To'liq logout/login sekin
- **PIN** (4 raqam) bilan tez almashish
- "Order kim tomonidan" — PIN orqali aniqlanadi
- POS asosiy login (filial) + har waiter PIN

```javascript
// POS: filial sessiyasi + waiter PIN
user.pin: String,  // hash, faqat shu filial POS'da tez kirish uchun
```

> [!note] PIN xavfsizligi
> PIN — faqat **lokal POS'da tez almashish** uchun (umumiy terminal). Mobile/web login — to'liq parol. PIN faqat shu filial ichida ([[../02-arxitektura/xavfsizlik/auth-strategiyasi]]).

## 9. Course timing / "fire" (kelajak)

Restoranlarda taomlar navbat bilan: avval salat, keyin asosiy taom.
- "Fire" — "endi tayyorlang" signali
- Course (1-navbat, 2-navbat)
- **Kelajak** — MVP'da hammasi birga. Schema room: `order.foods[i].course: Number`

## 10. Open order timeout

DineIn order ochiq, lekin mijoz ketib qoldi (tolamasdan):
- Smena yopishda pending order block ([[../05-data-model/biznes-mantiq/shift-lifecycle]])
- Cashier: void/cancel (sabab: "mijoz ketdi")
- Hisobotda anomaliya

## Schema qo'shimchalar xulosasi

```javascript
order.cancelType: 'void' | 'cancel',
order.note: String,
order.foods[i].note: String,
order.foods[i].course: Number,    // reserved (kelajak)
order.guestCount: Number,
order.printCount: Number,
shift.handovers: [{ fromUserId, toUserId, cashCount, at }],
user.pin: String,                  // hash
```

## Test rejasi

- [ ] Void (oshxona boshlamagan) vs cancel (boshlagan)
- [ ] Order/taom izohi oshxona chekida
- [ ] Guest count saqlanadi
- [ ] Reprint "DUPLIKAT" belgisi + audit
- [ ] Smena handover (kassa sanash)
- [ ] 24h+ smena ogohlantirish
- [ ] Renderer ↔ backend uzilish banner
- [ ] PIN bilan tez almashish
- [ ] Open order timeout (smena block)

## Bog'liq

- [[../05-data-model/order]]
- [[../05-data-model/biznes-mantiq/cancel-refund]]
- [[../05-data-model/biznes-mantiq/shift-lifecycle]]
- [[../02-arxitektura/xavfsizlik/auth-strategiyasi]]
