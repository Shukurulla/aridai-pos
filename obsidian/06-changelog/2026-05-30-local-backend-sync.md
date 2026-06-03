---
tags: [changelog, kod, local-backend, sync, electron]
date: 2026-05-30
type: implementation
---

# 2026-05-30 — Local backend + global↔local sync (MVP)

## Sabab

Foydalanuvchi local server va POS'ni so'radi. Tanlov: **to'liq Electron + MongoDB**, POS
**local backend'ga ulanadi + online sync**. Haqiqiy arxitektura (global-va-local.md): filial
ma'lumotining birlamchi egasi — local backend, global esa mirror.

## Bajarilgan ish

### `local/` — yangi papka (Electron + local backend)
- **Bir xil schema** (global-va-local.md): global backend'ning models/utils/middlewares nusxasi
  (12 model, 6 util, 8 middleware) → sync mantiqi sodda.
- `backend/config/index.js` — local config (port 4561, lokal Mongo `aridai_local`, global URL,
  branchToken). JWT secret GLOBAL bilan bir xil (token o'zaro yaroqli).
- `backend/server.js` — Express + Socket.io, lokal Mongo ulanish, standalone (`node`) yoki Electron'dan.
- `backend/routes/auth.routes.js` — **lokal POS login** (sync qilingan userlar, offline ham ishlaydi).
- `backend/routes/pos.routes.js` — POS API (global bilan bir xil).
- `package.json` — electron, express, mongoose, socket.io, vite, react (deps o'rnatildi).

### Sync qatlami
**Global tomonda** (branchToken auth — `branchAuth.middleware.js` + `sync.routes.js`):
- `GET /api/sync/bootstrap` — local boot'da filial mirror (restaurant/branch/menyu/stol/service/
  discount/users, parol hash bilan — offline login uchun).
- `POST /api/sync/push` — local order/smena qabul (upsert, bir xil `_id`, global'da → `synced`).

**Local tomonda** (`backend/sync/`):
- `sync-client.js` — `bootstrapSync()` (global→local mirror, bulkWrite bir xil `_id`),
  `pushSync()` (pending→global, so'ng lokal `synced`), `collectPending()`.
- `initial-sync.js`, `push-once.js` — standalone skriptlar.

### syncStatus boshqaruvi (muhim tuzatish)
Local `sync-meta.plugin.js`: `save()` bilan yaratilgan/o'zgargan yozuv **`pending`** bo'ladi
(global'ga push kerak). Mirror (bulkWrite) bu hook'ni chetlab o'tadi → global'dan kelgan data
`synced` qoladi. Global plugin o'zgarmaydi (default `synced` = source of truth).

## Tasdiqlash (real, 2 backend + 2 Mongo DB)

✅ Local backend boot (port 4561, `aridai_local` Mongo)
✅ Boshlang'ich sync: global→local (1 branch, 2 kat, 5 taom, 6 stol, 1 service, 2 discount, 1 user)
✅ Lokal login (offline-capable, sync qilingan parol hash)
✅ Lokal order (calc 79200 to'g'ri, `syncStatus=pending`)
✅ Push: local→global (1 order + 1 smena, bir xil `_id`) → global'da `syncStatus=synced`
✅ Push'dan keyin lokal pending=0

### Tuzatilgan
- `syncStatus` default `synced` → local'da `pending` kerak edi (plugin save-hook)
- receiptNumber kolliziya (global+local mustaqil generatsiya) — test orderlar tozalandi; kelajakda
  order FAQAT local'da yaratiladi (global mirror), POS endpointi global'da o'qish uchun qoladi.

## Qolgan (keyingi qadam)
- **POS terminal UI** (Electron renderer) — Task #20
- **Electron qobiq** (`electron/main.js` + `preload.js`) — backend'ni main process'da ishga tushiradi
- Avtomatik/davriy sync (socket yoki interval) — hozir manual push
- Offline outbox + reconnect, conflict resolution
- MongoDB installer + electron-builder paketlash (Windows .exe)

## Bog'liq
- [[../02-arxitektura/local-backend-stack]] — Electron + MongoDB qarori
- [[../02-arxitektura/global-va-local]] — mirror + "local avval jo'natadi"
- [[../02-arxitektura/sinxronizatsiya/boshlangich-sync]]
- [[2026-05-30-pos-backend-mvp]] — POS API (oldingi qadam)
