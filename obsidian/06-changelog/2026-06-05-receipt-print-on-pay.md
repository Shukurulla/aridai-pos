---
tags: [changelog, printer, chek, payment, routing, local-server]
created: 2026-06-05
modul: local/aridaipos_server
---

# To'lovda chek avtomatik chop etish (kassir printeri)

> Foydalanuvchi: kassir login bog'ladim, lekin POS'dan to'lov qilsam chek
> chiqmayapti. Sabab: binding saqlanardi-yu, to'lovga **ulanmagandi**. Ulandi.

## Oqim — decoupled hook
- **backend** (`routes/orders.routes.js` `POST /:id/pay`) — to'lovdan keyin
  `firePrintReceipt(orderId)` (fire-and-forget, to'lov javobini bloklamaydi).
- **print-hook.js** (yangi) — backend↔main ajratish: backend faqat hook chaqiradi
  (Electron'ga bog'liq emas → standalone ham ishlaydi). Main `setPrintHook` beradi.
- **main** (`index.js`) `printOrderReceipt(orderId)`:
  - KASSIR roli (`cashier`/`kassir`) bog'langan printerlarni topadi.
  - Order → `buildReceiptHtml` (VECTOR STYLE dizayn) — mahsulotlar, chegirma,
    servis, ИТОГО, to'lov turi.
  - Har printerga `printHtml` (puppeteer→PDF→lp/pdf-to-printer).

## Detallar
- ESM: index.js `./backend/print-hook.js` + route `../print-hook.js` → **bitta
  modul instansi** (hook umumiy).
- Kassir printeri bog'lanmagan bo'lsa — jim (chek chiqmaydi, xato yo'q).
- Soatlik taom: `hourlyFinalAmount` (to'lovda muzlatilgan) ishlatiladi.
- Print xatosi to'lovni buzmaydi (try/catch, fire-and-forget).

## Keyingi
- **Povar (kitchen) cheki**: yangi buyurtma/qo'shilgan taom/bekor → povar
  bog'langan printerga (kategoriya/taom filtri bilan). Hozir faqat kassir to'lov cheki.

## Versiya
- 0.3.8 → **0.3.9**.

## Bog'liq
- [[2026-06-05-receipt-design-vectorstyle]]
- [[2026-06-05-printer-login-binding]]
