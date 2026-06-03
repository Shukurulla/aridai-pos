---
tags: [changelog, qaror, backup, data]
date: 2026-05-29
type: decision
---

# 2026-05-29 — Backup PITR + hard delete YO'Q

## Foydalanuvchi qarorlari

1. **Hard delete YO'Q** — barcha ma'lumot soft delete (`deleted: true`), hech narsa fizik o'chirilmaydi
2. **VPS MongoDB backup** — har restoran alohida, 6-soatlik oynalar, 1 yilgacha
3. **Real-time capture** — 6-soatlik cron snapshot yetmaydi (3-soatda crash → 3 soat yo'qoladi). Barcha collection'lar real-time faylga yozilib boradi, 6 soatda finalize/yopiladi, yangisi davom etadi → 1 daqiqa ham yo'qolmaydi

## Yangi fayl

- [[../09-deployment/backup-pitr|backup-pitr.md]] ⭐ — Point-In-Time Recovery dizayni:
  - Hard delete YO'Q (1-asos)
  - Base snapshot + uzluksiz change capture (change stream)
  - 6-soatlik oyna fayllar (real-time append → rotate)
  - Per-restaurant ajratish
  - 1 yil retention
  - Recovery: base + replay → 1 daqiqa aniqlik
  - Resume token (writer crash recovery), fsync durability
  - Atlas vs self-hosted

## Yangilangan (hard delete → soft delete + anonimizatsiya)

- [[../07-nozik-nuqtalar/ochirish-cascade|ochirish-cascade.md]] — "Hard delete faqat GDPR" BEKOR. Endi: hech qachon hard delete, GDPR → anonimizatsiya
- [[../07-nozik-nuqtalar/data-osishi-arxivlash|data-osishi-arxivlash.md]] — global backup → PITR, archive = transactional move (delete emas), lokal prune = cache eviction (data loss emas)
- [[../05-data-model/sync-metadata|sync-metadata.md]] — `deleted` = isDeleted, hard delete yo'q, onUninstall data qoldiradi
- [[../05-data-model/restaurant|restaurant.md]] — lifecycle: 90 kun hard delete → soft delete
- [[../05-data-model/food|food.md]] — 3-daraja "hard delete" o'chirildi
- [[../05-data-model/user|user.md]] — hard delete → anonimizatsiya
- [[../10-operatsiyalar/disaster-recovery|disaster-recovery.md]] — Mongo corruption → PITR (base+replay, 1 daqiqa)
- [[../09-deployment/_MOC]], [[../00-INDEX]] — yangi linklar

## Asosiy texnik dizayn

```
Change stream (real-time) → joriy 6-soatlik oyna fayli (append + fsync)
                          ↓ cron har 6 soat
                   finalize (gzip+format) → S3 → yangi oyna davom etadi
Base snapshot (kunlik per-restoran) + oyna fayllar = PITR
Recovery = base + replay(windows) → istalgan daqiqa
```

- Replica set kerak (change stream) — global + lokal
- Resume token → writer crash'da gap yo'q
- Per-restaurant: `s3://aridai-backups/{restaurantId}/{base,windows}/`

## Hard delete → soft delete + anonimizatsiya

- `db.deleteOne()` hech qayerda ishlatilmaydi
- O'chirish = `deleted: true`
- GDPR right-to-be-forgotten → anonimizatsiya (telefon/ism olib tashlanadi, moliyaviy yozuv qoladi)
- Archive = transactional move (cold collection, data preserved)
- Lokal prune = cache eviction (global'da + PITR'da bor)

## Field nomi

Soft-delete flag = `deleted` (mavjud konvensiya, ~15 faylda). Foydalanuvchining "isDeleted" niyati shu field bilan qondiriladi (semantik bir xil).

## Statistika

- 1 yangi fayl + 8 yangilangan + 1 changelog
- Vault jami: ~124 fayl

## Bog'liq

- [[../09-deployment/backup-pitr]]
- [[../07-nozik-nuqtalar/ochirish-cascade]]
- [[2026-05-29-cash-drawer-qaror]]
