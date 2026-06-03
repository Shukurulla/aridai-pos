---
tags: [moc, data-model]
created: 2026-05-28
updated: 2026-05-28
---

# Data model MOC

## Asosiy fayllar

### Umumiy
- [[er-diagramma|ER diagramma]] — barcha entity'lar va munosabatlar
- [[sync-metadata|Sync metadata]] — `clientId`, `version`, `syncStatus` va boshqalar
- [[index-strategiyasi|Index strategiyasi]] — compound indexlar, kompromisslar
- [[snapshot-strategiyasi|Snapshot strategiyasi]] — qachon snapshot vs ref

### Biznes mantiq (lifecycle va qoidalar)
- [[biznes-mantiq/_MOC|Biznes mantiq MOC]]

## Core entity'lar

| Entity | Hujjat | Status |
|---|---|---|
| restaurant | [[restaurant]] | ✅ |
| branch | [[branch]] | ✅ |
| user | [[user]] | ✅ |
| order | [[order]] | ✅ markaziy |
| food | [[food]] | ✅ |
| category | [[category]] | ✅ |
| table | [[table]] | ✅ |
| shift | [[shift]] | ✅ |
| service | [[service]] | ✅ |
| discount | [[discount]] | ✅ |
| customer | [[customer]] | ✅ mijoz (telefon, tarix, keshbek) |

## Tool'lar tomonidan qo'shilgan entity'lar

| Tool | Yangi entity'lar | Hujjat |
|---|---|---|
| sklad | `ingredient`, `stock`, `stock_movement` | [[../04-toollar/sklad]] |
| keldi-ketti | `salary_rule`, `schedule`, `attendance`, `payroll` | [[../04-toollar/keldi-ketti]] |
| qr-order | `qr_order_request` | [[../04-toollar/qr-order]] |
| qr-pay | `kaspi_transaction` | [[../04-toollar/qr-pay-kaspi]] |
| keshbek | `cashback_balance`, `cashback_movement`, `cashback_qr_session` | [[../04-toollar/keshbek-tizimi]] |
| sync infra | `outbox` (lokal MongoDB), `audit_log` | [[sync-metadata]] |

## Tool model patch'lari

Mavjud entity'larga tool'lar qaysi field'larni qo'shadi:

- `restaurant.features` — [[../03-tool-strategiyasi/feature-toggle-tizimi]]
- `restaurant.tokenVersion` — [[../02-arxitektura/xavfsizlik/auth-strategiyasi]]
- `branch.currentMode`, `branch.lastSyncedAt`, `branch.outboxPending` — [[../04-toollar/online-offline-rejim]]
- `user.tokenVersion`, `user.restaurantId` (denorm) — [[../02-arxitektura/xavfsizlik/tenant-izolyatsiyasi]]
- `food.recipe[]`, `food.restaurantId` — [[../04-toollar/sklad]]
- `food.isActive`, `food.sortOrder` — UX
- `order.kaspi` — [[../04-toollar/qr-pay-kaspi]]
- `order.cashback` — [[../04-toollar/keshbek-tizimi]]
- `order.createdInMode` — [[../04-toollar/cook-waiter-possiz-rejim]]
- Barcha entity'larga: [[sync-metadata|sync metadata]] field'lari

## Bog'liq

- [[../02-arxitektura/multi-tenant-xavfsizlik]]
- [[../02-arxitektura/conflict-resolution]]
- [[../02-arxitektura/socket-sinxronizatsiya]]
