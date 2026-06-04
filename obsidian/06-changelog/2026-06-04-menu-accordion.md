---
tags: [changelog, mobile, waiter, menu, accordion, ui]
created: 2026-06-04
modul: aridai-pos-app · waiter
---

# Menu accordion UI — waiter_flutter bilan 1:1

> Oxirgi vizual farq: waiter menyusi gorizontal chip + flat ro'yxat edi.
> Reference (`kepket-kz/waiter_flutter/menu_screen.dart`) — **accordion**:
> kategoriya folder kartalari, bitta ochiq (yig'-yoz), tepada qidiruv.

## Nima qilindi

Yangi reusable **`MenuAccordion`** widget (`screens/waiter/menu_accordion.dart`):
- **Qidiruv paneli** (debounce 250ms) — nom bo'yicha filtr. Qidiruvda **flat
  natija** (accordion emas) + "Результатов: N".
- **Accordion**: har kategoriya — folder kartasi (folder ikona + nom +
  "{N} блюд" + aylanadigan strelka). **Faqat bitta** ochiq (`_expandedId`).
  Ochilganda ichida taomlar ro'yxati (yuqori chegara + bg).
- Ochiq folder ikona `folder_open` + ink fon; yopiq `folder_outlined`.
- Kategoriyasiz taomlar uchun "Без категории" bo'limi.
- `rowBuilder(Food)` — har ekran o'z qatorini beradi (DRY).

## Ikkala ekran ham accordion'ga o'tdi

1. **MenuTab** (faqat ko'rish browser) — `_categoryBar` + flat list o'rniga
   `MenuAccordion` (read-only `_FoodRow`).
2. **CreateOrderScreen** (order berish) — `_categoryBar` + flat list o'rniga
   `MenuAccordion` (stepper'li `_FoodRow`). Savatcha/submit logikasi
   **o'zgarmadi** — faqat menyu ko'rinishi accordion bo'ldi.

## Yangi/o'zgargan fayllar
- `screens/waiter/menu_accordion.dart` — YANGI (reusable accordion + search)
- `screens/waiter/menu_tab.dart` — accordion'ga o'tdi (chip bar olib tashlandi)
- `screens/waiter/create_order_screen.dart` — accordion'ga o'tdi (cart o'zgarmadi)

## Choziluvchanlik
Sof UI yaxshilanishi — toggle shart emas. Qidiruv hozircha oddiy
`contains` (kelajakda transliteratsiya — latin/kirill — qo'shilishi mumkin).

## Bog'liq
- [[aridai-pos-app-reja]]
- [[2026-06-04-cashier-cook-chuqurlik]] (oldingi qadam)
