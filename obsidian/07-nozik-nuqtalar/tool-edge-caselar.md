---
tags: [nozik-nuqta, tool]
created: 2026-05-29
---

# Tool-specific edge case'lar

> Har tool hujjati bor ([[../04-toollar/_MOC]]), lekin bu yerda — eng oson unutiladigan tool edge'lari.

## Sklad ([[../04-toollar/sklad]])

### Stock tugashi → BLOK (O1 qaror 2026-05-29)
- Order berilganda stock yetmasa — order **rad etiladi** (oversell yo'q, manfiy stock yo'q)
- Mavjud porsiya = `floor(stock / retsept_miqdori)` → effektiv limit
- Real-time barcha kanalda disable ([[stop-list-limit#Oversell oldini olish — barcha kanal, real-time]])
- Atomik tekshirish (concurrent order oversell qila olmaydi — [[concurrency-race]])
- ⚠️ Aniq retsept shart (ingredient miqdori to'g'ri bo'lsa, blok to'g'ri ishlaydi)
- (Avvalgi "bloklanmaydi/manfiy stock" default **bekor qilindi**)

### Birlik konversiya (unit conversion)
- Ingredient kg'da, retsept g'da → konversiya kerak
- `un: 50 kg` stock, retsept `un: 200 g` → 0.2 kg kamayadi
- Birlik standartlashtirish: har ingredient base unit (kg, litr, dona)
- Retseptda base unit'ga konvert

### Yarim tayyor mahsulot (semi-finished)
- Xamir bir nechta taomda ishlatiladi
- Xamir = un + suv + tuz (o'zi retsept)
- Taom = xamir + boshqa
- **2-darajali retsept** — murakkab, kelajak. MVP: faqat 1-daraja (taom → ingredient)

### Isrof (waste/spoilage)
- Buzilgan mahsulot hisobdan chiqariladi
- `stock_movement` direction='waste', sabab
- Inventory check farqi ham shu yerga

### Combo/set menu sklad
- Biznes-lanch = osh + salat + non → har birining ingredient'i kamayadi
- Combo modeli kelajak ([[order-operatsion-edge]])

## Keldi-ketti ([[../04-toollar/keldi-ketti]])

### Tungi smena yarim tunni kesib o'tishi
- Smena 22:00-06:00 → ikki calendar kunga tegishli
- Davomat `businessDate` bo'yicha ([[vaqt-va-soat]])
- Kechikish hisobi tungi smenada to'g'ri

### Maosh qoidasi o'rtada o'zgarishi
- Oy o'rtasida waiter % 6 → 8 ga o'zgartirildi
- Payroll: o'zgarishgacha eski %, keyin yangi
- `salaryRule` snapshot davomat paytida ([[../05-data-model/snapshot-strategiyasi]])

### GPS noaniqligi (geo-fence)
- Geo-fence 100m, lekin GPS ±50m xato
- False negative: xodim filialda, lekin GPS tashqarida ko'rsatadi
- Yechim: geo-fence yumshoq (faqat ogohlantirish, blok emas) yoki admin manual check-in
- Yoki: Wi-Fi/QR check-in (filial Wi-Fi'ga ulansa = keldi)

### Ko'p rolli xodim
- Bir odam ba'zan waiter, ba'zan cook
- Qaysi role bo'yicha maosh?
- `attendance.role` — shu smenadagi role
- Murakkab — kelajak. MVP: bir xodim bir role

### Cook per-dish: qaysi taomlar sanaladi
- Bekor qilingan taomlar sanalmaydi
- Faqat tayyorlangan (cookingStatus='served')
- `effectiveQuantity` ([[../05-data-model/biznes-mantiq/total-hisoblash]])

## QR Order ([[../04-toollar/qr-order]])

### Stol band — boshqa kompaniya
- Mijoz QR skanerladi, lekin stolda boshqa odamlar (oldingi order)
- POS tasdiqlashda ko'rinadi — cashier rad qiladi
- Yoki: stol bo'sh bo'lmaguncha QR order qabul qilinmaydi

### Bir vaqtda ko'p skanerlash
- 4 kishi bir stol QR'ni skanerladi
- Har biri alohida request → POS'da 4 ta pending
- Cashier ularni birlashtiradi yoki bittasini tasdiqlaydi
- Yoki: bitta active QR session per table

### Tashlab ketish
- Mijoz order berdi, lekin POS tasdiqlamasdan ketdi
- Auto-expire 5 daqiqa ([[../04-toollar/qr-order]])

## QR Pay / Kaspi ([[../04-toollar/qr-pay-kaspi]])

### Webhook order'dan oldin kelishi (race)
- Kaspi webhook tez keldi, lekin order hali saqlanmagan (sekin)
- Webhook'ni **buffer** qilish (kaspi_transaction status='received', matchedOrderId=null)
- Order saqlangach — match qilinadi
- Yoki: invoice yaratilganda order allaqachon bor (dinamik QR) → race kam

### Partial Kaspi
- Mijoz to'liq emas, qisman Kaspi to'ladi
- Mixed payment ([[../05-data-model/biznes-mantiq/tolov-oqimi]]): Kaspi + naqd
- Webhook qisman summa → partial

### Kaspi refund
- Tolangan Kaspi order qaytarish
- Kaspi API orqali refund (yoki manual)
- `order.paymentStatus='refunded'` ([[../05-data-model/biznes-mantiq/cancel-refund]])

### Duplicate webhook
- Kaspi bir webhook'ni 2 marta yubordi
- `kaspiInvoiceId` unique → idempotent ([[../04-toollar/qr-pay-kaspi]])

### Orphan transaction
- Statik QR: mijoz to'ladi, lekin order topilmadi
- `kaspi_transaction status='orphan'`
- Admin manual match

## Keshbek ([[../04-toollar/keshbek-tizimi]])

- Offline spend YO'Q (qaror — [[../06-changelog/2026-05-29-keshbek-offline-qaror|changelog]])
- Telefon normalizatsiya ([[telefon-normalizatsiya]])
- Multi-tenant izolyatsiya (A restoran phone B'ga ko'rinmaydi)

## Umumiy printsip

> Har tool o'chiq bo'lsa — bu edge'lar umuman mavjud emas. Tool yoqilganda — bu edge'lar hisobga olinishi shart. Har tool test rejasida bular bo'lishi kerak ([[../03-tool-strategiyasi/tool-qoshish-shabloni]]).

## Bog'liq

- [[../04-toollar/_MOC]]
- [[../04-toollar/sklad]]
- [[../04-toollar/keldi-ketti]]
- [[../04-toollar/qr-order]]
- [[../04-toollar/qr-pay-kaspi]]
- [[concurrency-race]]
