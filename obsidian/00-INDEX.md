---
tags: [moc, index]
created: 2026-05-28
---

# AridaiPos_v2 — Obsidian Vault

Bu vault loyihaning **butun bilim bazasi**. Har bir arxitektura qarori, har bir tool, har bir o'zgarish shu yerda yozib boriladi. Kod yozishdan oldin — shu yerda dizayn. Kod yozishdan keyin — shu yerda o'zgarish loglari.

## Strategiya

> [!important] Asosiy qoida
> **Kod = Obsidian'dagi rejaning amaliyoti.** Avval shu yerda yozilmagan hech narsa kodga tushmaydi. Har bir o'zgarish [[06-changelog]] ga yoziladi.

> [!tip] Qarorlar reestri
> Barcha qabul qilingan qarorlar va holati: [[00-QARORLAR-REESTRI]] ⭐ (33 hal qilingan, 3 ochiq)

## Navigatsiya

### 🎯 Vizyon
- [[01-vizyon/loyiha-mohiyati|Loyiha mohiyati]] — nima qilamiz va nima uchun
- [[01-vizyon/choziluvchanlik-printsipi|Choziluvchanlik printsipi]] — markaziy falsafa
- [[01-vizyon/roadmap|Roadmap / MVP rejasi]] ⭐ Phase 0→4 ketma-ketlik
- [[01-vizyon/glossariy|Glossariy]] — atamalar lug'ati (uz/ru/en)

