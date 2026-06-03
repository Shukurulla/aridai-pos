---
sana: 2026-06-02
mavzu: aridai-pos-app — Flutter poydevor (login + role routing)
status: bajarildi (poydevor)
---

# aridai-pos-app — Flutter mobil app poydevori

## Kontekst
Obsidian o'qildi (`08-frontend/mobile-flutter.md` + RBAC + analitika). Qaror: **bitta Flutter app,
role-based UI, online→GLOBAL VPS**. Dizayn manbai: kepket-kz `waiter_flutter` (1:1 uslub).
restoran-admin-app — KERAK EMAS (foydalanuvchi); hammasi waiter uslubida + owner/admin logikasi.

## Bajarilgan (poydevor)
`/Users/shukurulla/Desktop/AridaiPos_v2/aridai-pos-app` (Flutter, com.aridai / aridai_pos_app):
- **Dizayn tizimi** `utils/app_colors.dart` — waiter_flutter'dan 1:1 (bg #FAFAF7, qizil #DC2626,
  ink #0A0A0A, line #ECE7DC, status ranglar). Shrift: IBM Plex Sans (google_fonts), Material3.
- **api_service.dart** (dio singleton) — `baseUrl=http://localhost:4560/api` (GLOBAL; real qurilmada
  LAN IP). `login(phone,password)` → bizning `/users/login` ({status,data,token}) shakliga mos;
  token+user shared_preferences; Bearer interceptor; xato kodlari tarjimasi.
- **models/user.dart** — branch/restaurantId ham String id, ham populate Map'ni o'qiydi.
- **login_screen.dart** — kepket uslubi (qizil "A", KZ+7/UZ+998 selektor, telefon+parol, ВОЙТИ,
  loading + inline xato).
- **role_router.dart** + `screens/home/{waiter,cook,cashier,admin,owner}_home.dart` — STUB ("Скоро").
- **main.dart** — `loadSession()` → AuthWrapper (token bo'lsa RoleRouter, yo'q bo'lsa Login).
- Texnologiya: dio, provider, socket_io_client, google_fonts, shared_preferences, intl, flutter_svg,
  cached_network_image. (firebase/FCM — keyingi bosqich.)
- ✅ `flutter analyze`: **No issues found**.

## Keyingi bosqichlar (role ekranlari — waiter uslubida)
1. **Waiter** (waiter_flutter'dan 1:1): orders/menu/stol/create-order/order-detail/profile/salary.
2. **Cook**: biriktirilgan taomlar queue + status (kelgan/tayyorlanmoqda/tayyor) + (keyin FCM).
3. **Filial admin** (mobil, ixcham): menyu/kategoriya/stol/xodim(maosh,cook-taom)/order/otchot/smena.
4. **Owner**: filiallar + tushum statistikasi (kun/hafta/oy/yil) + filiallar taqqoslash.

## Bog'liq
- 02-arxitektura/aridai-pos-app-reja.md (to'liq reja)
- Backend: xodim maosh + cook taom (06-changelog/2026-06-02-xodim-maosh-cook-taom.md)
