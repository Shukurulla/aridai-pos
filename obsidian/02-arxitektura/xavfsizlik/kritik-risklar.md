---
tags: [xavfsizlik, risk, muhim]
created: 2026-05-29
---

# Kritik risklar reestri

> [!important] Bu — loyihaning risk reestri
> Biznesni o'ldira oladigan yoki katta zarar keltiradigan xavflar. Har biri: tavsif, ehtimol × ta'sir, himoya, holat. Yangi risk aniqlanса shu yerga qo'shiladi.

## Severity matritsa

| | Past ta'sir | O'rta ta'sir | Yuqori ta'sir |
|---|---|---|---|
| **Yuqori ehtimol** | 🟡 | 🟠 | 🔴 |
| **O'rta ehtimol** | 🟢 | 🟡 | 🟠 |
| **Past ehtimol** | 🟢 | 🟢 | 🟡 |

## 🔴 Katastrofik risklar

### K1. Cross-tenant data leak
- **Tavsif:** A restoran B'ning ma'lumotini ko'radi/o'zgartiradi
- **Ta'sir:** Ishonch yo'qoladi, biznes tugaydi, huquqiy
- **Himoya:** tenantGuard har endpoint, socket event guard, mongoose plugin, audit ([[tenant-izolyatsiyasi]], [[../multi-tenant-xavfsizlik]])
- **Holat:** ✅ himoyalangan (test shart)

### K2. Webhook spoofing → bepul ovqat
- **Tavsif:** Hujumchi soxta Kaspi webhook yuboradi → order "paid" → mijoz tolamasdan ovqat oladi
- **Ta'sir:** Bevosita pul yo'qotish, masshtablashishi mumkin
- **Himoya:** HMAC SHA-256 signature, IP whitelist, `kaspiInvoiceId` unique (replay), timestamp tolerance ([[../../04-toollar/qr-pay-kaspi]])
- **Holat:** ⚠️ HMAC bor — lekin **majburiy kuchaytirish**: webhook hech qachon HMAC'siz qabul qilinmaydi, invoice bizning tomondan yaratilgan bo'lishi shart (dinamik QR), summa moslashtiriladi
- **Qo'shimcha:** statik QR (mijoz summa kiritadi) — yanada xavfli, faqat ishonchli restoran uchun

### K3. Secret leak (JWT/branch)
- **Tavsif:** JWT_SECRET yoki BRANCH_SECRET sizib chiqsa → istalgan token soxtalashtiriladi
- **Ta'sir:** To'liq kompromiss
- **Himoya:** rotation, .env git'da emas, pre-commit hook, redaction ([[secrets-management]])
- **Holat:** ✅ + rotation rejasi

### K4. Pul yo'qolishi (unsynced payment)
- **Tavsif:** Offline'da tolov olindi, POS crash/disk o'ldi, sync bo'lmadi → pul olindi, yozuv yo'q
- **Ta'sir:** Bevosita yo'qotish, hisobot noto'g'ri
- **Himoya:** outbox (lokal Mongo, journal), tez-tez sync, lokal backup ([[../sinxronizatsiya/offline-to-online-otish]], [[../../07-nozik-nuqtalar/data-osishi-arxivlash]])
- **Holat:** ⚠️ **kuchaytirish kerak** — qarang quyida "Payment durability"

### K5. Sync split-brain / payment loss
- **Tavsif:** Konflikt'da tolov yoki order jim yo'qoladi
- **Ta'sir:** Pul/data yo'qotish
- **Himoya:** version, idempotency, per-field merge, konflikt audit + manual UI ([[../conflict-resolution]], [[../sinxronizatsiya/sync-monitoring]])
- **Holat:** ✅ qisman — konfliktlar hech qachon jim tashlanmaydi, audit'ga

## 🟠 Jiddiy risklar

### J1. Xodim firibgarligi
- **Tavsif:** Kassir/waiter void/refund/cash bilan pul o'g'irlaydi
- **Ta'sir:** Doimiy, sezilmas pul oqishi (eng katta real POS yo'qotish)
- **Himoya:** [[firibgarlik-nazorati]] — manager PIN, audit, anomaliya hisobot
- **Holat:** ✅ dizayn qilindi (2026-05-29)

### J2. Double revenue (sync replay)
- **Tavsif:** Event takror jo'natiladi → daromad ikki marta
- **Himoya:** idempotency (`_id`/`clientId`, Redis seen-set) ([[../../05-data-model/sync-metadata]])
- **Holat:** ✅

