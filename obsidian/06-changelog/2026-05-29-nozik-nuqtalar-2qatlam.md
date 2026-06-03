---
tags: [changelog, nozik-nuqtalar, qaror]
date: 2026-05-29
type: edge-cases + decisions
---

# 2026-05-29 — Nozik nuqtalar 2-qatlam + 4 qaror

## Sabab

Foydalanuvchi "keyingi nozik nuqtalarga ot" dedi. Birinchi 13 talikka kirmagan 2-qatlam edge case'lar topildi, 4 ta biznes qaror olindi.

## Foydalanuvchi qarorlari

| Mavzu | Qaror |
|---|---|
| **Taom variantlari (modifiers)** | Keyinroq, toggle sifatida. Schema room. MVP'da yo'q |
| **Naqd** | Kupyura tugmalari (KZT: 1000-20000, UZS: 5000-200000) + qaytim hisobi. **Hisob yaxlitlash YO'Q** (narxlar toza raqamlarda, 21323 kabi summa bo'lmaydi) — aniqlashtirildi 2026-05-29 |
| **Manual chegirma** | YO'Q. Admin yaratadi, kassir order ustida **toggle** bilan yoqadi/o'chiradi |
| **Open price / kg narx** | YO'Q. Har taom fixed narx |

## Yangi fayllar (5 ta) — `07-nozik-nuqtalar/`

- [[../07-nozik-nuqtalar/naqd-tolov-qaytim|naqd-tolov-qaytim.md]] — kupyura tugmalari (davlat bo'yicha), qaytim hisoblash, cash rounding config
- [[../07-nozik-nuqtalar/chegirma-service-qollanishi|chegirma-service-qollanishi.md]] — predefined toggle, stacking (default bitta), service waive
- [[../07-nozik-nuqtalar/order-operatsion-edge|order-operatsion-edge.md]] — void vs cancel, izoh/allergiya, guest count, reprint, smena handover, 24h smena, renderer↔backend, PIN
- [[../07-nozik-nuqtalar/stol-birlashtirish-bolish|stol-birlashtirish-bolish.md]] — stol merge/split
- [[../07-nozik-nuqtalar/tool-edge-caselar|tool-edge-caselar.md]] — sklad (manfiy stock, unit, semi-finished, waste), keldi-ketti (tungi smena, geo, multi-role), qr-order (band stol), qr-pay (webhook race, partial, refund, orphan)

## Yangilangan

- [[../07-nozik-nuqtalar/_MOC|07-nozik-nuqtalar/_MOC]] — yangi seksiyalar
- [[../00-INDEX|00-INDEX]] — 5 yangi link
- [[../05-data-model/discount|discount.md]] — toggle qaror callout
- [[../04-toollar/_MOC|04-toollar/_MOC]] — modifiers kelajak toggle, tipping+multi-currency rad etildi

## Asosiy hujjatlangan qarorlar (default, revisable)

- **Void vs Cancel:** oshxona boshlamasdan = void, boshlagandan = cancel. `order.cancelType`
- **Chegirma stacking:** default bitta order = bitta chegirma (yangi yoqilsa eski o'chadi)
- **Cash rounding:** config `cashRoundingUnit` (UZ: 100, KZ: 50/100), faqat naqd, karta/Kaspi aniq
- **Smena handover:** kassir almashadi smena yopmasdan, kassa sanaladi, `shift.handovers[]`
- **PIN:** umumiy POS'da tezkor xodim almashish (faqat lokal)
- **Stol merge:** asosiy + `linkedTables[]`. Split — payment-level (MVP), full split kelajak
- **Sklad manfiy stock:** order bloklanmaydi (default), config bilan
- **Semi-finished/combo:** kelajak (MVP 1-daraja retsept)

## Schema qo'shimchalar (kelajak implementatsiya uchun)

```javascript
order.cancelType: 'void' | 'cancel',
order.note, order.foods[i].note,
order.foods[i].course (reserved),
order.guestCount, order.printCount,
order.linkedTables[],
order.cashPayment: { givenAmount, changeAmount },   // yaxlitlash field'lari YO'Q
order.service.waived, waivedBy, waiveReason,
shift.handovers[],
user.pin (hash),
restaurant.config.allowDiscountStacking,
```

## Aniqlashtirildi (2026-05-29)

- **Naqd yaxlitlash:** ❌ YO'Q. Foydalanuvchi tasdiqladi — hisob summasi yaxlitlanmaydi (43287→43300 emas). Sabab: menyu narxlari har doim toza raqamlarda (eng kam 300 tenge / 5000 som), 21323 kabi summa hech qachon paydo bo'lmaydi. `cashRounding` config olib tashlandi. Total har doim aniq. Kupyura tugmalari va qaytim hisobi qoladi.

## Statistika

- Bu sessiyada: 5 yangi fayl + 4 yangilangan + 1 changelog
- 07-nozik-nuqtalar endi: 18 fayl (13 + 5)
- Vault'da jami: ~115 fayl

## Bog'liq

- [[2026-05-29-nozik-nuqtalar]]
- [[2026-05-29-keshbek-offline-qaror]]
- [[../07-nozik-nuqtalar/_MOC]]
