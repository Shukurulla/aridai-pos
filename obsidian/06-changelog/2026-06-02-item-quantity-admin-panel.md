---
sana: 2026-06-02
mavzu: Item miqdorini kamaytirish/ko'paytirish — admin panel + POS
status: bajarildi
---

# Item miqdori (+/−) — filial admin panelda ham, POS monitorda ham

## Talab
Buyurtma ichidagi taom miqdorini kamaytirish/ko'paytirish — **admin panelda ham, POS monitorda ham**.

## Holat
- **POS monitor**: ALLAQACHON bor edi — itemni bosish → qty modal (katta −/+ stepper +
  tezkor [1,2,3,5,10] + "Было X → станет Y" → Сохранить). Local `PATCH /orders/:id/items/:itemId/quantity`.
- **Filial admin**: YO'Q edi → qo'shildi.

## Yechim (filial admin)
- **Global backend** `order.routes.js`: `PATCH /api/orders/:id/items/:itemId/quantity` { quantity }
  — `item.quantity = qty` (min 1), o'sha item cancels tozalanadi, `recalcOrder` (service→discount),
  guard: paid/cancelled bo'lsa 400.
- **api.js**: `orderItemQty(orderId, itemId, quantity)`.
- **Orders.jsx**: ochiq item yonida **`− [qty] +`** stepper (min 1). "+" ko'paytiradi, "−" kamaytiradi,
  "✕" — butun itemni bekor qiladi (olib tashlaydi). To'langan/bekor orderda yashirin.
- **styles.css**: `.qty-step` (o'tkir kepket stepper).

## Sync (ikki tomon — avval qurilgan order-sync orqali)
- Admin global'da o'zgartirsa → ~2s ichida local POS'ga qaytadi (`order_updated` socket → reload).
- POS local'da o'zgartirsa → push → admin Заказы auto-refresh (8s) ko'rsatadi.

## Sinov (verified)
- Backend: Coca-Cola 1→2, total 7900→8500; ~3.5s → LOCAL/POS'da ham qty 2, grandTotal 8500 ✅.
- UI: "+" 2→3 (10 000→15 000₸), "−" 3→2 (15 000→10 000₸) — Подытог/Итого/позиции yangilanadi ✅.
