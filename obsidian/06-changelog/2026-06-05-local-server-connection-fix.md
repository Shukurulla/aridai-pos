---
tags: [changelog, local-server, connection, heartbeat, bug-fix, electron]
created: 2026-06-05
modul: local/aridaipos_server
---

# Local server — global ulanish ("Соединение...") + port fix

> Foydalanuvchi: (1) local server global API'ga ulanmayapti ("Соединение..."
> qotib qoladi); (2) UI'da "LAN: localhost:3011" — noto'g'ri port.

## Sabab 1 — heartbeat timeout juda qisqa (1.5s)
- `pingGlobal()` `${GLOBAL_URL}/api/health`'ni **1500ms** timeout bilan so'rardi.
- O'zbekiston ↔ VPS (Germaniya) HTTPS uchun sovuq TLS handshake 1.5s'dan oshib
  ketishi mumkin → abort → `isOnline=false` → "Соединение..." qotib qoladi.
- Global `/api/health` aslida **jonli** (HTTP 200 — tekshirildi). Muammo timeout.
- Xato `.catch(()=>null)` bilan **yutilardi** → diagnostika ko'rinmasdi.

**Fix:**
- Timeout **1500ms → 6000ms**.
- Xato to'g'ri ushlanadi: `lastError = "timeout (6s)"` yoki `HTTP <code>` yoki
  network message. Status'da ko'rsatiladi.

## Sabab 2 — port 3011 (hardcoded, noto'g'ri)
- Backend aslida **4561** portda (`index.js:23`, "POS monitorlar 4561'ga ulanadi").
- UI'da `Shell.jsx` + `StatusPage.jsx` "3011" hardcoded edi (eski qiymat).
- **Fix:** dinamik `status.localPort` (4561) ko'rsatiladi.

## Diagnostika qo'shildi
- `status:get` endi `globalUrl` + `localPort` qaytaradi.
- Topbar: **"Сервер: api.asadbek-durdana.uz"** + offline bo'lsa xato sababi
  (timeout/HTTP/...) yonida qizil rangda. Endi qaysi serverga ulanyapti va
  nega ulanmayotgani ko'rinadi.

## Eslatma — GLOBAL_URL
- Default `https://api.asadbek-durdana.uz` (`.env`'siz ham). Agar topbar boshqa
  URL ko'rsatsa — build'da eski `.env`/`GLOBAL_URL` bor. Yangi EXE (.env bundle
  qilinmaydi) → har doim production default.

## Versiya / yetkazish
- 0.3.2 → **0.3.3** (printer Phase 1 + ulanish fix birga). release-server.yml → EXE.
- Dev'da: `git pull` + restart.

## Bog'liq
- [[2026-06-05-local-server-printers-phase1]]
- [[2026-06-05-exe-build-fix]]
