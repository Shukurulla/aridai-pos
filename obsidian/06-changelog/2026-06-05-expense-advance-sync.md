---
tags: [changelog, sync, expense, advance, kassa, local-global, backend]
created: 2026-06-05
modul: global/backend · local/aridaipos_server
---

# Sync #30 — Rasxod/Avans (expense/advance) local → global

> POS'da kassir kiritgan **Расходы/Авансы** lokalda qolib ketardi — global'ga
> umuman bormasdi (owner/admin hisobotlari ularni ko'rmasdi). Endi order/smena
> kabi push sync orqali global'ga ketadi.

## Muammo (audit natijasi)
- Lokal `finance.routes.js` rasxod/avansni `syncStatus: "pending"` bilan yaratadi —
  ya'ni sync uchun **belgilangan**, lekin hech kim yig'ib push qilmasdi.
- Global backend'da `expense`/`advance` **modeli umuman yo'q edi**.
- Natija: har bir rasxod/avans faqat filial kompyuterida qoladi → global hisobot
  noto'g'ri (kassa balansi mos kelmaydi).
- Dizayn (obsidian/.../offline-to-online): hozircha "best effort + idempotent +
  audit" REST sync — socket/outbox kelajak ishi. Shu yondashuvga mos qo'shildi.

## O'zgarishlar (additive — order/smena oqimiga tegmaydi)
### Global
- **Yangi model**: `expense.model.js`, `advance.model.js` — lokal nusxasining aynan
  ko'chirmasi (sync-meta plugin, bir xil `_id` mirror).
- `sync.routes.js` `POST /push`: endi `{ orders, shifts, expenses, advances }`
  qabul qiladi. `upsertOne(Model, doc, type)` yordamchisi — tenant guard (branch
  tekshiruvi) + `replaceOne` upsert. Audit xabari 4 turni sanaydi.

### Local (aridaipos_server)
- `sync-client.js`:
  - `collectPending()` → endi 4 to'plam: order, shift, **expense, advance**
    (`syncStatus pending|in_progress`).
  - `pushSync()` → 4 turni yuboradi; muvaffaqiyatdan keyin `markSynced` helper
    (raw `collection.updateMany`, sync-meta hook'siz) hammasini "synced" qiladi.
  - `runOrderSync()` push guard'i endi expense/advance bo'lsa ham push qiladi
    (avval faqat order/shift'ni tekshirardi → faqat rasxod bo'lsa o'tkazib yuborardi).
- Versiya: 0.3.1 (avvalgi smena-guard bump'i bilan birga, hali EXE chiqmagan).

## Hali yo'q (keyingi — alohida ish)
- **Global → local pull** (expense/advance): hozircha kerak emas — bu yozuvlar
  faqat POS'da yaratiladi, admin web'da tahrir/o'chirish yo'q.
- **Global hisobotlar** bu data'ni ishlatishi (#29): model keldi, endi
  reports/dashboard'ga ulash kerak.
- Smena yopishda `expectedCash` dan `cashExpenses` ni ayirish (kassa aniqligi).

## Holat
- global/backend: deploy-backend.yml → auto. Yangi modellar yuklanadi (pm2 tekshiriladi).
- local/aridaipos_server: EXE keyingi build'da filialga yetadi.

## Bog'liq
- [[2026-06-04-smena-yopish-validatsiya]]
- [[../02-arxitektura/sinxronizatsiya/offline-to-online-otish]]
