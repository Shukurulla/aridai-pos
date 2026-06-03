---
tags: [changelog, kod, frontend, owner-panel]
date: 2026-05-29
type: implementation
---

# 2026-05-29 — Restoran egasi paneli (owner_admin) qurildi

## Sabab

Foydalanuvchi system admin panelda restoran yaratgandan keyin so'radi: "endi o'sha
restoran paneliga qanday kiraman". Restoran egasi (owner) o'z restoranini boshqaradigan
panel kerak edi. Tanlov: **alohida ilova** (system admin paneldan ajralgan) — foydalanuvchi
tasdiqladi (xavfsizlik: mijoz ichki paneldan xabardor bo'lmaydi).

## Bajarilgan ish (global/owner_admin)

React + Vite SPA, **port 5174** (system admin 5173'da). Yashil aksent (system = ko'k).

| Fayl | Maqsad |
|---|---|
| `package.json`, `vite.config.js` | port 5174, `strictPort:true`, proxy → 4560 |
| `src/api.js` | owner token client; login/getRestaurant/toggleFeature/branch CRUD/branchToken |
| `src/auth.jsx` | `AuthProvider` — owner token + restoran data, `refreshRestaurant()` |
| `src/features.js` | feature metadata (backend registry'ning UI ko'rinishi) |
| `src/App.jsx` | router — `/login` + protected layout (`/`, `/features`, `/branches`) |
| `src/components/Layout.jsx` | sidebar navigatsiya + restoran nomi + chiqish |
| `src/pages/Login.jsx` | owner login (telefon + parol) |
| `src/pages/Dashboard.jsx` | statistika (filial soni, faol funksiya, valyuta) + restoran ma'lumoti |
| `src/pages/Features.jsx` | feature toggle (switch, requires/excludes, cascade ogohlantirish) |
| `src/pages/Branches.jsx` | filial CRUD + POS branchToken modal (bir marta ko'rsatiladi) |
| `src/components/BranchForm.jsx` | filial yaratish/tahrirlash modali |

## Backend bog'liqligi (owner token bilan ishlaydigan)

| Funksiya | Endpoint |
|---|---|
| Login | `POST /api/restaurants/login` → `{data, ownerToken, refreshToken}` |
| Restoran | `GET /api/restaurants/:id` |
| Feature toggle | `PATCH /api/restaurants/:id/features/:key` |
| Filiallar | `GET /api/branches/all`, `POST /create`, `PUT/:id`, `DELETE/:id` |
| POS token | `POST /api/branches/:id/token` |

> [!warning] Xodimlar bo'limi — keyingi qadam (Task #15)
> `GET/PUT/DELETE /api/users/*` `authMiddleware` (type:"user") ishlatadi — owner token
> (type:"owner") rad etiladi. Owner xodimlarni boshqarishi uchun backend'ga owner-scoped
> endpoint qo'shilishi kerak. Xodim **yaratish** (`POST /api/users/register`) esa owner
> token bilan allaqachon ishlaydi.

## Tasdiqlash (real backend + MongoDB)

✅ `npm install` (65 paket) + `npm run build` (43 modul) — xatosiz
✅ Owner login (to'g'ridan-to'g'ri + vite proxy 5174 orqali)
✅ `GET /restaurants/:id` owner token bilan — features bilan qaytdi
✅ Feature toggle: **sklad** yoqildi; **possiz** yoqildi (offline talab qiladi, bajarildi)
✅ Bog'liqlik: **offline o'chirishga urinish → CASCADE xato** (possiz bog'liq) — UI ogohlantiradi
✅ Filial yaratildi (prefiks "mkz"→"MKZ"), ro'yxat, **POS branchToken** (bir marta) ishladi
✅ Port izolyatsiyasi: system=5173, owner=5174 (`strictPort` — race oldini oladi)

## Ishga tushirish

```bash
cd global/backend && npm start                    # :4560
cd global/restaurant_admin && npm run dev          # :5173  (AridaiPos jamoasi)
cd global/owner_admin && npm run dev               # :5174  (restoran egasi)
```

Test owner (system admin panelda yaratilgan): telefon `+998901112233`, parol `owner12345`.

## Qolgan
- **Task #15**: owner xodimlar bo'limi + backend owner-scoped user endpoint
- **Task #9**: operatsion routelar (menyu/stol/order) yangi auth'ga moslash
- Owner restoran ma'lumotini tahrirlash (brand/logo) — hozir read-only (system admin boshqaradi)

## Bog'liq
- [[2026-05-29-restoran-admin-panel]] — system admin paneli
- [[../08-frontend/web-admin]] — panel spetsifikatsiyasi (owner ko'rinishi)
- [[../03-tool-strategiyasi/feature-toggle-tizimi]] — toggle mantiqi
- [[../02-arxitektura/xavfsizlik/auth-strategiyasi]] — owner/branch token
