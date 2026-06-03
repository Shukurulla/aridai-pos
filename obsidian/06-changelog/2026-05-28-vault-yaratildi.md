---
tags: [changelog, milestone]
date: 2026-05-28
type: vault-init
---

# 2026-05-28 — Obsidian vault yaratildi

## Sabab

Foydalanuvchi loyihaning arxitektura va tool strategiyasini Obsidian vault'da yozib borishni so'radi. Maqsad — har bir o'zgarish, har bir tool, har bir qaror shu yerda hujjatlangan bo'lib, tartibsiz keng qamrovli yo'qotish bo'lmasligi.

## Bu sessiya'da yaratilgan fayllar

### Tuzilma
```
obsidian/
├── 00-INDEX.md
├── 01-vizyon/
│   ├── loyiha-mohiyati.md
│   └── choziluvchanlik-printsipi.md
├── 02-arxitektura/
│   ├── global-va-local.md
│   ├── 3-rejim.md
│   ├── socket-sinxronizatsiya.md
│   ├── conflict-resolution.md
│   ├── multi-tenant-xavfsizlik.md
│   ├── rejimlar/         (kelajakda batafsil)
│   ├── sinxronizatsiya/
│   │   └── offline-to-online-otish.md
│   └── xavfsizlik/       (kelajakda batafsil)
├── 03-tool-strategiyasi/
│   ├── feature-toggle-tizimi.md  ⭐
│   ├── tool-lifecycle.md
│   ├── tool-qoshish-shabloni.md
│   └── modullar-orasidagi-bogliqlik.md
├── 04-toollar/
│   ├── _MOC.md
│   ├── online-offline-rejim.md
│   ├── cook-waiter-possiz-rejim.md
│   ├── sklad.md
│   ├── keldi-ketti.md
│   ├── qr-order.md
│   ├── qr-pay-kaspi.md
│   └── keshbek-tizimi.md
├── 05-data-model/        (kelajakda)
├── 06-changelog/
│   └── 2026-05-28-vault-yaratildi.md
└── 99-templates/
    └── yangi-tool-template.md
```

## Asosiy qarorlar

### Q1: Vault tuzilmasi raqamlangan
Sabab: Obsidian'da fayllar alfa-tartibda chiqadi. `00-INDEX` birinchi, `01-vizyon` ikkinchi va h.k. — navigatsiya tabiiy.

### Q2: Wikilinks `[[fayl-nomi]]` formatida
Sabab: Obsidian native sintaksisi. Backlinks va graf ishlaydi.

### Q3: Tags `#vizyon`, `#arxitektura`, `#tool` ishlatildi
Sabab: Filter va search.

### Q4: Frontmatter har faylda
- `tags`, `created`, status fieldlari
- Tool fayllarida `toolKey`, `default`, `status`

### Q5: Mermaid diagrammalari
Sabab: Sinxron protokoli va arxitektura ko'rinarli bo'lishi uchun.

### Q6: Choziluvchanlik printsipi — markaziy
Sabab: Foydalanuvchining asosiy talabi. [[../01-vizyon/choziluvchanlik-printsipi]] da yozildi. [[../03-tool-strategiyasi/feature-toggle-tizimi]] — texnik amaliyot.

### Q7: 3 ta rejim aniq belgilangan
- Online, Offline, Possiz (cook+waiter)
- [[../02-arxitektura/3-rejim]] da matn va state machine

### Q8: Local backend texnologiyasi — Node.js + SQLite (taklif, hali yakunlanmagan)
Bu qaror keyingi sessiya'da yakunlanishi kerak.

## Hozir hujjat darajasidagi 7 ta tool

1. ✅ [[../04-toollar/online-offline-rejim|Online/Offline rejim]] (default ON)
2. ✅ [[../04-toollar/cook-waiter-possiz-rejim|Possiz rejim]]
3. ✅ [[../04-toollar/sklad|Sklad]]
4. ✅ [[../04-toollar/keldi-ketti|Keldi-ketti]]
5. ✅ [[../04-toollar/qr-order|QR Order]]
6. ✅ [[../04-toollar/qr-pay-kaspi|QR Pay (Kaspi)]]
7. ✅ [[../04-toollar/keshbek-tizimi|Keshbek]]

Hammasi dizayn bosqichida (📝), kod yozilmagan.

## Kelgusi ish (suggestions, hali tasdiqlanmagan)

- [ ] [[../05-data-model]] ni to'ldirish — barcha entity ER diagrammasi
- [ ] Local backend stack qarori (Node + SQLite vs alternativ)
- [ ] `restoranAuth.middleware.js` xavfsizlik tuzatishi (JWT login)
- [ ] Feature toggle tizimini implementatsiya qilish
- [ ] Socket layer'ni global/backend'ga qo'shish
- [ ] Misol kichik tool implementatsiya — eng oddiyi (masalan, tipping yoki keshbek default ko'rinishi)
- [ ] CI/test infrastructure

## Foydalanuvchi ko'rsatmasi

Foydalanuvchi qo'shimcha aytdi: **"sen shu obsidian strategiyasi boyicha harakatlan"**. Demak, bundan keyingi har bir o'zgarish — vault'da yoziladi, keyin kodga aylanadi.

## Bog'liq

- [[../00-INDEX]]
- [[../01-vizyon/loyiha-mohiyati]]
