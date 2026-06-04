# AridaiPOS — monorepo, CI/CD va avtomatik yangilanish

Barcha loyihalar **bitta GitHub repo** (monorepo) ichida. `main`'ga push qilinganda **qaysi
loyiha o'zgargan** bo'lsa, faqat o'sha uchun workflow ishlaydi (path-filter).

```
AridaiPos_v2/                 ← monorepo (git root)
├── .github/workflows/        ← CI/CD
│   ├── deploy-backend.yml    ← global/backend → VPS pull + pm2 restart
│   ├── release-app.yml       ← aridai-pos-app → APK + GitHub Release (app-v*)
│   ├── release-monitor.yml   ← local/aridaipos_monitor → EXE + Release (channel: monitor)
│   ├── release-server.yml    ← local/aridaipos_server → EXE + Release (channel: server)
│   └── deploy-web.yml        ← global/{filial_admin,owner_admin,super_admin} → VPS build + nginx
├── global/backend            ← VPS pm2 → https://api.asadbek-durdana.uz
├── global/filial_admin       ← https://admin.asadbek-durdana.uz (VPS nginx + SSL)
├── global/owner_admin        ← https://owner.asadbek-durdana.uz (VPS nginx + SSL)
├── global/super_admin        ← https://system.asadbek-durdana.uz (VPS nginx + SSL)
├── local/aridaipos_monitor   ← POS .exe (electron-updater, interaktiv)
├── local/aridaipos_server    ← filial local server .exe (electron-updater, saylent)
└── aridai-pos-app            ← mobil (APK / keyin AAB)
```

## 1-qadam — GitHub repo
```bash
# root'da (allaqachon git init qilingan)
git remote add origin https://github.com/Shukurulla/aridai-pos.git
git push -u origin main
```
(repo nomi boshqa bo'lsa — workflow/electron-builder publish'ni mos yangilang.)

## 2-qadam — GitHub Secrets (Settings → Secrets and variables → Actions)
| Secret | Nima uchun |
|---|---|
| `VPS_HOST` | VPS IP/domen (backend deploy) |
| `VPS_USER` | SSH user (mas. `root`) |
| `VPS_SSH_KEY` | SSH **private key** (deploy kaliti) |
| `VPS_PATH` | repo yo'li VPS'da (mas. `/var/www/aridai-pos`) |
| `RELEASES_TOKEN` | (ixtiyoriy) EXE'ni alohida releases-repo'ga publish qilsa — PAT |

`GITHUB_TOKEN` avtomatik (APK release + EXE shu repo'ga publish uchun yetarli).

## 3-qadam — VPS (bir martalik)
```bash
# VPS'da
git clone https://github.com/Shukurulla/aridai-pos.git /var/www/aridai-pos
cd /var/www/aridai-pos/global/backend
cp .env.example .env   # to'ldiring (MONGO_URL, JWT_SECRET, PORT...)
npm ci --omit=dev
npm i -g pm2
pm2 start index.js --name aridai-backend
pm2 save && pm2 startup   # reboot'da avtostart
```
Endi `global/backend/**` o'zgarib push bo'lsa → workflow SSH bilan pull + restart.

## 4-qadam — Avtomatik yangilanish
- **Backend (VPS)** ✅ — push → `deploy-backend.yml` → pull + `pm2 restart`.
- **Mobil APK** — `release-app.yml` `app-v<pubspec version>` release chiqaradi. Ilovadagi
  `UpdateService` (lib/services/update_service.dart) GitHub Releases API'dan eng so'nggi `app-v`'ni
  tekshiradi → yangi bo'lsa "Обновить" dialogi (APK'ni brauzerda ochadi/yuklaydi).
  **Yangi versiya**: `aridai-pos-app/pubspec.yaml` `version:` ni oshiring → push.
- **POS monitor .exe** ✅ — `release-monitor.yml` electron-builder bilan publish qiladi.
  `electron-updater` interaktiv (renderer Settings → `window.pos.updates`).
  Channel: **`monitor`** → `monitor.yml`.
- **Local server .exe** ✅ — `release-server.yml` electron-builder bilan publish qiladi.
  `electron-updater` **SAYLENT** (fon infratuzilma): jimgina yuklab, keyingi qayta ishga
  tushishda o'rnatadi. Channel: **`server`** → `server.yml`.

  > **Ko'p electron app + bitta repo:** ikkala app `latest.yml` o'rniga alohida channel
  > ishlatadi (`monitor.yml` / `server.yml`), shuning uchun update manifestlari
  > **to'qnashmaydi** (monitor xato bilan server build'ini o'rnatmaydi).
  > **Ishonchli avtoyangilanish uchun** monitor va server `version`'larini **birga oshiring**
  > (bir xil) — shunda bitta GitHub Release ichida ikkala channel ham bo'ladi va
  > electron-updater "eng so'nggi release"dan o'z channel'ini topadi.

## Relizlar tartibi (qisqa)
- Backend: `global/backend/**` push → VPS avto-restart (versiya shart emas).
- APK: `aridai-pos-app/pubspec.yaml` version++ → push → `app-vX` release.
- Monitor EXE: `local/aridaipos_monitor/package.json` version++ → push → release + auto-update.
- Server EXE: `local/aridaipos_server/package.json` version++ → push → release + auto-update.
  (Ikkala EXE — versiyani **birga** oshirish tavsiya etiladi.)
- Web panellar: `global/<panel>/**` push → VPS server-side build (`deploy-web.yml`),
  versiya shart emas. nginx `dist/`'ni darhol xizmat qiladi.

## Keyingi (hali yo'q)
APK signing (release keystore) ·
code signing (EXE) · monitor↔server versiya sync skripti.
