---
tags: [nozik-nuqta, delete, cascade]
created: 2026-05-29
---

# O'chirish cascade qoidalari

## Muammo

Entity o'chirilganda, unga bog'liq boshqa entity'lar nima qiladi? Yetim qolish (orphan), yo'qolish, yoki o'chirishni taqiqlash?

## Umumiy printsip

> [!important] Soft delete + bog'liqlik tekshiruvi
> 1. Hech narsa **hard delete** qilinmaydi (faqat `deleted: true`)
> 2. O'chirishdan oldin **bog'liqlik tekshiriladi**
> 3. Tarixiy ma'lumot (order'lardagi snapshot) himoyalangan

## Cascade jadval

| O'chiriladigan | Bog'liq | Qoida |
|---|---|---|
| `category` | foods | **Taqiq** agar active food bor ([[../05-data-model/category#Kategoriya o'chirilganda food'lar]]) |
| `food` | order.foods (snapshot) | Soft delete. Order'da snapshot qoladi |
| `table` | active order | **Taqiq** agar stolda active order bor |
| `user` (waiter) | order.waiter (snapshot) | Soft delete + tokenVersion++. Order'da snapshot qoladi |
| `discount` | order.discount (snapshot) | Soft delete. Order'da snapshot qoladi |
| `service` | order.service (snapshot) | Soft delete. Order'da snapshot qoladi |
| `shift` | orders | **Taqiq** — smena hech qachon o'chirilmaydi (faqat yopiladi) |
| `branch` | hammasi | **Taqiq** agar active shift/order bor. Aks holda cascade soft delete |
| `restaurant` | hammasi | **Taqiq** agar active branch bor. system_admin only |
| `ingredient` (sklad) | food.recipe, stock | **Taqiq** agar recipe'da ishlatilsa |

## Tafsilot — har biri

### category → foods
```javascript
async function deleteCategory(id, branchId) {
  const activeFoods = await foodModel.countDocuments({
    category: id, branch: branchId, deleted: { $ne: true }
  });
  if (activeFoods > 0) {
    throw new Error(`Kategoriyada ${activeFoods} ta taom bor. Avval ko'chiring yoki o'chiring.`);
  }
  await categoryModel.softDelete(id);
}
```

### food → order snapshot
Food o'chirilsa — order'lardagi `foodName`, `foodPrice` **snapshot** qoladi ([[../05-data-model/snapshot-strategiyasi]]). Order hech narsa yo'qotmaydi.

```javascript
async function deleteFood(id) {
  // Order'larda snapshot bor — xavfsiz soft delete
  await foodModel.softDelete(id);
  // recipe ham qoladi (sklad), lekin food deleted bo'lgani uchun ko'rinmaydi
}
```

### table → active order
```javascript
async function deleteTable(id) {
  const activeOrder = await orderModel.findOne({
    table: id,
    paymentStatus: { $in: ['pending', 'partiallyPaid'] },
    isCancel: false,
  });
  if (activeOrder) {
    throw new Error('Stolda ochiq order bor. Avval yoping.');
  }
  await tableModel.softDelete(id);
}
```

### user (waiter) o'chirish
```javascript
async function deleteUser(id) {
  // Order'da waiter snapshot bor — tarixiy ma'lumot xavfsiz
  await userModel.softDelete(id);
  await userModel.updateOne({ _id: id }, { $inc: { tokenVersion: 1 } }); // logout
  // Active order'lari boshqa waiter'ga o'tkazilmaydi (snapshot qoladi)
  // Lekin ogohlantirish: bu waiter'da pending order bormi
  const pending = await orderModel.countDocuments({
    'waiter.waiterId': id,
    paymentStatus: { $ne: 'paid' },
    isCancel: false,
  });
  if (pending > 0) {
    return { warning: `Bu xodimda ${pending} ta ochiq order bor` };
  }
}
```

### shift — hech qachon o'chirilmaydi
Smena moliyaviy hujjat. Faqat yopiladi, hech qachon o'chirilmaydi. `deleteShift` endpoint **yo'q**.

### branch o'chirish
```javascript
async function deleteBranch(id) {
  const activeShift = await shiftModel.findOne({ branch: id, isActive: true });
  if (activeShift) throw new Error('Filialda faol smena bor');

  const pendingOrders = await orderModel.countDocuments({
    branch: id, paymentStatus: { $in: ['pending', 'partiallyPaid'] }, isCancel: false
  });
  if (pendingOrders > 0) throw new Error('Filialda tolanmagan orderlar bor');

  // Cascade soft delete
  await branchModel.softDelete(id);
  await branchModel.updateOne({ _id: id }, { tokenRevoked: true }); // lokal backend uziladi
  // foods, categories, tables, users — soft delete (cascade)
  // orders, shifts — qoladi (tarixiy)
}
```

### restaurant o'chirish (system_admin only)
```javascript
async function deleteRestaurant(id, systemAdmin) {
  if (systemAdmin.role !== 'system_admin') throw new Error('Faqat tizim admini');

  const activeBranches = await branchModel.countDocuments({ restaurant: id, deleted: { $ne: true } });
  if (activeBranches > 0) {
    throw new Error('Restoranda faol filiallar bor. Avval ularni o\'chiring.');
  }

  await restaurantModel.softDelete(id);
  // 90 kun keyin hard delete (GDPR) — alohida cron
}
```

### ingredient (sklad) o'chirish
```javascript
async function deleteIngredient(id) {
  const usedInRecipes = await foodModel.countDocuments({
    'recipe.ingredientId': id, deleted: { $ne: true }
  });
  if (usedInRecipes > 0) {
    throw new Error(`Ingredient ${usedInRecipes} ta taom retseptida ishlatilmoqda`);
  }
  await ingredientModel.softDelete(id);
}
```

## Soft delete + 1 oylik tiklash (qaror 2026-05-29)

> [!important] Oddiy va yagona qoida
> Foydalanuvchi: *"kimdir taomlarni ochirib tashlasa yoki skladdagi narsalarni delete button orqali ochirsa... documentdan ochirilmasligi kerak. shunchaki statusi isDeleted true bolishi kerak. 1 oy saqlanib turishi kerak qayta tiklash uchun. hech qayerda chiqib qolmasligi kerak. 1 oydan song tiklanmasa ochirilib yuborishi kerak."*

**Qoida (har qanday o'chirish amaliga):**
1. `findByIdAndDelete`, `deleteOne` kabi Mongo o'chirish metodlari **ISHLATILMAYDI**
2. O'rniga → `isDeleted: true`
3. **1 oy** saqlanadi (tiklash uchun)
4. **Hamma joydan yashirin** (query'lar `isDeleted: { $ne: true }`)
5. 1 oydan keyin tiklanmasa → **fizik o'chiriladi** (cleanup cron)

```javascript
// YOMON — hech qachon (document'dan o'chadi)
await categoryModel.findByIdAndDelete(id);

// YAXSHI — soft delete
await categoryModel.updateOne({ _id: id },
  { isDeleted: true, deletedAt: new Date(), deletedBy: actor._id });

// Cleanup cron (har kuni) — 1 oydan eski, tiklanmaganlar fizik o'chadi
const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
await Model.deleteMany({ isDeleted: true, deletedAt: { $lt: cutoff } });
```

**Qaerda ishlatiladi:** delete tugmasi bo'lgan hamma joy — taom, kategoriya, stol, xodim, chegirma, sklad mahsuloti (ingredient) va h.k.

**Tiklash (1 oy ichida):**
```javascript
async function restore(model, id) {
  await model.updateOne({ _id: id }, { isDeleted: false, restoredAt: new Date() });
}
```
Admin panelda "O'chirilganlar" ro'yxati → "Tiklash" tugmasi.

> [!note] Order'lar bu qoidaga kirmaydi
> Order/smena **"o'chirilmaydi"** — ular **bekor qilinadi** (isCancel) yoki **arxivlanadi**, delete tugmasi yo'q. Demak bu soft-delete qoidasi asosan **katalog/menyu/sklad** uchun. (Order retention alohida — [[../09-deployment/backup-pitr]], archive.)

> [!note] Field nomi: `isDeleted`
> Canonical nom = **`isDeleted`** (foydalanuvchi xohlagan). Eski docs'da `deleted` — bir xil semantika; kodda `isDeleted`.

### GDPR "right to be forgotten" → anonimizatsiya (hard delete emas)

Mijoz "ma'lumotimni o'chiring" desa:
```javascript
// Hard delete EMAS — anonimizatsiya
async function anonymizeCustomer(restaurantId, phone) {
  // Customer: shaxsiy maydonlar olib tashlanadi
  await customerModel.updateOne(
    { restaurantId, phone },
    { phone: `ANON-${hash(phone)}`, name: null, anonymized: true, anonymizedAt: new Date() }
  );
  // Order tarixi QOLADI (moliyaviy), lekin telefon anonim
  await orderModel.updateMany(
    { restaurantId, 'cashback.clientPhone': phone },
    { 'cashback.clientPhone': `ANON-${hash(phone)}` }
  );
}
```

- Shaxsiy ma'lumot (telefon, ism) → anonim

### GDPR "right to be forgotten" → anonimizatsiya (hard delete emas)

Mijoz "ma'lumotimni o'chiring" desa:
```javascript
// Hard delete EMAS — anonimizatsiya
async function anonymizeCustomer(restaurantId, phone) {
  // Customer: shaxsiy maydonlar olib tashlanadi
  await customerModel.updateOne(
    { restaurantId, phone },
    { phone: `ANON-${hash(phone)}`, name: null, anonymized: true, anonymizedAt: new Date() }
  );
  // Order tarixi QOLADI (moliyaviy), lekin telefon anonim
  await orderModel.updateMany(
    { restaurantId, 'cashback.clientPhone': phone },
    { 'cashback.clientPhone': `ANON-${hash(phone)}` }
  );
}
```

- Shaxsiy ma'lumot (telefon, ism) → anonim
- Moliyaviy yozuv (order, tolov) → **qoladi** (anonim holda)
- Yozuv fizik o'chirilmaydi

> [!warning] Order moliyaviy hujjat
> Order hech qachon o'chirilmaydi (fiskal yoqilsa 5 yil — [[fiskal-soliq]]). Faqat anonimizatsiya (telefon olib tashlanadi).

## Sync bilan munosabati

Soft delete — tombstone (qarang [[../05-data-model/sync-metadata#Tombstone]]). `deleted: true` ham sync bo'ladi, aks holda global qaytadan "bor" deb push qiladi.

## Test rejasi

- [ ] Category active food bilan — o'chirish taqiq
- [ ] Food o'chirildi — order snapshot qoladi
- [ ] Table active order bilan — taqiq
- [ ] User o'chirildi — tokenVersion++, snapshot qoladi
- [ ] Shift delete endpoint yo'q
- [ ] Branch active shift bilan — taqiq
- [ ] Restaurant active branch bilan — taqiq
- [ ] Ingredient recipe'da — taqiq
- [ ] Soft delete tombstone sync

## Bog'liq

- [[../05-data-model/snapshot-strategiyasi]]
- [[../05-data-model/sync-metadata]]
- [[fiskal-soliq]]
- [[../05-data-model/category]]
