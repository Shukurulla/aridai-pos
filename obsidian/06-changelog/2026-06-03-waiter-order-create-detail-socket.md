---
sana: 2026-06-03
mavzu: Waiter — buyurtma yaratish + order detal + real-time socket
status: bajarildi
---

# Waiter app: + Заказ, order detal, real-time

Foydalanuvchi punktlari (1,2) + real-time. Backend (`/orders/place` + socket) avval tayyor edi.

## Flutter (aridai-pos-app)
- `services/socket_service.dart` — singleton; `ApiService.baseUrl`'dan host (`/api` olib tashlanadi
  → `http://localhost:4560`), ulanib `join {branchId}`, `orders:changed` → `Stream<void>`. Offline-bardosh.
- `screens/waiter/create_order_screen.dart` — **Зал/Собой** toggle, stol tanlash (bo'sh stollar grid,
  band'lar disabled), kategoriya chiplari + taomlar, savatga qo'shish (qty stepper), pastda savat bar
  ("N · X ₸" + Оформить) → `placeOrder` → "Заказ создан". Smena yo'q bo'lsa xato ko'rsatadi.
- `screens/waiter/order_detail_screen.dart` — chek/тип/ofitsiant/vaqt/status + item lines +
  Подытог/Обслуживание/Итого. Pull-to-refresh (`GET /orders/:id`).
- `api_service`: `placeOrder(...)`, `getOrder(id)`.
- Navigatsiya: WaiterHome **"+ Новый заказ"** FAB; tables_tab bo'sh stol → create, band stol → detal;
  orders_tab karta → detal.
- Real-time: WaiterHome socket ulaydi; orders_tab + tables_tab `onOrdersChanged` → reload (10s timer zaxira).
- ✅ `flutter analyze`: No issues found.

## To'liq oqim (avval backend E2E sinalgan)
Waiter `/orders/place` → global → **socket `orders:changed`** (mobil) + **local pull ~2s** (POS monitor)
+ **cook navbati**. Endi frontend ham shu endpointga ulangan.

## Hozircha yo'q (keyingi)
- Order detal'da to'lov / + Блюдо (mavjud orderga) / cook actions.
- Waiter UI'ni waiter_flutter'ga yanada yaqinlashtirish (davomiy polish).
- Push (FCM) · possiz/offline.

## Git
Bu o'zgarishlar hali commit/push qilinmagan (so'rasangiz — push qilaman → release-app + deploy-backend
workflowlari ishlaydi).
