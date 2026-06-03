---
tags: [nozik-nuqta, fiskal, soliq, kelajak]
created: 2026-05-29
---

# Fiskal va soliq (KKM)

> [!important] Qaror (foydalanuvchi tasdiqlagan, 2026-05-29)
> Fiskal/KKM **hozircha kerak emas**. Lekin schema'da kelajak uchun **joy qoldiriladi** — keyin qo'shilganda migration oson bo'lsin.

## Kontekst — nima uchun muhim

O'zbekiston va Qozog'iston'da rasmiy biznes uchun **onlayn kassa (KKM/ККМ)** majburiy bo'lishi mumkin:
- **Qozog'iston:** ОФД (Оператор фискальных данных) orqali har chek davlatga real-time yuboriladi
- **O'zbekiston:** Soliq qo'mitasi onlayn-kassa (онлайн-ККМ), har chek fiskal belgisi bilan

Bu — jiddiy huquqiy talab. Lekin MVP'da yo'q.

## Hozircha qilinadigan ish: schema room

Order modelida **reserved** (ishlatilmaydigan lekin joy band qilingan) subdoc:

```javascript
// order.model.js — kelajak uchun reserved
fiscal: {
  enabled: { type: Boolean, default: false },  // bu order fiskal qilinganmi
  fiscalNumber: String,        // davlat bergan fiskal raqam
  fiscalSign: String,          // fiskal belgi (FP)
  ofdProvider: String,         // OFD operatori nomi
  ofdSentAt: Date,             // davlatga yuborilgan vaqt
  ofdStatus: {                  // 'pending' | 'sent' | 'confirmed' | 'failed'
    type: String,
    default: null,
  },
  qqs: {                        // QQS/VAT (kelajak)
    rate: Number,               // 12% UZ, 12% KZ
    amount: Number,
  },
  raw: Object,                  // OFD javobining to'liq nusxasi
},
```

Bu — `default: null/false`, hozir ishlatilmaydi, lekin keyin qo'shilganda **migration kerak emas** (field allaqachon bor).

## QQS (VAT) — hozircha yo'q

- O'zbekiston QQS: 12%
- Qozog'iston ҚҚС (VAT): 12%

Hozircha hisoblanmaydi. Kelajakda fiskal bilan birga keladi. `fiscal.qqs` reserved.

## Feature toggle sifatida (kelajak)

Fiskal qo'shilganda — yangi tool:
```javascript
features.fiskal: {
  enabled: false,
  config: {
    country: 'KZ',           // KZ | UZ
    ofdProvider: '...',      // qaysi OFD operatori
    kkmSerial: '...',        // KKM apparat seriyasi
    qqsRate: 12,
    taxRegime: '...',        // soliq rejimi
  }
}
```

Bu [[../04-toollar/_MOC|tool ro'yxatiga]] kelajak g'oyasi sifatida qo'shildi.

## Chek bilan munosabati

Fiskal yoqilsa:
- Bizning `receiptNumber` ([[chek-raqamlash]]) — **ichki** raqam, qoladi
- Fiskal raqam — **davlat** beradi, alohida
- Chek'da ikkalasi ham chiqadi
- Chek'ga fiskal QR (davlat tekshirishi uchun)

## Data retention fiskal bilan

Fiskal qo'shilsa — orderlar **5+ yil** saqlanishi shart (huquqiy). Bu [[data-osishi-arxivlash]] arxivlash strategiyasiga ta'sir qiladi:
- Hozircha: 1 yildan eski lokal'dan arxivga
- Fiskal bo'lsa: hech narsa o'chirilmaydi 5 yilgacha

## Offline fiskal — murakkab

Fiskal real-time davlatga yuborishni talab qiladi. Offline'da bu mumkin emas:
- Ba'zi OFD'lar offline buffer ruxsat beradi (KKM apparatda saqlanadi, internet kelganda yuboriladi)
- Bu — KKM apparat darajasidagi masala, bizning emas
- Kelajakda hal qilinadi

## Hozirgi MVP'da nima qilamiz

1. `order.fiscal` subdoc — reserved, `enabled: false`
2. `restaurant.currency` bor (valyuta) — fiskal uchun zarur
3. Chek formatida fiskal joy uchun bo'sh (kelajakda to'ldiriladi)
4. Data retention — hozircha 1 yil, fiskal kelsa o'zgaradi
5. **Hech qanday fiskal logika yozilmaydi** — faqat schema room

## Test rejasi (hozircha minimal)

- [ ] order.fiscal subdoc mavjud, default null/false
- [ ] Fiskal logika YO'Q (faqat reserved)
- [ ] Chek formatida fiskal uchun joy

## Bog'liq

- [[chek-raqamlash]]
- [[pul-valyuta-yaxlitlash]]
- [[data-osishi-arxivlash]]
- [[../05-data-model/order]]
- [[../04-toollar/_MOC]]
