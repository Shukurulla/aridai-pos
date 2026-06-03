---
sana: 2026-06-02
mavzu: aridai-pos-app — cashier + BARCHA 5 rol tayyor
status: bajarildi
---

# aridai-pos-app: cashier (to'lov) + 5/5 rol MVP tayyor

## Cashier
- **Backend** (global `order.routes.js`): `PATCH /api/orders/:id/pay { paymentMethod, mixed }` —
  cash/card/transfer/kaspi/mixed; mixed split = totalPrice; paymentStatus=paid, paymentMethod,
  paidAt, paidBy. ✅ Sinov: MKZ-...0002 (8690) cash → paid.
- **Flutter** `cashier_home.dart` + `cashier/payment_page.dart`: ochiq orderlar ro'yxati ("К оплате:
  N · X ₸"), karta bosilsa to'lov sahifasi — item lines + К ОПЛАТЕ + usul (Наличные/Карта/Перевод/
  Смешанная); mixed split (yig'indi = total) tekshiruvi; Подтвердить оплату. ✅ analyze toza.
- Cashier: **+77001114455 / 123456**.

## 🎉 BARCHA 5 ROL TAYYOR (MVP)
| Rol | Login | Ekranlar |
|---|---|---|
| waiter | +77001112244 / 123456 | Заказы/Столы/Меню/Профиль+maosh |
| cook | +77001113355 / 123456 | Кухня navbati (biriktirilgan taom) |
| cashier | +77001114455 / 123456 | Ochiq orderlar → to'lov |
| branch_admin | +77005000831 / 123456 | Заказы/Сотрудники/Отчёты/Смена |
| owner | +77000000001 / 123456 | Tushum statistikasi (filiallar) |

- Bitta Flutter app (`aridai-pos-app`), login rolega qarab yo'naltiradi. Dizayn: waiter_flutter 1:1
  (#FAFAF7 / #DC2626 / IBM Plex). Online → GLOBAL backend (4560). 32 dart fayl. `flutter analyze` toza.

## Qolgan ish (keyingi bosqichlar)
- **Waiter buyurtma yaratish** oqimi (stol → taom → submit) + global order-create endpoint.
- **Real-time/FCM** (cook/waiter push) + socket.
- **Possiz rejim** (svet yo'q — lokal Wi-Fi).
- Admin: **Меню/Категории/Столы CRUD** (hozir Заказы/Сотрудники/Отчёты/Смена bor).
- Telefon/emulatorda to'liq sinov (web preview CanvasKit cheklovi).
