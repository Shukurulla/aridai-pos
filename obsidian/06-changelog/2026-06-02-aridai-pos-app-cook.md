---
sana: 2026-06-02
mavzu: aridai-pos-app — cook roli (oshxona navbati)
status: bajarildi
---

# aridai-pos-app: cook roli — oshxona navbati

## Backend (global order.routes.js)
- `GET /api/orders/kitchen/:branchId` (auth) — ochiq (bekor emas, to'lanmagan) orderlardagi
  waiting/cooking itemlar flat ro'yxati. Cook bo'lsa FAQAT unga biriktirilgan
  (assignedFoods/assignedCategories) taomlar; bo'sh → hammasi. Bekor item (effQty 0) chiqmaydi.
- `PATCH /api/orders/:id/items/:itemId/cooking { status }` (auth) — waiting→cooking→ready
  (cookingStartedAt/readyAt/servedAt + cookId; ready → navbatdan chiqadi).

## Flutter (aridai-pos-app)
- `models/kitchen_item.dart`, api `getKitchen()` + `setCookingStatus()`.
- `screens/home/cook_home.dart` (stub → TAYYOR): "Кухня" header + cook nomi/filial; segmentlar
  **Новые** (waiting) / **Готовятся** (cooking) + sanoq; FIFO kartalar (taom, ×miqdor, Стол N/Собой,
  izoh, vaqt); **Начать готовить** (red→cooking) / **Готово** (green→ready); pull-to-refresh + 10s
  auto-refresh; loading/empty/error. waiter dizayni bilan bir xil (AppColors + waiter_design).
- ✅ `flutter analyze`: No issues found.

## Sinov (verified)
- Cook "Тест Повар" (+77001113355 / 123456, biriktirilgan: Горячие блюда) → kitchen navbat 10 item
  (faqat issiq taomlar); cooking PATCH ✅.

## Rollar holati
waiter 🟢 (read) · cook 🟢 · cashier 🔴 · admin 🔴 · owner 🔴
Keyingi: admin (filial boshqaruv, mobil) → owner (filiallar + tushum statistikasi).
