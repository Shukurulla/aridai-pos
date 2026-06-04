---
tags: [changelog, deploy, vps, backend, production]
created: 2026-06-04
modul: global-backend · deploy
---

# Global backend VPS'ga deploy qilindi (izolyatsiyalangan)

> Backend endi **jonli**: `http://37.60.226.97:4560/api` — barcha 5 rol login
> qiladi. Server boshqa loyihalar bilan **band** (aridai-*, kepket), shuning
> uchun **toʻliq izolyatsiya** qilindi (boshqasiga tegmaydi).

## Deploy tafsilotlari
| Narsa | Qiymat |
|---|---|
| VPS | 37.60.226.97 (Ubuntu 24.04, Node 20, pm2, Mongo 7 rs0) |
| Backend URL | http://37.60.226.97:4560/api |
| Loyiha yo'li | `/root/shukurulla/aridai-pos` |
| pm2 nomi | **`aridai-pos-backend`** (alohida — boshqa aridai-api'ga tegmaydi) |
| Port | 4560 (boʻsh edi) · ufw'da ochildi |
| Mongo baza | **`aridai_pos`** + alohida user (faqat shu bazaga `readWrite`) |
| pm2 startup | enabled + saved (reboot'da tiklanadi) |

## Izolyatsiya (boshqa loyihalarга taʼsir YOʻQ)
- Alohida papka, alohida pm2 process, alohida port, **alohida Mongo user** —
  `aridai_pos` user boshqa bazalarni (aridai, kepket_kz) **koʻrolmaydi**.
- Mavjud `aridai-api/web/webhook` (15 kun uptime) — **tegilmadi**, ishlayapti.
- ufw'ga faqat 4560 **qoʻshildi** (mavjud qoidalar oʻzgartirilmadi).

## Maʼlumot
Lokal `aridai_pos` (275 hujjat: 7 restoran, 11 user, 16 taom) `mongodump` →
`mongorestore` bilan koʻchirildi. Test parollari: hammasiga **`test1234`**
(admin +998901110001, waiter +77001112233, owner +77000000001, cook
+77001113355, cashier +77001114455).

## Mobil + auto-deploy
- `api_service.dart` default backend → **VPS** (APK darhol ishlaydi; login'da
  oʻzgartirsa boʻladi). Versiya 1.8.0+9.
- `deploy-backend.yml` — pm2 nomi `aridai-pos-backend`, VPS_PATH
  `/root/shukurulla/aridai-pos`. **Auto-deploy uchun foydalanuvchi qiladi:**
  GitHub Secrets (VPS_HOST/USER/SSH_KEY/PATH) — SSH **kalit** qoʻshish kerak.

## Maxfiylik
Mongo paroli, JWT/BRANCH secret'lar — faqat VPS `.env` ichida (git'ga
tushmaydi). Bu hujjatda secret yoʻq.

## Keyingi (ixtiyoriy)
- Domen + HTTPS (nginx reverse-proxy `api.domen.uz` → :4560 + Let's Encrypt)
- FCM: VPS `.env`'ga service account qoʻshish (hozir push OFF)
- GitHub Secrets → auto-deploy yoqish

## Bogʻliq
- [[../../DEPLOY|DEPLOY.md]]
- [[2026-06-04-mobil-server-url-config]]
