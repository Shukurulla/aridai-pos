# AridaiPOS — monorepo, CI/CD va avtomatik yangilanish

Barcha loyihalar **bitta GitHub repo** (monorepo) ichida. `main`'ga push qilinganda **qaysi
loyiha o'zgargan** bo'lsa, faqat o'sha uchun workflow ishlaydi (path-filter).

```
AridaiPos_v2/                 ← monorepo (git root)
├── .github/workflows/        ← CI/CD
│   ├── deploy-backend.yml    ← global/backend → VPS pull + pm2 restart
│   ├── release-app.yml       ← aridai-pos-app → APK + GitHub Release (app-v*)
│   └── release-monitor.yml   ← local/aridaipos_monitor → EXE + Release (electron-updater)
├── global/backend            ← VPS (pm2)
├── global/{filial_admin,owner_admin,super_admin}  ← web (keyingi: static deploy)
├── local/aridaipos_monitor   ← POS .exe (electron-updater)
├── local/aridaipos_server    ← filial local server (.exe — keyingi)
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
- **POS .exe** — `release-monitor.yml` electron-builder bilan publish qiladi, `electron-updater`
  ko'radi. **Qo'shimcha ish kerak** (DEPLOY follow-up):
  1. `local/aridaipos_monitor/package.json` ga:
     ```json
     "build": { "publish": [{ "provider": "github", "owner": "Shukurulla", "repo": "aridai-pos" }] }
     ```
  2. `npm i electron-updater`
  3. main-process: `autoUpdater.checkForUpdatesAndNotify()` + preload `window.pos.updates`
     (renderer Settings'da UI allaqachon bor — `window.pos.updates`).
  > Monorepo + electron-updater: agar app-v/monitor-v relizlar aralashsa, EXE'ni **alohida
  > releases-repo** (`aridai-pos-monitor`) ga publish qilish tozaroq (publish.repo + RELEASES_TOKEN).

## Relizlar tartibi (qisqa)
- Backend: `global/backend/**` push → VPS avto-restart (versiya shart emas).
- APK: `aridai-pos-app/pubspec.yaml` version++ → push → `app-vX` release.
- EXE: `local/aridaipos_monitor/package.json` version++ → push → release + electron-updater.

## Keyingi (hali yo'q)
Web panellar deploy (static → VPS nginx / Vercel) · local-server .exe relizi · APK signing
(release keystore) · code signing (EXE).
