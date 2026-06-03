---
tags: [vizyon, glossary, lugat]
created: 2026-05-29
---

# Glossariy (atamalar lug'ati)

> Loyihada o'zbek + rus + ingliz aralash atamalar ishlatiladi. Bu — yagona haqiqat manbai. Yangi atama ishlatilsa shu yerga qo'shiladi.

## Domain atamalari (restoran)

| O'zbek | Ruscha | Inglizcha | Tizimda (kod) | Izoh |
|---|---|---|---|---|
| Filial | Филиал | Branch | `branch` | Restoran'ning bir joyi |
| Smena | Смена | Shift | `shift` | Kassirlik smena (ochiq-yopiq) |
| Taom | Блюдо | Food/Dish | `food` | Menyu elementi |
| Stol | Стол | Table | `table` | Fizik stol |
| Buyurtma | Заказ | Order | `order` | Mijoz buyurtmasi |
| Ofitsiant | Официант | Waiter | `waiter` (role) | Xizmat ko'rsatuvchi |
| Oshpaz | Повар | Cook | `cook` (role) | Ovqat tayyorlovchi |
| Kassir | Кассир | Cashier | `cashier` (role) | Tolov qabul qiluvchi |
| Kategoriya | Категория | Category | `category` | Menyu guruhi |
| Chegirma | Скидка | Discount | `discount` | Narx kamaytirish |
| Xizmat haqqi | Сервисный сбор | Service charge | `service` | Ofitsiant uchun % |
| Stol tarifi | Тариф стола | Table tariff | `selectedTariff` | Billiard/VIP soatlik |
| Chek | Чек | Receipt | `receipt` | Tolov hujjati |
| Pul yashigi | Денежный ящик | Cash drawer | `cashDrawer` | Naqd pul qutisi |

## Tizim rejimlari

| O'zbek/atama | Inglizcha | Tizimda | Izoh |
|---|---|---|---|
| Online rejim | Online mode | `online` | Internet bor, real-time sync |
| Offline rejim | Offline mode | `offline` | Internet yo'q, lokal ishlaydi |
| Possiz rejim | POS-less mode | `possiz` | Svet yo'q, mobile-only (cook+waiter) |

## Texnik atamalar

| Atama | Ma'no |
|---|---|
| Global VPS | Bulutdagi markaziy server (barcha restoranlar) |
| Local backend | Filial POS ichidagi Electron+MongoDB server |
| Sync / sinxronizatsiya | Lokal ↔ global ma'lumot moslashtirish |
| Outbox | Lokal'da jo'natilmagan event'lar navbati |
| Idempotency | Takror jo'natilsa ham bir marta ishlash |
| Conflict resolution | Ikki tomon o'zgartirganda qaror |
| Tombstone | Soft-deleted yozuv belgisi |
| Snapshot | Order'da yozib qo'yilgan immutable nusxa (narx, ism) |
| Feature toggle | Funksiyani yoqib-o'chirish kaliti |
| Multi-tenant | Ko'p ijaralilik (restoranlar ajratilgan) |
| branchToken | Lokal backend ↔ global ulanish kaliti |
| tokenVersion | JWT bekor qilish mexanizmi |
| Heartbeat | Tirik-ekanini bildiruvchi ping/pong |
| Business day | Biznes kun (06:00-06:00, tungi smena uchun) |

## Tool'lar

| O'zbek/atama | Inglizcha | Tizimda | Izoh |
|---|---|---|---|
| Sklad | Склад / Inventory | `sklad` | Ombor, ingredient hisobi |
| Keldi-ketti | Учёт рабочего времени | `keldiKetti` | Davomat + maosh |
| QR Order | QR заказ | `qrOrder` | Stol QR'dan buyurtma |
| QR Pay | QR оплата | `qrPay` | Kaspi QR tolov |
| Keshbek | Кешбэк / Cashback | `keshbek` | Mijoz balans/keshbek |
| Ingredient | Ингредиент | `ingredient` | Sklad mahsuloti |
| Retsept | Рецепт / Recipe (BOM) | `recipe` | Taom = ingredient'lar |
| Davomat | Посещаемость | `attendance` | Keldi/ketdi yozuvi |
| Maosh | Зарплата | `payroll` | Ish haqi |

## Tashqi servislar / huquqiy

| Atama | Ma'no |
|---|---|
| Kaspi / Kaspi Pay | Qozog'iston tolov tizimi (QR) |
| KKM / ККМ | Kontrol-kassa mashinasi (fiskal kassa) |
| OFD / ОФД | Fiskal ma'lumotlar operatori (KZ) |
| QQS / ҚҚС / НДС | Qo'shilgan qiymat solig'i (VAT) |
| Fiskal | Davlat soliq hujjati (chek) |
| Eskiz / Playmobile | SMS gateway (UZ) |
| FCM | Firebase Cloud Messaging (push) |
| WhatsApp Cloud API | WhatsApp bot uchun |

## Valyuta

| Kod | Valyuta | Belgi | Davlat |
|---|---|---|---|
| `UZS` | O'zbek so'mi | so'm | O'zbekiston |
| `KZT` | Qozoq tengesi | ₸ | Qozog'iston |

## Rollar (RBAC)

| Role | O'zbek | Doirasi |
|---|---|---|
| `system_admin` | Tizim admini | Barcha restoranlar (biz) |
| `owner` | Restoran egasi | Bitta restoran |
| `branch_admin` | Filial admini | Bitta filial |
| `cashier` | Kassir | Bitta filial |
| `waiter` | Ofitsiant | Bitta filial |
| `cook` | Oshpaz | Bitta filial |

## Ilovalar

| Atama | Ma'no |
|---|---|
| aridai_pos_app | Mobile ilova (barcha rollar, role'ga qarab UI) |
| POS monitor | Filial POS Electron desktop ilovasi |
| aridaipos_monitor | (eski nom — local'dagi monitor) |
| Web admin | super_admin web paneli |
| Mijoz QR web | Stol QR'dan ochiladigan mijoz menyu sayti |

## Bog'liq

- [[loyiha-mohiyati]]
- [[roadmap]]
- [[../00-INDEX]]
