---
tags: [tool]
created: 2026-05-28
toolKey: possiz
status: 📝
default: OFF
---

# Tool: Cook+Waiter possiz rejim

## Meta

- **Key:** `possiz`
- **Status:** 📝 dizayn
- **Default:** OFF
- **Version:** 1
- **requires:** core, offline
- **excludes:** qrPay (Kaspi possiz'da ishlamaydi)

## Maqsad

Svet o'chgan paytda restoran ishlay olishi. POS umuman ishlamasa, waiter va cook telefondan ishlaydi, cashier telefondan tolov oladi. Chek apparat ishlamaydi — PDF check yoki QR.

## Foydalanuvchi senariolari

### Senariy 1: Svet o'chdi
1. Restoran admin telefondagi ilovaga kiradi
2. "Possiz rejimga o'tish" tugmasini bosadi
3. Tasdiqlash: "Chek apparatga tolov bosilmaydi. Davom etamizmi?"
4. Hammaga (waiter, cook, cashier mobile'lari) push: "Possiz rejim yoqildi"
5. Waiter ekrani — order berish
6. Cook — kelgan orderlar
7. Cashier — to'lov

### Senariy 2: Svet keldi
1. Admin "POS rejimga qaytarish" tugmasini bosadi
2. Tasdiqlash: "Possiz paytdagi order va tolovlar global bazaga jo'natiladi"
3. Sync paytida butun tizim qisqa vaqt "syncing"
4. Tugagach — online rejim

## UI o'zgarishlar

| Role | UI |
|---|---|
| Admin (mobile) | "Sozlamalar" da yangi katta tugma "Possiz rejim" toggle |
| Admin (web) | Sozlamalar → "Cook+Waiter rejimi" feature toggle |
| Waiter (mobile) | Possiz'da — bosh ekran "Order berish" view'ga o'zgaradi |
| Cook (mobile) | Possiz'da — bosh ekran "Kelgan orderlar" view |
| Cashier (mobile) | Possiz'da — "To'lov" view yoqiladi |
| POS monitor | Hech narsa (svet yo'q) |

## Data model

`order` modeliga qo'shimcha:
```javascript
order.createdInMode: 'online' | 'offline' | 'possiz'
order.checkPrinted: Boolean    // possiz da hech qachon true emas
order.checkPdfUrl: String      // PDF check storage URL
```

Yangi collection — peer-to-peer aloqa uchun (kelajakda):
```javascript
// peer_session — admin "possiz" yoqqanda yaratiladi
{ _id, branchId, startedAt, endedAt, activeUsers: [userId] }
```

## API endpoint'lar

| Method | Path | Min role | Tavsif |
|---|---|---|---|
| POST | `/api/branches/:id/mode/possiz` | admin, owner | Possiz yoqish |
| POST | `/api/branches/:id/mode/return-to-pos` | admin, owner | POS'ga qaytish |
| GET | `/api/orders/:id/check.pdf` | * (auth) | PDF check generatsiya |

> [!note] Possiz paytda bu endpoint'lar **global VPS'da emas, local backend'da** ishlaydi (yoki admin telefonidagi mini-server'da, agar local backend ishlamasa).

## Socket eventlar

Possiz rejimda socket — yolg'iz Wi-Fi orqali peer-to-peer yoki local backend orqali:

- `possiz.activated` — admin yoqdi
- `possiz.order_created` — waiter mobile → cook mobile (push notification)
- `possiz.order_ready` — cook mobile → waiter mobile (push)
- `possiz.payment_taken` — cashier mobile → barcha
- `possiz.deactivating` — admin "qayt" deyapti

Notification — agar lokal Wi-Fi bo'lsa socket, bo'lmasa SMS yoki bluetooth (kelajakda).

## Rejimlar ichida xatti-harakati

| Holat | Possiz toggle | Xatti-harakat |
|---|---|---|
| Online | OFF | Ko'rinmaydi |
| Online | ON | "Possiz rejimga o'tish" tugmasi mavjud |
| Offline | OFF | Ko'rinmaydi |
| Offline | ON | "Possiz rejimga o'tish" tugmasi mavjud |
| Possiz | (har holatda) | Yoqilgan, faqat possiz mantiqi ishlaydi |

## Boshqa toollarga bog'liqlik

- `requires`: `offline` (offline infra bo'lmasa possiz ham ishlamaydi)
- `excludes`: `qrPay` — Kaspi internet talab qiladi
- Optional: `keshbek` — possiz'da QR keshbek check'siz qiyin
- Optional: `sklad` — possiz'da stock kamayishi delayed bo'ladi

## Lifecycle hook'lar

### onEnable
```javascript
async function possizOnEnable(restaurantId) {
  // Mobile ilovaga "possiz tugmasi ko'rinsin" deb features push qilinadi
  // PDF check generator (lokal) initsializatsiya
  await ensurePdfTemplate(restaurantId);
  // Push notification credential'lar mavjudligi tekshiriladi
  await verifyFcmCredentials(restaurantId);
}
```

### onDisable
```javascript
async function possizOnDisable(restaurantId) {
  // Hozirda possiz rejimda bo'lsa — admin tasdiqlash so'raladi
  if (await isAnyBranchInPossizMode(restaurantId)) {
    throw new Error('Hozirda filialda possiz rejim faol. Avval POS\'ga qaytaring.');
  }
}
```

## Konfiguratsiya

```javascript
features.possiz.config = {
  pdfCheckTemplate: 'default',   // brendlangan template
  notificationChannel: 'push',   // push | sms | both
  autoReturnOnReconnect: false,  // svet+internet kelsa avtomatik qaytishmi?
}
```

## Possiz → Online sync xususiyatlari

[[../02-arxitektura/sinxronizatsiya/offline-to-online-otish|Sync protokoli]] dan farqi:

- Possiz'da yaratilgan orderlar — `createdInMode='possiz'` belgi bilan
- Reconnect'da chek apparatga **retroaktiv bosilmaydi**
- Hisobotda "possiz rejim orderlari" alohida ko'rsatilishi mumkin
- `paymentMethod` — possiz'da faqat cash, transfer (Kaspi yo'q)

## Test rejasi

- [ ] Default OFF
- [ ] Yoqilgan: admin telefonida "possiz" tugma chiqadi
- [ ] Possiz yoqildi: waiter mobile order ekraniga o'zgaradi
- [ ] Waiter order yaratdi: cook'ga push keladi
- [ ] Cook "tayyor": waiter'ga push
- [ ] Cashier tolov: mobile'da chek ko'rinadi
- [ ] PDF check yuklanadi
- [ ] POS'ga qaytish: barcha order/tolovlar sync
- [ ] Chek apparat retroaktiv bosmaydi
- [ ] `excludes: qrPay` — qrPay yoqilgan restorada possiz yoqib bo'lmaydi (yoki ogohlantirishadi)

## Xavfsizlik

- Possiz rejimda mobile'lar lokal Wi-Fi orqali aloqa qiladi — JWT tekshiruvi davom etadi
- Cashier "tolandi" deb belgilash — faqat cashier roli (ofitsiant qila olmaydi)
- Audit log: kim qachon possiz yoqdi/o'chdi

## Bog'liq

- [[../02-arxitektura/3-rejim]]
- [[online-offline-rejim]]
- [[../02-arxitektura/sinxronizatsiya/offline-to-online-otish]]
- [[qr-pay-kaspi]] (excludes)
