---
tags: [frontend, web-admin]
created: 2026-05-29
---

# Web admin panel (super_admin)

## Maqsadi

Restoran egasi va filial admini uchun web panel. Tizim admini uchun ham (system_admin). Sozlash, boshqarish, hisobot.

## Texnologiya

- **React + Vite** (yoki Next.js agar SSR kerak bo'lsa — hozircha SPA yetadi)
- TypeScript
- React Query (server state) + Zustand (UI)
- UI kit: shadcn/ui yoki Ant Design (admin panel uchun boy komponentlar)
- Charts: Recharts (hisobotlar)
- Global VPS REST + socket

## Foydalanuvchilar va ko'rinishlar

| Role | Ko'radi |
|---|---|
| `system_admin` | Barcha restoranlar, yangi restoran yaratish, global monitoring |
| `owner` | O'z restorani, filiallar, feature toggle, hisobotlar |
| `branch_admin` | O'z filiali, menyu, xodimlar, smenalar |

## Asosiy sahifalar

```
/login
/dashboard                    # umumiy ko'rsatkichlar, filiallar holati
/restaurants                  # (system_admin) restoran ro'yxati
/restaurants/:id/settings     # restoran sozlamalari
/restaurants/:id/features     # feature toggle boshqaruv ⭐
/branches                     # filiallar
/branches/:id                 # filial detali, currentMode, sync holati
/branches/:id/staff           # xodimlar (CRUD)
/menu/categories              # kategoriyalar
/menu/foods                   # taomlar (CRUD, rasm upload)
/tables                       # stollar, QR generatsiya
/shifts                       # smenalar tarixi, hisobot
/orders                       # orderlar (filter, qidiruv, eski data)
/reports                      # hisobotlar ([[../02-arxitektura/hisobotlar-analitika]])
/sync                         # sync monitoring ([[../02-arxitektura/sinxronizatsiya/sync-monitoring]])
/audit                        # audit log ([[../02-arxitektura/xavfsizlik/audit-log]])
```

## Feature toggle sahifasi (markaziy)

```
/restaurants/:id/features
┌────────────────────────────────────────────┐
│ Funksiyalar                                  │
├────────────────────────────────────────────┤
│ ✅ Offline rejim          [ON]  [sozlash]   │
│ ⬜ Possiz (cook+waiter)   [OFF] [sozlash]   │
│ ✅ Sklad                  [ON]  [sozlash]   │
│ ⬜ Keldi-ketti            [OFF] [sozlash]   │
│ ⬜ QR Order               [OFF] [sozlash]   │
│ ⬜ QR Pay (Kaspi)         [OFF] [sozlash]   │
│ ✅ Keshbek                [ON]  [sozlash]   │
└────────────────────────────────────────────┘
```

- Toggle bosilganda — `PATCH /restaurants/:id/features/:key`
- `requires`/`excludes` validatsiya ([[../03-tool-strategiyasi/modullar-orasidagi-bogliqlik]])
- Cascade ogohlantirish ("X o'chsa Y ham o'chadi")
- `config` sozlash modali (har tool uchun)

Bu sahifa **registry'dan avtomatik generatsiya** qilinadi — yangi tool qo'shilsa, bu yerda avtomatik chiqadi.

## Real-time elementlar

- Dashboard: filiallar holati (online/offline/syncing) — socket
- Sync monitoring — real-time outbox, latency
- Audit — critical event'lar live feed

## Phase bo'yicha

- **Phase 1:** basic — restoran/filial/user/menu/table setup, oddiy hisobot
- **Phase 2:** + sync monitoring sahifasi
- **Phase 3:** + feature toggle sahifa to'liq, har tool config UI
- **Phase 4:** + advanced analytics, audit dashboard

## Xavfsizlik

- JWT (owner/system_admin token)
- RBAC — sahifalar role bo'yicha ([[../02-arxitektura/xavfsizlik/role-based-access]])
- system_admin sahifalar owner'ga ko'rinmaydi

## Bog'liq

- [[_MOC]]
- [[umumiy-arxitektura]]
- [[../03-tool-strategiyasi/feature-toggle-tizimi]]
- [[../02-arxitektura/sinxronizatsiya/sync-monitoring]]
