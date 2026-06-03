---
tags: [changelog, kod, frontend, lokalizatsiya, xodimlar]
date: 2026-05-29
type: implementation
---

# 2026-05-29 — Rus tili + filial detal sahifasi + xodimlar boshqaruvi

## Sabab

Foydalanuvchi ikkita talab qo'ydi:
1. **Tizim to'liq rus tilida** bo'lishi kerak (ikkala panel).
2. Filial yaratilgandan keyin unga **xodim qo'shish** (admin/cook/cashier/waiter), va
   filiallar oddiy jadval bo'lib qolmasligi — owner filial haqida **to'liq ma'lumotni**
   ko'ra olishi kerak.

Qaror: til — **hardcode rus** (i18n emas), qamrov — **ikkala panel**.

## Bajarilgan ish

### 1. Backend — owner-scoped xodim endpointlari (`user.routes.js`)
Owner token (`restoranMiddleware`) bilan ishlaydigan yangi endpointlar:
| Endpoint | Vazifa |
|---|---|
| `GET /api/users/owner/branch/:branchId` | filial xodimlari ro'yxati (tenant tekshiruv: `assertBranchInRestaurant`) |
| `PUT /api/users/owner/:id` | xodim tahrirlash (ism/role/isActive/parol/rasm; parol/role o'zgarsa tokenVersion++) |
| `DELETE /api/users/owner/:id` | soft delete + tokenVersion++ |

> Sabab: eski `GET/PUT/DELETE /api/users/*` `authMiddleware` (type:"user") kutadi —
> owner token (type:"owner") rad etilardi. Xodim **yaratish** (`POST /register`) esa
> avvaldan owner token bilan ishlardi.

### 2. owner_admin — filial detal + xodimlar (rus tilida)
- **Yangi sahifa** `BranchDetail.jsx` (`/branches/:id`): filial to'liq ma'lumoti
  (manzil, chek prefiksi, POS server IP, rejim, yaratilgan sana, ruxsat IP) + **xodimlar
  jadvali** (ism, telefon, rol badge, holat, tahrir/o'chirish) + "Xodim qo'shish".
- **Yangi komponentlar**: `StaffForm.jsx` (xodim qo'shish/tahrir — rol select, parol,
  isActive), `TokenModal.jsx` (POS token bir marta ko'rsatish — Branches'dan ko'chirildi).
- `constants.js` — BRANCH_ROLES (Администратор/Кассир/Официант/Повар), MODE_LABEL.
- `Branches.jsx` — endi filial nomi bosiladigan (→ detal), "Подробнее" tugmasi.
- Filial ma'lumotini owner `listBranches`'dan oladi (chunki `GET /branches/:id` user-token
  kutadi; qo'shimcha backend kerak bo'lmasligi uchun).

### 3. Rus tili (hardcode) — ikkala panel
- **owner_admin**: api.js xatolar, features.js (funksiya nomlari), Login, Layout (navigatsiya),
  Dashboard, Features, Branches, BranchForm, StaffForm, BranchDetail, TokenModal, index.html.
- **restaurant_admin**: api.js xatolar, Login, Restaurants (jadval/pagination/qidiruv),
  RestaurantForm, index.html (`lang="ru"`, title).
- Sana formati `ru-RU` locale.

## Tasdiqlash (real backend + MongoDB)

✅ Backend: xodim qo'shish (branch_admin, cook) → ro'yxat → tahrir → o'chirish (soft) — ishladi
✅ Tenant izolyatsiya: owner faqat o'z restorani xodimlarini ko'radi/boshqaradi
✅ owner_admin build — 47 modul, restaurant_admin build — toza
✅ Vite proxy 5174 orqali: owner login → filiallar → **xodimlar ro'yxati** (yangi endpoint) ishladi
✅ Port izolyatsiyasi: 5173 (system), 5174 (owner) — `strictPort`

## Ishga tushirish
```bash
cd global/backend && npm start                    # :4560
cd global/restaurant_admin && npm run dev          # :5173 (rus)
cd global/owner_admin && npm run dev               # :5174 (rus)
```
Test owner: `+998901112233` / `owner12345` → filial "Markaziy filial" → xodim "Иван Админов".

## Qolgan
- **Task #9**: operatsion routelar (menyu/stol/order) — POS uchun
- Owner xodimga rasm (image) yuklash — StaffForm tayyor, hozir matn maydonlar
- Xodimlarni filiallar bo'yicha umumiy ko'rish (hozir filial detal ichida)

## Bog'liq
- [[2026-05-29-owner-panel]] — owner panel yadrosi
- [[2026-05-29-restoran-admin-panel]] — system admin paneli
- [[../02-arxitektura/lokalizatsiya]] — til strategiyasi
- [[../02-arxitektura/xavfsizlik/role-based-access]] — rollar (branch_admin/cashier/waiter/cook)
