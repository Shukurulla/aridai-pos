---
tags: [moc, biznes-mantiq]
created: 2026-05-28
---

# Biznes mantiq MOC

> Data model — struktura (entity'lar, field'lar). Biznes mantiq — qoidalar va harakatlar (lifecycle, calculation, transitions).

## Asosiy hujjatlar

### Lifecycle'lar
- [[order-lifecycle|Order lifecycle]] — created → cooking → ready → served → paid → closed
- [[shift-lifecycle|Shift lifecycle]] — open → orders → close-attempt → resolve-pending → closed

### Hisoblashlar
- [[total-hisoblash|Total hisoblash]] — subTotal, discount, service, tariff tartibi va formula

### Operatsiyalar
- [[tolov-oqimi|Tolov oqimi]] — single / split / mixed / cashback gibrid
- [[cancel-refund|Cancel va refund]] — sabab, audit, qaytarish qoidalari

## Asosiy qoidalar (bir-biriga bog'liq)

- **Shift ochilmasa order yaratib bo'lmaydi** (qarang [[shift-lifecycle]])
- **Pending tolov bor — shift yopilmaydi** (qarang [[shift-lifecycle#Shift yopish protokoli]])
- **Order yaratilganda snapshot olinadi** (qarang [[../snapshot-strategiyasi]])
- **Cancel — sabab majburiy** (qarang [[cancel-refund]])
- **Service charge discount'dan keyin** (qarang [[total-hisoblash#tartib]])
- **Mixed payment yig'indisi totalPrice'ga teng** (qarang [[tolov-oqimi]])

## Bog'liq

- [[../_MOC]]
- [[../order]]
- [[../shift]]
- [[../../02-arxitektura/3-rejim]]
