---
tags: [changelog, kod, phase0]
date: 2026-05-29
type: implementation
---

# 2026-05-29 — Phase 0 kod: fundament qurildi va tasdiqlandi

## Sabab

Foydalanuvchi to'liq avtonomiya berdi: "sen barcha kodlarni bajar, men natijani tekshiraman". Dizayndan (obsidian vault) implementatsiyaga o'tildi — Roadmap Phase 0.

## Bajarilgan ish (global/backend)

### Yangi infratuzilma
| Fayl | Maqsad |
|---|---|
| `config/index.js` | markazlashgan config (env, JWT/BRANCH secret, TTL) |
| `config/constants.js` | ROLES, CURRENCIES, CASH_DENOMINATIONS, FEATURE_KEYS, ... |
| `utils/sync-meta.plugin.js` | soft delete (`isDeleted`) + version + syncStatus mongoose plugin |
| `utils/token.js` | 4 token turi (user/owner/refresh/branch), verify helperlar |
| `utils/password.js` | bcrypt hash/compare/dummyCompare |
| `utils/phone.js` | E.164 normalizatsiya (+998/+7) |
| `utils/audit.js` | audit.log (redaction, severity) |
| `models/audit_log.model.js` | audit yozuvlari |
| `middlewares/auth.middleware.js` | JWT verify + tokenVersion + tenant claim |
| `middlewares/restoranAuth.middleware.js` | ⭐ telefon-token BEKOR → JWT (xavfsizlik tuzatildi) |
| `middlewares/tenant.middleware.js` | tenantGuard + assertBranchInRestaurant |
| `middlewares/role.middleware.js` | requireRole(...) |
| `middlewares/rate-limit.middleware.js` | loginLimiter (5/15min), apiLimiter |
| `middlewares/sanitize.middleware.js` | NoSQL injection (Express 5 mos) |
| `features/registry.js` | 7 tool toggle + requires/excludes + buildDefaultFeatures |
| `features/middleware.js` | requireFeature(key) |

### Yangilangan modellar (10/10)
restaurant (features Map + flattenMaps, currency immutable, tokenVersion), user (6 role, restaurantId, pin/managerPin), branch (currentMode, branchToken, posServerIp), category, food (availability/stop-list + recipe), table (tariffs+qrSlug), service, discount, shift (totals+handovers+discrepancy), order (snapshotlar, receiptNumber, cancelType, kaspi/cashback, fiscal-reserved). Hammasiga `restaurantId` + `syncMetaPlugin` + partial-unique indexlar.

### Yangilangan routelar
- `restoraurants.routes.js` — JWT login, features seed, **PATCH /:id/features/:key** toggle, soft delete
- `user.routes.js` — register (owner auth + restaurantId + normalize), JWT login, soft delete + tokenVersion
- `branch.routes.js` — owner auth, **POST /:id/token** (branchToken), soft delete
- `index.js` — config, sanitize, rate-limit, health endpoint, error handler

## Tasdiqlash (real test, MongoDB bilan)

✅ Server boot: MongoDB ulandi, port 4560, ogohlantirishsiz
✅ 38/38 fayl sintaksis toza (`node --check`)
✅ Restoran create: currency KZT→timezone Asia/Almaty avto, features seeded (offline=on)
✅ Owner JWT login (eski telefon-token xato tuzatildi)
✅ Xato parol → INVALID_CREDENTIALS, token'siz → AUTH_REQUIRED
✅ Feature toggle: sklad/possiz/keshbek yoqildi, config merge, dependency (possiz requires offline) ishlaydi
✅ Soft delete plugin (isDeleted filter)

## Tuzatilgan muammolar (test paytida topildi)
1. **Mongoose 9 middleware** — query pre-hook'lar `next` callback qabul qilmaydi → next'siz async uslubga o'tkazildi
2. **Map serialization** — `flattenMaps: true` qo'shildi (JSON.stringify(Map)→{} muammosi)
3. **Duplicate index** — service/discount'da takroriy restaurantId index olib tashlandi
4. **express-mongo-sanitize** — Express 5 mos emas → o'z sanitizer'imiz

## Qolgan (Task #9)
Operatsion routelar (category/food/table/discount/service/shift/order) hali eski auth'da — restaurantId inject + tenantGuard + requireRole + soft delete + stop-list blok kerak. Ular yangilanmaguncha o'sha endpointlar create'da xato beradi (restaurantId required).

## Test komandalar (foydalanuvchi uchun)
```bash
cd global/backend
npm install              # uuid, express-rate-limit (bajarildi)
npm run dev              # yoki npm start
# create → login → toggle (yuqoridagi curl misollar)
```

## Bog'liq
- [[../01-vizyon/roadmap]] — Phase 0
- [[../02-arxitektura/xavfsizlik/restoran-auth-tuzatish]]
- [[../03-tool-strategiyasi/feature-toggle-tizimi]]
