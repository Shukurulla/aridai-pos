---
tags: [operatsiyalar, troubleshooting]
created: 2026-05-29
---

# Troubleshooting

> Keng tarqalgan muammolar va ularning yechimi.

## Filial uzoq offline

**Belgi:** Web admin dashboard'da filial 🔴 offline, 30+ daqiqa.

**Tekshirish:**
1. Filialda internet bormi? (admin'ga qo'ng'iroq)
2. POS PC yoqilganmi? Electron ochiqmi?
3. `branch.lastHeartbeatAt` qachon?
4. Sync monitoring ([[../02-arxitektura/sinxronizatsiya/sync-monitoring]])

**Yechim:**
- Internet muammosi → filial hal qiladi, offline rejimda ishlayveradi
- POS yopilgan → qayta ochish
- branchToken muammosi → quyiga qarang
- Outbox to'lib ketgan → reconnect'da avtomatik sync

**Eslatma:** Offline'da filial ishlayveradi (POS), faqat sync kutadi. Bu falokat emas.

## branchToken muammosi

**Belgi:** POS "Tizim bilan ulanish yo'q" yoki socket auth fail.

**Sabablar:**
- Token noto'g'ri kiritilgan
- Token revoked (admin bloklagan)
- tokenVersion mos kelmaydi

**Yechim:**
1. Web admin → filial → "Yangi branchToken generatsiya"
2. POS sozlamalar → yangi token kiritish
3. Yoki: `local.json` ni tahrirlash (admin)
4. Qayta ulanish

Xavfsizlik: o'g'irlangan PC ([[../07-nozik-nuqtalar/xavfsizlik-qoshimcha#1. O'g'irlangan POS PC]]).

## Sync to'xtadi

**Belgi:** Outbox o'sib boryapti, lekin kamaymayapti. `outboxPending` katta.

**Tekshirish:**
1. Socket ulangan­mi? (mode online_syncing'da turibdimi)
2. Sync error log ([[../02-arxitektura/sinxronizatsiya/sync-monitoring]])
3. Biror event rejected bo'lganmi? (tenant mismatch, validation)

**Yechim:**
- Rejected event → admin sync conflicts sahifasi → manual resolve
- Stuck batch → "Force sync" tugmasi
- Retry > 5 event → tekshirish, kerak bo'lsa manual reject
- Server tomonда muammo → backend log

## POS sekin ishlayapti

**Tekshirish:**
- Lokal MongoDB RAM/disk (data o'sib ketganmi)
- Eski order'lar arxivlanmaganmi ([[../07-nozik-nuqtalar/data-osishi-arxivlash]])
- PC resurslari (RAM 4GB minimum)

**Yechim:**
- Lokal arxivlash cron ishlaganmi (90 kun)
- Disk tozalash
- PC RAM yetarli emas → upgrade

## Chek bosilmayapti

**Tekshirish:**
- Printer yoqilganmi, qog'oz bormi
- Hardware test ([[../07-nozik-nuqtalar/hardware-nozikliklari]])
- Print queue

**Yechim:**
- Printer qayta yoqish
- "Qayta bosish" tugmasi
- Drayver qayta o'rnatish
- **Eslatma:** tolov baribir muvaffaqiyatli (chek alohida)

## Smena yopilmayapti

**Belgi:** "Tolov kutayotgan N ta order bor".

**Yechim:**
- Pending orderlarni tolash yoki bekor qilish ([[../05-data-model/biznes-mantiq/shift-lifecycle]])
- Mijoz ketgan/tashlab ketilgan order → bekor qilish (sabab bilan)
- Favqulodda → admin force-close ([[../05-data-model/biznes-mantiq/shift-lifecycle#Force close]])

## Mijoz "keshbegim yo'q" deydi

**Sabab:** Telefon raqami har xil formatda ([[../07-nozik-nuqtalar/telefon-normalizatsiya]]).

**Yechim:**
- Normalize tekshirish (+998... formatda saqlanganmi)
- Keshbek movements log
- Web admin keshbek balanslar sahifasi

## Soat noto'g'ri (hourly tarif xato)

**Belgi:** Billiard tarif noto'g'ri, ⚠️ clock drift banner.

**Yechim:**
- POS PC soatini to'g'rilash (NTP sync) ([[../07-nozik-nuqtalar/vaqt-va-soat]])
- Windows Time service tekshirish

## Order duplikat (sync'dan keyin)

**Belgi:** Bir order ikki marta ko'rinadi.

**Tekshirish:**
- Backup restore qilinganmi ([[../07-nozik-nuqtalar/data-osishi-arxivlash#Backup-restore duplikat]])
- clientId/`_id` idempotency ishlaganmi

**Yechim:**
- Idempotency normalda oldini oladi
- Agar bo'lsa → manual merge/delete (audit bilan)
- Root cause tekshirish (bug?)

## Login ishlamayapti

**Tekshirish:**
- Telefon/parol to'g'rimi
- tokenVersion bekor qilinganmi (logout all)
- Rate limit (5 urinish/15 min) ([[../02-arxitektura/xavfsizlik/rate-limiting]])

**Yechim:**
- Rate limit → 15 daqiqa kutish
- Parol unutgan → admin reset
- Account bloklangan → admin unlock

## Eskalatsiya

Hal bo'lmasa → dev team (Telegram alert) → log tekshirish → Sentry ([[../09-deployment/monitoring]]).

## Bog'liq

- [[_MOC]]
- [[disaster-recovery]]
- [[../02-arxitektura/sinxronizatsiya/sync-monitoring]]
- [[../07-nozik-nuqtalar/_MOC]]
