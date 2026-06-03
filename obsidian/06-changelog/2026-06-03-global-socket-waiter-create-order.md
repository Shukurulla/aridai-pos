---
sana: 2026-06-03
mavzu: Global backend qoldiqlari — real-time socket + waiter buyurtma yaratish
status: bajarildi (backend)
---

# Global backend: real-time socket.io + waiter create-order + propagatsiya

## 1. Real-time (socket.io) — global backendda YO'Q edi, qo'shildi
- `socket.io` o'rnatildi; `index.js` — HTTP server + Socket server; `utils/socket.js`:
  `setIo` (connection → klient `join {branchId}` → `branch:<id>` xonasi) + `emitToBranch(branchId, event, data)`.
- Order o'zgarganda emit qilinadi (**"orders:changed"**): create, pay, cancel, item-cancel,
  quantity, cooking. Mobil klientlar (waiter/cook/cashier) tinglab jonli yangilanadi.

## 2. Waiter buyurtma yaratish — `POST /api/orders/place`
- Sodda format (mobil): `{ tableId?, items:[{foodId,quantity,note?}], orderType, note?, guestCount? }`.
- Backend: taom snapshot (foodName/foodPrice, soatlik bo'lsa hourly), stol (dineIn shart), service
  (filial sozlamasidan), chek raqami (genReceipt), totals (recalcOrder), shift (aktiv). source=waiter_mobile.
- Yaratilgach `emitToBranch("orders:changed")`.

## 3. Propagatsiya (E2E sinov ✅)
Waiter order yaratdi (global) →
- **socket "orders:changed" o'sha zahoti** (mobil) ✅
- **LOCAL DB / POS monitor** ~3.5s (orders-since pull → synced) ✅
- **COOK navbati** (global kitchen) — yangi item (Плов×2) ✅
Chek MKZ-20260603-0001, стол 1, 3960₸.

## Qolgan (waiter APP — frontend, keyingi tur)
- Mobil app socketga ulanib "orders:changed" tinglashi (10s polling o'rniga instant).
- Waiter app: **+ Заказ** oqimi (stol → taom → /orders/place) + **order tap → detal**.
- Waiter UI'ni waiter_flutter'ga yaqinlashtirish (foydalanuvchi: "umuman bir xil emas").

## Hali to'ldirilmagan global qoldiqlar
- FCM push (notifications stub) · possiz/offline (mobil) · expenses/advances + reports endpoint
  (global) · `/api/pos` ↔ `/api/orders` API birlashtirish.
