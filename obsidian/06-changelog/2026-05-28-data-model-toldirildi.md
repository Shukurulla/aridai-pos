---
tags: [changelog, data-model]
date: 2026-05-28
type: docs-expansion
---

# 2026-05-28 — Data model to'liq to'ldirildi

## Sabab

Avval `05-data-model/_MOC.md` faqat indeks edi. Hech qanday batafsil model hujjati yo'q edi. Kod yozish oldidan har core entity uchun aniq schema va qoidalar bo'lishi shart.

## Yangi fayllar (14 ta)

### Umumiy hujjatlar
- [[../05-data-model/er-diagramma|er-diagramma.md]] — Mermaid ER diagrammalari (core + tool entity'lar)
- [[../05-data-model/sync-metadata|sync-metadata.md]] — `clientId`, `version`, `syncStatus`, mongoose plugin
- [[../05-data-model/index-strategiyasi|index-strategiyasi.md]] — barcha collection'lar uchun compound index ro'yxati
- [[../05-data-model/snapshot-strategiyasi|snapshot-strategiyasi.md]] — qachon snapshot vs ref, order'da implementatsiya

### Core entity'lar (10 ta)
- [[../05-data-model/restaurant|restaurant.md]] — features struct, owner subdoc, tokenVersion
- [[../05-data-model/branch|branch.md]] — currentMode, branchToken, heartbeat, geo
- [[../05-data-model/user|user.md]] — role enum, RBAC, tokenVersion, isActive
- [[../05-data-model/food|food.md]] — recipe array (sklad), isActive vs deleted
- [[../05-data-model/category|category.md]] — title uniqueness, cascade qoidalari
- [[../05-data-model/table|table.md]] — tariffs (hourly/fixed/daily), qrSlug, position
- [[../05-data-model/shift|shift.md]] — totals object, openingCash, closingDiscrepancy
- [[../05-data-model/service|service.md]] — applyTo enum, percent
- [[../05-data-model/discount|discount.md]] — conditions, promoCode (kelajak)
- [[../05-data-model/order|order.md]] ⭐ — eng murakkab, snapshot subdoc'lar, cooking status

## Yangilangan

- [[../05-data-model/_MOC|05-data-model/_MOC.md]] — to'liq qayta yozildi
- [[../00-INDEX|00-INDEX.md]] — core entity linklari qo'shildi

## Asosiy o'zgarishlar va tavsiyalar

### Joriy schemalardan farqlar

| Entity | Joriy | Tavsiya |
|---|---|---|
| `restaurant` | Faqat owner | + features, tokenVersion, installedFeatureVersions |
| `branch` | name, address, restaurant | + currentMode, branchToken, heartbeat, geo, workingHours |
| `user` | role 4 ta enum | role 6 ta enum (system_admin, owner qo'shildi), restaurantId denorm, tokenVersion |
| `food` | minimal | + isActive, sortOrder, recipe, restaurantId, allergens kelajak |
| `category` | minimal | + sortOrder, icon, color, restaurantId |
| `table` | tariffs subdoc bor | + qrSlug, qrEnabled, position |
| `shift` | isActive | + openingCash, closingCash, totals, openedBy, closedBy, discrepancy |
| `service` | percent | + applyTo, isActive, restaurantId |
| `discount` | percent | + conditions, promoCode, usageLimit, restaurantId |
| `order` | yaxshi yo'lda | + snapshot subdoc'lar (waiter/service/discount), cooking status per food, kaspi obj, paidBy, cancelledBy, createdInMode, source |

### Markaziy printsiplar

1. **Multi-tenant denormalize** — har entity'da `restaurantId` (denorm `branch.restaurant` dan)
2. **Snapshot subdoc'lar** — waiter, service, discount, food.name/price — order'da yozib qo'yiladi
3. **Sync metadata** — har entity'ga 6 ta field qo'shiladi (qarang [[../05-data-model/sync-metadata]])
4. **Soft delete** — `deleted: true`, hard delete kamdan-kam
5. **isActive vs deleted** — vaqtinchalik o'chirish vs abadiy

## Identifikatsiyalangan ochiq qarorlar

1. **Kategoriya o'chirilganda food'lar nima qiladi?** — Variant C (ichida food bo'lsa o'chirishni taqiqlash) tavsiya
2. **Foods.cancels changelog yoki quantity yangilash?** — joriy changelog yondashuvi qoldirildi, lekin tasdiqlash kerak
3. **Restaurant.owner alohida user collection'da?** — hozircha restaurant.owner ichida qoldi
4. **Service nechta bo'ladi per branch?** — 1 ta. Murakkablik (vaqt-bog'liq foiz) kelajakda

## Statistika

- Bu sessiyada: 14 yangi fayl + 2 yangilangan + 1 changelog
- Vault'da jami: ~54 markdown fayl
- 4 ta ER diagramma (core, sync infra, tool entity'lar)
- 10 ta sample document
- 100+ kod snippet

## Keyingi qadam

Foydalanuvchi tasdiqlagan reja bo'yicha keyingisi — **Biznes mantiq** (Group 2): order lifecycle, shift lifecycle, tolov oqimi, total hisoblash, cancel/refund.

## Bog'liq

- [[2026-05-28-vault-yaratildi]]
- [[2026-05-28-local-stack-qarori]]
- [[2026-05-28-rejimlar-xavfsizlik-deepdive]]
