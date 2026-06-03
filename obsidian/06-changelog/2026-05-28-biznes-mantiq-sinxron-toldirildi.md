---
tags: [changelog, biznes-mantiq, sinxron]
date: 2026-05-28
type: docs-expansion
---

# 2026-05-28 — Biznes mantiq va sinxronizatsiya to'liq to'ldirildi

## Sabab

Foydalanuvchi tasdiqlagan reja bo'yicha — data model'dan keyin biznes mantiq va sinxronizatsiya guruhlari ham yopildi.

## Yangi fayllar

### Biznes mantiq (6 ta)
- [[../05-data-model/biznes-mantiq/_MOC|_MOC.md]] — navigatsiya
- [[../05-data-model/biznes-mantiq/order-lifecycle|order-lifecycle.md]] — to'liq state machine, 6 bosqich, per-food cooking status
- [[../05-data-model/biznes-mantiq/shift-lifecycle|shift-lifecycle.md]] — open → active → close, totals hisoblash, force-close
- [[../05-data-model/biznes-mantiq/total-hisoblash|total-hisoblash.md]] — formula, tartib, 5 ta misol, server-side authority
- [[../05-data-model/biznes-mantiq/tolov-oqimi|tolov-oqimi.md]] — single/mixed/partial/cashback/kaspi/refund
- [[../05-data-model/biznes-mantiq/cancel-refund|cancel-refund.md]] — cancel oqimi, sabab kategoriyalari, anomaliyalar, food dec/inc

### Sinxronizatsiya (5 ta)
- [[../02-arxitektura/sinxronizatsiya/_MOC|_MOC.md]] — navigatsiya
- [[../02-arxitektura/sinxronizatsiya/online-to-offline-otish|online-to-offline-otish.md]] — trigger holatlar, race conditions, hysteresis
- [[../02-arxitektura/sinxronizatsiya/boshlangich-sync|boshlangich-sync.md]] — initial sync 8 ta batch, hajm baholash, failure recovery
- [[../02-arxitektura/sinxronizatsiya/sync-prioritizatsiyasi|sync-prioritizatsiyasi.md]] — P0-P4 darajalar, batch hajm, real-time vs reliable
- [[../02-arxitektura/sinxronizatsiya/sync-monitoring|sync-monitoring.md]] — metrikalar, alert'lar, dashboard, konflikt UI

## Yangilangan

- [[../00-INDEX|00-INDEX.md]] — yangi bo'limlar va linklari

## Asosiy hujjatlangan qoidalar

### Order lifecycle
- 6 bosqich: created → cooking → ready → served → paid → closed
- Cooking status — har food darajasida
- Order'ning umumiy cookingStatus — `min(foods.cookingStatus)` derived

### Shift lifecycle
- 1 filialda — 1 vaqtda 1 active smena
- Pending tolovli orderlar — smena yopilishini bloklaydi
- closingDiscrepancy = closingCash − (openingCash + cashRevenue)
- Force close — admin tomonidan, audit warn

### Total formula
- Tartib: subTotal → tariff → discount → service → total
- Service hisoblanadi (subTotal − discount)'dan
- Tariff alohida, foods'ga aralashmaydi
- Service tariff'ga qo'llanmaydi
- Server-side authority — mijoz total ishonchsiz

### Tolov oqimi
- 6 ta method: cash, card, transfer, kaspi, cashback, mixed
- Mixed sum == totalPrice validation
- Partial payment — paidAmounts array (kelajakda schema patch)
- Refund — faqat admin/owner, cashback balanslar qaytariladi

### Cancel/Refund
- Cancel: tolanmagan order
- Refund: tolangan order
- Cancel sabab majburiy (min 3 belgi)
- Sabab kategoriyalari (predefined + free-text)
- Waiter cancel taqiqlangan
- Food dec/inc — cancels[] changelog'da saqlanadi
- Anomaliya alert'lar: order_cancelled_after_payment, frequent_cancels_same_waiter va h.k.

### Sync prioritizatsiyasi
- P0: order events (real-time)
- P1: shift events
- P2: stock, attendance
- P3: menu, table, sozlama
- P4: analytics, audit log (batch)
- Real-time + outbox dual delivery (P0/P1)

### Sync monitoring
- Per-filial metrikalar: outboxPending, syncLag, lastHeartbeat, errorRate, conflictRate
- Alert'lar: 5+ min offline (warn), 30+ min (critical), error rate > 1% (error)
- Konflikt UI: admin lokal/global tanlashi
- Health check endpoint: `/api/health/sync`

### Boshlang'ich sync
- 8 ta batch: restaurant → branch → categories → foods → tables → services/discounts → users → shift+orders
- Eski order'lar (>7 kun) — lokal'da yo'q, web admin'dan
- Tezlik: kichik filial ~30s-2min, katta ~1-5min
- Failure'dan resume — idempotent

## Identifikatsiyalangan ochiq qarorlar

1. **Shift.totals real-time vs at-close?** — joriy at-close. Real-time keyinroq optimize qilinishi mumkin
2. **foods.cancels nomi noto'g'ri** — `changes` deb nomlash kerak (backward compat ehtiyot)
3. **Partial payment field'lari** — `paidAmounts[]` array kerak, joriy schema'ga qo'shilishi shart
4. **Service tariff'ga qo'llanmaydi** — dizayn qarori, kelajakda configurable bo'lishi mumkin
5. **Eski order'lar uchun Variant B** (web admin'da) tasdiqlandi

## Statistika

- Bu sessiyada: 11 yangi fayl + 1 yangilangan + 1 changelog
- Vault'da jami: ~66 markdown fayl
- 4 ta state machine diagrammasi
- 5 ta hisoblash misoli (total)
- 20+ code snippet

## Foydalanuvchi tasdiqlagan rejaning yakuni

Group 1 (Data model) ✅ + Group 2 (Biznes mantiq) ✅ + Group 3 (Sinxron) ✅ — barchasi tugadi.

Endi vault yangi tool yoki kod yozish bosqichi uchun **tayyor**.

## Hali yopilmagan (kelajakda)

| Bo'lim | Status |
|---|---|
| 🟠 Frontend arxitekturasi | hujjatlanmagan |
| 🟠 Deployment/DevOps | hujjatlanmagan |
| 🟠 Installer batafsil | qisman |
| 🟠 Hardware integratsiyalari | qisman |
| 🟠 Notification tizimi | yo'l-yo'lakay |
| 🟡 Hisobotlar va analitika | yo'l-yo'lakay |
| 🟡 Operations runbook | yo'q |
| 🟡 Roadmap va MVP rejasi | yo'q |
| 🟡 Lokalizatsiya | yo'q |
| 🟡 Glossary | yo'q |
| 🟡 Backup va disaster recovery | qisman |
| 🟡 Testing strategiyasi | yo'l-yo'lakay |

## Bog'liq

- [[2026-05-28-vault-yaratildi]]
- [[2026-05-28-local-stack-qarori]]
- [[2026-05-28-rejimlar-xavfsizlik-deepdive]]
- [[2026-05-28-data-model-toldirildi]]
