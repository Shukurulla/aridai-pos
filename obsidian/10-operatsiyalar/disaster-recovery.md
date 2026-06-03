---
tags: [operatsiyalar, disaster-recovery, muhim]
created: 2026-05-29
---

# Disaster recovery

> Jiddiy falokatlar va tiklash protseduralari. Har biri uchun: belgi, ta'sir, tiklash.

## POS PC buzildi (hardware)

**Ta'sir:** Filial POS ishlamaydi. Lokal MongoDB'dagi sync qilinmagan data risk.

**Tiklash:**
1. Agar lokal disk butun → data ko'chirish
2. Yangi PC → `aridaipos-setup.exe` (admin)
3. branchToken kiritish
4. Boshlang'ich sync ([[../02-arxitektura/sinxronizatsiya/boshlangich-sync]])
5. **Lekin:** sync qilinmagan (pending) order'lar — eski PC'da qolgan
   - Eski disk'dan lokal Mongo backup ko'chirish (agar mumkin)
   - Yoki: yo'qotilgan (faqat offline pending orderlar)

**Oldini olish:** lokal backup ([[../07-nozik-nuqtalar/data-osishi-arxivlash]]), tez-tez sync (online'da pending kam).

**Eng yaxshi holat:** filial ko'pincha online → pending kam → POS buzilsa ham global'da deyarli hammasi bor.

## Global VPS down

**Ta'sir:** Web admin ishlamaydi, mobile online ishlamaydi, **lekin filiallar offline rejimda ishlayveradi**.

**Tiklash:**
1. VPS provider status tekshirish
2. Server restart (yoki yangi server)
3. Docker compose up ([[../09-deployment/vps-deploy]])
4. MongoDB tekshirish (data butunmi)
5. Filiallar avtomatik reconnect → sync ([[../02-arxitektura/sinxronizatsiya/offline-to-online-otish]])

**Muhim:** Global down ≠ filiallar to'xtaydi. Offline rejim aynan shu uchun. Filiallar pending'ni saqlaydi, VPS qaytganda sync.

**RTO maqsadi:** < 1 soat
**RPO:** ~0 (filiallar lokal saqlaydi)

## Global MongoDB data corruption

**Ta'sir:** Eng jiddiy — markaziy data buzildi.

**Tiklash (PITR — [[../09-deployment/backup-pitr]]):**
1. Maqsad vaqtdan oldingi **base snapshot** restore (per-restoran)
2. **Change-log oyna fayllarini replay** (base → corruption vaqtigacha)
3. → **1 daqiqa aniqlikgacha** tiklanadi (deyarli hech narsa yo'qolmaydi)
4. Qo'shimcha: filiallardan offline-pending re-sync (idempotency duplikat oldini oladi)

> [!note] Eski "kunlik backup" yondashuvi yangilandi
> Endi PITR (real-time change capture) — oddiy kunlik snapshot emas. Backup'dan keyingi data **yo'qolmaydi** (1 daqiqalik granularity).

**Oldini olish:**
- PITR (change stream + 6-soatlik oynalar) — [[../09-deployment/backup-pitr]]
- MongoDB Atlas managed PITR (alternativa)
- Replica set
- Hard delete YO'Q — soft delete data baribir bor
- Tez-tez backup

## Filial lokal MongoDB corruption

**Ta'sir:** Bitta filial lokal data buzildi.

**Tiklash:**
1. Lokal MongoDB to'xtatish
2. Lokal backup'dan restore ([[../07-nozik-nuqtalar/data-osishi-arxivlash]])
3. afterRestore() — pending tekshiruv (duplikat yo'q)
4. Yoki: global'dan to'liq re-sync (boshlang'ich sync qayta)
   - Lokal Mongo tozalanadi
   - Global'dan butun filial data qayta keladi
   - **Lekin:** sync qilinmagan pending order'lar yo'qoladi (agar backup yo'q bo'lsa)

## branchToken kompromiss (o'g'irlangan)

**Ta'sir:** O'g'ri filial data'siga kira oladi.

**Tiklash:**
1. Web admin → filial → token revoke (`tokenRevoked: true`)
2. O'g'irlangan token bilan ulanish darhol rad
3. Yangi branchToken → haqiqiy POS'ga
4. Audit log tekshirish (qanday data kirilgan)

Tafsilot: [[../07-nozik-nuqtalar/xavfsizlik-qoshimcha#1. O'g'irlangan POS PC]]

## JWT secret leak

**Ta'sir:** Barcha token soxtalashtirilishi mumkin.

**Tiklash:**
1. JWT_SECRET rotation ([[../02-arxitektura/xavfsizlik/secrets-management#JWT_SECRET rotation]])
2. Barcha user majburiy logout (tokenVersion ostida)
3. Audit tekshirish
4. Yangi secret bilan qayta login

## Sync split-brain (kamdan-kam)

**Belgi:** Lokal va global jiddiy farq, ko'p konflikt.

**Tiklash:**
1. Sync to'xtatish (manual)
2. Konfliktlarni admin ko'rib chiqadi ([[../02-arxitektura/sinxronizatsiya/sync-monitoring#Konflikt resolyutsiya UI]])
3. Qaysi tomon ustun — qaror
4. Manual merge
5. Sync qayta yoqish

## Backup test (muntazam)

> [!important] Backup — restore qilib ko'rilmaган backup = backup emas
> Har oy: backup'dan test restore (staging'ga). Restore ishlashini tasdiqlash.

## RTO / RPO maqsadlari

| Komponent | RTO (tiklash vaqti) | RPO (data yo'qotish) |
|---|---|---|
| Global VPS | < 1 soat | ~0 (filiallar saqlaydi) |
| Global Mongo | < 2 soat | < 24 soat (kunlik backup) + filial re-sync |
| POS PC | < 1 soat | offline pending (kam) |
| Lokal Mongo | < 30 min | offline pending yoki 0 (re-sync) |

## Falokat aloqa rejasi

1. Alert (monitoring → Telegram/SMS) ([[../09-deployment/monitoring]])
2. Dev team javob
3. Status sahifa (mijozlarga, kelajak)
4. Post-mortem (nima bo'ldi, qanday oldini olamiz)

## Bog'liq

- [[_MOC]]
- [[troubleshooting]]
- [[../07-nozik-nuqtalar/data-osishi-arxivlash]]
- [[../02-arxitektura/sinxronizatsiya/offline-to-online-otish]]
- [[../09-deployment/monitoring]]
