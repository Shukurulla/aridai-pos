---
sana: 2026-06-02
mavzu: Smena sync global→local (admin yopsa POS ham yopiladi) + closing cash default
status: bajarildi
---

# Smena global→local sync + yopish kassasi default

## Muammo
1. Filial_admin'da smena yopganda **closing cash input bo'sh** — manager qo'lда yozishi kerak edi
   (natijada расхождение noto'g'ri: 0 − 10 050 = −10 050).
2. **Admin smena yopsa, POS'da smena yopilmaydi** — shift sync FAQAT local→global (push) edi.

## Yechim

### 1. Closing cash default (filial_admin Shifts.jsx)
- Aktiv smena uchun `cashRevenue` hisoblanadi (cash + mixed.cash, bekor qilinmagan paid orderlar).
- Yopish prompt default = **`openingCash + cashRevenue`** (kutilayotgan kassa). Manager tasdiqlaydi
  yoki haqiqiy sanagan summani kiritadi → расхождение to'g'ri.
- (Local POS mapShift'da `expectedClosingCash` allaqachon bor edi — bu filial_admin tomoni uchun.)

### 2. Smena global→local PULL (order-sync kabi)
- Global: `GET /api/sync/shifts-since?ts=` (branchAuth) → `updatedAt > ts` smenalar.
- Global `shift.model.js`: `shiftNumber` qo'shildi (local↔global round-trip — "Смена №N").
- Global `shift.routes.js` create: `shiftNumber = count+1` (admin ochsa ham raqamli).
- Local `sync-client.js`: `pullShifts(skipIds)` — global'dan o'zgargan smenalarni `replaceOne`
  bilan local'ga yozadi (local pending/just-pushed skip). Yengil order-loop ichida (har 2s).
- Local `server.js`: smena o'zgarsa → socket **`shift:closed`** (yopilgan bo'lsa) + **`order_updated`**.
- POS allaqachon `shift:closed` (→ `setActiveShift(null)`) va `order_updated` (→ `loadData` →
  `getActiveShift`) ni eshitadi → REAL-TIME yangilanadi (~2s). Local `getActiveShift` inactive
  smena uchun `null` qaytaradi → POS ShiftOpen ekraniga o'tadi.

## Sinov (verified)
- To'liq sikl: ADMIN ochdi (3000) → ~3.5s → LOCAL aktiv (3000) ✅; ADMIN yopdi → ~3.5s →
  LOCAL `/shifts/active` = null → POS smena yopildi ✅.
- Closing cash prompt default = "3000" (openingCash 3000 + naqd 0) ✅.

## Cheklov (#30)
- Bidirectional konflikt: agar smena ayni paytda local'da (POS) ham, global'da (admin) ham
  o'zgartirilsa, local pending versiyasi ustun. Odatiy holat (admin synced smenani yopadi) ishlaydi.
