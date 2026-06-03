---
tags: [nozik-nuqta, order]
created: 2026-05-29
---

# Split bill va order tahrir

## Muammo 1: Split bill (hisobni bo'lish)

Bitta stolda 4 kishi ovqatlandi, har biri o'zinikini alohida tolaydi.

### Variantlar

**Variant A: Bitta order, bir nechta tolov (split payment)**
- Order bitta, lekin tolov bo'lib-bo'lib
- `paidAmounts[]` array (qarang [[../05-data-model/biznes-mantiq/tolov-oqimi#Partial payment]])
- Har tolov: kim, qancha, qanday
- Order `paid` bo'ladi total yetganda

**Variant B: Order'ni bo'lish (split into sub-orders)**
- Bitta order → bir nechta alohida order
- Har biri alohida chek
- Murakkabroq

### Qaror

> [!note] Hozircha Variant A (split payment), Variant B kelajak
> MVP'da — bitta order, bir nechta tolov (`paidAmounts[]`). To'liq bo'lish (har kishi alohida chek) — kelajak feature.

```javascript
// Split payment
order.paidAmounts = [
  { amount: 30000, method: 'cash', paidBy: cashier, payerNote: '1-mijoz', paidAt },
  { amount: 25000, method: 'kaspi', paidBy: cashier, payerNote: '2-mijoz', paidAt },
];
// Total yetganda paymentStatus = 'paid'
```

UI: "Bo'lib tolash" → har tolov alohida kiritiladi.

### To'liq split (Variant B — kelajak)
Agar kerak bo'lsa — feature toggle. Bitta order tanlanadi → "Bo'lish" → taomlar 2-3 guruhga ajratiladi → har biri alohida order + chek. Murakkab, kelajak.

## Muammo 2: Tolovdan keyin taom qo'shish

Mijoz tolagandan keyin "yana bitta choy" dedi.

### Qaror

> [!important] Tolangan order — immutable (qulflanadi)
> Tolangan order o'zgartirilmaydi. Yangi taom = **yangi order** (bog'langan).

```javascript
// Yangi linked order
{
  ...,
  parentOrderId: originalOrder._id,   // bog'lanish
  table: sameTable,
  foods: [newItems],
}
```

`parentOrderId` — order'lar bog'langan. Hisobotda "Stol 5 — 2 ta order" deb ko'rinadi.

Sabab: tolangan order moliyaviy hujjat, o'zgartirsa — chek va hisobot buziladi.

### order.model.js patch
```javascript
parentOrderId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'order',
  default: null,
}
```

## Muammo 3: Order'ni boshqa stolga ko'chirish

Mijozlar boshqa stolga o'tdi.

### Qaror
- Order `table` field o'zgartiriladi (oddiy update)
- `version++`, audit log
- Tolanmagan order'da ruxsat etiladi

```javascript
async function moveOrderToTable(orderId, newTableId, actor) {
  const order = await orderModel.findOne({ _id: orderId, paymentStatus: { $ne: 'paid' }, isCancel: false });
  if (!order) throw new Error('Order topilmadi yoki tolangan');

  const newTableBusy = await orderModel.findOne({
    table: newTableId, paymentStatus: { $in: ['pending', 'partiallyPaid'] }, isCancel: false
  });
  if (newTableBusy) throw new Error('Yangi stol band');

  order.table = newTableId;
  await order.save();
  await audit.log({ kind: 'order_moved', data: { orderId, newTableId } });
}
```

## Muammo 4: Order'ni boshqa waiter'ga o'tkazish

Waiter smena tugatdi, order'lari boshqa waiter'ga.

### Qaror
- `order.waiter` snapshot o'zgartiriladi (yangi waiter)
- Yoki: eski waiter snapshot qoladi, lekin "joriy mas'ul" alohida
- Hozircha: oddiy — waiter snapshot yangilanadi tolanmagan order'da

> [!note] Waiter foiz haqqi
> Agar waiter o'tkazilsa, [[../04-toollar/keldi-ketti]] foiz haqqi kimga? Qaror: order yopilganda (tolanганda) kim waiter bo'lsa, o'shanga. Yoki bo'lingan. Bu — keldi-ketti tool detali.

## Muammo 5: Bo'sh order (taomsiz)

Order yaratildi, lekin hali taom qo'shilmagan (waiter "ochaman keyin qo'shaman").

### Qaror
- Schema: `foods` array bo'sh bo'lsa validation fail (`min 1`)
- **Yechim:** "Draft" holat — UI'da, bazaga yozilmaydi
- Faqat kamida 1 taom bo'lganda order yaratiladi
- Yoki: stol "band" qilish alohida (order'siz) — kelajak

## Test rejasi

- [ ] Split payment (paidAmounts)
- [ ] Total yetganda paid
- [ ] Tolangan order immutable
- [ ] Yangi taom → linked order (parentOrderId)
- [ ] Order boshqa stolga ko'chirish
- [ ] Yangi stol band bo'lsa — taqiq
- [ ] Order boshqa waiter'ga
- [ ] Bo'sh order — validation fail

## Bog'liq

- [[../05-data-model/order]]
- [[../05-data-model/biznes-mantiq/tolov-oqimi]]
- [[../05-data-model/biznes-mantiq/order-lifecycle]]
- [[../04-toollar/keldi-ketti]]
