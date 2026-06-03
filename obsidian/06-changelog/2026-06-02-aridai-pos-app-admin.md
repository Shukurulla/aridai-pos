---
sana: 2026-06-02
mavzu: aridai-pos-app — branch_admin (filial admin) mobil ekranlari
status: bajarildi (MVP)
---

# aridai-pos-app: branch_admin — mobil boshqaruv (4 tab)

Saytdagi filial_admin logikasi, mobil/ixcham, waiter dizaynida. Backend allaqachon tayyor edi
(oldingi turlar: xodim/order/smena endpointlari) — faqat Flutter ekranlari.

## api_service (qo'shildi)
getStaff/createStaff/updateStaff/deleteStaff · cancelOrder · getShifts/openShift/closeShift.
Modellar: `StaffMember`, `ShiftModel`.

## Ekranlar (lib/screens/admin/ + home/admin_home.dart)
Bottom-nav 4 tab: **Заказы · Сотрудники · Отчёты · Смена**; tepada filial+admin nomi + logout.
- **Заказы** — barcha filial orderlari, filter chiplar (Все/Открытые/Оплаченные/Отменённые),
  ochiq orderda "Отменить" (sabab dialog → cancel).
- **Сотрудники** (asosiy) — rolega guruhlangan ro'yxat, "+" FAB → forma: ism/telefon(KZ/UZ)/parol/rol;
  **waiter → maosh** (Нет/Дневная/Месячная/Процент + summa); **cook → taom biriktirish**
  (kategoriya chiplari + taom checklist). Tahrir/o'chirish (PUT/DELETE).
- **Отчёты** — davr (Сегодня/7 дней/Всё) + kartalar (Выручка/Заказов/Средний чек/Отменено) + ТОП блюд.
- **Смена** — aktiv smena (ochilish/жонли) → "Закрыть смену" (default kassa); aktiv yo'q → "Открыть
  смену"; tarix.
- ✅ `flutter analyze`: No issues found.

## Rollar holati
waiter 🟢 · cook 🟢 · **admin 🟢** · cashier 🔴 · owner 🔴

## Owner uchun eslatma (keyingi)
Owner mobil — barcha filiallar + tushum statistikasi (kun/hafta/oy/yil). Backend tayyorgarlik kerak:
owner user-token bilan filiallar ro'yxati + analitika endpointi (aggregation), chunki hozir
`/branches/all` restoran-token (restoranMiddleware) talab qiladi.
