---
sana: 2026-06-02
mavzu: aridai-pos-app — owner (egasi) dashboard + backend analitika
status: bajarildi
---

# aridai-pos-app: owner — tushum statistikasi (barcha filiallar)

## Muhim: owner auth
Owner-role userlar yo'q edi (ownerlar restoran-entity sifatida edi). Mobil app `/users/login`
ishlatadi → **owner USER** (role owner) yaratildi: branch model `required` bo'lgani uchun branch
biror filialga qo'yiladi, lekin owner endpointlari `restaurantId` ishlatadi. Test owner:
**+77000000001 / 123456** (BrendPlov).

## Backend (YANGI — owner.routes.js, /api/owner, authMiddleware + requireRole owner)
- `GET /owner/branches` — owner restoranining filiallari.
- `GET /owner/stats?period=today|7d|30d|year` — MongoDB aggregation (paid, non-cancel):
  revenue, ordersCount, avgCheck, cancelledCount, branchesCount, **byBranch** (filiallar taqqoslash),
  **byMethod** (cash/card/transfer/kaspi), **topFoods**, **daily** (trend). Tenant: restaurantId.

## Flutter (owner_home.dart + owner_stats.dart + api)
- Davr chiplari (Сегодня/7д/30д/Год) → reload.
- Stat kartalar: Выручка / Заказов / Средний чек / Отменено.
- **Филиалы** — filiallar taqqoslash (revenue + proportsiya bari).
- **Оплата по способам** + **ТОП блюд** + **Динамика** (paketsiz bar qatori).
- Pull-to-refresh + empty/loading. waiter/admin dizayni bilan bir xil.
- ✅ `flutter analyze`: No issues found.

## Sinov (verified)
Owner login (role owner) ✅; /owner/branches → 2 filial; /owner/stats(year) → revenue 10050,
byBranch [Sayna], byMethod {cash:10050}, topFoods [Шашлык×3, Ачичук×1] ✅.

## Rollar holati — 4/5
waiter 🟢 · cook 🟢 · admin 🟢 · owner 🟢 · **cashier 🔴**
Qolgan: cashier (global to'lov endpointi kerak) + waiter buyurtma-yaratish oqimi + real-time/FCM.
