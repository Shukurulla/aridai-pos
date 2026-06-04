---
tags: [changelog, local-server, sync, deploy, global-url]
created: 2026-06-04
modul: local/aridaipos_server
---

# Local server → production global URL

> Backend endi deploy qilingan (`https://api.asadbek-durdana.uz`). Local server
> (POS PC) global bilan sync qiladi — `GLOBAL_URL` shu manzilga qaratildi.

## Nima qilindi
- **Kod default** `GLOBAL_URL` → `https://api.asadbek-durdana.uz`:
  - `src/main/index.js` (pingGlobal)
  - `src/main/backend/config/index.js` (globalUrl — sync)
  - Default'lar — chunki CI EXE'da `.env` boʻlmaydi (gitignored).
- **Lokal `.env`** (gitignored, commit emas): `GLOBAL_URL` + `JWT_SECRET` +
  `BRANCH_SECRET` → **production qiymatlari** (global bilan BIR XIL secret —
  token verify uchun shart).
- Versiya `0.3.0` → push → `release-server.yml` EXE qayta quradi (deploy).

## ⚠️ Real POS PC uchun (muhim)
Local server EXE production global bilan **toʻliq sync** qilishi uchun PC'dagi
`.env`'da `JWT_SECRET` + `BRANCH_SECRET` **production global bilan bir xil**
boʻlishi shart (secret'lar public repo'da yoʻq — provisioning/qoʻlda sozlanadi).
`pingGlobal` (health) — auth'siz, darhol ishlaydi.

## Bogʻliq
- [[2026-06-04-https-subdomain]]
- [[2026-06-04-vps-deploy]]
