---
tags: [changelog, xavfsizlik, tenant, multi-tenant, auth, backend, "#9"]
created: 2026-06-05
modul: global/backend
---

# #9 — Operatsion CRUD route'larga tenant izolyatsiyasi

> Audit: category/food/table/discount/service CRUD'lari faqat `authMiddleware`
> bilan himoyalangan edi — istalgan autentifikatsiyalangan foydalanuvchi
> **boshqa restoran/filial** menyu/konfiguratsiyasini list/create/edit/delete
> qila olardi (cross-tenant). Endi `tenantGuard` + `tenantResource` qo'shildi.

## Audit natijasi
- `authMiddleware` (JWT+tokenVersion) — ✅ hamma joyda.
- `tenantGuard` — faqat user.routes'da 2 ta joy edi.
- `requireRole` — operatsion CRUD'da yo'q (har kim o'chira olardi).
- Order/Shift — handler ichida qo'lda tenant tekshiruvi bor edi (pul route'lari).
- Gap: **menyu/konfiguratsiya CRUD'da tenant izolyatsiyasi yo'q.**

## O'zgarishlar
### Yangi: `tenantResource(Model)` (tenant.middleware.js)
`:id` route'lar uchun — resursni yuklab, `restaurantId`'ni token bilan
solishtiradi (aniq mismatch → 403 + audit). Legacy (`restaurantId` yo'q) yozuvni
bloklamaydi — eski data buzilmasin.

### Qo'llandi (5 route × create/list/edit/delete)
| Route | create+list | put/:id, delete/:id |
|---|---|---|
| category, discount, service | `tenantGuard` | `tenantResource(Model)` |
| food (multipart) | `tenantGuard` (multer'dan keyin) | `tenantResource` (upload'dan oldin) |
| table (`/create`, `/tables/:branchId`) | `tenantGuard` | `tenantResource(tableModel)` |

- `tenantGuard` request'dagi `branchId`/`restaurantId`'ni token claim bilan
  solishtiradi. **Xavfsiz**: legit foydalanuvchi o'z filialiga kiradi → o'tadi;
  cross-tenant → 403. Role'ga tegmaydi (POS/mobil read buzilmaydi).
- Owner token'da `branchId` yo'q → branch tekshiruvi skip (owner o'z restorani
  filiallariga kiradi).
- `/table/create` (restoran token, restoranMiddleware) — o'zgarmadi.

## Hali #9'da qolgan (keyingi, ehtiyotkorlik bilan)
- WRITE'larga `requireRole` (mas. menyu CRUD faqat branch_admin/owner) — client
  role'larini tekshirib qo'llash kerak (mobil admin/web admin buzilmasin).
- order/shift handler tenant tekshiruvini `tenantGuard`/`tenantResource`'ga
  birlashtirib tozalash (hozir ishlaydi, qo'lda).
- `requireFeature` — tool route'lari qo'shilganda.

## Tekshirildi
- Syntax ✅. Production deploy keyin: login (branch_admin) → o'z filial foods 200;
  cross-branch 403; create/edit/delete o'z resursi 200; noma'lum id 404.

## Bog'liq
- [[../02-arxitektura/xavfsizlik/tenant-izolyatsiyasi]]
