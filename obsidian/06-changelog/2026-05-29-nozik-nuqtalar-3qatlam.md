---
tags: [changelog, nozik-nuqtalar, qaror]
date: 2026-05-29
type: edge-cases + decisions
---

# 2026-05-29 — Nozik nuqtalar 3-qatlam + 4 qaror

## Foydalanuvchi qarorlari

| Mavzu | Qaror |
|---|---|
| **Pre-bill (hisob)** | Ha — hisob → tolov → final chek (dine-in oqimi) |
| **Stop-list** | Real-time, 2 mexanizm: (1) manual, (2) **limit-based avto** (somsa 1000 ta → limitga yetganda avto stop-list) |
| **Mijoz** | WhatsApp telefonidan customer entity — tarix, keshbek, tolovlar ko'rsatiladi |
| **Menyu** | Har filial **mustaqil** + JSON export/import orqali nusxalash |

## Yangi fayllar (5 ta)

### 07-nozik-nuqtalar/ (4 ta)
- [[../07-nozik-nuqtalar/stop-list-limit|stop-list-limit.md]] ⭐ — manual stop + limit-based avto counter, void/cancel munosabati, biznes-kun reset, per-branch offline
- [[../07-nozik-nuqtalar/pre-bill-chek-print|pre-bill-chek-print.md]] — oshxona cheki / pre-bill (hisob) / final chek, formatlar, modification reprint
- [[../07-nozik-nuqtalar/menyu-export-import|menyu-export-import.md]] — JSON export/import, konflikt strategiyasi, currency mismatch
- [[../07-nozik-nuqtalar/versiya-empty-state|versiya-empty-state.md]] — schema versiya mosligi, token expiry, chek raqami bo'shliqlari, empty state

### 05-data-model/ (1 ta)
- [[../05-data-model/customer|customer.md]] — mijoz entity (restaurantId+phone, stats, history, WhatsApp source)

## Yangilangan

- [[../05-data-model/food|food.md]] — `availability` subdoc (stop-list, dailyLimit, soldToday), per-branch mustaqil + export/import note, stop index
- [[../04-toollar/keshbek-tizimi|keshbek-tizimi.md]] — customer entity bog'lanishi
- [[../05-data-model/_MOC]], [[../07-nozik-nuqtalar/_MOC]], [[../00-INDEX]] — yangi linklar

## Asosiy dizayn nuqtalari

### Stop-list (eng muhim)
- **Manual:** `food.availability.stopped` — cook/cashier/admin darhol
- **Limit:** `dailyLimit` qo'yiladi → `soldToday` counter (limitSetAt'dan) → limitga yetganda avto stop
- Real-time broadcast `food.availability_changed`
- Void → counter qaytadi; Cancel → qaytmaydi
- Biznes-kun boshi reset (auto-stop ochiladi, manual qoladi)
- **Per-branch** (har filial o'z somsasi), offline'da lokal counter
- **Core funksiya** (toggle emas), sklad'dan alohida

### Pre-bill oqimi
- Oshxona cheki (narxsiz, cook) → pre-bill (HISOB, receiptNumber'siz) → final chek (CHEK + receiptNumber, qaytim)
- 3 xil bosma hujjat aniq farqlangan

### Customer entity
- `(restaurantId, phone)` unique, WhatsApp telefonidan
- Stats: totalOrders, totalSpent, visitCount
- cashback_balance bilan telefon orqali bog'lanadi
- Order paid → stats yangilanadi
- Multi-tenant, GDPR

### Menyu export/import
- Har filial mustaqil menyu
- JSON export (ID'larsiz, categoryTitle bilan) → import (yangi ID)
- Konflikt: skip default
- Faqat o'z restorani filiallariga (RBAC)

## Schema qo'shimchalar

```javascript
food.availability: { stopped, stoppedAt, stoppedBy, stopReason, dailyLimit, soldToday, limitSetAt, autoStoppedByLimit },
order.prebillPrintedAt, prebillPrintCount,
customer: { restaurantId, phone, name, source, stats{...}, addresses[], marketingOptIn },
```

## Statistika

- Bu sessiyada: 5 yangi fayl + 4 yangilangan + 1 changelog
- 07-nozik-nuqtalar: 22 fayl (13+5+4)
- 05-data-model: yangi customer entity (11 core)
- Vault jami: ~120 fayl

## Bog'liq

- [[2026-05-29-nozik-nuqtalar-2qatlam]]
- [[../07-nozik-nuqtalar/stop-list-limit]]
- [[../05-data-model/customer]]