### J3. Reconnect storm (thundering herd)
- **Tavsif:** VPS tiklanganda 100+ filial bir vaqtda ulanadi → VPS yana yiqiladi
- **Ta'sir:** Availability — barcha online ops o'ladi
- **Himoya:** exponential backoff + **jitter**, server connection rate limit ([[../socket-sinxronizatsiya#Reconnect storm himoyasi]])
- **Holat:** ✅ dizayn qilindi (2026-05-29)

### J4. Stock oversell → bepul taom
- **Tavsif:** Manfiy stock yoki limit chetlanishi → tizim "bor" deydi
- **Himoya:** atomic decrement, stop-list/limit ([[../../07-nozik-nuqtalar/stop-list-limit]], [[concurrency-race?]])
- **Holat:** ⚠️ stock manfiy bo'lishi mumkin (default) — biznes qarori

### J5. Privilege escalation
- **Tavsif:** Waiter admin huquqini oladi
- **Himoya:** RBAC, tokenVersion, token claims server-side ([[role-based-access]], [[auth-strategiyasi]])
- **Holat:** ✅

### J6. Backup tiklanmaydi
- **Tavsif:** Backup bor, lekin restore ishlamaydi (sinov qilinmagan)
- **Himoya:** **oylik test restore** (staging), MongoDB Atlas PITR ([[../../07-nozik-nuqtalar/data-osishi-arxivlash]], [[../../10-operatsiyalar/disaster-recovery]])
- **Holat:** ⚠️ test rejimini joriy qilish kerak

## 🟡 Muhim risklar (asosan yopilgan)

| Risk | Himoya | Holat |
|---|---|---|
| NoSQL injection | mongo-sanitize, validation | ✅ [[../../07-nozik-nuqtalar/xavfsizlik-qoshimcha]] |
| Image malware | magic bytes + re-encode | ✅ |
| Clock skew wrong winner | NTP, wall-clock + actor priority | ⚠️ [[../../07-nozik-nuqtalar/vaqt-va-soat]] |
| O'g'irlangan POS | branchToken revoke | ✅ |
| Rate limit / DoS | express-rate-limit, socket throttle | ✅ [[rate-limiting]] |
| Audit gaps | audit_log keng qamrov | ✅ [[audit-log]] |

## Payment durability (K4 kuchaytirish)

> [!important] Tolov hech qachon yo'qolmasligi kerak
> 1. Tolov **lokal Mongo'ga sinxron yoziladi** (acknowledged write, journal) — keyin OK qaytariladi
> 2. Outbox event ham **shu transaction'da** (atomic) — yozuv va sync-intent birga
> 3. WiredTiger journal — crash'da ham yozuv saqlanadi
> 4. Reconnect'da pending outbox jo'natiladi (idempotent)
> 5. Disk full watchdog — yozuv fail bo'lsa alert, POS bloklanadi (jim yo'qotmaslik)

```javascript
// Tolov — transaction ichida (replica set)
await session.withTransaction(async () => {
  await orderModel.updateOne({_id}, {paymentStatus:'paid', ...}, {session});
  await outboxModel.create([{eventType:'order.paid', ...}], {session});
});
// Endi yozuv VA sync-intent atomik. Crash bo'lsa ikkalasi ham bor yoki ikkalasi ham yo'q.
```

## Risk review jarayoni

- Har katta feature → risk tahlili (yangi risk bormi?)
- Oylik: risk reestrini ko'rib chiqish
- Incident → post-mortem → yangi risk/himoya
- Penetration test (kelajak, production oldidan)

## Gaplar (hozirgi holat)

| Gap | Reja |
|---|---|
| Backup test restore | Oylik staging restore joriy qilish |
| Penetration test | Production oldidan |
| Stock oversell siyosati | Biznes qaror (block yoki ruxsat) |
| ~~Cash drawer no-sale~~ | ✅ 2026-05-29: log + asosiy nazorat smena discrepancy ([[firibgarlik-nazorati#Cash drawer no-sale (qaror 2026-05-29)]]) |

## Bog'liq

- [[firibgarlik-nazorati]]
- [[_MOC]]
- [[../conflict-resolution]]
- [[../../10-operatsiyalar/disaster-recovery]]
- [[../sinxronizatsiya/sync-monitoring]]
