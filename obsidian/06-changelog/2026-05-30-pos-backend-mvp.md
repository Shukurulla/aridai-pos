---
tags: [changelog, kod, backend, pos, order, biznes-mantiq]
date: 2026-05-30
type: implementation
---

# 2026-05-30 — POS/waiter terminal backend MVP (order + calc)

## Sabab

Foydalanuvchi POS va waiter tomonini tez MVP tarzda boshlashni so'radi. Asosiy funksiyalar:
order berish, **xizmat haqi (service) qo'shish/olib tashlash**, **chegirma berish/bermaslik**.

Maxsus talab (biznes-mantiq tuzatishi): service va discount **mustaqil hisoblanmasligi** kerak.
Eski (noto'g'ri) holatda 1000'lik orderga service 10% (+100) va discount 10% (−100) mustaqil
qo'shilib bir-birini bekor qilardi. To'g'risi — **service chegirmadan keyingi bazadan**:
```
discount = 10% × 1000 = 100
service  = 10% × (1000 − 100) = 90   ← chegirma ayrilgan summadan
total    = 1000 + 90 − 100 = 990
```

## Bajarilgan ish (global/backend)

### `utils/order-calc.js` — yagona total manbai (server authority)
`calculateOrderTotals(order)` — tartib (total-hisoblash.md bo'yicha):
1. subTotal = Σ(foodPrice × effectiveQuantity) — inc/dec cancels bilan
2. discount = subTotal asosida (percent/amount, subTotal bilan cheklangan)
3. **service = (subTotal − discount) asosida** ← asosiy tuzatish
4. tariff = stol tarifi (hourly/fixed/daily, alohida)
5. total = subTotal + tariff + service − discount (negative → throw)

`effectiveQuantity`, `calculateTariff` ham shu faylda.

### `routes/pos.routes.js` — terminal API (yangi auth)
Auth: user token (`waiter`/`cashier`/`branch_admin`), branch token'dan (`req.userData.branch`).
| Endpoint | Vazifa |
|---|---|
| `GET /pos/menu` | kategoriya + taom (branch) |
| `GET /pos/tables`, `/services`, `/discounts` | katalog |
| `GET /pos/shift/current`, `POST /shift/open`, `POST /shift/close` | smena (close'da totals + discrepancy) |
| `POST /pos/orders` | order yaratish (snapshot + server calc) |
| `GET /pos/orders?status=open`, `GET /pos/orders/:id` | ro'yxat / bitta |
| `PATCH /pos/orders/:id` | taom/service/discount o'zgartirish (recalc); `removeService`/`removeDiscount` |
| `POST /pos/orders/:id/pay` | to'lov (cash/card/transfer/kaspi/mixed, naqd qaytim) |
| `POST /pos/orders/:id/cancel` | void/cancel |

Xususiyatlar: food snapshot (narx/nom muzlatiladi), **stop-list bloki** (stopped + dailyLimit),
receiptNumber generatsiya (PREFIX-YYYYMMDD-NNNN), client total e'tiborga olinmaydi (server hisoblaydi).

### Tuzatilgan real buglar (test paytida topildi)
- `table.qrSlug` va `discount.promoCode`: `default:null` + `sparse unique` → ikkinchi null **dublikat
  xatosi**. Yechim: `default:null` olib tashlandi + `partialFilterExpression: {$type:"string"}`
  (faqat haqiqiy qiymatlar unique). Eski indexlar drop + syncIndexes.

## Tasdiqlash (real backend + MongoDB)

✅ Calc unit test: foydalanuvchi misoli (1000→990) + hujjatning 5 misoli — barchasi to'g'ri
✅ To'liq oqim (branch_admin): login → smena ochish → menyu → **order (80000: discount 8000,
   service 7200 chegirmadan keyin, total 79200)** → service olib tashlash (72000) → discount olib
   tashlash (80000) → to'lov (cash, qaytim 20000) → smena yopish (revenue 80000, discrepancy 0)
✅ receiptNumber: MKZ-20260530-0001
✅ Seed: `scripts/seed-pos-test.js` (Markaziy filial — 5 taom, 6 stol, service 10%, 2 discount)

## Qolgan (keyingi qadam)
- **POS/waiter frontend** (terminal UI): menyu → savatcha → service/discount toggle → total → to'lov
- Cook (oshpaz) ekrani — cookingStatus oqimi
- Real-time (socket) — order yangilanishi
- Split/birlashtirish, refund, cashback/kaspi to'lov

## Bog'liq
- [[../05-data-model/biznes-mantiq/total-hisoblash]] — calc formulasi (asos)
- [[../05-data-model/biznes-mantiq/order-lifecycle]]
- [[../08-frontend/pos-electron]] — POS terminal spetsifikatsiyasi
- [[2026-05-29-rus-tili-filial-detal-xodimlar]] — oldingi qadam
