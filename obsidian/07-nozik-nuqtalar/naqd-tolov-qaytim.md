---
tags: [nozik-nuqta, tolov, naqd, muhim]
created: 2026-05-29
---

# Naqd to'lov, qaytim, yaxlitlash

> [!important] Qaror (foydalanuvchi, 2026-05-29): naqd yaxlitlash bor + davlat bo'yicha kupyura tugmalari

## Muammo

Naqd to'lovda:
- Mijoz aniq summani bermaydi (kupyura beradi) → **qaytim** hisoblash kerak
- UZ/KZ'da mayda tanga deyarli yo'q → **yaxlitlash**
- Tez ishlash uchun kupyura tugmalari kerak

## Kupyura tugmalari (quick-cash) — davlat bo'yicha

To'lov ekranida kassir mijoz bergan kupyurani bir bosishda kiritadi:

### Qozog'iston (KZT)
```
[1 000]  [2 000]  [5 000]  [10 000]  [20 000]  [Aniq summa]
```

### O'zbekiston (UZS)
```
[5 000]  [10 000]  [20 000]  [50 000]  [100 000]  [200 000]  [Aniq summa]
```

Kupyuralar `restaurant.currency`'ga qarab ko'rsatiladi ([[pul-valyuta-yaxlitlash]]).

```javascript
const CASH_DENOMINATIONS = {
  KZT: [1000, 2000, 5000, 10000, 20000],
  UZS: [5000, 10000, 20000, 50000, 100000, 200000],
};
```

## Qaytim (change) hisoblash

```
Hisob: 43 000 so'm
Mijoz berdi: 50 000 (bir bosish [50 000])
Qaytim: 50 000 − 43 000 = 7 000 so'm
```

```javascript
function calculateChange(total, given) {
  const change = given - total;
  if (change < 0) throw new Error('Berilgan summa yetarli emas');
  return change;
}
```

To'lov ekranida real-time ko'rsatiladi: "Qaytim: 7 000 so'm".

> [!note] Tip (chayyot pul) YO'Q
> Tip funksiyasi yo'q ([[pul-valyuta-yaxlitlash#Chayyot pul (tip) — YO'Q qarori]]). "Qaytimni qoldiring" — alohida funksiya emas. Qaytim har doim to'liq qaytariladi.

## Hisob yaxlitlash — YO'Q (qaror 2026-05-29)

> [!important] Hisob summasi yaxlitlanmaydi — aniq qoladi
> Foydalanuvchi: *"43 287 → 43 300 buni hozircha hisoblamaymiz... har bir davlatda narxlar bunday qoyilmaydi. restoranda eng kam summa 300 tenge / 5000 som, 21323 kabi summa hech qayerda belgilanmagan."*
>
> Menyu narxlari **har doim toza raqamlarda** qo'yiladi (admin shunday belgilaydi). Shuning uchun g'alati summalar (21323) umuman paydo bo'lmaydi → **hisob yaxlitlash kerak emas.**

- Hisob total — **aniq** (qanday hisoblansa shunday)
- Hech qanday `cashRounding` config yo'q
- Karta / Kaspi / naqd — hammasi aniq summa
- `Math.round` faqat foiz hisoblashda integer olish uchun ishlatiladi (denominationga yaxlitlash emas) — [[../05-data-model/biznes-mantiq/total-hisoblash]]

> [!note] Eslatma: narx kiritishda
> Admin menyu narxini toza qiymatda kiritadi (5000, 12000, 300). Tizim g'alati narxlarni majburlamaydi, lekin amalda shunday bo'ladi.

## Order'da saqlash

```javascript
order.cashPayment: {
  givenAmount: Number,    // mijoz bergan summa (kupyura tugmasi orqali)
  changeAmount: Number,   // qaytim
}
```

Yaxlitlash field'lari YO'Q (roundedTotal, roundingAdjustment — kerak emas).

## Mixed payment naqd qismi

Gibrid to'lovda ([[../05-data-model/biznes-mantiq/tolov-oqimi]]) naqd qismi ham aniq:
```
Hisob: 43 000
Karta: 30 000 (aniq)
Naqd: 13 000 (aniq)
```
Hech qanday yaxlitlash yo'q.

## Offline'da naqd

Naqd to'lov offline'da to'liq ishlaydi (lokal). Kupyura, qaytim, yaxlitlash — hammasi lokal hisoblanadi. Hech qanday muammo (keshbekdan farqli).

## To'lov ekrani namunasi (POS)

```
┌──────────────────────────────────────┐
│ Hisob: 43 000 so'm  (aniq)            │
├──────────────────────────────────────┤
│ [5 000] [10 000] [20 000]             │
│ [50 000] [100 000] [200 000]          │
│ [Aniq summa]                          │
├──────────────────────────────────────┤
│ Berildi: 50 000                       │
│ Qaytim:  7 000 so'm                   │
│ [Tasdiqlash]                          │
└──────────────────────────────────────┘
```

## Test rejasi

- [ ] Kupyura tugmalari KZT (1000-20000)
- [ ] Kupyura tugmalari UZS (5000-200000)
- [ ] Qaytim hisoblash (given − total)
- [ ] Given < total → error
- [ ] ⭐ Hisob yaxlitlanmaydi (total aniq qoladi)
- [ ] Mixed naqd qismi (aniq)
- [ ] Offline naqd to'liq ishlaydi

## Bog'liq

- [[pul-valyuta-yaxlitlash]]
- [[../05-data-model/biznes-mantiq/tolov-oqimi]]
- [[../05-data-model/biznes-mantiq/total-hisoblash]]
- [[chek-raqamlash]]
