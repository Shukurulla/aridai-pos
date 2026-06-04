---
tags: [changelog, backend, mobile, possiz, offline, idempotency, sync]
created: 2026-06-04
modul: global-backend · aridai-pos-app · possiz
---

# Possiz v2 — Slice 1: idempotent order joylashtirish (clientId)

> Possiz v2 («haqiqiy offline») — telefon SQLite outbox + admin-koordinator +
> internet kelganda global'ga sync ([[possiz-rejim]]). Bu **katta, ko'p
> bosqichli** ish. **Slice 1** — uning **poydevori**: order joylashtirishni
> **idempotent** qilish. Outbox qayta-sync qilganda (yoki submit timeout bo'lib,
> aslida o'tib ketganda) **dublikat order yaratilmasligi** uchun har order
> client tomonda `clientId` (UUID) oladi.

## Nima qilindi (Slice 1)

### Backend
- **`order.model.js`**: `clientId` maydoni + partial-unique indeks
  `{ branch, clientId }` (faqat string clientId'lar — qayta-yuborish dublikat
  bermaydi).
- **`POST /orders/place`**:
  - `clientId` berilgan bo'lsa — avval `{ branch, clientId }` bo'yicha qidiradi;
    mavjud bo'lsa **o'shani qaytaradi** (idempotent, 200, yangi yaratmaydi).
  - `possiz: true` flag — `createdInMode: "possiz"`, `source: "possiz_mobile"`
    (aks holda `waiter_mobile`).

### Mobile
- `uuid` paketi qo'shildi.
- `ApiService.placeOrder` — har order'ga `clientId` (UUID) qo'shadi (+ ixtiyoriy
  `possiz` flag). Endi order submit **xavfsiz qayta-yuboriladi** (timeout bo'lsa
  ham dublikat bo'lmaydi) — bu outbox uchun zarur shart.

## Possiz v2 — keyingi slice'lar (reja)

- **Slice 2 — Mobile SQLite outbox**: `sqflite` — submit network'da yiqilsa
  order outbox'ga tushadi (yo'qolmaydi).
- **Slice 3 — Sync engine**: aloqa qaytsa outbox global'ga `clientId` bilan
  flush qilinadi (idempotent → dublikatsiz). Pending-count indikator.
- **Slice 4 — Possiz-mode (admin toggle)**: admin "Possiz rejim"ni qo'lda yoqadi;
  offline'da order berishga ruxsat (outbox), POS yo'q deb taxmin qilinadi.
- **Slice 5 — Koordinator + PDF chek**: admin telefoni master; mobil PDF chek.

## Yangi/o'zgargan fayllar
- `models/order.model.js` — `clientId` + indeks
- `routes/order.routes.js` — `/place` idempotency + possiz flag
- `aridai-pos-app/pubspec.yaml` — `uuid`
- `aridai-pos-app/lib/services/api_service.dart` — `placeOrder` clientId

## Bog'liq
- [[possiz-rejim]] ⭐
- [[2026-06-04-offline-awareness-v1]] (oldingi qadam)
