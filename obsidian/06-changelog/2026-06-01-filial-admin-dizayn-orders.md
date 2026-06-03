---
sana: 2026-06-01
mavzu: Filial admin — dizayn tuzatish + POS orderlari (Заказы)
status: bajarildi
---

# Filial admin: topbar dizayn tuzatish + "Заказы" (POS orderlari)

## Muammo
1. **Topbar buzilgan** — filial nomi + foydalanuvchi/rol matni 64px balandlikka sig'masdan
   wrap bo'lib, yuqoridan **qirqilib** ketyapti (`.row { flex-wrap: wrap }` global klassi
   topbarda ham qo'llanib, matn ikki qatorga tushib ketgan).
2. Filial nomi ko'rinmaydi — login `branch`'ni populate qilmaydi (faqat ObjectId),
   shuning uchun `user.branch.name` bo'sh → "Управление филиалом" fallback chiqaveradi.
3. **POS orderlari ko'rinmaydi** — filial admin POS'da urilgan buyurtmalarni kўра olmaydi.

## Yechim

### 1. Topbar (styles.css + Shell.jsx)
- Topbarga maxsus klasslar: `.tb-title` (filial nomi, `white-space: nowrap`, ellipsis),
  `.tb-right` (foydalanuvchi + Выйти, `flex-shrink: 0`, wrap YO'Q), `.tb-user` (nowrap).
- Global `.row` o'rniga shu klasslar — endi topbar hech qachon qirqilmaydi.
- Filial nomini ishonchli olish: `GET /api/branches/:id` (authMiddleware, tenant guard) —
  login populate'iga tayanmaymiz.

### 2. Заказы sahifasi (Orders.jsx — YANGI)
- Manba: mavjud `GET /api/orders/all/:branchId` (authMiddleware — filial admin user token
  ishlaydi). POS → local → `/api/sync/push` → global `orders` kolleksiyasi → shu endpoint.
- **Statistika** (client-side): buyurtmalar soni, выручка (paid totalPrice yig'indisi),
  ochiq (pending) buyurtmalar.
- **Filter chiplari**: Все / Открытые / Оплаченные / Отменённые.
- **Jadval**: № чека, Тип (Зал N / Собой / Доставка), Официант, Позиции, Сумма, Статус, Время.
- **Qator ochilishi** (expand): taomlar ro'yxati (name ×qty = sum) + Подытог + Обслуживание +
  Скидка + Итого + to'lov usuli.
- **Real-time'ga yaqin**: har 8s avtomatik yangilanadi (poll) + qo'lda "Обновить" tugmasi.
  (Filial admin web — global socketga ulanmaydi; menyu kabi push o'rniga yengil polling.)

### 3. api.js
- `orders(branchId)` → `GET /orders/all/:branchId`
- `branch(branchId)` → `GET /branches/:id`

### 4. Shell.jsx
- Sidebar'ga **"Заказы"** nav (eng yuqorida — monitoring asosiy ish).
- Mount'da filial nomini `api.branch()` orqali yuklaydi.

## Toggle / kelajak
- Заказы — alohida modul (sidebar nav). Kelajakda date filter + pagination + cancel/refund
  detali qo'shiladi.
- Hozir `/orders/all/:branchId` butun ro'yxatni qaytaradi (filialда oz order) — production'da
  sana oralig'i + limit kerak bo'ladi (#29 hisobotlar bilan birga).

## Sinov
- +77005000831 (BrendPlov Sayna) — 3 order, 11 menyu → Заказы to'ladi.
- +77005000832 (BrendPlov Ayraport) — 0 order → bo'sh holat ("Заказов пока нет").
