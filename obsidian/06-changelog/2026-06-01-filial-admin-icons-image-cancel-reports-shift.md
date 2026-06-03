---
sana: 2026-06-01
mavzu: Filial admin — 5 ta yaxshilanish (iconlar, rasm, cancel, otchot, smena)
status: bajarildi
---

# Filial admin: professional iconlar + rasm + cancel + otchot + smena

## Talab (5 punkt)
1. Emoji o'rniga professional iconlar.
2. Taom qo'shishda rasm ham yuklash.
3. Orderni va alohida itemlarni bekor qilish (cancel).
4. Otchotlarni ko'rish (Отчёты).
5. Smena ochish / yopish.

## Yechim

### 1. Iconlar (icons.jsx — YANGI)
- Inline SVG (Feather/Lucide uslubi, `stroke=currentColor`, 1.8px) — qo'shimcha paket YO'Q,
  kepket o'tkir dizayniga mos. `<Icon name size />` komponenti.
- Shell sidebar + barcha tugmalar (Экспорт/Импорт/+/Изм./Удал./Обновить) emoji'siz.

### 2. Taom rasmi (Foods.jsx + api.js)
- Backend ALLAQACHON tayyor: `POST/PUT /foods` da `upload.single("image")` (multer) →
  `/uploads/<file>`; `food.image` maydoni bor; `/uploads` static; vite proxy ham bor.
- Frontend: modalda fayl tanlash + preview; jadvalda thumbnail. Rasm bo'lsa `FormData`
  (multipart), bo'lmasa JSON — `request()` ikkalasini ham qo'llaydi.

### 3. Order / item cancel (backend order.routes.js + Orders.jsx)
- `PATCH /api/orders/:id/cancel` — `{reason, type}` → isCancel, cancelType(void|cancel),
  cancelReason, cancelledBy, cancelledAt. (Reports bekor qilinganlarni hisobga olmaydi.)
- `PATCH /api/orders/:id/items/:itemId/cancel` — itemga `cancels:[{status:dec,changeVal:netQty}]`
  qo'shiladi → totallar QAYTA hisoblanadi (service subtotalda, discount (subtotal+service)da —
  foydalanuvchi formulasi). Hamma item 0 bo'lsa order ham bekor bo'ladi.
- UI: Заказы detalida "Отменить заказ" + har item yonida "✕" (sabab so'raydi). Bekor item
  ustidan chiziq (struck).
- ⚠️ Sync: hozir order sync FAQAT local→global (push). Global→local pull (#30) hali yo'q —
  shuning uchun cancel global yozuvni (reporting manbai) yangilaydi, POS'ga hali qaytmaydi.

### 4. Otchotlar (Reports.jsx — YANGI, client-side)
- Manba: `/orders/all/:branchId` (+ `/shifts/all`). Davr: Сегодня / 7 дней / Всё.
- Kartalar: Выручка, Заказов, Средний чек, Отменено.
- Bo'limlar: to'lov usuli bo'yicha (Наличные/Карта/Перевод/Kaspi/Смешанная), buyurtma turi
  (Зал/Собой/Доставка), ТОП блюд (sotilgan soni + summa), Обслуживание/Скидка jami.

### 5. Smena (backend shift.routes.js + Shift.jsx — YANGI)
- `POST /shifts/create` tuzatildi — `openedBy`+`restaurantId` (model required), `openingCash`,
  bitta branchda bitta aktiv smena (409 SHIFT_ALREADY_OPEN).
- `PUT /shifts/:id/close` — orderlardan totals hisoblaydi (revenue, cash/card/transfer/kaspi,
  mixed bo'linishi, discount/service jami, cancelled), closingCash + discrepancy.
- UI: aktiv smena kartasi (jonli totals) + "Открыть/Закрыть смену" + o'tgan smenalar jadvali.
- ⚠️ Sync: POS o'z lokal smenasini ochadi; bu sahifa global smenalarni boshqaradi/ko'rsatadi.

## Toggle / kelajak
- Har bo'lim sidebar nav moduli. Cancel/Smena to'liq local↔global sinxron #30 bilan yakunlanadi.
