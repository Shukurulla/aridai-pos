---
sana: 2026-06-03
mavzu: Monorepo + CI/CD + avtomatik yangilanish (scaffolding)
status: poydevor tayyor (siz repo+VPS+secret sozlaysiz)
---

# Monorepo + CI/CD + auto-update

## Bajarildi
- **Monorepo**: root `git init` + `main` (commit 81637b5). `.gitignore` — node_modules, build,
  .env, Flutter build, *.apk/*.exe istisno (539 fayl, node_modules YO'Q).
- **.github/workflows/** (path-filtered — o'zgargan loyiha → release/deploy):
  - `deploy-backend.yml` — `global/backend/**` push → VPS SSH (`appleboy/ssh-action`) → git pull +
    `npm ci` + `pm2 restart`. Secret: VPS_HOST/USER/SSH_KEY/PATH.
  - `release-app.yml` — `aridai-pos-app/**` push → Flutter `build apk` → Release `app-v<pubspec ver>`
    (APK asset). `GITHUB_TOKEN`.
  - `release-monitor.yml` — `local/aridaipos_monitor/**` push → `electron-builder --win --publish` →
    Release (electron-updater). `RELEASES_TOKEN`/`GITHUB_TOKEN`.
- **aridai-pos-app**: `lib/services/update_service.dart` — GitHub Releases API'dan eng so'nggi
  `app-v` ni tekshiradi, joriy versiya bilan solishtiradi → UpdateInfo (versiya/APK url/notes).
- **DEPLOY.md** — to'liq sozlash qo'llanmasi (repo, secretlar, VPS pm2, release tartibi).

## Siz sozlaysiz (DEPLOY.md)
1. GitHub repo (`Shukurulla/aridai-pos`) → `git remote add` + push.
2. Secrets: VPS_HOST/USER/SSH_KEY/PATH (+ RELEASES_TOKEN agar EXE alohida repo'ga).
3. VPS bir martalik: clone + .env + pm2 start.

## Hali yo'q (follow-up)
- Monitor **electron-updater** main-wiring + package.json `build.publish` (renderer UI bor).
- UpdateService UI'ga ulanishi (dialog + url_launcher bilan APK yuklash).
- Web panellar deploy (static → nginx/Vercel) · local-server .exe · APK/EXE signing.
- Auto-update YANGI versiya = loyiha versiyasini oshirish (pubspec/package.json) + push.
