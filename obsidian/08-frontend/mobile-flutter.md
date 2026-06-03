---
tags: [frontend, mobile, flutter]
created: 2026-05-29
---

# Mobile (Flutter) — aridai_pos_app

## Maqsadi

Bitta Flutter ilova, **role'ga qarab interfeys o'zgaradi**: waiter, cook, cashier, admin. Avval har role uchun alohida ilova rejalashtirilgandi (waiter-flutter, cook-flutter), endi birlashtirildi.

## Texnologiya

- **Flutter** (iOS + Android)
- State: **Riverpod** (yoki BLoC)
- HTTP: dio
- Socket: socket_io_client
- Lokal saqlash: Hive yoki Isar (offline cache, possiz uchun)
- Push: firebase_messaging (FCM)
- Secure storage: flutter_secure_storage (token'lar)

## Role-based UI

Login'dan keyin `user.role`'ga qarab boshqa interfeys:

```dart
Widget homeScreen(User user) {
  switch (user.role) {
    case 'waiter': return WaiterHome();
    case 'cook': return CookHome();
    case 'cashier': return CashierHome();
    case 'branch_admin':
    case 'owner': return AdminHome();
    default: return UnknownRole();
  }
}
```

## Role ko'rinishlari

### Waiter
- Online: order berish (menyu, stol), o'z orderlari
- Filial offline: bloklangan ("POS'dan bering")
- Possiz: order berish → cook'ga push
- Food ready push notification

### Cook
- Kelgan orderlar ro'yxati
- "Tayyorlashni boshlash" → "Tayyor"
- Possiz: asosiy ish rejimi (push orqali order)
- Online: lokal socket yoki global orqali

### Cashier
- Possiz: tolov qabul qilish, PDF chek
- Online: ko'pincha POS ishlatadi, mobile yordamchi

### Admin (branch_admin/owner)
- Filial holati
- "Possiz rejimga o'tish" tugmasi ([[../02-arxitektura/rejimlar/possiz-rejim]])
- Tezkor hisobot
- Xodimlar (keldi-ketti)

## Rejim bog'liqligi

| Rejim | Waiter | Cook | Cashier | Admin |
|---|---|---|---|---|
| Online | order berish | orderlar | yordamchi | monitoring + possiz tugma |
| Filial offline | ❌ bloklangan | lokal socket | ❌ | monitoring |
| Possiz | order berish | ⭐ asosiy | ⭐ tolov | koordinator |

Tafsilot: [[../02-arxitektura/rejimlar/possiz-rejim]]

## Push notification

FCM orqali ([[../02-arxitektura/notification-tizimi]]):
- Cook'ga: yangi order
- Waiter'ga: ovqat tayyor
- Admin'ga: possiz koordinatsiya, alert'lar

## Offline cache (possiz uchun)

Possiz rejimda mobile lokal saqlaydi (Hive/Isar):
- Yaratilgan orderlar
- Koordinator (admin) — barcha possiz orderlari
- Reconnect'da sync ([[../02-arxitektura/sinxronizatsiya/offline-to-online-otish]])

## Ulanish strategiyasi

| Rejim | Mobile qayerga ulanadi |
|---|---|
| Online | Global VPS (REST + socket) |
| Filial offline | Global VPS (lekin filial status offline → order bloklangan) |
| Possiz | Lokal Wi-Fi (peer/local backend) yoki global (mobile internet bo'lsa) |

## Feature-flag aware

```dart
if (restaurant.features.keldiKetti.enabled) {
  showKeldiKettiButton();  // "Keldim/Ketdim"
}
```

## PDF chek (possiz, cashier)

Cashier possiz'da PDF generatsiya (pdf package), mijozga ko'rsatadi yoki ulashadi ([[../02-arxitektura/rejimlar/possiz-rejim#PDF check generatsiya]]).

## Phase bo'yicha

- **Phase 2:** waiter ko'rinishi (online order berish)
- **Phase 3:** cook, cashier, admin ko'rinishlari + possiz rejim + push
- **Phase 4:** offline cache to'liq, polish

## Xavfsizlik

- JWT secure storage (Keychain/Keystore)
- tokenVersion check ([[../02-arxitektura/xavfsizlik/auth-strategiyasi]])
- Waiter faqat o'z orderlari ([[../02-arxitektura/xavfsizlik/role-based-access]])

## Bog'liq

- [[_MOC]]
- [[umumiy-arxitektura]]
- [[../02-arxitektura/rejimlar/possiz-rejim]]
- [[../02-arxitektura/notification-tizimi]]
