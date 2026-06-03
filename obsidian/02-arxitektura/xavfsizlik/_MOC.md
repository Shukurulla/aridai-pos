---
tags: [moc, xavfsizlik]
created: 2026-05-28
---

# Xavfsizlik MOC

Yuqori darajadagi taqqoslash uchun: [[../multi-tenant-xavfsizlik]]. Bu yerda — har bir xavfsizlik mavzusi chuqurroq.

## ⭐ Kritik risklar (eng muhim)
- [[kritik-risklar|Kritik risklar reestri]] — katastrofik/jiddiy xavflar, himoya holati, gaplar
- [[firibgarlik-nazorati|Xodim firibgarligi nazorati]] — void/cancel PIN, anomaliya, audit

## Asosiy mavzular

### Autentifikatsiya
- [[auth-strategiyasi|Auth strategiyasi]] — JWT, refresh, branchToken
- [[restoran-auth-tuzatish|Restoran auth tuzatish]] — eski xato middleware'ni almashtirish

### Avtorizatsiya
- [[role-based-access|Role-based access control]] — RBAC matrix
- [[tenant-izolyatsiyasi|Tenant izolyatsiyasi]] — restaurant/branch guard'lar

### Aloqa qatlami
- [[socket-xavfsizligi|Socket xavfsizligi]] — handshake, room, event guard
- [[rate-limiting|Rate limiting]] — login, API, socket

### Maxfiy ma'lumotlar
- [[secrets-management|Secrets management]] — JWT_SECRET, API key'lar, branchToken

### Kuzatuv
- [[audit-log|Audit log]] — barcha shubhali harakatlar

## Tartib (eng muhim'dan past'gacha)

1. ⭐ [[restoran-auth-tuzatish]] — joriy backend'da xato bor, darhol tuzatilishi kerak
2. ⭐ [[tenant-izolyatsiyasi]] — har endpoint'ga middleware
3. ⭐ [[auth-strategiyasi]] — JWT to'g'ri
4. [[role-based-access]] — roller guard
5. [[socket-xavfsizligi]] — socket layer qo'shilganda
6. [[secrets-management]] — secret rotation
7. [[audit-log]] — logging infra
8. [[rate-limiting]] — DoS oldini olish

## Bog'liq

- [[../multi-tenant-xavfsizlik]] — yuqori darajadagi
- [[../socket-sinxronizatsiya]] — socket protokoli
