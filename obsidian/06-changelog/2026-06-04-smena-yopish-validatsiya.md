---
tags: [changelog, smena, shift, validation, kassa, filial-admin, pos-monitor, backend]
created: 2026-06-04
modul: global/backend · global/filial_admin · local/aridaipos_server
---

# Smena yopish — ochiq order tekshiruvi + avtomatik kassa/daromad

> Smena yopilayotganda **ochiq (to'lanmagan) orderlar** bo'lsa — yopish bloklanadi
> (tushum/kassa noto'g'ri hisoblanmasligi uchun). Web admin modalida endi
> **daromad + kutilayotgan kassa avtomatik** ko'rsatiladi/yoziladi.

## 1. Backend guard — ochiq orderlar bo'lsa yopilmaydi
Ikkala close endpointida bir xil tekshiruv qo'shildi:
- **global** `PUT /shifts/:id/close` (web admin yopadi)
- **local** `POST /shifts/:id/close` (POS kassir yopadi) — kunlik asosiy yo'l

```js
const openOrders = orders.filter(o => !o.isCancel && o.paymentStatus !== "paid").length;
if (openOrders > 0) return 400 { code: "OPEN_ORDERS", message: "...есть открытые заказы (N)..." }
```
- Sabab: ochiq order to'lov metodi/summasi aniq emas → smena totals (tushum,
  naqd, kassa discrepancy) buziladi. Avval to'lash yoki bekor qilish kerak.

## 2. Web admin (filial_admin) — Shifts.jsx closeShift
- **Pre-check**: yopishdan oldin shu smenaning ochiq orderlari sanaladi →
  bo'lsa `modal.alert("Есть открытые заказы: N…")` va to'xtaydi (server'ga
  bormaydi ham).
- **Avtomatik daromad/kassa**: prompt modal endi to'liq breakdown ko'rsatadi:
  - `Выручка за смену: X ₸`
  - `Наличными: Y ₸ · Касса на старте: Z ₸`
  - `Ожидается в кассе: (Z+Y) ₸` ← input shu qiymat bilan **avtomatik to'ldiriladi**
  - Avval faqat "0" chiqardi (card-only smena → naqd=0 bo'lsa kutilgan kassa ham 0;
    endi breakdown buni tushuntiradi).
- **Xato → modal**: catch endi `modal.alert(Ошибка)` ko'rsatadi (server OPEN_ORDERS
  ham bu yerda ushlanadi — ikkilamchi himoya).

## 3. POS monitor — kod o'zgarmadi (avtomatik ishlaydi)
- ShiftClose.tsx allaqachon `expectedCash` bilan avtomatik to'ldiradi (kassa sanash
  ekrani). Ochiq order guard — local server'dan `error.error.message` orqali keladi,
  oldin qo'yilgan **errMsg modal** uni ko'rsatadi. Versiya o'zgarmadi.

## Holat / versiya
- global/backend: deploy-backend.yml → VPS pull + pm2 restart (auto).
- global/filial_admin: deploy-web.yml → VPS rebuild (auto). Build toza ✅.
- local/aridaipos_server: **0.3.0 → 0.3.1** (backend guard). EXE keyingi build'da
  (release-server.yml) — filialda qayta o'rnatilganda kuchga kiradi.

## Bog'liq
- [[2026-06-04-modal-shift-close]]
- [[2026-06-04-smena-filtri-monitor-local]]
