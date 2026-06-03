---
tags: [data-model, snapshot, muhim]
created: 2026-05-28
---

# Snapshot strategiyasi

## Muammo

Order yaratiladi: "Osh — 30,000 so'm". Bir hafta keyin admin osh narxini 35,000 so'mga oshiradi. Hisobotda eski order'ga qarasangiz, hozirgi narxni emas, **o'sha paytdagi narxni** ko'rishingiz kerak. Aks holda hisobot buziladi.

## Yechim: snapshot (immutable copy)

Order yaratilganda — `food.name`, `food.price`, `service.percent`, `selectedTariff` kabi field'lar **shu paytda yozib qo'yiladi**. Order kelajakda hech qachon ref'dan o'qib olmaydi.

Joriy [order.model.js](../../../global/backend/models/order.model.js) bunda:
```javascript
foods: [{
  foodId: ObjectId,     // ref
  foodName: String,     // snapshot ✅
  foodPrice: Number,    // snapshot ✅
  quantity: Number,
  ...
}]

selectedTariff: {       // table.tariffs[i] snapshot ✅
  name: String,
  price: Number,
  chargeType: String,
}
```

Yaxshi yo'lga qo'yilgan! Ammo qo'shilishi kerak bo'lganlar bor.

## Snapshot kerak/kerakmas qoidasi

### ✅ Snapshot kerak

| Field | Sabab |
|---|---|
| `foodName`, `foodPrice` | Narx o'zgarsa hisobotda eski qiymat |
| `categoryName` (kelajakda) | Kategoriya nomi o'zgarsa |
| `selectedTariff` | Stol tarifi o'zgarsa |
| `service.percent` snapshot order'da | Xizmat haqqi % keyin o'zgarsa |
| `discount.percent` | Chegirma o'zgarsa |
| `waiter.name`, `waiter.phone` | Xodim ketsa, ismi o'zgarsa |
| `branch.name`, `branch.address` | Filial nomi o'zgarsa |
| Ingredient narxi (sklad) | Stock harakatlanishi paytidagi xarid narxi |
| Salary rule (keldi-ketti) | Maosh formula o'zgarsa, payroll eski formula bilan |

### ❌ Snapshot kerak emas (ref yetadi)

| Field | Sabab |
|---|---|
| `food.image` | Tasvir o'zgarsa ham eski'sini ko'rsatish ham mumkin (zarur emas) |
| `food.description` | Hech kim eski tavsifni ko'rishni xohlamaydi |
| `restaurant.brand` | Brending o'zgarsa eski order'larda ham yangi brending OK |
| `user.image` (avatar) | UI qulayligi, snapshot kerak emas |

## Snapshot yangilanishi

Snapshot **immutable** — order yaratilgach o'zgartirilmaydi. Aks holda butun ma'noni yo'qotadi.

