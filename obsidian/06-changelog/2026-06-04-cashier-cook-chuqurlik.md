---
tags: [changelog, mobile, cashier, cook, waiter, smena, check, handoff]
created: 2026-06-04
modul: aridai-pos-app · cashier · cook · waiter
---

# Cashier / Cook chuqurlik — Смена, Счёт so'rovi, Готово handoff

> Mobil ilovada kassir va oshpaz rollarini "ishchi holatga" chuqurlashtirish:
> kassir smena ochib-yopadi va "счёт so'ralgan" orderlarni ko'radi; oshpaz
> tayyor blyudalarni handoff (Выдано) qiladi; ofitsiant счёт so'raydi.

## A. Cook — «Готово» handoff segmenti
- Oshpaz home'iga **3-segment «Готово»** qo'shildi (Новые · Готовятся · Готово).
- `GET /orders/kitchen/:branchId?includeReady=1` — endi `ready` (tayyor, lekin
  hali `served` emas) itemlarni ham qaytaradi. Default (param yo'q) — eski
  xatti-harakat (faqat waiting/cooking).
- «Готово» segmentidagi blyudada **«Выдано»** tugmasi → `cookingStatus = served`
  (`PATCH /:id/items/:itemId/cooking { status: "served" }`) → navbatdan chiqadi.
- Bu kuxnyaga to'liq ko'rinish beradi: nima tayyor bo'lib ofitsiantni kutyapti.

## B. Cashier — Смена boshqaruvi
- Kassir home **2-segment**: «К оплате» (mavjud) + «Смена».
- «Смена»: aktiv smena bo'lsa — jonli summary (ochilgan vaqt, kassa start,
  vyruchka, naqd) + **«Закрыть смену»**; yo'q bo'lsa — **«Открыть смену»**.
- Yopishda naqd input **avtomatik default** = openingCash + cashRevenue
  (admin shift tab bilan bir xil — oldin kelishilgan).
- Backend o'zgarmadi (`POST /shifts/create`, `PUT /shifts/:id/close` tayyor).

## C. Счёт so'rovi (check request) — ofitsiant → kassir
- **Model**: `order.checkRequest = { requested, at, byName }` qo'shildi.
- **Route**: `PATCH /orders/:id/request-check { requested }` — `requested:true`
  bo'lsa `at=now`, `byName=userData.name`. Faqat ochiq (to'lanmagan, bekor emas)
  orderga.
- **Ofitsiant**: order detal pastki panelida **«Запросить счёт»** tugmasi
  (ochiq dine-in/order uchun). Bosilsa flag o'rnatiladi; qayta bossa — bekor.
- **Kassir**: «К оплате» ro'yxatida `checkRequest.requested` orderlar **qizil
  «Счёт запрошен» badge** bilan **eng tepada** ko'rsatiladi.

## Yangi/o'zgargan fayllar

**Backend**
- `models/order.model.js` — `checkRequest` subdoc
- `routes/order.routes.js` — `PATCH /:id/request-check`; `/kitchen` `includeReady` param

**Flutter (aridai-pos-app)**
- `models/order.dart` — `checkRequested` + `checkRequestedByName`
- `models/kitchen_item.dart` — `isReady`
- `services/api_service.dart` — `requestCheck(id, bool)`, `getKitchen({includeReady})`
- `screens/home/cook_home.dart` — 3-segment + «Выдано»
- `screens/home/cashier_home.dart` — 2-segment (К оплате + Смена)
- `screens/waiter/order_detail_screen.dart` — «Запросить счёт» tugmasi

## Choziluvchanlik (toggle)
Bu rollarning tabiiy chuqurlashuvi — alohida toggle shart emas. Kelajakda
«счёт so'rovi» (call-waiter/QR) alohida modul sifatida kengaytirilishi mumkin
(push bildirishnoma kassirga). Hozircha flag + UI highlight.

## Bog'liq
- [[aridai-pos-app-reja]]
- [[2026-06-04-admin-mobil-crud]] (oldingi qadam)
