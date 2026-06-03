---
tags: [changelog, hujjatlash]
date: 2026-05-28
type: docs-expansion
---

# 2026-05-28 — Rejimlar va xavfsizlik deep-dive hujjatlari

## Sabab

Foydalanuvchi ko'rsatdi: `02-arxitektura/rejimlar/` va `02-arxitektura/xavfsizlik/` papkalari bo'sh edi. Yuqori darajadagi `3-rejim.md` va `multi-tenant-xavfsizlik.md` mavjud, lekin chuqurroq tafsilotlar yo'q edi. Har papkani to'liq to'ldirildi.

## Yangi fayllar (12 ta)

### rejimlar/
- [[../02-arxitektura/rejimlar/_MOC|_MOC.md]] — navigatsiya
- [[../02-arxitektura/rejimlar/online-rejim|online-rejim.md]] — texnik holat, oqim, performance, degradation
- [[../02-arxitektura/rejimlar/offline-rejim|offline-rejim.md]] — trigger, cheklov, race conditions, watchdog
- [[../02-arxitektura/rejimlar/possiz-rejim|possiz-rejim.md]] — peer-to-peer, koordinator, mobile UI, PDF check
- [[../02-arxitektura/rejimlar/rejim-otish-qoidalari|rejim-otish-qoidalari.md]] — to'liq state machine, transition matrix, 5 race condition stsenariolari

### xavfsizlik/
- [[../02-arxitektura/xavfsizlik/_MOC|_MOC.md]] — navigatsiya, tartibga ko'ra prioritet
- [[../02-arxitektura/xavfsizlik/restoran-auth-tuzatish|restoran-auth-tuzatish.md]] ⭐ shoshilinch
- [[../02-arxitektura/xavfsizlik/auth-strategiyasi|auth-strategiyasi.md]] — JWT, refresh, branchToken
- [[../02-arxitektura/xavfsizlik/role-based-access|role-based-access.md]] — RBAC matrix
- [[../02-arxitektura/xavfsizlik/tenant-izolyatsiyasi|tenant-izolyatsiyasi.md]] — mongoose plugin, middleware
- [[../02-arxitektura/xavfsizlik/socket-xavfsizligi|socket-xavfsizligi.md]] — handshake, rate limit, replay
- [[../02-arxitektura/xavfsizlik/rate-limiting|rate-limiting.md]] — endpointlar va limitlar
- [[../02-arxitektura/xavfsizlik/secrets-management|secrets-management.md]] — saqlash, rotation
- [[../02-arxitektura/xavfsizlik/audit-log|audit-log.md]] — schema, kindlar, retention

## Yangilanganlar

- [[../00-INDEX|00-INDEX.md]] — yangi bo'limlar qo'shildi (Rejimlar, Xavfsizlik, Sinxronizatsiya — deep dive)
- [[../02-arxitektura/3-rejim|3-rejim.md]] — deep dive linklar
- [[../02-arxitektura/multi-tenant-xavfsizlik|multi-tenant-xavfsizlik.md]] — deep dive linklar

## Asosiy mavzular qamragandi

### Rejimlar
- Online rejim — performance maqsadlari (latency, throughput jadvali), degradation senariolari (Kaspi yo'q, FCM yo'q)
- Offline rejim — waiter mobile bloklash sababi, lokal yozish cheklovlari jadvali, watchdog
- Possiz rejim — admin telefoni koordinator, mobile UI mockup'lar, PDF check oqimi, koordinator o'zgartirish
- State machine — 10 dan ortiq transition, hysteresis, atomik update, 5 race condition'ni alohida echim bilan

### Xavfsizlik
- Restoran auth muammosi — joriy `restoranAuth.middleware.js` telefonni token sifatida ishlatadi (kritik xato), 3 attacker stsenariosi, yangi JWT-based oqim
- Auth strategiyasi — 4 token turi (user/refresh/owner/branch), tokenVersion mexanizmi
- RBAC — 6 ta role, 7 kategoriya bo'yicha action matrix (restoran/filial/xodim/menyu/stol/order/smena/sklad/hisobot)
- Tenant izolyatsiyasi — mongoose plugin avtomatik filter, query helper, aggregate guard
- Socket xavfsizligi — handshake, room avtomatik join, event whitelist, replay protection, bandwidth quota
- Rate limiting — 11 ta endpoint/harakat limit jadvali, Redis store, brute-force lockout
- Secrets — 15+ secret ro'yxati, rotation strategiyasi (JWT 6 oy), local PC fayl permissions
- Audit log — 30+ kind, severity, retention, alerting kanallari

## Prioritetlar (deep dive hujjatlardan kelib chiqib)

Eng kritik tuzatish kerak bo'lgan joylar (sifat tartibida):

1. ⭐⭐⭐ [[../02-arxitektura/xavfsizlik/restoran-auth-tuzatish|restoran-auth.middleware.js]] — DARHOL, kritik
2. ⭐⭐ [[../02-arxitektura/xavfsizlik/tenant-izolyatsiyasi|tenantGuard]] — har endpoint'ga
3. ⭐⭐ [[../02-arxitektura/xavfsizlik/auth-strategiyasi|tokenVersion]] — schema patch va middleware
4. ⭐ [[../02-arxitektura/xavfsizlik/role-based-access|RBAC]] — enum kengaytirish + middleware
5. ⭐ [[../02-arxitektura/xavfsizlik/audit-log|audit_log collection]]

## Statistika

- Bu sessiyada yaratilgan fayllar: 12 + 1 changelog
- Vault'da jami markdown fayllar: ~37
- Diagrammalar (Mermaid): 8+
- Code snippets: 40+

## Bog'liq

- [[2026-05-28-vault-yaratildi]]
- [[2026-05-28-local-stack-qarori]]
- [[2026-05-28-obsidian-config]]
