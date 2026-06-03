---
tags: [nozik-nuqta, stol, order]
created: 2026-05-29
---

# Stol birlashtirish va bo'lish

## 1. Stol birlashtirish (merge)

Katta kompaniya keldi — 2-3 stol birga.

### Yondashuv: asosiy stol + bog'langan stollar

```javascript
// Order asosiy stolga, qo'shimcha stollar belgilanadi
order.table: mainTableId,
order.linkedTables: [tableId2, tableId3],
```

- Bitta order, bir nechta stol
- Asosiy stolda hisob
- Qo'shimcha stollar "band" ko'rinadi (shu order bilan)
- Bitta chek

### UI
```
[Stol 5] + [Stol 6 qo'shish] → birlashgan
"Stol 5+6 (8 kishi)"
```

## 2. Stol bo'lish (split)

Bitta stolda alohida hisoblar (har kishi/guruh alohida tolaydi).

> [!note] Bu — [[split-bill-order-tahrir]] bilan bog'liq
> "Split bill" (hisobni bo'lish) — tolov darajasida ([[split-bill-order-tahrir]]). "Stol bo'lish" — order darajasida (taomlarni guruhlash).

### Default: split payment (oddiy)
Bitta order, bir nechta tolov (`paidAmounts[]`) — [[split-bill-order-tahrir]]. MVP uchun yetarli.

### To'liq order bo'lish (kelajak)
Bitta order → bir nechta alohida order (har biri alohida chek):
- Taomlar guruhlanadi (1-guruh, 2-guruh)
- Har guruh → alohida order (`parentOrderId` bilan bog'langan)
- Har biri alohida chek raqami ([[chek-raqamlash]])
- Murakkab — **kelajak feature**

## Stol holati (band/bo'sh) — birlashtirilgan

Stol holati derived ([[../05-data-model/table]]):
```javascript
async function tableStatus(tableId) {
  // To'g'ridan-to'g'ri yoki linkedTables orqali band bo'lishi mumkin
  const order = await orderModel.findOne({
    $or: [{ table: tableId }, { linkedTables: tableId }],
    paymentStatus: { $in: ['pending', 'partiallyPaid'] },
    isCancel: false,
  });
  return order ? 'occupied' : 'free';
}
```

## Concurrency

Stol birlashtirish/bo'lish — atomik bo'lishi kerak ([[concurrency-race]]):
- Ikki kassir bir vaqtda stolni band qilmasligi
- Birlashtirilayotgan stol allaqachon band bo'lsa — taqiq

## Schema qo'shimcha

```javascript
order.linkedTables: [{ type: ObjectId, ref: 'table' }],
```

## Tarif bilan munosabati

Agar stollarda tarif bo'lsa (billiard) — birlashtirilganda har stol o'z tarifini hisoblaydimi yoki bittasi? 
- Default: asosiy stol tarifi
- Yoki har stol alohida (murakkab)
- **Kelajak** — hozircha asosiy stol

## Test rejasi

- [ ] Stol birlashtirish (asosiy + linked)
- [ ] Birlashgan stol holati (ikkalasi band)
- [ ] Band stolni birlashtirib bo'lmaydi
- [ ] Split payment (paidAmounts) — MVP
- [ ] To'liq order bo'lish — kelajak
- [ ] Concurrency (parallel band)

## Bog'liq

- [[split-bill-order-tahrir]]
- [[../05-data-model/table]]
- [[../05-data-model/order]]
- [[concurrency-race]]
