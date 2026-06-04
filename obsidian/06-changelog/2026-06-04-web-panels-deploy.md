---
tags: [changelog, deploy, web, nginx, ssl, auto-deploy]
created: 2026-06-04
modul: global/{filial_admin,owner_admin,super_admin} · nginx · CI-CD
---

# Web panellar deploy — domen + HTTPS + auto-deploy

> 3 ta web panel endi jonli (HTTPS), VPS'da **server-side build**, har push'da
> avtomatik yangilanadi. Kod oʻzgartirilmadi — nginx `/api`+`/uploads`'ni
> backendga proxy qiladi (panellar relativ `/api` ishlatadi).

## Jonli manzillar
| Panel | URL |
|---|---|
| Filial admin | **https://admin.asadbek-durdana.uz** |
| Owner | **https://owner.asadbek-durdana.uz** |
| System admin | **https://system.asadbek-durdana.uz** |

## Qanday qilindi
- **DNS** (foydalanuvchi): `admin`/`owner`/`system` → `37.60.226.97`.
- **Build** (VPS): `npm ci && vite build` → `dist/` (har panel).
- **nginx** (har subdomen, alohida config — **mavjud 8 sayt tegilmadi**):
  - `root → dist/`, SPA fallback `try_files $uri /index.html`
  - `/api/` + `/uploads/` → `proxy_pass :4560` (WebSocket header'lar bilan)
- **SSL**: Let's Encrypt (certbot --nginx) → HTTPS + HTTP→HTTPS 301, avto-renew.

## Auto-deploy
- **`deploy-web.yml`**: `global/{filial_admin,owner_admin,super_admin}/**` push
  → VPS `git pull` + har panelni `npm ci && vite build`. nginx yangi `dist/`'ni
  darhol xizmat qiladi (reload shart emas — statik). Backend bilan bir xil secrets.

## Tasdiqlandi
- 3 panel: HTML 200 ✅ · `/api` proxy → backend ✅ · HTTP→HTTPS 301 ✅
- admin domeni orqali login (test1234) → success ✅

## Bogʻliq
- [[2026-06-04-https-subdomain]]
- [[../../DEPLOY|DEPLOY.md]]
