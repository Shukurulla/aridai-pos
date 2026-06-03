---
sana: 2026-06-02
mavzu: Xodim maoshi (waiter) + cook biriktirilgan taomlar — data model + endpointlar
status: bajarildi
---

# Xodim qo'shishda maosh (waiter) + taom biriktirish (cook)

## Talab
Admin xodim qo'shganda: **waiter** → maosh (kunlik YOKI olgan orderning %); **cook** → qaysi
taomlarni qabul qilishi (taomlar biriktiriladi).

## Yechim (BACKEND — har qanday klient uchun poydevor)
### users.model.js
- `salary: { mode: none|daily|monthly|percent, amount }` — waiter maoshi:
  - `daily`/`monthly` → amount = summa; `percent` → amount = order summasidan foiz.
- `assignedCategories[]`, `assignedFoods[]` — cook biriktirilgan taomlar (bo'sh = hammasini ko'radi).

### user.routes.js
- `parseStaffExtras(body)` helper — maosh + taomlarni JSON yoki multipart (string) dan parse qiladi.
- `POST /api/users/register` (owner) + `PUT /api/users/owner/:id` + `PUT /api/users/:id`
  (owner/branch_admin) — endi extras qabul qiladi.
- **YANGI** `POST /api/users/staff` (branch_admin/owner) — FILIAL ADMIN o'z filialiga xodim
  qo'sha oladi (avval faqat owner edi). branch_admin → faqat o'z filiali.

## Sinov (verified)
- branch_admin (+77005000831) orqali: waiter `salary{percent,5}` ✅; cook `assignedCategories`+
  `assignedFoods` ✅. Test xodimlar o'chirildi.

## Keyingi (aridai-pos-app)
- 02-arxitektura/aridai-pos-app-reja.md — Flutter 4 rol reja. Maosh/cook UI shu app'da (waiter
  salary screen + admin staff form) quriladi.
