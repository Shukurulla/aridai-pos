---
tags: [moc, toollar]
created: 2026-05-28
---

# Toollar MOC (Map of Content)

Barcha mavjud va rejalashtirilgan tool'lar shu yerda ro'yxatga olinadi.

## Status legend

- ✅ Dizayn tugagan, kod yozilgan
- 🚧 Dizayn tugagan, kod yozilmoqda
- 📝 Dizayn yozilgan
- 💭 G'oya, hali dizayn yo'q

## Mavjud toollar

| # | Tool | Status | Default | requires | Hujjat |
|---|---|---|---|---|---|
| 1 | Online/Offline rejim | 📝 | ON | core | [[online-offline-rejim]] |
| 2 | Cook+Waiter possiz rejim | 📝 | OFF | core, offline | [[cook-waiter-possiz-rejim]] |
| 3 | Sklad | 📝 | OFF | core | [[sklad]] |
| 4 | Keldi-ketti (davomat+maosh) | 📝 | OFF | core | [[keldi-ketti]] |
| 5 | QR Order | 📝 | OFF | core, table | [[qr-order]] |
| 6 | QR Pay (Kaspi) | 📝 | OFF | core, payment | [[qr-pay-kaspi]] |
| 7 | Keshbek | 📝 | OFF | core, payment | [[keshbek-tizimi]] |

## Kelajak g'oyalari (hali dizaynsiz)

- 💭 **Seyf (cash safe)** — foydalanuvchi keyinroq tushuntiradi (2026-05-29: mavzu keyinga qoldirildi). Toqtalganda strategiya bo'yicha dizayn qilinadi
- 💭 **Taom variantlari / modifiers** (o'lcham, qo'shimcha, olib tashlash) — qaror 2026-05-29: keyinroq toggle sifatida, schema room
- 💭 Joy bron qilish (reservation)
- 💭 Yetkazib berish (delivery)
- 💭 Kitchen Display System (KDS — TV'da buyurtmalar)
- 💭 Loyalty programma (mijoz darajalari, ballar)
- 💭 Promo aksiyalar (happy hour, second free)
- 💭 Hisobot va analitika (boshqacha — biroz murakkab)
- 💭 Yetkazib beruvchi integratsiyasi (Yandex Eats, Wolt)
- 💭 SMS marketing
- 💭 Telegram bot — buyurtma berish
- 💭 Tax invoice / KKM fiskal ([[../07-nozik-nuqtalar/fiskal-soliq]])
- 💭 Inventaryzatsiya (stock take)
- 💭 Recipe management (BOM, semi-finished — [[../07-nozik-nuqtalar/tool-edge-caselar]])
- 💭 Smart pricing (yuklamaga qarab narx)

> [!note] Rad etilgan g'oyalar (qaror 2026-05-29)
> - **Tipping (chayyot pul):** YO'Q — faqat service charge ([[../07-nozik-nuqtalar/pul-valyuta-yaxlitlash]])
> - **Multi-currency (bir restoran ko'p valyuta):** YO'Q — har restoran bitta valyuta

Har qaysisi alohida tool sifatida [[../99-templates/yangi-tool-template|shablon]] bo'yicha yoziladi.

## Bog'liqlik xaritasi

[[../03-tool-strategiyasi/modullar-orasidagi-bogliqlik]] da to'liq grafni ko'ring.

## Bog'liq

- [[../03-tool-strategiyasi/feature-toggle-tizimi]]
- [[../03-tool-strategiyasi/tool-qoshish-shabloni]]
