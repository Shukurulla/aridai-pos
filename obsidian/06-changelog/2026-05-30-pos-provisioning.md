---
tags: [changelog, kod, pos, xavfsizlik, provisioning]
date: 2026-05-30
type: implementation
---

# 2026-05-30 — POS provisioning (filial admin login → branchToken)

## Sabab

Foydalanuvchi: "local exe POS bo'lishi kerak va u filial admin sifatida login qilishi kerak?"
Tushuntirildi: POS'da **ikki darajali auth** bor:
1. **Qurilma** (POS PC) → filialga biriktirish (branchToken) — bir marta
2. **Foydalanuvchi** (kassir/admin) → har smena (telefon+parol)

Foydalanuvchi tanlovi: **qurilma filial admin login orqali biriktiriladi** (token qo'lda
nusxalashsiz, qulay).

## Bajarilgan ish

### Global — provision endpoint
`POST /api/sync/provision` (branchAuth'dan OLDIN — hali token yo'q):
- `branch_admin` telefon+parol tekshiradi → user.branch → **signBranchToken** → qaytaradi
  `{branchToken, branchId, restaurantId, branchName}`
- branch.branchToken (hash) saqlanadi, tokenRevoked=false, audit `pos_provisioned`.

### Local — setup + config saqlash
- `models/local_config.model.js` — singleton (branchToken/branchId/restaurantId/branchName).
- `routes/setup.routes.js`:
  - `GET /api/setup/status` — qurilma sozlanganmi (`provisioned`)
  - `POST /api/setup/provision` — global'ga provision → branchToken'ni lokal Mongo + runtime
    config'ga saqlaydi → **boshlang'ich sync** (menyu/stol/xodim) avtomatik
- `server.js` boot'da `local_config`'dan branchToken yuklaydi (restart'da saqlanadi).

### POS renderer — provisioning oqimi
- `pages/Provision.jsx` — "Привязка кассы" (filial admin login).
- `App.jsx` — 2 bosqich: `setup/status` → **sozlanmagan** = Provision; **sozlangan** = xodim Login → POS.

## Tasdiqlash (UI + backend)

✅ Sozlanmagan qurilma → `provisioned: false`
✅ Provision (filial admin +998901110001) → branchToken + **avtomatik bootstrap** (5 taom, 6 stol)
✅ Sozlangan → `provisioned: true`
✅ Noto'g'ri parol → INVALID_CREDENTIALS
✅ **Restart'dan keyin saqlanadi** (local Mongo config)
✅ **POS UI (Preview)**: "Привязка кассы" ekrani → filial admin login → xodim "Касса" login ekrani

## Oqim (yakuniy)
```
POS exe ochildi
  └─ qurilma sozlanganmi?
       ├─ YO'Q → "Привязка кассы" → filial admin login → branchToken (avto) + sync
       └─ HA   → xodim login (telefon+parol) → POS (smena, order, to'lov)
```

## Qolgan
- Real Windows `.exe` (electron-builder + MongoDB installer)
- branchToken muddati tugaganda/revoke bo'lganda qayta provision
- Avtomatik davriy sync (hozir manual)

## Bog'liq
- [[../02-arxitektura/xavfsizlik/auth-strategiyasi]] — 4 token (branch token)
- [[../02-arxitektura/local-backend-stack]] — installer + branchToken
- [[2026-05-30-pos-terminal-ui]] — POS UI (oldingi qadam)
