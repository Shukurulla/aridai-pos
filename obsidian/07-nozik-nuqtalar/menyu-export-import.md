---
tags: [nozik-nuqta, menyu, export-import]
created: 2026-05-29
---

# Menyu export / import (filiallar orasida)

> [!important] Qaror (foydalanuvchi, 2026-05-29)
> Har filial **mustaqil menyu** yaratadi (shahar markazi vs chekka — narx/tanlov farq qiladi). Filiallar orasida nusxalash uchun: **JSON export → import**. Import qilingach filial o'ziga moslab tahrirlaydi yoki o'chiradi.

## Nima uchun mustaqil

- Shahar markazidagi filial: ko'p taom, qimmat narx
- Chekka filial: kam taom, arzon narx
- Lekin ko'pincha **o'sha taomlar** → noldan kiritish og'riq
- Yechim: bir filialdan export, boshqasiga import, keyin moslash

## Export

Filial admin "Menyuni eksport qilish" → JSON fayl yuklab oladi:

```javascript
GET /api/menu/export/:branchId
// → categories + foods JSON fayl (download)
```

```json
{
  "exportVersion": 1,
  "exportedAt": "2026-05-29T...",
  "sourceBranch": "Yunusobod",
  "currency": "UZS",
  "categories": [
    { "title": "Issiq taomlar", "sortOrder": 1, "icon": "...", "color": "#E74C3C" }
  ],
  "foods": [
    {
      "name": "Osh",
      "description": "...",
      "price": 35000,
      "categoryTitle": "Issiq taomlar",
      "sortOrder": 1,
      "imageUrl": "https://.../osh.jpg",
      "recipe": [ ... ]
    }
  ]
}
```

> [!note] ID'lar eksport qilinmaydi
> JSON'da `_id`, `branch`, `restaurantId` **yo'q** — chunki import qilinganda yangi filialda yangi entity yaratiladi. Bog'lanish `categoryTitle` orqali (ID emas).

## Import

Boshqa filial admin JSON yuklaydi:

```javascript
POST /api/menu/import/:targetBranchId
Body: <JSON file>
// → categories + foods yaratiladi (yangi ID)
```

Oqim:
1. JSON validate (versiya, struktura)
2. Kategoriyalar yaratiladi (target branch'da)
3. Taomlar yaratiladi (categoryTitle → yangi category ID bog'lanadi)
4. Rasmlar: URL'dan qayta yuklanadi yoki ulashilgan (quyiga qarang)
5. Hammasi `target branch + restaurantId` bilan

## Konflikt (import paytida)

Target filialda allaqachon "Osh" bor bo'lsa:

| Strategiya | Xulq |
|---|---|
| **Skip** (default) | Mavjud "Osh" qoldiriladi, import'dagi o'tkazib yuboriladi |
| **Replace** | Mavjud "Osh" yangilanadi |
| **Rename** | "Osh (import)" sifatida qo'shiladi |
| **Merge** | Foydalanuvchi har biri uchun tanlaydi |

Default: **Skip + hisobot** ("5 ta taom qo'shildi, 3 tasi mavjud edi, o'tkazib yuborildi").

## Rasmlar

- Export: `imageUrl` (to'liq URL)
- Import: rasm target filialga **qayta yuklanadi** (yangi upload) yoki URL ulashil    adi
- Default: qayta yuklash (har filial o'z rasmiga ega, mustaqil)

## Currency mosligi

Export'da `currency` bor. Import paytida:
- Target restoran currency != export currency → **ogohlantirish**
- Narxlar boshqa valyutada bo'lishi mumkin (5000 so'm ≠ 5000 tenge)
- Foydalanuvchi narxlarni qayta ko'rib chiqishi kerak

## Cross-restaurant import (xavfsizlik)

JSON fayl — oddiy fayl, boshqa restoranga ham o'tishi mumkin:
- Import faqat **o'z restoranining filiallariga** (RBAC — [[../02-arxitektura/xavfsizlik/role-based-access]])
- Import qilingan ma'lumot target restaurantId bilan (manba emas)
- JSON ichidagi narxlar/nomlar — tashqi data, validate qilinadi ([[xavfsizlik-qoshimcha]])

## Versiyalash

`exportVersion` — JSON format versiyasi. Kelajakda format o'zgarsa, eski export'larni import qilish uchun migration.

## Bulk operations (kelajak)

- CSV/Excel import (ko'p taom)
- Restoran shablon (kelajakda "asosiy menyu" → barcha filiallarga)
- Hozircha: filial-to-filial JSON export/import

## UI

```
Web admin / POS → Menyu →
  [Eksport] → menu-yunusobod-2026-05-29.json yuklab olinadi
  [Import]  → fayl tanlash → preview → "5 yangi, 3 mavjud" → Tasdiqlash
```

## Test rejasi

- [ ] Export → JSON (ID'larsiz, categoryTitle bilan)
- [ ] Import → yangi category+food (yangi ID)
- [ ] categoryTitle to'g'ri bog'lanadi
- [ ] Konflikt: skip (default) + hisobot
- [ ] Rasm qayta yuklanadi
- [ ] Currency mismatch → ogohlantirish
- [ ] Faqat o'z restorani filiallariga (RBAC)
- [ ] JSON validate (malicious data)
- [ ] Import'dan keyin filial edit/delete qila oladi

## Bog'liq

- [[../05-data-model/food]]
- [[../05-data-model/category]]
- [[../02-arxitektura/xavfsizlik/role-based-access]]
- [[xavfsizlik-qoshimcha]]
- [[../08-frontend/web-admin]]
