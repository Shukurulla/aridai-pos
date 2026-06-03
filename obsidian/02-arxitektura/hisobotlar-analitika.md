---
tags: [arxitektura, hisobot, analitika]
created: 2026-05-29
---

# Hisobotlar va analitika

## Maqsad

Restoran egasi va admin uchun ma'lumotdan xulosa. Sotuvlar, xodimlar, taomlar, smenalar.

## Hisobot turlari

### Smena hisoboti (eng muhim)
Smena yopilganda ([[../05-data-model/biznes-mantiq/shift-lifecycle]]):
- Ochilish/yopilish vaqti, kim
- Jami daromad (cash/card/kaspi/transfer breakdown)
- Order soni, bekor qilinganlar
- Discount/service jami
- Kassa farqi (discrepancy)
- Print/PDF

### Kunlik hisobot
- Filial bo'yicha kunlik daromad
- Smenalar yig'indisi
- Eng ko'p sotilgan taomlar
- Soatlik yuklamadagi grafik

### Haftalik/Oylik
- Trend (o'sish/pasayish)
- Filiallar taqqoslash (restoran egasi)
- Kategoriya bo'yicha sotuv
- O'rtacha chek summasi

### Xodim hisoboti (keldi-ketti bilan)
- Davomat ([[../04-toollar/keldi-ketti]])
- Waiter sotuvlari, service haqqi
- Maosh hisoblash

### Sklad hisoboti (sklad bilan)
- Stock harakati ([[../04-toollar/sklad]])
- Past balans
- Sarflanish (consumption)

## Texnik yondashuv

### MongoDB aggregation
Hisobotlar — aggregation pipeline:

```javascript
// Kunlik daromad
db.orders.aggregate([
  { $match: { restaurantId, branch, createdAt: {$gte: dayStart, $lt: dayEnd}, paymentStatus: 'paid', isCancel: false } },
  { $group: {
      _id: '$paymentMethod',
      total: { $sum: '$totalPrice' },
      count: { $sum: 1 }
  }}
]);
```

> [!important] Tenant guard aggregate'da
> Aggregate ham tenant filter shart ([[xavfsizlik/tenant-izolyatsiyasi#Aggregation pipeline ham xavfsiz]]). `$match` birinchi bosqichda `restaurantId`.

### Pre-aggregation (kelajak — performance)
Katta data'da real-time aggregate sekin. Yechim:
- Smena yopilganda `shift.totals` saqlanadi (allaqachon)
- Kunlik snapshot collection (`daily_stats`)
- Hisobot snapshot'lardan o'qiydi (tez)

## Hisobot qayerda ko'rinadi

| Joy | Hisobot |
|---|---|
| POS | Smena hisoboti (yopishda), kunlik |
| Web admin | Barchasi, grafiklar, eksport |
| Mobile (admin) | Tezkor kunlik ko'rsatkichlar |

## Eksport

- PDF (chek, smena hisoboti)
- Excel/CSV (ma'lumot tahlili)
- Print

## Eski data (1 yildan eski)

Hot data 1 yil, eski — archive ([[../07-nozik-nuqtalar/data-osishi-arxivlash]]). Eski hisobot archive'dan (sekinroq).

## Multi-tenant

- `owner` — barcha filiallar
- `branch_admin` — faqat o'z filiali
- `system_admin` — global (barcha restoranlar — biznes metrikalar)

## Real-time dashboard

Web admin bosh sahifa:
- Bugungi daromad (live)
- Faol orderlar
- Filiallar holati (online/offline)
- Soatlik grafik

Socket orqali yangilanadi.

## Phase bo'yicha

- **Phase 1:** smena hisoboti, kunlik (oddiy)
- **Phase 2:** + sync-aware (offline data)
- **Phase 3:** + tool hisobotlari (sklad, keldi-ketti)
- **Phase 4:** advanced analytics, pre-aggregation, trends, eksport

## Feature sifatida (kelajak)

Advanced analytics — alohida toggle bo'lishi mumkin (`analytics`). Oddiy hisobotlar — har doim bor.

## Bog'liq

- [[../05-data-model/biznes-mantiq/shift-lifecycle]]
- [[xavfsizlik/tenant-izolyatsiyasi]]
- [[../07-nozik-nuqtalar/data-osishi-arxivlash]]
- [[../04-toollar/keldi-ketti]]
- [[../04-toollar/sklad]]
