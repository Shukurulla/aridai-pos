---
tags: [changelog, kod, frontend, web-admin]
date: 2026-05-29
type: implementation
---

# 2026-05-29 — Tizim admin paneli (restaurant_admin) qurildi

## Sabab

Foydalanuvchi: "restoran yaratish paneli (bu yerda asosan biz foydalanamiz — restoran
yaratish, tahrirlash, o'chirish). shundan boshla". Bu — AridaiPos jamoasi (system_admin)
ishlatadigan web panel. Backend tomoni (Task #10, #11) oldin tayyor edi; endi UI qurildi.

## Bajarilgan ish (global/restaurant_admin)

React + Vite SPA (JS/JSX, TypeScript'siz — Phase 1 uchun yengil tutildi).

| Fayl | Maqsad |
|---|---|
| `package.json` | react 18, react-dom, react-router-dom 6, vite 5 |
| `vite.config.js` | port 5173, proxy `/api` va `/uploads` → `localhost:4560` |
| `index.html` | root + main.jsx kirish nuqtasi |
| `src/main.jsx` | React root render |
| `src/index.css` | to'liq dark-theme dizayn tizimi (btn, input, table, modal, badge, ...) |
| `src/api.js` | fetch-client (Bearer token localStorage'dan), 401→logout event, xato kodlarini o'zbekchaga tarjima |
| `src/auth.jsx` | `AuthProvider` + `useAuth` (token+admin localStorage'da, 401 auto-logout) |
| `src/App.jsx` | router: `/login`, `/restaurants` (protected), `*`→redirect |
| `src/pages/Login.jsx` | system_admin login (POST /api/system/login) |
| `src/pages/Restaurants.jsx` | ro'yxat + qidiruv (debounce 350ms) + pagination + o'chirish |
| `src/components/RestaurantForm.jsx` | create/edit modal (brand, logo upload, currency, owner) |
| `public/favicon.svg` | brend ikonkasi |
| `.gitignore` | node_modules, dist, .env |

## Asosiy oqim

```
/login → POST /api/system/login {username,password} → token (localStorage)
   ↓
/restaurants → GET /api/system/restaurants?search=&page=&limit=20
   ├─ "+ Yangi restoran" → modal → POST (multipart: brand, currency, logo, owner JSON)
   ├─ "Tahrirlash" → modal → PUT (currency disabled — immutable; parol bo'sh = o'zgartirmaslik)
   └─ "O'chirish" → confirm → DELETE (soft delete)
```

### Muhim detallar
- **multipart/form-data** ishlatiladi (logo fayl yuklash uchun). `owner` — `JSON.stringify`
  qilingan string sifatida yuboriladi; backend `getOwnerData` uni parse qiladi.
- **currency immutable** — edit'da `<select disabled>`, FormData'ga ham qo'shilmaydi.
- **parol** — create'da majburiy, edit'da bo'sh qoldirilsa o'zgarmaydi (`owner.password`
  yuborilmaydi → backend `if (owner.password)` o'tkazib yuboradi).
- **logo preview** — tanlangan rasm darhol `URL.createObjectURL` bilan ko'rinadi.
- **401** → token tozalanadi, `auth:unauthorized` event → avtomatik login sahifaga.

## Tasdiqlash (real backend + MongoDB bilan)

✅ `npm install` — 65 paket, xatosiz
✅ `npm run build` — 39 modul transformed, xatosiz (175 kB js / 57 kB gzip)
✅ Login → token olindi
✅ **Create** (multipart, owner JSON): telefon E.164 ga (+7 700 123 4567 → +77001234567),
   KZT → timezone Asia/Almaty avto, features seeded (offline=on), logo `/uploads/...` ga saqlandi
✅ **Edit** (parolsiz): brand + owner yangilandi, isActive=false, currency o'zgarmadi (immutable)
✅ **Delete** (soft): muvaffaqiyat, ro'yxatdan yo'qoldi (isDeleted filtri ishlaydi)

## Ishga tushirish (foydalanuvchi uchun)

```bash
# 1-terminal: backend (agar ishlamayotgan bo'lsa)
cd global/backend && npm start          # port 4560, MongoDB kerak

# system admin (bir marta): admin / admin12345
node scripts/seed-system-admin.js

# 2-terminal: frontend
cd global/restaurant_admin && npm install && npm run dev   # http://localhost:5173
```

Brauzer: `http://localhost:5173` → login `admin` / `admin12345` → restoranlarni boshqarish.

## Qolgan (keyingi qadamlar)
- **Task #9**: operatsion routelar (category/food/table/discount/service/shift/order) hali
  yangi auth'ga moslanmagan — create'da `restaurantId` required xatosi beradi.
- Feature toggle sahifasi (`/restaurants/:id/features`) — PATCH endpoint tayyor, UI qolgan.
- Owner paneli (filial/menyu/xodim) — keyingi bosqich.

## Bog'liq
- [[../08-frontend/web-admin]] — panel spetsifikatsiyasi
- [[../08-frontend/umumiy-arxitektura]] — API client, auth patternlari
- [[2026-05-29-phase0-kod-boshlandi]] — backend fundament
- [[../01-vizyon/roadmap]] — Phase 1 (web-admin basic)
