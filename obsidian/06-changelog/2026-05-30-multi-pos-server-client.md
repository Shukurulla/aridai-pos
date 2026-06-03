---
tags: [changelog, kod, pos, multi-pos, electron, arxitektura]
date: 2026-05-30
type: implementation
---

# 2026-05-30 — Multi-POS: server exe + client exe ajratish

## Sabab

Foydalanuvchi muhim arxitektura xatosini ko'rsatdi: agar POS+server **bitta dastur** bo'lsa va
bir filialda bir nechta POS monitor bo'lsa, har biriga o'rnatilganda **har biri o'z backend'i
bilan ishlab qoladi** → duplikat chek raqami, ikki smena, chalkash stock.

Yechim (`multi-pos.md` qarori): **bitta filial = bitta local server**. Qolgan POS'lar unga
client sifatida ulanadi. Demak ikkita exe:
- **Server exe** — backend + MongoDB + UI (filialda bitta)
- **Client (POS) exe** — faqat UI, server PC'ga LAN orqali ulanadi

## Bajarilgan ish

### Renderer — bir xil kod, ikki rejim
- `api.js`: `posMode()` (server|client), `getServerUrl/setServerUrl/clearServerUrl`, `pingServer()`.
  `BASE` endi: client → LAN server URL (localStorage); server → `window.LOCAL_API` (preload).
- `pages/ServerSetup.jsx` — CLIENT birinchi ochilganda server IP so'raydi (`192.168.x.x:4561`),
  ulanishni tekshiradi (`/health`).
- `pages/NotProvisionedClient.jsx` — server topildi lekin aloqa yo'q / hali biriktirilmagan.
- `App.jsx` — rejim oqimi:
  - CLIENT: server URL yo'q → ServerSetup; aloqa/biriktirilmagan → NotProvisionedClient; aks holda login
  - SERVER: biriktirilmagan → Provision (filial admin); aks holda login

### Electron — ikki entry
- `electron/preload.cjs` — SERVER: `POS_MODE="server"`, `LOCAL_API="http://localhost:4561"`
- `electron/preload-client.cjs` — CLIENT: `POS_MODE="client"` (LOCAL_API yo'q)
- `electron/main-client.js` — CLIENT main: **local backend ishga tushirilMAYDI**, faqat oyna
  (server PC'dagi backendga ulanadi)
- `package.json`: `electron` (server), `electron:client`, `dev:client`

> Server backend `0.0.0.0:4561` tinglaydi (LAN), CORS ochiq — client LAN orqali ulanadi.
> Bitta global sync, atomik chek/stock — faqat serverda (duplikat yo'q).

## Tasdiqlash (UI — Preview)

✅ **CLIENT rejim**: "Подключение к серверу" → IP kiritildi (localhost:4561) → ulandi
✅ Server provisioned → CLIENT'da **xodim login** → POS (server backend'dan: bir xil menyu, smena
   касса 50 000) — client'ning o'z bazasi yo'q, hammasi serverdan
✅ **SERVER rejim** (oldingi): provisioning → login → POS (o'z backend'i ichida)

## Arxitektura (yakuniy)
```
Filial LAN
├── POS #1 (SERVER exe)  ← Electron + MongoDB + backend(0.0.0.0:4561) + UI  ──wss──▶ Global VPS
├── POS #2 (CLIENT exe)  ← Electron + UI  ──http LAN──▶  POS #1:4561
└── POS #3 (CLIENT exe)  ← Electron + UI  ──http LAN──▶  POS #1:4561
```
Bitta baza, bitta chek counter, bitta smena → duplikat yo'q.

## Qolgan
- Real-time broadcast (socket) — POS #1 order ochsa POS #2 darhol ko'rsin (hozir refresh kerak)
- Server o'chsa client banner ("Server bilan aloqa yo'q") — NotProvisionedClient bor, lekin
  ishlash paytida uzilishni ham aniqlash kerak
- electron-builder: 2 target (server.exe + client.exe), MongoDB installer (server uchun)
- Statik IP / mDNS auto-discovery

## Bog'liq
- [[../02-arxitektura/multi-pos]] — server-client qarori (asos)
- [[../02-arxitektura/local-backend-stack]] — Variant A
- [[2026-05-30-pos-provisioning]] — provisioning (oldingi qadam)
