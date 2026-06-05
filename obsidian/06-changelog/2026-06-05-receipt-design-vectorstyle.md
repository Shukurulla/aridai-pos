---
tags: [changelog, printer, chek, receipt, dizayn, local-server]
created: 2026-06-05
modul: local/aridaipos_server
---

# Chek dizayni — VECTOR STYLE ko'rinishi (haqiqiy layout)

> Foydalanuvchi: (1) `<hr>` dashed va sodda ko'rinish o'rniga **haqiqiy
> tuzilgan** chek kerak; (2) to'lov cheki **VECTOR STYLE** namunasidagi
> ko'rinishda, lekin mantiqqa to'g'ri kelmaydigan maydonlarsiz.

## Yangi — `buildReceiptHtml(data)` (print.js)
VECTOR STYLE namunasiga mos to'lov cheki:
- **Brand** (markazda, katta bold) + filial.
- Nuqtali ajratgich (`border-top:2px dotted`).
- **Meta**: Продажа #, Дата, Продавец, Клиент?, Контакты? (bold label).
- **Mahsulotlar**: `N. Nom / Kategoriya`, `qty шт x narx ····· jami сум`,
  `Скидка X% ····· chegirmali сум` (chegirma bo'lsa).
- **Yakun**: Подытог, Скидка?, Скидка %?, Обслуживание?, **ИТОГО** (katta),
  to'lov turi (italic).
- **Footer**: rahmat matni.
- **Leader nuqtalar** (`label ····· value`) — `flexbox` + `border-bottom:dotted`
  (toza, ASCII "-----" emas). Namunadagidek.

## "Logikasi to'g'ri kelmaydigan" maydonlar — CHIQARILMAYDI
Рабочее время, Баланс клиента, Instagram, barcode — data bo'lmasa ko'rsatilmaydi
(faqat mavjud maydonlar). Optional maydonlar (Клиент, Скидка, Обслуживание) —
qiymat bo'lsa chiqadi.

## Test chek
`buildTestReceiptHtml` → namuna buyurtma (Плов 50% chegirma + Кола) shu dizaynda.
**Tekshirildi**: puppeteer screenshot → VECTOR STYLE namunasiga mos (brand,
meta, mahsulot+chegirma, yakun, nuqtali leader'lar).

## Keyingi (Phase 2)
- Real to'lov chekida (buyurtma to'langanda) avtomatik chop etish — shu
  `buildReceiptHtml` order ma'lumoti bilan chaqiriladi.

## Versiya
- 0.3.5 → **0.3.6**. release-server.yml → EXE.

## Bog'liq
- [[2026-06-05-printer-puppeteer-fix]]
