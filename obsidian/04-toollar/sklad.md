---
tags: [tool]
created: 2026-05-28
toolKey: sklad
status: 📝
default: OFF
---

# Tool: Sklad (Inventory)

## Meta

- **Key:** `sklad`
- **Status:** 📝 dizayn
- **Default:** OFF
- **Version:** 1
- **requires:** core
- **excludes:** —

## Maqsad

Restoran omborida turgan mahsulotlarni (ingredient — un, go'sht, sabzavot, ichimliklar) hisobga olish. Order berilganda avtomatik kamaytirish. Past qolganda admin'ga xabar.

## Foydalanuvchi senariolari

### Senariy 1: Sklad'ga mahsulot kelishi
1. Admin "Sklad → Kirish" sahifasida
2. "Yangi kirish": Un 50kg, narx 1000kg, yetkazib beruvchi: ...
3. `stock_movement` — kirish yozuvi
4. `stock.un.balance += 50`

### Senariy 2: Order berilganda kamayishi
1. Cashier order tasdiqlaydi: "Osh x2"
2. Osh recipe (BOM): 200g un, 150g go'sht, 50g sabzavot
3. Order yaratilganda — `stock_movement` (chiqish): un -400g, go'sht -300g
4. `stock.un.balance -= 400`
5. Past darajaga yetsa `stock.low_alert` emit

### Senariy 3: Inventaryzatsiya
1. Oy oxirida admin "Inventory check" boshlaydi
2. Real qiymatni kiritish: un = haqiqiy 23kg (lekin tizimda 25kg)
3. Farq — `stock_movement` (adjustment): un -2kg, sabab: 'inventaryzatsiya'

## UI o'zgarishlar

| Role | UI |
|---|---|
| Admin (web) | Yangi: "Sklad" sahifa — kirish/chiqish/inventary, recipe |
| Cook (mobile) | "Tayyorlash" da har taom uchun ingredient mavjudligi ko'rsatiladi (low → 🟡) |
| Cashier (POS) | Order berishda taom "stock yetmaydi" deb belgilanishi mumkin |

## Data model

```javascript
// models/ingredient.model.js
{
  _id, restaurantId, branchId,
  name: 'un',
  unit: 'kg',
  category: 'asosiy', // asosiy / yordamchi / spice
  defaultLowAlert: 10,
}

// models/stock.model.js
{
  _id, restaurantId, branchId, ingredientId,
  balance: Number,    // kg yoki dona
  lastMovementAt: Date,
  lowAlertThreshold: Number,
}

// models/stock_movement.model.js
{
  _id, restaurantId, branchId, ingredientId,
  direction: 'in' | 'out' | 'adjustment',
  quantity: Number,
  unit: String,
  price: Number,      // umumiy narx (in uchun)
  reason: String,     // 'order:{id}' | 'manual' | 'inventory'
  refOrderId: ObjectId,
  createdBy: ObjectId, // user
  createdAt: Date,
}

// food modeliga qo'shimcha (recipe / BOM)
food.recipe: [
  { ingredientId, quantity, unit }
]
```

## API endpoint'lar

| Method | Path | Min role |
|---|---|---|
| POST | `/api/sklad/ingredients` | admin |
| GET | `/api/sklad/ingredients/:branchId` | admin, cook |
| POST | `/api/sklad/stock/in` | admin |
| POST | `/api/sklad/stock/adjustment` | admin |
| GET | `/api/sklad/stock/:branchId` | admin, cook, cashier |
| GET | `/api/sklad/movements/:branchId` | admin |
| GET | `/api/sklad/low-alerts/:branchId` | admin |
| POST | `/api/sklad/inventory-check` | admin |

## Socket eventlar

| Yo'nalish | Event | Maqsad |
|---|---|---|
| L → G | `stock.changed` | Stock balansi o'zgardi |
| G → L | `stock.in_recorded` | Boshqa joydan kirish yozildi |
| G → role:admin | `stock.low_alert` | Past balans |
| G → role:cook | `stock.unavailable` | Ingredient tugadi |

## Rejimlar ichida xatti-harakati

### Online
- Order yaratilsa darhol stock kamayadi
- Low alert real-time

### Offline
- Lokal stock kamayaveradi (lokal MongoDB)
- Reconnect'da global'ga sync
- Konflikt: agar ikkala tomonda ham kamaygan bo'lsa — qo'shiladi (additive)

### Possiz
- Stock kamaymaydi (mobile'lar lokal stock ko'rmaydi)
- Reconnect'da possiz'da yaratilgan orderlar uchun stock retroaktiv kamayadi
- Past balans bo'lsa hisobotda chiqadi (ammo ogohlantirish kech keladi)

## Boshqa toollarga bog'liqlik

- `requires`: core (order, food)
- `excludes`: —
- Optional integration:
  - `qr-order` — mijoz QR'dan order berishda real-time stock tekshirilishi
  - Keshbek — bog'liqlik yo'q

## Tool **o'chirilganda** — nima bo'ladi?

- API 404 qaytaradi
- Order berishda stock tekshirilmaydi
- Recipe maydoni mavjud lekin ishlatilmaydi
- Cook mobile'da ingredient ko'rinmaydi
- `stocks` collection ma'lumotlari qoladi
- Re-enable'da — eski ma'lumot ko'rinadi
- **Order/payment flow umuman buzilmaydi**

## Lifecycle hook'lar

### onInstall
```javascript
async function skladOnInstall(restaurantId) {
  await db.createCollection('ingredients');
  await db.createCollection('stocks');
  await db.createCollection('stock_movements');
  await db.createIndex('stocks', { restaurantId: 1, branchId: 1, ingredientId: 1 }, { unique: true });
  await db.createIndex('stock_movements', { restaurantId: 1, branchId: 1, createdAt: -1 });
}
```

### onEnable
```javascript
async function skladOnEnable(restaurantId, config) {
  eventBus.on(`order.created:${restaurantId}`, decrementOnOrder);
  eventBus.on(`order.cancelled:${restaurantId}`, restoreOnCancel);
  eventBus.on(`stock.changed:${restaurantId}`, checkLowAlert);
  scheduler.schedule(`sklad_daily_${restaurantId}`, '0 23 * * *', sendDailyDigest);
}
```

### onDisable
```javascript
async function skladOnDisable(restaurantId) {
  eventBus.off(`order.created:${restaurantId}`, decrementOnOrder);
  eventBus.off(`order.cancelled:${restaurantId}`, restoreOnCancel);
  eventBus.off(`stock.changed:${restaurantId}`, checkLowAlert);
  scheduler.cancel(`sklad_daily_${restaurantId}`);
}
```

## Konfiguratsiya

```javascript
features.sklad.config = {
  autoDeductOnOrder: true,           // order berilganda avtomatik kamayish
  blockOrderIfOutOfStock: true,      // O1 qaror: stock yetmasa RAD qilinadi (oversell yo'q)
  lowAlertChannel: 'push',           // push | email | sms
  dailyDigestTime: '23:00',
  unitSystem: 'metric',              // metric | imperial
}
```

> [!important] O1 qaror (2026-05-29): stock tugasa BLOK (oversell yo'q)
> Ingredient tugasa, o'sha ingredient kerak bo'lgan taom **rad etiladi** (qattiq blok). Mavjud porsiya = `floor(stock / retsept_miqdori)` — bu effektiv limit, [[../07-nozik-nuqtalar/stop-list-limit]] kabi real-time barcha kanalda disable. Manfiy stock YO'Q. (Avvalgi "bloklanmaydi" default bekor qilindi.)

## Test rejasi

- [ ] Default OFF
- [ ] Yoqildi: ingredient va stock yaratish ishlaydi
- [ ] Order berildi: stock kamaydi
- [ ] Order bekor: stock qaytadi
- [ ] Past balans: admin'ga push
- [ ] O'chirildi: stock ma'lumot qoladi
- [ ] O'chiq paytda order berish — stock o'zgarmaydi, lekin order yaratiladi
- [ ] Re-enable: eski stock holati ko'rinadi
- [ ] Offline'da order: lokal stock kamayadi
- [ ] Reconnect'da sync
- [ ] Multi-tenant: boshqa restoran stock'i ko'rinmaydi

## Bog'liq

- [[../03-tool-strategiyasi/feature-toggle-tizimi]]
- [[_MOC]]
- Kelajak: recipe management, supplier management
