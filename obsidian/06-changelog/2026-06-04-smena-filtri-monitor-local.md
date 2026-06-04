---
tags: [changelog, orders, smena, filter, admin, pos-monitor]
created: 2026-06-04
modul: global/backend · global/filial_admin · local/aridaipos_monitor
---

# Smena bo'yicha order filtri + POS monitor local-only tasdiq

> Muammo: web admin "Заказы" **barcha smenalar** orderlarini ko'rsatardi (18),
> POS monitor esa joriy smenani (14). Endi admin ham smena bo'yicha saralaydi.

## 1. Smena filtri
- **Backend** `GET /orders/all/:branchId?shift=` — `<shiftId>` | `active` |
  `all`(default). `active` → joriy aktiv smena order'lari; param yo'q → hammasi
  (orqaga moslik).
- **Web admin** (`filial_admin/Orders.jsx`): chips qatorida **smena tanlagich**
  (`<select>`): "Текущая смена" (default) · "Все смены" · har yopilgan smena.
  Tanlanганда qayta yuklanadi. `api.orders(branchId, shift)`.
- **Natija:** default "Текущая смена" → admin POS bilan bir xil (14) ko'radi;
  "Все смены" → hammasi (18); aniq smena → o'shaники.

## 2. POS monitor — global fallback YO'Q (tasdiq)
Foydalanuvchi so'rovi bo'yicha tekshirildi: **POS monitor FAQAT local serverga**
(`localhost:4561` yoki Settings LAN IP) ulanadi. Global/VPS'ga **to'g'ridan
ulanmaydi** (global sync — local-server vazifasi). Olib tashlanadigan fallback
yo'q edi. `api.ts` izohi tozalandi (eski "VPS"/"3011" eslatmalari → aniq
local-only).

## E2E (5/5 ✅)
BrendPlov Sayna filialida: param yo'q=18 · ?shift=all=18 · ?shift=active=**14**
(har order aktiv smenaники) · aniq smena API=DB=4.

## Bog'liq
- [[2026-06-04-web-panels-deploy]]
