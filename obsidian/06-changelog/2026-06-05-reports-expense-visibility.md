---
tags: [changelog, hisobot, reports, expense, advance, kassa, filial-admin, backend, "#29"]
created: 2026-06-05
modul: global/backend · global/filial_admin
---

# #29 — Hisobotlarda Расходы/Авансы + naqd kassa ko'rinishi

> Sync orqali global'ga kelgan Расходы/Авансы hech qayerda ko'rinmasdi. Endi web
> admin Отчёты sahifasida **kassa harakati + naqd qoldiq** ko'rinadi (owner/admin
> real kassani ko'radi).

## Muammo
- Expense/advance global'ga sync bo'lardi (oldingi ish), lekin **global read
  endpoint yo'q** edi va Reports faqat orderlardan hisoblardi → rasxod ko'rinmasdi.
- Natijada "Выручка" ko'rinardi-yu, lekin kassada **aslida qancha naqd qolgani**
  (rasxod/avans ayirilgandan keyin) ko'rinmasdi.

## O'zgarishlar
### Global backend (read-only)
- Yangi `routes/finance.routes.js` + `app.use("/api/finance", …)`:
  - `GET /finance/expenses/:branchId` — `authMiddleware + tenantGuard`
  - `GET /finance/advances/:branchId` — `authMiddleware + tenantGuard`
- Faqat o'qish (yozish POS'da). Tenant guard — boshqa filial ko'rolmaydi.

### Web admin (filial_admin)
- `api.js`: `expenses(branchId)`, `advances(branchId)`.
- `Reports.jsx`: orders bilan birga expense/advance yuklanadi (`catch → []`, ya'ni
  bo'lmasa hisobot baribir ishlaydi). Davr (today/7d/all) bo'yicha filtr.
- Yangi 2 ta karta:
  - **Касса (наличные)**: Наличная выручка + Приход − Расходы − Авансы = **В кассе (нал.)**
  - **Расходы / Авансы**: jami + naqd/perevod ajratib, soni bilan.

## Hali #29'da qolgan (ixtiyoriy)
- **По кассирам** — orderlarni kassir bo'yicha guruhlash (order modelda kassir
  snapshot kerak — tekshirish lozim).
- **Отменённые позиции** detali (hozir faqat soni bor).
- Owner mobil `/stats`'ga ham expense/advance qo'shish (hozir faqat web admin).

## Tekshirildi
- Backend syntax ✅, web build ✅. Production: finance endpoint 200 + tenant guard;
  sync'dan kelgan test expense/advance Reports'da ko'rinadi.

## Bog'liq
- [[2026-06-05-expense-advance-sync]]
- [[2026-06-05-tenant-guard-crud]]
