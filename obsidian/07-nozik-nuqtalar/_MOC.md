---
tags: [moc, nozik-nuqtalar, muhim]
created: 2026-05-29
---

# Nozik nuqtalar MOC (Edge cases & gotchas)

> [!important] Bu — loyihaning "gotchas injili"
> Eng oson unutiladigan, eng katta zarar keltiradigan nozik nuqtalar. Har biri aniq qaror bilan hujjatlangan. Kod yozishdan oldin shu yerni o'qing.

## Biznes/huquqiy qarorlar (foydalanuvchi tasdiqlagan — 2026-05-29)

| Mavzu | Qaror | Hujjat |
|---|---|---|
| Valyuta | Har restoran bitta valyuta (so'm yoki tenge) | [[pul-valyuta-yaxlitlash]] |
| Fiskal/KKM | Hozircha yo'q, schema'da joy qoldiriladi | [[fiskal-soliq]] |
| Chayyot pul (tip) | YO'Q — faqat service charge | [[pul-valyuta-yaxlitlash#Chayyot pul (tip) — YO'Q qarori]] |
| Chek raqami | filial + sana + ketma-ket | [[chek-raqamlash]] |

## Texnik nozik nuqtalar

### Vaqt va pul
- [[vaqt-va-soat|Vaqt va soat]] — NTP, UTC, hourly tarif, timezone, biznes-kun
- [[pul-valyuta-yaxlitlash|Pul, valyuta, yaxlitlash]] — integer, per-restaurant valyuta, rounding
- [[chek-raqamlash|Chek raqamlash]] — offline-safe ketma-ket raqam

### Ma'lumot yaxlitligi
- [[concurrency-race|Concurrency va race]] — atomic ops, optimistic lock, double-pay
- [[id-generatsiya|ID generatsiya]] — clientId, ObjectId, lokal vs global
- [[ochirish-cascade|O'chirish cascade]] — category/branch/user/restaurant
- [[data-osishi-arxivlash|Data o'sishi va arxivlash]] — lokal Mongo, outbox, backup-restore

### To'lov va chegirma (2-qatlam)
- [[naqd-tolov-qaytim|Naqd to'lov, qaytim, yaxlitlash]] — kupyura tugmalari, qaytim, cash rounding
- [[chegirma-service-qollanishi|Chegirma va service qo'llanishi]] — predefined toggle, stacking, service waive

### Order va operatsion (2-qatlam)
- [[order-operatsion-edge|Order/operatsion edge]] — void vs cancel, izoh, handover, PIN, reprint
- [[stol-birlashtirish-bolish|Stol birlashtirish/bo'lish]] — merge, split
- [[tool-edge-caselar|Tool-specific edge'lar]] — sklad/keldi-ketti/qr-order/qr-pay nozikliklari

### Operatsion oqim va menyu (3-qatlam)
- [[stop-list-limit|Stop-list va kunlik limit]] ⭐ — manual + limit-based avto (somsa 1000 ta)
- [[pre-bill-chek-print|Pre-bill, final chek, oshxona cheki]] — hisob → tolov → chek
- [[menyu-export-import|Menyu export/import]] — filiallar orasida JSON nusxa
- [[versiya-empty-state|Versiya, token expiry, empty state]] — texnik nozikliklar

### Tashqi
- [[fiskal-soliq|Fiskal va soliq]] — KKM (kelajak), QQS, schema room
- [[telefon-normalizatsiya|Telefon normalizatsiya]] — +998/+7, keshbek matching
- [[hardware-nozikliklari|Hardware nozikliklari]] — printer, cash drawer, ko'p printer
- [[split-bill-order-tahrir|Split bill va order tahrir]] — bo'lib tolash, tolovdan keyin

### Xavfsizlik qo'shimcha
- [[xavfsizlik-qoshimcha|Xavfsizlik qo'shimcha]] — o'g'irlangan POS, image upload, injection

## Tamoyil

> Har nozik nuqta uchun: **(1) Muammo → (2) Qaror → (3) Implementatsiya → (4) Test**. Qaror "default" bo'lsa, "revisable" deb belgilanadi.

## Bog'liq

- [[../00-INDEX]]
- [[../05-data-model/_MOC]]
- [[../02-arxitektura/conflict-resolution]]
