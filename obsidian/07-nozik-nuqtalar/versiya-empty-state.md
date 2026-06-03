---
tags: [nozik-nuqta, texnik, versiya]
created: 2026-05-29
---

# Versiya mosligi, token expiry, empty state

> Texnik nozik nuqtalar — default qarorlar bilan (revisable).

## 1. App/schema versiya mosligi (local vs global)

### Muammo
- Global VPS v2 schema'ga yangilandi (yangi field qo'shildi)
- Lokal POS hali v1 (offline edi, yoki update qilmagan)
- Sync paytida — versiyalar mos kelmaydi

### Qaror: versiya negotiation + backward-compat

```javascript
// Socket handshake'da versiya almashinuvi
socket.auth = { branchToken, appVersion: '1.4.2', schemaVersion: 5 };

// Global tekshiradi
if (clientSchemaVersion < MIN_SUPPORTED_SCHEMA) {
  return { error: 'UPDATE_REQUIRED', message: 'POS yangilanishi kerak' };
}
```

### Qoidalar
- **Additive o'zgarishlar** (yangi optional field) → backward-compat, eski lokal ham ishlaydi
- **Breaking o'zgarishlar** (field o'chirildi, type o'zgardi) → lokal **avval update** bo'lishi kerak
- Global har doim N va N-1 schema versiyani qo'llab-quvvatlaydi (grace window)
- Lokal sync'da o'z versiyasini aytadi, global mos formatda javob beradi

### Migration
- Lokal MongoDB migration ([[../02-arxitektura/local-backend-stack]]) app update bilan
- Global migration deploy bilan ([[../09-deployment/ci-cd]])
- Eski event'lar (offline'da v1 formatda yaratilgan) → global v2'ga migrate qabul qilishda

### Auto-update bilan bog'liq
- electron-updater POS'ni yangilaydi ([[../02-arxitektura/local-backend-stack#Update mexanizmi]])
- "Majburiy update" — breaking change bo'lsa, eski versiya ishlamaydi
- POS UI: "Yangilanish kerak, internet ulanганda yangilanadi"

## 2. Token o'rtada tugashi (mid-operation expiry)

### Muammo
- Waiter order olyapti, 20 daqiqa o'tdi
- userToken (7 kun) — kam ehtimol, lekin refresh paytida
- yoki: tokenVersion o'zgardi (admin role o'zgartirdi)

### Qaror: graceful re-auth
```javascript
// API client 401 oldi
async function on401() {
  const ok = await tryRefresh();  // refresh token bilan
  if (ok) return retry();          // so'rovni qaytarish
  // refresh ham fail → login screen, lekin order draft saqlanadi
  saveDraftLocally();
  redirectToLogin();
}
```

- Order **draft lokal saqlanadi** (yo'qolmaydi)
- Re-login'dan keyin davom etadi
- POS: token uzoq muddatli, lekin re-auth silliq

## 3. Chek raqami bo'shliqlari

### Muammo
- Order #0042 yaratildi, raqam oldi
- Order bekor qilindi (void/cancel)
- #0042 raqami "iste'mol qilingan" → ketma-ketlikda bo'shliq (0041, 0043...)

### Qaror: bo'shliq normal (audit trail)
- Bekor qilingan order ham raqamni saqlaydi (audit uchun)
- Bo'shliq — bu **xato emas**, balki to'g'ri (raqam qayta ishlatilmaydi)
- Hisobotda: bekor qilingan order'lar ko'rinadi (raqami bilan)
- Fiskal (kelajak) — bo'shliq bo'lmasligini talab qilishi mumkin → o'shanda bekor qilingan ham fiskal raqam oladi

> [!note] Raqam qayta ishlatilmaydi
> #0042 bekor bo'lsa, keyingi order #0043 (0042 emas). Raqam unique va monoton ([[chek-raqamlash]]).

## 4. Empty state (bo'sh holat)

### Menyu yo'q
- Filial yangi, hali taom qo'shilmagan
- POS: "Menyu bo'sh. Admin menyu qo'shishi kerak."
- Order berib bo'lmaydi (taom yo'q)
- Web admin'da menyu qo'shish yo'naltirgich

### Smena yo'q
- Faol smena yo'q → order berib bo'lmaydi ([[../05-data-model/biznes-mantiq/shift-lifecycle]])
- POS: "Smena ochilmagan. Smena oching."
- Katta "Smena ochish" tugmasi

### Stol yo'q (dineIn)
- dineIn uchun stol kerak
- Stol yo'q → faqat takeaway mumkin
- Yoki: "Stol qo'shing"

### Xodim yo'q
- Filialda faqat admin, waiter/cashier yo'q
- Admin o'zi ishlaydi yoki xodim qo'shadi

### UI printsipi
> Har bo'sh holatda — **nima qilish kerakligini ko'rsatadigan** yo'naltirgich (empty state + CTA tugma), shunchaki bo'sh ekran emas.

## 5. Birinchi ishga tushish (cold start)

- POS birinchi marta ochildi → boshlang'ich sync ([[../02-arxitektura/sinxronizatsiya/boshlangich-sync]])
- Sync tugaguncha "Tayyorlanmoqda..." 
- Menyu/stol bo'sh bo'lsa → empty state

## Test rejasi

- [ ] Schema versiya mismatch → UPDATE_REQUIRED (breaking)
- [ ] Additive field → eski lokal ishlaydi
- [ ] Token expiry → refresh → retry (draft saqlanadi)
- [ ] Refresh fail → login, draft yo'qolmaydi
- [ ] Chek raqami bo'shliq (bekor order) — normal
- [ ] Empty menu → CTA
- [ ] No shift → "smena oching"
- [ ] No table dineIn → takeaway yoki "stol qo'shing"

## Bog'liq

- [[../02-arxitektura/local-backend-stack]]
- [[../02-arxitektura/sinxronizatsiya/boshlangich-sync]]
- [[../02-arxitektura/xavfsizlik/auth-strategiyasi]]
- [[chek-raqamlash]]
- [[../05-data-model/biznes-mantiq/shift-lifecycle]]
