---
tags: [changelog, sync, conflict, version, kassa, backend, muhim]
created: 2026-06-05
modul: global/backend · local/aridaipos_server
---

# Sync #30 — Konflikt guard (version monotonic)

> `/push` ilgari `version` tekshirmay `replaceOne` qilardi → **eski lokal push
> global'dagi yangiroq yozuvni ezib yuborishi** mumkin edi (mas. admin orderni
> bekor qildi, lokal eski nusxani qayta yozib bekorlikni bekor qiladi). Pul
> masalasida bu data-loss. Endi versiya asosida himoya bor.

## Muammo (audit topdi)
- `/push` har bir hujjatni shartsiz `replaceOne` qilardi (last-write = local, doim).
- Stsenariy: order lokalda synced (v1) → admin web'da o'zgartirdi (global v2) →
  lokalda kassir ham o'zgartirdi (local v2, pending) → pull lokal-pending'ni skip
  qiladi → push global v2 ni **ezib yuboradi**. Admin amali yo'qoladi.

## Yechim — version monotonic apply + conflict detect
`global/backend/routes/sync.routes.js` `POST /push` → `applyOne(Model, doc, type)`:
1. **Tenant guard** (avvalgidek) — boshqa filial → `rejected: TENANT_MISMATCH`.
2. Global'dagi mavjud hujjat versiyasini oladi (`includeDeleted` — tombstone'ni
   ham, o'chirilganni tiriltirmaslik uchun).
3. Qaror:
   - `iv > ev` (local yangiroq) → **apply** (oddiy update oqimi).
   - `iv === ev` + bir xil `lastModifiedAt` → **idempotent** (qayta yozmaymiz).
   - `iv < ev` YOKI bir xil versiya, boshqa vaqt (concurrent) → **CONFLICT** →
     rad etiladi, global yozuv **saqlanadi**, `audit.log(sync_conflict)`.

> `version` — toza logical clock: faqat haqiqiy `.save()`/update'da +1 bo'ladi.
> Sync mirror (`bulkWrite replaceOne`) plugin hook'larini chetlab o'tadi → versiya
> ko'chiriladi, sun'iy +1 yo'q. Shu sabab solishtirish ishonchli.

## Local tomon — konvergensiya (loop yo'q)
`sync-client.js` `pushSync` endi javobga qarab status qo'yadi:
- qabul → `synced`
- **CONFLICT → `conflict`** — `collectPending` buni OLMAYDI → qayta push yo'q
  (cheksiz loop oldini oladi). Keyingi `pullOrders/pullShifts` global versiyani
  qaytaradi (pull faqat `pending|in_progress`ni skip qiladi, `conflict`ni emas) →
  lokal global'ga **konvergensiya** qiladi.
- TENANT_MISMATCH → `rejected`.

## Qaror: konfliktда global (committed) g'olib — xavfsiz default
Dizayn (conflict-resolution.md) offline davrida "local source of truth" deydi.
Lekin ONLINE concurrent edit'da **committed global yozuvni ezmaslik** xavfsizroq
(pul amali — bekor/refund — yo'qolmasin). Shuning uchun: konflikt → global qoladi,
lokal o'zgarish `conflict` deb belgilanadi + audit. To'liq **per-field merge** va
"cashier > admin" actor-priority — kelajak ishi (hozir guard + audit yetarli).

## Tekshirildi (production E2E)
provision (test filial) → push bilan stsenariylar: insert, local-ahead, idempotent,
stale-conflict, concurrent-conflict → global holati + cleanup. Hammasi ✅.

## Holat
- global/backend: deploy-backend.yml → auto.
- local/aridaipos_server: 0.3.1 (EXE keyingi build'da).

## Bog'liq
- [[2026-06-05-expense-advance-sync]]
- [[../02-arxitektura/conflict-resolution]]
