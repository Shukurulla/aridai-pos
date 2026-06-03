---
mavzu: aridai-pos-app — mobil Flutter app (4 rol) arxitektura rejasi
status: reja (boshlanmoqda)
sana: 2026-06-02
---

# aridai-pos-app — mobil app (Flutter, 4 rol)

Yagona Flutter app, login rolega qarab tegishli interfeysga yo'naltiradi.
Dizayn manbai: `/Users/shukurulla/Desktop/projects/kepket-kz`.

## Rollar va dizayn manbalari
| Rol | Vazifa | Dizayn manbai | Backend |
|---|---|---|---|
| **owner** | filiallarni kuzatish/CRUD, tushum statistikasi (kun/hafta/oy/yil) | `restoran-admin-app` (moslashtirilgan) | GLOBAL (barcha filiallar) |
| **filial admin** | menyu/kategoriya/stol/xodim/order/otchot/smena (saytdagi kabi, ixcham mobil) | yangi (kepket uslubida) | GLOBAL (config/staff) |
| **waiter** | order yaratish/yopish, stollar, menyu, maosh | `waiter_flutter` (1:1) | LOCAL (filial LAN) |
| **cook** | biriktirilgan taomlar sotuvi + notification | yangi (waiter uslubida) | LOCAL (filial) |

## Backend ulanish (obsidian/08-frontend/mobile-flutter.md bo'yicha — TASDIQ)
- **Online (asosiy)**: BARCHA rollar → **GLOBAL VPS** (REST + socket). Dev: `http://localhost:4560`,
  deploy: cloud URL. App'da sozlanadi (telefon "localhost" emas — dev'da LAN IP).
- **Possiz (svet yo'q)**: lokal Wi-Fi/local backend (keyingi bosqich).
- Local server (4561) — POS terminal (offline kassir) uchun; mobil app online→global.

## Dizayn tizimi (waiter_flutter'dan 1:1)
- Fon `#FAFAF7` (iliq oq), surface `#FFFFFF`, surface2 `#F4F1EA`, ink `#0A0A0A`, mute `#7A7468`,
  line `#ECE7DC`, qizil `#DC2626` (redInk `#B91C1C`, redSoft `#FBEDED`).
- Shrift: **IBM Plex Sans** (google_fonts). Material3, light.
- Status: ok `#1F6F4A`, warn `#B45309`, info `#1F3F6F`.

## Texnologiya (waiter_flutter'dan)
provider (state) · dio (HTTP) · socket_io_client (real-time) · shared_preferences · google_fonts
(IBM Plex Sans) · intl. (firebase_messaging/FCM — keyingi bosqich, hozir notifications stub.)

## Xodim maoshi + cook taomlari (DATA MODEL — BAJARILDI)
`users.model.js`:
- `salary: { mode: none|daily|monthly|percent, amount }` — waiter: kunlik summa YOKI order %.
- `assignedCategories[]`, `assignedFoods[]` — cook biriktirilgan taomlar (bo'sh=hammasi).
Backend endpointlar (BAJARILDI):
- `POST /api/users/staff` (branch_admin/owner) — admin O'Z filialiga xodim qo'shadi (+maosh/taomlar).
- `POST /api/users/register` (owner) + `PUT /api/users/:id` (admin/owner) — extras qabul qiladi.

## Bosqichlar (reja)
1. **(bajarildi)** Backend poydevor: maosh + cook taom data model + staff endpointlar.
2. **Flutter skeleton**: `aridai-pos-app` (Flutter project), role-based login → router.
   Asos: `waiter_flutter` lib (theme/services/widgets) ko'chiriladi, baseUrl bizникi.
3. **Waiter** (1:1) → LOCAL backendga moslash (kepket-format order/menu/table allaqachon bor).
4. **Cook** → biriktirilgan taomlar bo'yicha kitchen queue + FCM notification.
5. **Filial admin** (mobil, ixcham) → GLOBAL (menyu/staff/order/otchot/smena).
6. **Owner** → GLOBAL (filiallar, tushum statistikasi kun/hafta/oy/yil).

## Ochiq savollar (foydalanuvchi tasdiqlasin)
- Backend ulanish modeli (yuqoridagi taklif) to'g'rimi?
- Birinchi qaysi rol quriladi? (tavsiya: **waiter** — 1:1 manba bor, eng tez natija.)
- Bitta app (role-routing) — tasdiq? (yoki har rol alohida app?)
