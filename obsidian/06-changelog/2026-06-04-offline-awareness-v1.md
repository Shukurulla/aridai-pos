---
tags: [changelog, mobile, backend, offline, rejim, heartbeat]
created: 2026-06-04
modul: aridai-pos-app · global-backend · offline
---

# Offline-awareness v1 — filial offline holatini mobil ilovaga yetkazish

> **Diqqat (arxitektura qaror):** [[offline-rejim]] hujjati aniq aytadi —
> waiter mobile **lokal backend'ga ULANMAYDI** (sabablar: telefon 3G/4G'da
> bo'lishi mumkin; har telefonga lokal IP sozlash murakkab; xavfsizlik —
> lokal backend tashqaridan ko'rinmasligi kerak). Buning o'rniga: **global
> VPS** filialning lokal-backend heartbeat'ini kuzatadi → filial offline
> bo'lsa, mobile'ga status beradi → mobile order berishni bloklaydi va banner
> ko'rsatadi. Bu — hujjatlashtirilgan **v1**. (Lokal-ulanish/possiz-SQLite — v2.)

## Nima qilindi

### Backend — heartbeat + status
- **`branchAuth` middleware**: lokal backend har sync so'rovida (branchToken)
  `branch.lastHeartbeatAt` yangilanadi (10s throttle, fire-and-forget).
  Model'da maydon allaqachon bor edi (`branches.model.js`).
- **`GET /branches/:id/status`** (user token) → `{ online, currentMode,
  lastHeartbeatAt, secondsSinceHeartbeat, posServerIp }`.
  - `online = lastHeartbeatAt yo'q (lokal backend umuman yo'q — global orqali
    online) YOKI heartbeat < 45s`.
  - Lokal backend sync qilyapti → **online**; to'xtagan (>45s) → **offline**.

### Mobile — status polling + degradatsiya
- **`BranchStatusService`** — har 15s `GET /branches/:id/status` so'raydi;
  `ValueNotifier<bool> online`. So'rov muvaffaqiyatsiz (telefon internetsiz)
  bo'lsa — holat **o'zgartirilmaydi** (false-offline flapping bo'lmasligi uchun).
  Login'da start, logout'da stop (PushService kabi).
- **`OfflineBanner`** — waiter / cook / cashier home tepasida ko'rinadi (offline'da):
  "📵 Филиал офлайн — оформляйте через POS…".
- **CreateOrderScreen** — offline'da tepada banner + **«Оформить» bloklangan**
  (`_submit` ham guard qiladi). 3 ta kirish nuqtasi bitta joyda himoyalanadi.

## Yangi/o'zgargan fayllar
**Backend**
- `middlewares/branchAuth.middleware.js` — heartbeat yozish
- `routes/branch.routes.js` — `GET /:id/status`

**Flutter**
- `models/branch_status.dart` — YANGI
- `services/branch_status_service.dart` — YANGI (poll + ValueNotifier)
- `services/api_service.dart` — `getBranchStatus()`
- `widgets/offline_banner.dart` — YANGI (reusable banner)
- `screens/home/{waiter,cook,cashier}_home.dart` — banner
- `screens/waiter/create_order_screen.dart` — banner + submit guard
- `main.dart` — service start/stop (login/logout)

## Choziluvchanlik (toggle)
Offline-awareness — xavfsizlik/UX uchun standart. Kelajak (v2):
- Lokal Wi-Fi peer / possiz-SQLite koordinator ([[possiz-rejim]])
- Client-side hysteresis (online 30s stable) — hozir server 45s threshold yetarli

## Bog'liq
- [[offline-rejim]] ⭐ (arxitektura asosi)
- [[rejim-otish-qoidalari]]
- [[2026-06-04-menu-accordion]] (oldingi qadam)
