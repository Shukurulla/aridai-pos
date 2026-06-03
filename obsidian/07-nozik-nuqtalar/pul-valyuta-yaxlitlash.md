---
tags: [nozik-nuqta, pul, valyuta, muhim]
created: 2026-05-29
---

# Pul, valyuta, yaxlitlash

## Muammo 1: Float bilan pul saqlash — TAQIQLANADI

```javascript
0.1 + 0.2 === 0.30000000000000004  // float xatosi
```

Pul float bo'lsa — har hisoblashda mayda xatolar yig'iladi. Hisobot to'g'ri kelmaydi.

### Qaror

> [!important] Pul = integer (eng kichik birlik)
> So'm va tenge'da amalda subunit ishlatilmaydi (tiyin/tıyın bor lekin ishlatilmaydi). Demak pul **butun son** sifatida saqlanadi: `35000` = 35,000 so'm.

- Hech qachon `Number` float emas — integer
- MongoDB: `Number` (lekin doim integer qiymat)
- Hisoblashda `Math.round()` har bosqichda
- Foiz hisoblash: `Math.round(subTotal * percent / 100)`

```javascript
// Yomon
order.discountAmount = subTotal * 0.1;  // 9999.999...

// Yaxshi
order.discountAmount = Math.round(subTotal * discount.percent / 100);
```

## Muammo 2: Valyuta — har restoran bittadan

> [!important] Qaror (foydalanuvchi tasdiqlagan, 2026-05-29)
> Har restoran **bitta valyuta** tanlaydi: `UZS` (so'm) yoki `KZT` (tenge). Tizim ikkala bozorda ishlaydi, lekin bitta restoran bitta valyutada.

### Schema

```javascript
// restaurant.model.js
currency: {
  type: String,
  enum: ['UZS', 'KZT'],
  required: true,
  default: 'UZS',
}
```

Restoran yaratilganda tanlanadi. **Keyin o'zgartirib bo'lmaydi** (chunki tarixiy orderlar shu valyutada).

### Filiallar bir xil valyutada

Bitta restoran'ning barcha filiallari bir xil valyutada (restaurant.currency'dan meros). Filialda alohida valyuta yo'q.

### Ko'rsatish formati

| Valyuta | Kod | Belgi | Format misol | Decimal |
|---|---|---|---|---|
| O'zbek so'mi | UZS | so'm | `1 000 000 so'm` | yo'q |
| Qozoq tengesi | KZT | ₸ | `1 000 000 ₸` | yo'q |

```javascript
function formatMoney(amount, currency) {
  const formatted = new Intl.NumberFormat('ru-RU').format(amount); // 1 000 000 (space sep)
  if (currency === 'UZS') return `${formatted} so'm`;
  if (currency === 'KZT') return `${formatted} ₸`;
}
```

> [!note] Multi-currency YO'Q
> Bitta restoran ham so'm ham tenge qabul qilmaydi. Bu qaror — soddalik. Agar kelajakda chegara hududidagi restoran ikkala valyutani xohlasa — alohida feature toggle bo'ladi.

## Muammo 3: Yaxlitlash lokal va global'da bir xil

Lokal POS service charge hisoblaydi: `98000 × 6% = 5880`. Global ham hisoblaydi. Ikkalasi **bir xil natija** berishi shart, aks holda sync'da konflikt.

### Qaror

- Yagona hisoblash funksiyasi `shared/calculateTotals.js` — lokal va global **bir xil kod** ishlatadi
- `Math.round` (banker's rounding emas — oddiy)
- Hisoblash tartibi qat'iy: [[../05-data-model/biznes-mantiq/total-hisoblash]]

```javascript
// shared/money.js — lokal va global ikkalasi import qiladi
export const round = (x) => Math.round(x);
export const percentOf = (base, percent) => Math.round(base * percent / 100);
```

## Muammo 4: Chayyot pul (tip) — YO'Q qarori

> [!important] Qaror (foydalanuvchi tasdiqlagan, 2026-05-29)
> Chayyot pul (tip / чаевые) funksiyasi **kerak emas**. Xizmat haqqi (service charge) yetarli.

**Nima uchun bu yerda yozilgan:** Keyinchalik kimdir "tip qo'shaylik" deb order modelini o'zgartirmasligi uchun. Agar kerak bo'lsa — alohida feature toggle sifatida, lekin **default emas**.

- `order` modelida `tip` field **yo'q**
- Service charge (`service.amount`) — bu ofitsiantning haqqi (qarang [[../05-data-model/service]])
- Waiter foiz haqqi — [[../04-toollar/keldi-ketti]] orqali (service charge'dan 6%)

## Muammo 5: Negative va overflow

```javascript
// Validation
if (order.totalPrice < 0) throw new Error('Negative total — bug');
if (order.discountAmount > order.subTotal) {
  order.discountAmount = order.subTotal; // cap
}
```

- `discountAmount` hech qachon `subTotal`'dan katta emas
- `totalPrice >= 0` har doim
- Katta sonlar: MongoDB `Number` 2^53 gacha xavfsiz. Restoran orderlar — milliardlar emas, xavf yo'q

## Muammo 6: Valyuta sync'da

Order'da valyuta saqlanadimi? Order `restaurant.currency`'dan meros. Lekin **snapshot** uchun:

```javascript
// order'da valyuta snapshot — kelajakda restaurant.currency o'zgarmasa ham
order.currency = restaurant.currency;  // snapshot
```

Bu — restaurant.currency o'zgartirib bo'lmaydigani uchun ortiqcha, lekin xavfsizlik uchun snapshot saqlash yaxshi.

## Test rejasi

- [ ] Pul integer (float yo'q)
- [ ] restaurant.currency enum, default UZS
- [ ] Currency o'zgartirib bo'lmaydi (immutable after create)
- [ ] formatMoney UZS va KZT
- [ ] Lokal va global bir xil yaxlitlash (shared kod)
- [ ] order'da tip field YO'Q
- [ ] discountAmount <= subTotal cap
- [ ] totalPrice >= 0

## Bog'liq

- [[chek-raqamlash]]
- [[fiskal-soliq]]
- [[../05-data-model/restaurant]]
- [[../05-data-model/biznes-mantiq/total-hisoblash]]
- [[../05-data-model/service]]
