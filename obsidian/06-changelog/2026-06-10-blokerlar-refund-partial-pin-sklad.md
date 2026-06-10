---
sana: 2026-06-10
mavzu: Audit blokerlar + refund + qisman to'lov + manager PIN + SKLAD moduli
status: bajarildi
---

# Katta sessiya: pul-integrity blokerlar → core POS funksiyalar → birinchi Phase-3 modul

15-agentlik holat auditi (obsidian maqsad vs kod) asosida prioritetlangan ro'yxat
bir chekkadan bajarildi.

## A. Pul/data-integrity blokerlar (5/5) ✅
1. **Total formula birxillashtirildi** — global `order-calc.js` eski Camp A'da
   qolgan edi; 2026-05-31 foydalanuvchi qarori (Camp B: service subTotal'dan,
   discount (subTotal+service)'dan) bo'yicha tuzatildi. `total-hisoblash.md` va
   `chegirma-service-qollanishi.md` yangi qarorga yangilandi.
2. **computeShiftTotals** — yagona helper (mixed/kaspi/cashback/cancelled/refund);
   4 ta shift-close shu helperga o'tdi (local close mixed'ni yo'qotardi).
3. **Merge soft-cancel** — deleteMany o'rniga isCancel+pending (global'da orphan/2x
   tushum yo'q).
4. **Order PUT/POST/DELETE hardening** — tenant guard + body whitelist + soft-delete.
5. **Global pay mixed split == total** validatsiyasi.

## B. Core POS funksiyalar ✅
- **#10 Socket auth** — handshake JWT + canJoinBranch (faqat o'z filiali/restorani);
  flutter setAuth({token}).
- **#6 Refund (vozvrat)** — POST /orders/:id/refund (global+local), refunded
  revenue'ga kirmaydi, POS "Возврат" tugmasi + "ВОЗВРАТ ОФОРМЛЕН". Smena yopishni
  bloklamaydi (paid/refunded = yopiq).
- **#7 Qisman to'lov (pay-items)** — foods[].isPaid + payments[] sessiyalar.
  Σ payments == totalPrice invariant (oxirgi sessiya qoldiqni yopadi). UI shartnoma:
  qisman oqimda услуга/chegirma OLINMAYDI (birinchi sessiyada waive). /pay
  partiallyPaid'da qoldiqni oladi. Global foods[] schema parity (hourly maydonlar
  ham — sync strip data-loss tuzatildi).
- **#9 Manager PIN** — owner_admin StaffForm'da PIN (4-6 raqam, hash, sync orqali
  local'ga); oshxona boshlagan bekor/kamaytirish + har refund → PIN. GRACEFUL:
  PIN o'rnatilmagan filialda talab qilinmaydi. POS modallarida PIN maydoni.

## C. SKLAD moduli (birinchi Phase-3 tool) ✅
`sklad.md` spec bo'yicha to'liq backend + UI:
- Modellar: ingredient, stock, **stock_movement (append-only imzoli delta)** —
  offline additive sync spec qoidasi: movement _id idempotent insert + balans $inc,
  konflikt YO'Q.
- `requireFeature("sklad")` — **birinchi real ulanish**: toggle o'chiq → /api/sklad
  404 FEATURE_DISABLED (#8 yopildi).
- O1 oversell-blok: order create/add/qty-oshirish'da ingredient yetmasa
  400 STOCK_INSUFFICIENT (POS/waiter alert ko'radi). Deduct/restore fire-and-forget
  (order oqimi buzilmaydi). To'liq bekorda movement-kompensatsiya.
- Hooklar: local (POS) create/saboy/items/qty/delete/cancel + global (waiter)
  place/items/cancel'lar.
- Sync: movements push (local→global), ingredients+stocks bootstrap mirror
  (stock (branch,ingredientId) bo'yicha — balans hosilaviy).
- filial_admin: Склад sahifasi (qoldiq/prixod/inventarizatsiya/porog/jurnal,
  past-balans banner) + Foods retsept (BOM) editori.

## Rate limit + admin smena
- GET 300→5000, mutate 100→2000/min, login 5→50/15min.
- Smena sahifasi: BARCHA aktiv smenalar ko'rinadi + force-close (ochiq orderlarni
  bekor qilib yopish) — osilib qolgan smenalar tozalanadi.

## Eslatmalar
- Refund/partial/PIN/sklad lokal qismi — local server RESTART talab qiladi.
- Sklad'ni sinash: owner panel → Функции → Склад ON → filial_admin → Склад →
  ingredient + prixod → Foods retsept → POS order → jurnalda "Заказ" chiqimi.
