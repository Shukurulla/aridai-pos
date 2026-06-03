---
tags: [changelog, frontend, deployment, operatsiyalar]
date: 2026-05-29
type: docs-expansion
---

# 2026-05-29 — Variant A yakunlandi (frontend, deployment, operations, va h.k.)

## Sabab

Foydalanuvchi Variant A ni tanlagan edi — kelajak (qolgan) hujjatlarni to'ldirish. Nozik nuqtalar tugagach, Variant A ning qolgan barcha bo'limlari yozildi.

## Yangi fayllar (18 ta)

### Vizyon (2)
- [[../01-vizyon/roadmap|roadmap.md]] ⭐ — Phase 0→4, bog'liqlik grafi, har Phase feature set
- [[../01-vizyon/glossariy|glossariy.md]] — atamalar lug'ati (domain/texnik/tool/rol/valyuta)

### Frontend (6) — `08-frontend/`
- [[../08-frontend/_MOC|_MOC.md]]
- [[../08-frontend/umumiy-arxitektura|umumiy-arxitektura.md]] — shared kod, API/socket client, optimistic UI, feature-flag render
- [[../08-frontend/web-admin|web-admin.md]] — React+Vite, feature toggle sahifa
- [[../08-frontend/pos-electron|pos-electron.md]] — Electron renderer, status bar, hardware
- [[../08-frontend/mobile-flutter|mobile-flutter.md]] — role-based UI, possiz, push
- [[../08-frontend/mijoz-qr-web|mijoz-qr-web.md]] — public menyu sayti

### Deployment (5) — `09-deployment/`
- [[../09-deployment/_MOC|_MOC.md]]
- [[../09-deployment/vps-deploy|vps-deploy.md]] — Docker, Nginx (WebSocket!), SSL
- [[../09-deployment/environments|environments.md]] — dev/staging/prod
- [[../09-deployment/ci-cd|ci-cd.md]] — GitHub Actions pipeline
- [[../09-deployment/monitoring|monitoring.md]] — logs, metrics, Sentry, alert'lar

### Operatsiyalar (4) — `10-operatsiyalar/`
- [[../10-operatsiyalar/_MOC|_MOC.md]]
- [[../10-operatsiyalar/restoran-onboarding|restoran-onboarding.md]] — yangi restoran/filial/POS qadamlari + checklist
- [[../10-operatsiyalar/troubleshooting|troubleshooting.md]] — keng tarqalgan muammolar
- [[../10-operatsiyalar/disaster-recovery|disaster-recovery.md]] — falokat tiklash, RTO/RPO

### Arxitektura cross-cutting (4) — `02-arxitektura/`
- [[../02-arxitektura/notification-tizimi|notification-tizimi.md]] — push/SMS/WhatsApp/email/in-app
- [[../02-arxitektura/lokalizatsiya|lokalizatsiya.md]] — i18n, uz/ru/kk/en
- [[../02-arxitektura/testing-strategiyasi|testing-strategiyasi.md]] — test piramidasi, kritik unit'lar
- [[../02-arxitektura/hisobotlar-analitika|hisobotlar-analitika.md]] — smena/kunlik/oylik hisobot

## Yangilangan
- [[../00-INDEX|00-INDEX.md]] — barcha yangi bo'limlar (Vizyon+, Arxitektura+, Frontend, Deployment, Operatsiyalar, Changelog ro'yxati)

## Asosiy qarorlar/tavsiyalar

### Roadmap — eng muhim
> **Avval core online'da, keyin offline, keyin tool'lar.**
> - Phase 0: Fundament (auth fix, tenant guard, toggle, sync metadata)
> - Phase 1: MVP online POS (offline'siz, tool'siz — core'ni isbotlash)
> - Phase 2: Offline + Socket + Local backend (eng qiyin)
> - Phase 3: Tool'lar (sklad → qr-order → qr-pay → keshbek → keldi-ketti → possiz)
> - Phase 4: Scale (multi-POS, fiskal, analytics)

### Frontend
- 4 ilova: web admin (React), POS (Electron), mobile (Flutter), mijoz QR (React)
- Shared `calc` — lokal/global/frontend bir xil hisoblash kod
- Optimistic UI (POS), feature-flag aware render, role-based UI (mobile)

### Deployment
- Docker Compose + Nginx (WebSocket upgrade!) + Let's Encrypt
- MongoDB Atlas tavsiya (managed)
- GitHub Actions: lint+test (PR), deploy (staging auto, prod manual)
- Sentry + UptimeRobot (boshlanish minimal)

### Operations
- Onboarding checklist (14 band)
- Troubleshooting (10+ muammo)
- DR: global down ≠ filial to'xtaydi (offline rejim), RTO < 1soat

## Statistika

- Bu sessiyada: 18 yangi fayl + 1 INDEX + 1 changelog
- Vault'da jami: ~101 markdown fayl
- 3 yangi top-level folder (08-frontend, 09-deployment, 10-operatsiyalar)

## Vault holati — TO'LIQ

Endi vault quyidagilarni qamrab oladi:
- ✅ Vizyon + Roadmap + Glossary
- ✅ Arxitektura (global/local, socket, conflict, rejimlar, xavfsizlik, sinxron)
- ✅ Tool strategiyasi + 7 tool
- ✅ Data model (10 entity + sync + index + snapshot)
- ✅ Biznes mantiq (lifecycle, total, tolov, cancel)
- ✅ Nozik nuqtalar (13 edge case)
- ✅ Frontend (4 ilova)
- ✅ Deployment / DevOps
- ✅ Operatsiyalar (runbook)
- ✅ Notification, i18n, testing, hisobotlar

**Vault kod yozish uchun to'liq tayyor.**

## Keyingi qadam (taklif)

Hujjatlash bosqichi tugadi. Endi **kod**:
1. Phase 0 — fundament (auth fix eng kritik [[../02-arxitektura/xavfsizlik/restoran-auth-tuzatish]])
2. Phase 1 — MVP online POS

## Bog'liq

- [[2026-05-29-nozik-nuqtalar]]
- [[../01-vizyon/roadmap]]
- [[../00-INDEX]]
