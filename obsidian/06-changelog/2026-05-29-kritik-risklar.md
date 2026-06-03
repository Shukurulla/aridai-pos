---
tags: [changelog, risk, xavfsizlik, qaror]
date: 2026-05-29
type: risk-review + decisions
---

# 2026-05-29 — Kritik risklar tahlili + firibgarlik nazorati

## Sabab

Foydalanuvchi "yanada kritik havflarni korib chiqamiz" dedi. Edge-case'dan farqli — biznesni o'ldira oladigan kritik xavflar ko'rib chiqildi va risk reestri yaratildi.

## Foydalanuvchi qarorlari (firibgarlik nazorati)

| Nazorat | Qaror |
|---|---|
| **Void/Cancel** | Kitchen boshlamagan → cashier; kitchen boshlangan YOKI katta summa → **manager PIN** |
| **Item o'zgartirish** | Mumkin (3 plov→2), kitchen boshlangan kamaytirish → manager PIN, **oshxonaga delta check** (stol, order#, taom +/−) |
| **Anomaliya monitoring** | Faqat **hisobotda** (real-time alert emas) |
| **Staff meal** | Hozircha yo'q |
| **Cash drawer no-sale** | OCHIQ — tushuntirildi, foydalanuvchi keyin javob beradi (hozircha log default) |

## Yangi fayllar (2 ta)

- [[../02-arxitektura/xavfsizlik/kritik-risklar|kritik-risklar.md]] — risk reestri: 5 katastrofik (K1-K5), 6 jiddiy (J1-J6), muhim risklar, payment durability, gaplar
- [[../02-arxitektura/xavfsizlik/firibgarlik-nazorati|firibgarlik-nazorati.md]] — manager PIN, void/cancel/item nazorati, kitchen delta, anomaliya hisoboti, audit

## Yangilangan

- [[../07-nozik-nuqtalar/pre-bill-chek-print|pre-bill-chek-print.md]] — "Item o'zgarish → oshxona delta" (kamaytirish/oshirish, +/−, manager PIN)
- [[../02-arxitektura/socket-sinxronizatsiya|socket-sinxronizatsiya.md]] — "Reconnect storm himoyasi" (backoff + jitter, J3)
- [[../02-arxitektura/xavfsizlik/_MOC]], [[../00-INDEX]] — yangi linklar

## Aniqlangan 3 ta bo'shliq va yechimi

1. **J1 Xodim firibgarligi** — ✅ dizayn qilindi (manager PIN, anomaliya hisobot, audit)
2. **J3 Reconnect storm** — ✅ backoff + jitter, server rate limit, navbatli initial sync
3. **K2/K4 kuchaytirish** — ✅ webhook HMAC majburiy + payment durability (atomic write+outbox transaction)

## Risk reestri xulosa

**🔴 Katastrofik (5):** cross-tenant leak ✅, webhook spoofing ⚠️→kuchaytirildi, secret leak ✅, pul yo'qolishi ⚠️→durability, sync split-brain ✅

**🟠 Jiddiy (6):** xodim fraud ✅yangi, double revenue ✅, reconnect storm ✅yangi, stock oversell ⚠️, privilege escalation ✅, backup test ⚠️

**Qolgan gaplar:**
- Backup test restore (oylik staging) — joriy qilish kerak
- Penetration test — production oldidan
- Stock oversell siyosati — biznes qaror
- Cash drawer no-sale — foydalanuvchi qarori kutilmoqda

## Payment durability (K4 — eng muhim texnik)

Tolov hech qachon yo'qolmasligi uchun:
- Tolov + outbox event **bitta transaction'da** (atomic, replica set)
- WiredTiger journal (crash-safe)
- Disk full watchdog → yozuv fail bo'lsa POS bloklanadi (jim yo'qotmaslik)

## Schema qo'shimchalar

```javascript
user.managerPin: String (hash),
order.cancelApprovedBy: ObjectId,
order.foods[i].cancels[i].approvedBy: ObjectId,
restaurant.config.voidApprovalThreshold: Number,
```

## Statistika

- Bu sessiyada: 2 yangi fayl + 3 yangilangan + 1 changelog
- Vault jami: ~122 fayl

## Bog'liq

- [[../02-arxitektura/xavfsizlik/kritik-risklar]]
- [[../02-arxitektura/xavfsizlik/firibgarlik-nazorati]]
- [[2026-05-29-nozik-nuqtalar-3qatlam]]