Ammo ba'zi maxsus holatlar bor:
- **Taom qo'shildi** — yangi snapshot olinadi (hozirgi narx bilan)
- **Taom qisman bekor** (`cancels` array) — snapshot saqlangan, faqat qiymat o'zgaradi
- **Order tolandi** — pay snapshot ham bor (`paymentMethod`, `mixed`, `cashback` field'lar)

## Order.foods.cancels — snapshot bilan munosabati

```javascript
foods: [{
  foodId, foodName, foodPrice, quantity: 3,
  cancels: [
    {
      status: 'dec',         // kamaytirilgan
      changeVal: 1,          // 1 ta kamayd
      changeReason: 'mijoz fikri o\'zgardi',
      changedAt: Date,
    }
  ],
}]
```

Hisobot uchun:
- Asl miqdor: 3
- Bekor qilingan: 1
- Yakuniy: 2
- Daromad: `foodPrice * 2`

**Eslatma:** `cancels` array immutable changelog. Hech qachon eski entry o'chirilmaydi.

## Order yaratilishi paytida snapshot oqimi

```javascript
async function createOrder(input) {
  // Foods snapshot
  const enrichedFoods = await Promise.all(input.foods.map(async (item) => {
    const food = await foodModel.findById(item.foodId).lean();
    return {
      foodId: food._id,
      foodName: food.name,        // SNAPSHOT
      foodPrice: food.price,      // SNAPSHOT
      quantity: item.quantity,
      cancels: [],
    };
  }));

  // Service snapshot (kelajakda field qo'shilishi kerak)
  let serviceSnapshot = null;
  if (input.serviceId) {
    const service = await serviceModel.findById(input.serviceId).lean();
    serviceSnapshot = {
      serviceId: service._id,
      percent: service.servicePercent,   // SNAPSHOT
    };
  }

  // Discount snapshot (kelajakda)
  let discountSnapshot = null;
  if (input.discountId) {
    const discount = await discountModel.findById(input.discountId).lean();
    discountSnapshot = {
      discountId: discount._id,
      percent: discount.discountPercent,
      title: discount.title,
    };
  }

  // Waiter snapshot (kelajakda)
  let waiterSnapshot = null;
  if (input.waiterId) {
    const u = await userModel.findById(input.waiterId).lean();
    waiterSnapshot = {
      waiterId: u._id,
      name: u.name,
      phone: u.phone,
    };
  }

  return orderModel.create({
    ...input,
    foods: enrichedFoods,
    service: serviceSnapshot,
    discount: discountSnapshot,
    waiter: waiterSnapshot,
  });
}
```

## Order model patch (snapshot kengaytirish)

Hozirgi modelni quyidagicha kengaytirish kerak:

```javascript
// Currently:
service: { type: ObjectId, ref: 'service' }
discount: { type: ObjectId, ref: 'discount' }
waiter: { type: ObjectId, ref: 'user' }

// Yangi:
service: {
  serviceId: { type: ObjectId, ref: 'service' },
  percent: Number,    // snapshot
}
discount: {
  discountId: { type: ObjectId, ref: 'discount' },
  title: String,       // snapshot
  percent: Number,     // snapshot
  amount: Number,      // hisoblangan
}
waiter: {
  waiterId: { type: ObjectId, ref: 'user' },
  name: String,        // snapshot
  phone: String,
}
```

Bu — keyingi versiyada migration kerak bo'ladi.

## Migration: existing data uchun

Mavjud order'larda snapshot field'lar yo'q. Migration script:

```javascript
// scripts/order-snapshot-backfill.js
const orders = orderModel.find({ 'service.percent': { $exists: false } });
for await (const order of orders) {
  if (order.service) {
    const svc = await serviceModel.findById(order.service);
    if (svc) {
      order.service = { serviceId: svc._id, percent: svc.servicePercent };
      await order.save();
    }
  }
  // ... discount, waiter
}
```

Diqqat: migration paytida hozirgi narx olinadi (eski emas). Migration after-the-fact — istisno, ideal emas. Yangi orderlar'da to'g'ri snapshot olinadi.

## Snapshot vs Read-time projection

Boshqa yondashuv: hisobot paytida order ref'lardan o'qib chiqish, lekin "olganda qaysi version" deb saqlash. Bu — event sourcing'ga yaqin.

**Bizning yo'lda:** snapshot — soddaroq. Hisobot tezroq, kod oddiyroq. Trade-off — biroz qo'shimcha disk space (lekin order kichik).

## Kelajakda

Stol tarifi murakkablashsa (vaqtga qarab o'zgaradigan):
- Hourly tariff o'zgarsa — order'da snapshot bor, lekin "haqiqiy vaqt asosida hisoblash" kerak bo'ladi
- Bu uchun `chargeType` snapshot va `selectedAt` timestamp kerak

## Test rejasi

- [ ] Order yaratildi → foodName/foodPrice yozildi
- [ ] Food narxi o'zgartirildi → eski order'da eski narx
- [ ] Yangi order yaratildi → yangi narx
- [ ] Order taom qo'shish — yangi snapshot
- [ ] Cancels — quantity dec qiladi, narx o'zgarmaydi
- [ ] Hisobot — snapshot'dan emas, ref'dan o'qimaydi (test)
- [ ] Migration script — eski order'larga snapshot qo'shadi

## Bog'liq

- [[_MOC]]
- [[order]]
- [[food]]
- [[../02-arxitektura/conflict-resolution]]
