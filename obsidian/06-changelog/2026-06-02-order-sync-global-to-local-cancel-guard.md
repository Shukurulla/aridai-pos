---
sana: 2026-06-02
mavzu: Order sync global→local (cancel propagatsiya) + cancel cheklovi
status: bajarildi
---

# Global→local order sync (admin cancel POS'ga qaytadi) + paid/cancelled cancel cheklovi

## Muammo
1. Admin (filial_admin → global) item/order bekor qildi, lekin **POS (local) hali ko'rsatadi**.
   Sabab: order sync FAQAT local→global (push). Global→local pull yo'q edi (#30).
2. **To'langan** va **bekor qilingan** orderlarda ham cancel tugmasi bor edi — faqat
   OCHIQ (pending) orderlarda bo'lishi kerak.

## Yechim

### A. Global → local order PULL (#30 ning bir qismi)
- Global: `GET /api/sync/orders-since?ts=<iso>` (branchAuth) → `updatedAt > ts` orderlar.
- Local `sync-client.js`:
  - `pullOrders(skipIds)` — global'dan o'zgargan orderlarni `replaceOne` bilan local'ga yozadi.
    - Local PENDING (POS hozir tahrirlayotgan, push qilinmagan) orderlar **ezilmaydi** (konflikt yo'q).
    - Shu tsiklda push qilingan orderlar ham skip (ortiqcha emit bo'lmasin).
  - Loop IKKI tezlikka bo'lindi: **menyu bootstrap — 10s** (og'ir), **order push+pull — 2s** (yengil).
  - O'zgarish bo'lsa `onOrdersChangeCb` → server.js socket **`order_updated`** emit qiladi.
- Local `server.js`: `startSyncLoop(10000, menuCb→"menu:updated", ordersCb→"order_updated", 2000)`.
- POS allaqachon `order_updated`'ni eshitadi → `loadData()` → REAL-TIME yangilanadi (~2s).

### B. Item-cancel POS'da ko'rinishi (mapOrder)
- Local `orders.routes.js` `mapOrder`: item `quantity` endi **EFFEKTIV** (cancels: inc/dec).
  To'liq bekor (effQty=0) itemlar ro'yxatdan **chiqariladi**. Totallar global recalc'dan keladi.

### C. Cancel cheklovi (paid/cancelled)
- Frontend `Orders.jsx`: `canCancel = paymentStatus !== "paid" && !isCancel` → faqat OCHIQ orderda
  cancel tugmalari.
- Backend `order.routes.js`: `/cancel` va `/items/:itemId/cancel` — `paid` bo'lsa 400
  ("Нельзя отменить оплаченный заказ"); cancelled bo'lsa no-op/400 (oldindan bor edi).

## Tezlik
- Order o'zgarishi ~2s ichida POS'da (socket → instant reload; kechikish = pull intervali).
  `orderIntervalMs` ni 1000 qilsa 1s bo'ladi (orders-since yengil — faqat o'zgarganlar).

## Cheklov (kelajak #30)
- To'liq bidirectional konflikt-hal qilish hali emas: agar order AYNI paytda ham local'da
  (POS) ham global'da (admin) o'zgartirilsa — local pending versiyasi ustun (admin o'zgarishi
  keyingi push'da ezilishi mumkin). Odatiy holat (synced/yopiq orderni admin bekor qiladi) ishlaydi.
