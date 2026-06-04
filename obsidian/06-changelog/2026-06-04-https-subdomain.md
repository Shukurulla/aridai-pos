---
tags: [changelog, deploy, https, nginx, ssl, domen]
created: 2026-06-04
modul: deploy · nginx
---

# HTTPS subdomen — api.asadbek-durdana.uz

> Backend endi chiroyli HTTPS manzilda: **https://api.asadbek-durdana.uz**
> (raw IP o'rniga). Cloudflare'siz — to'g'ridan-to'g'ri + Let's Encrypt.

## Nima qilindi
- **DNS** (foydalanuvchi): `api.asadbek-durdana.uz` → `37.60.226.97` (A-yozuv).
- **nginx** (VPS): alohida config `/etc/nginx/sites-available/api.asadbek-durdana.uz`
  → reverse-proxy `:4560`. WebSocket (socket.io) qo'llab-quvvatlash
  (`Upgrade`/`Connection` header). **Boshqa 7 sayt tegilmadi.**
- **SSL**: Let's Encrypt (certbot --nginx) → HTTPS + HTTP→HTTPS 301 redirect.
  `certbot.timer` enabled → **avto-yangilanadi** (90 kun).
- **Mobil**: `api_service.dart` default → `https://api.asadbek-durdana.uz/api`.
  Versiya 1.9.0+10.

## Tasdiqlandi
- `https://api.asadbek-durdana.uz/api/health` → ok ✅
- HTTP → HTTPS 301 ✅ · login (test1234) success ✅
- SSL: Let's Encrypt, Jun 4 → Sep 2 (auto-renew) ✅

## Holat
| | |
|---|---|
| API (HTTPS) | https://api.asadbek-durdana.uz/api |
| API (IP, fallback) | http://37.60.226.97:4560/api (ufw'da ochiq) |
| Apex | asadbek-durdana.uz → 216.198.79.1 (tegilmadi) |

## Bog'liq
- [[2026-06-04-vps-deploy]]
- [[../../DEPLOY|DEPLOY.md]]
