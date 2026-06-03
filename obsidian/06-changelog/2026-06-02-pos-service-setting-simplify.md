---
sana: 2026-06-02
mavzu: POS Settings — "Услуга и скидка" bo'limini soddalashtirish
status: bajarildi
---

# POS Настройки: Услуга — oddiy toggle + (yoqilsa) input

## Talab
"Услуга и скидка" bo'limini soddalashtirish: shunchaki **toggle + input**. Yoqishni bossa
input chiqsin (oldingi/mantiqiy qiymat bilan), yozilsa saqlansin.

## Yechim (Settings.tsx)
- Yangi `ChargeRow` komponenti: **label + yashil toggle**; yoqilsa pastda **foiz input** (`10 %`)
  chiqadi. O'chsa input yo'qoladi (faqat toggle).
- **Avto-saqlash**: toggle bosilsa yoki input'dan chiqilsa (blur/Enter) DARHOL backendga
  saqlanadi → alohida "Сохранить" tugmasi olib tashlandi.
- Yoqilganda input avtomatik fokuslanadi; qiymat 0 bo'lsa mantiqiy `10` qo'yiladi (foydalanuvchi
  o'zgartiradi). Backend service'ni `serviceModel`da saqlaydi va ochiq dineIn orderlarga qo'llaydi.

## Скидка olib tashlandi (sabab)
- Local backend `GET /restaurant/settings` doim `discountPercent: 0` qaytaradi, `PUT` esa
  discount'ni HECH QAYERGA saqlamaydi (faqat service saqlanadi). Ya'ni Скидка toggle/input
  **o'lik** edi. Skidka — har order ichida beriladi (order.discount, PATCH /orders/:id).
- Shu sabab bo'lim faqat **Услуга** qoldi (sarlavha "Услуга"); izohda "Скидка задаётся в самом
  заказе" deb yozildi. Bu "shunchaki toggle+input" talabiga mos.
- (Kelajak: agar global default skidka kerak bo'lsa — alohida feature: backendda saqlash +
  order yaratishda qo'llash.)

## Sinov (verified, ikkinchi renderer 5181 + local backend 4561)
- Toggle ON → yashil + input `10 %`; OFF → input yo'qoladi (faqat toggle). ✅
- Avto-saqlash: backend `serviceChargeEnabled:true, serviceChargePercent:10`. ✅

## Eslatma (vazifadan tashqari, alohida task)
- `theme.tsx`: `--font-manrope` CSS o'zgaruvchisi REFERENCE qilingan-u, hech qayerda
  ANIQLANMAGAN → `var(--font-manrope)` yaroqsiz → butun font-family yiqilib brauzer default
  (serif) ishlatiladi. Butun POS fontiga ta'sir qiladi. Bir qatorlik tuzatish (var fallback yoki
  Manrope yuklash) kerak — alohida task sifatida belgilandi.
