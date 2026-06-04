---
tags: [changelog, backend, mobile, possiz, rejim, fcm, cook]
created: 2026-06-04
modul: global-backend · aridai-pos-app · possiz
---

# Possiz rejim — admin toggle + cook push gating (to'g'rilangan tushuncha)

> **Tuzatish:** men possiz'ni avval mobile-SQLite deb noto'g'ri tushundim.
> Foydalanuvchi aniqlashtirdi: **possiz = svet yo'q** (POS PC o'chgan). Bunda
> mobil internet (4G) bor — telefonlar **global backend** bilan ishlaydi.
> SQLite kerak emas.

## To'g'ri model

1. **Svet o'chdi** → POS PC ishlamaydi. Filial admin **telefondan possiz
   rejimni QO'LDA yoqadi**.
2. Possiz yoqilganda:
   - **Waiter mobile order bera oladi** (order global backendga 4G orqali boradi).
     (Offline rejimda — bloklanardi: "POS orqali bering". Possiz uni bekor qiladi.)
   - **Cook'larga FCM notification keladi** ("Новый заказ").
3. **Online/offline rejimda cook'ga push KELMAYDI** — cook orderlarni POS
   monitordan ko'radi. Faqat possiz'da (POS yo'q) telefonga push keladi.

## Nima qilindi

### Backend
- **`branches.model.js`**: `possiz: { active, activatedBy, activatedAt }`.
- **`PATCH /branches/:id/possiz`** (branch_admin yoki owner) — possiz yoqish/o'chirish
  (+ audit log). Yoqilganda `currentMode="possiz"`.
- **`GET /branches/:id/status`** — `possiz` qaytaradi.
- **`order.routes.js` `notifyCooks`** — endi `possizActive` parametri; **possiz
  bo'lmasa cook push YUBORILMAYDI** (early return). `/place` branch possiz flag'ini
  (yoki order possiz flag'ini) tekshiradi.

### Mobile
- **`BranchStatus`** + **`BranchStatusService`**: `possiz` (ValueNotifier) qo'shildi.
- **`ApiService.setPossiz(active)`** — toggle.
- **`OfflineBanner`**: possiz → qizil "Режим ПОССИЗ" banner; offline (possiz emas)
  → sariq banner; online → yo'q.
- **CreateOrderScreen / waiter FAB**: order bloklanadi FAQAT `offline && !possiz`.
  Possiz'da order ruxsat (placeOrder `possiz:true` yuboradi).
- **`PossizControl`** widget — admin Смена tab'ida toggle (svet yo'qda yoqadi).

## Slice 1 (idempotency) holati
clientId idempotency baribir foydali (retry/sync xavfsizligi) — saqlanadi.

## Yangi/o'zgargan fayllar
- Backend: `branches.model.js`, `routes/branch.routes.js`, `routes/order.routes.js`
- Mobile: `models/branch_status.dart`, `services/branch_status_service.dart`,
  `services/api_service.dart`, `widgets/offline_banner.dart`,
  `widgets/possiz_control.dart`, `screens/waiter/create_order_screen.dart`,
  `screens/home/waiter_home.dart`, `screens/admin/admin_shift_tab.dart`

## Bog'liq
- [[possiz-rejim]] ⭐
- [[2026-06-04-possiz-v2-slice1-idempotency]]
- [[2026-06-04-offline-awareness-v1]]
