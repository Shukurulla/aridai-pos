---
tags: [changelog, printer, chek, print-hub, currency, local-server, muhim]
created: 2026-06-05
modul: local/aridaipos_server
---

# Print-hub HTTP API (POS "Чек") + valyuta (tenge/sum) + double-print fix

> (1) POS'da "Чек" / to'lovda chek → "Ошибка печати: Неизвестная ошибка".
> (2) Chekda valyuta restoran sozlamasiga bog'lanmagan (сум/₸ chalkash).

## Sabab
- POS monitor `localhost:4561/print/payment`, `/printers`, `/health`, `/print/test`
  ga ulanadi (kepket printer-hub API, **auth yo'q**). Lekin local server bu
  endpointlarni **umuman bermasdi** → 404 → "Неизвестная ошибка".
- Chek `сум` hardcoded edi; restoran `currency` (UZS/KZT) ishlatilmasdi.

## Yechim
### 1. Print-hub router (yangi) — `routes/print-hub.routes.js`, root'ga mount
- `GET /health`, `GET /printers`, `POST /print/payment`, `POST /print/test`.
- `/print/payment`: POS body → `buildReceiptHtml` → `printViaHook` (kassir
  bog'langan printer). To'lov turi order'dan olinadi.
- Kuxnya/hisobot cheklari (`/print/by-kitchen` ...) — hozircha no-op (keyingi bosqich).

### 2. Arxitektura — toza ajratish
- `receipt-template.js` (yangi, **toza**) — `buildReceiptHtml` (backend ham import qiladi).
- `print.js` — faqat Electron print (puppeteer→PDF→lp/pdf-to-printer), shablonni re-export.
- `print-hook.js` — `setPrinter`/`printViaHook` (backend HTML quradi, main chop etadi).

### 3. Valyuta — restoran sozlamasidan
- `currencyLabel(code)`: UZS→**сум**, KZT→**₸**, RUB→₽, USD→$.
- Chek (auto-pay, test, /print/payment) restoran `currency`'sini ishlatadi.

### 4. Double-print fix
- Avval backend pay handler'da `firePrintReceipt` (auto-print) qo'shgan edim.
- Lekin POS **o'zi** `printPayment` chaqiradi (to'lovdan keyin + "Чек" tugma) →
  ikki marta chiqardi. Backend auto-print **olib tashlandi**; print POS boshqaradi.

### 5. Chekka qo'shildi
- **Стол** (table), **Официант** (waiter) meta qatorlari (restoran uchun).

## Tekshirildi
- Barcha fayllar syntax ✅. Receipt screenshot (Стол/Официант/сум) ✅ — restoran
  ko'rinishida.

## Versiya
- 0.3.9 → **0.4.0** (print to'liq integratsiya).

## Bog'liq
- [[2026-06-05-receipt-print-on-pay]]
- [[2026-06-05-receipt-design-vectorstyle]]