### 🏛️ Arxitektura
- [[02-arxitektura/global-va-local|Global VPS vs Local backend]]
- [[02-arxitektura/local-backend-stack|Local backend stack — Electron + MongoDB]] ⭐ qaror
- [[02-arxitektura/multi-pos|Multi-POS (bir filialda ko'p POS)]] — bitta server, client ulanadi
- [[02-arxitektura/3-rejim|3 ta ishlash rejimi]] (overview)
- [[02-arxitektura/socket-sinxronizatsiya|Socket sinxronizatsiya protokoli]]
- [[02-arxitektura/conflict-resolution|Konflikt yechimi]]
- [[02-arxitektura/multi-tenant-xavfsizlik|Multi-tenant xavfsizlik]] (overview)
- [[02-arxitektura/notification-tizimi|Notification tizimi]] — push/SMS/WhatsApp/email
- [[02-arxitektura/lokalizatsiya|Lokalizatsiya (i18n)]] — uz/ru/kk/en
- [[02-arxitektura/testing-strategiyasi|Testing strategiyasi]]
- [[02-arxitektura/hisobotlar-analitika|Hisobotlar va analitika]]

### 🔄 Rejimlar (deep dive)
- [[02-arxitektura/rejimlar/_MOC|Rejimlar MOC]]
  - [[02-arxitektura/rejimlar/online-rejim|🟢 Online rejim]]
  - [[02-arxitektura/rejimlar/offline-rejim|🟡 Offline rejim]]
  - [[02-arxitektura/rejimlar/possiz-rejim|🔴 Possiz rejim]]
  - [[02-arxitektura/rejimlar/rejim-otish-qoidalari|Rejim o'tish qoidalari (state machine)]]

### 🔒 Xavfsizlik (deep dive)
- [[02-arxitektura/xavfsizlik/_MOC|Xavfsizlik MOC]]
  - [[02-arxitektura/xavfsizlik/kritik-risklar|⭐ Kritik risklar reestri]]
  - [[02-arxitektura/xavfsizlik/firibgarlik-nazorati|⭐ Xodim firibgarligi nazorati]]
  - [[02-arxitektura/xavfsizlik/restoran-auth-tuzatish|Restoran auth tuzatish]] (shoshilinch)
  - [[02-arxitektura/xavfsizlik/auth-strategiyasi|Auth strategiyasi (JWT)]]
  - [[02-arxitektura/xavfsizlik/role-based-access|Role-based access (RBAC)]]
  - [[02-arxitektura/xavfsizlik/tenant-izolyatsiyasi|Tenant izolyatsiyasi]]
  - [[02-arxitektura/xavfsizlik/socket-xavfsizligi|Socket xavfsizligi]]
  - [[02-arxitektura/xavfsizlik/rate-limiting|Rate limiting]]
  - [[02-arxitektura/xavfsizlik/secrets-management|Secrets management]]
  - [[02-arxitektura/xavfsizlik/audit-log|Audit log]]

### 🔁 Sinxronizatsiya (deep dive)
- [[02-arxitektura/sinxronizatsiya/_MOC|Sinxronizatsiya MOC]]
  - [[02-arxitektura/sinxronizatsiya/online-to-offline-otish|Online → Offline o'tish]]
  - [[02-arxitektura/sinxronizatsiya/offline-to-online-otish|⭐ Offline → Online o'tish]]
  - [[02-arxitektura/sinxronizatsiya/boshlangich-sync|Boshlang'ich sync (initial)]]
  - [[02-arxitektura/sinxronizatsiya/sync-prioritizatsiyasi|Sync prioritizatsiyasi (P0-P4)]]
  - [[02-arxitektura/sinxronizatsiya/sync-monitoring|Sync monitoring va alerting]]

### 🧩 Tool strategiyasi (eng muhim qism)
- [[03-tool-strategiyasi/feature-toggle-tizimi|Feature toggle tizimi]] ⭐ markaziy hujjat
- [[03-tool-strategiyasi/tool-lifecycle|Tool lifecycle (yoqish/o'chirish jarayoni)]]
- [[03-tool-strategiyasi/tool-qoshish-shabloni|Yangi tool qo'shish shabloni]]
- [[03-tool-strategiyasi/modullar-orasidagi-bogliqlik|Modullar orasidagi bog'liqlik]]

### 🔧 Toollar ro'yxati
- [[04-toollar/_MOC|Barcha toollar (MOC)]]
  - [[04-toollar/online-offline-rejim|1. online/offline rejim]]
  - [[04-toollar/cook-waiter-possiz-rejim|2. cook+waiter possiz rejim]]
  - [[04-toollar/sklad|3. sklad]]
  - [[04-toollar/keldi-ketti|4. keldi-ketti]]
  - [[04-toollar/qr-order|5. qr-order]]
  - [[04-toollar/qr-pay-kaspi|6. qr-pay (Kaspi)]]
  - [[04-toollar/keshbek-tizimi|7. keshbek tizimi]]

### 📊 Data model
- [[05-data-model/_MOC|Data model MOC]]
- [[05-data-model/er-diagramma|ER diagrammasi]]
- [[05-data-model/sync-metadata|Sync metadata]]
- [[05-data-model/index-strategiyasi|Index strategiyasi]]
- [[05-data-model/snapshot-strategiyasi|Snapshot strategiyasi]]
- Core entity'lar:
  - [[05-data-model/restaurant|restaurant]]
  - [[05-data-model/branch|branch]]
  - [[05-data-model/user|user]]
  - [[05-data-model/order|order]] ⭐ markaziy
  - [[05-data-model/food|food]]
  - [[05-data-model/category|category]]
  - [[05-data-model/table|table]]
  - [[05-data-model/shift|shift]]
  - [[05-data-model/service|service]]
  - [[05-data-model/discount|discount]]
  - [[05-data-model/customer|customer]] — mijoz (telefon, tarix, keshbek)

### 🧠 Biznes mantiq (lifecycle, qoidalar)
- [[05-data-model/biznes-mantiq/_MOC|Biznes mantiq MOC]]
  - [[05-data-model/biznes-mantiq/order-lifecycle|Order lifecycle]]
  - [[05-data-model/biznes-mantiq/shift-lifecycle|Shift lifecycle]]
  - [[05-data-model/biznes-mantiq/total-hisoblash|Total hisoblash formula]]
  - [[05-data-model/biznes-mantiq/tolov-oqimi|Tolov oqimi]]
  - [[05-data-model/biznes-mantiq/cancel-refund|Cancel va refund]]

### ⚠️ Nozik nuqtalar (edge cases & gotchas)
- [[07-nozik-nuqtalar/_MOC|Nozik nuqtalar MOC]] ⭐ kod oldidan o'qish shart
  - [[07-nozik-nuqtalar/vaqt-va-soat|Vaqt va soat]]
  - [[07-nozik-nuqtalar/pul-valyuta-yaxlitlash|Pul, valyuta, yaxlitlash]]
  - [[07-nozik-nuqtalar/chek-raqamlash|Chek raqamlash]]
  - [[07-nozik-nuqtalar/fiskal-soliq|Fiskal va soliq (KKM)]]
  - [[07-nozik-nuqtalar/concurrency-race|Concurrency va race]]
  - [[07-nozik-nuqtalar/id-generatsiya|ID generatsiya]]
  - [[07-nozik-nuqtalar/ochirish-cascade|O'chirish cascade]]
  - [[07-nozik-nuqtalar/data-osishi-arxivlash|Data o'sishi va arxivlash]]
  - [[07-nozik-nuqtalar/telefon-normalizatsiya|Telefon normalizatsiya]]
  - [[07-nozik-nuqtalar/hardware-nozikliklari|Hardware nozikliklari]]
  - [[07-nozik-nuqtalar/split-bill-order-tahrir|Split bill va order tahrir]]
  - [[07-nozik-nuqtalar/xavfsizlik-qoshimcha|Xavfsizlik qo'shimcha]]
  - [[07-nozik-nuqtalar/naqd-tolov-qaytim|Naqd to'lov, qaytim, yaxlitlash]]
  - [[07-nozik-nuqtalar/chegirma-service-qollanishi|Chegirma va service qo'llanishi]]
  - [[07-nozik-nuqtalar/order-operatsion-edge|Order va operatsion edge]]
  - [[07-nozik-nuqtalar/stol-birlashtirish-bolish|Stol birlashtirish/bo'lish]]
  - [[07-nozik-nuqtalar/tool-edge-caselar|Tool-specific edge'lar]]
  - [[07-nozik-nuqtalar/stop-list-limit|Stop-list va kunlik limit]] ⭐
  - [[07-nozik-nuqtalar/pre-bill-chek-print|Pre-bill, final chek, oshxona cheki]]
  - [[07-nozik-nuqtalar/menyu-export-import|Menyu export/import]]
  - [[07-nozik-nuqtalar/versiya-empty-state|Versiya, token expiry, empty state]]

### 🖥️ Frontend
- [[08-frontend/_MOC|Frontend MOC]]
  - [[08-frontend/umumiy-arxitektura|Umumiy arxitektura]]
  - [[08-frontend/web-admin|Web admin panel]]
  - [[08-frontend/pos-electron|POS Electron]]
  - [[08-frontend/mobile-flutter|Mobile (Flutter)]]
  - [[08-frontend/mijoz-qr-web|Mijoz QR web]]

### 🚀 Deployment / DevOps
- [[09-deployment/_MOC|Deployment MOC]]
  - [[09-deployment/vps-deploy|Global VPS deploy]]
  - [[09-deployment/environments|Muhitlar (dev/staging/prod)]]
  - [[09-deployment/ci-cd|CI/CD pipeline]]
  - [[09-deployment/monitoring|Monitoring va observability]]
  - [[09-deployment/backup-pitr|⭐ Backup va PITR (real-time, hard delete YO'Q)]]

### 🛠️ Operatsiyalar (runbook)
- [[10-operatsiyalar/_MOC|Operatsiyalar MOC]]
  - [[10-operatsiyalar/restoran-onboarding|Restoran onboarding]]
  - [[10-operatsiyalar/troubleshooting|Troubleshooting]]
  - [[10-operatsiyalar/disaster-recovery|Disaster recovery]]

### 📝 Changelog
- [[06-changelog/2026-05-28-vault-yaratildi|2026-05-28: Vault yaratildi]]
- [[06-changelog/2026-05-28-local-stack-qarori|2026-05-28: Local stack qarori]]
- [[06-changelog/2026-05-28-rejimlar-xavfsizlik-deepdive|2026-05-28: Rejimlar+xavfsizlik]]
- [[06-changelog/2026-05-28-data-model-toldirildi|2026-05-28: Data model]]
- [[06-changelog/2026-05-28-biznes-mantiq-sinxron-toldirildi|2026-05-28: Biznes mantiq+sinxron]]
- [[06-changelog/2026-05-29-nozik-nuqtalar|2026-05-29: Nozik nuqtalar]]
- [[06-changelog/2026-05-29-variant-a-toldirildi|2026-05-29: Variant A (frontend/deploy/ops)]]

### 🧰 Shablonlar
- [[99-templates/yangi-tool-template|Yangi tool uchun shablon]]

---

## Vault qoidalari

1. **Har bir o'zgarish — changelog'ga**. [[06-changelog]] ichida `YYYY-MM-DD-nima-qilindi.md` formatida.
2. **Har bir yangi tool — alohida fayl**. [[04-toollar/]] papkasida, [[99-templates/yangi-tool-template|shablon]] bo'yicha to'ldirish.
3. **Wikilinks** orqali bog'lash — `[[fayl-nomi|ko'rsatiladigan matn]]`.
4. **Tags** — `#vizyon`, `#arxitektura`, `#tool/sklad`, `#muhim`, `#shoshilinch`.
5. **Mermaid diagrammalar** — murakkab oqimlar uchun.
6. **Callouts** — `> [!important]`, `> [!warning]`, `> [!todo]`.
