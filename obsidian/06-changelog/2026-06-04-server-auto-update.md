---
tags: [changelog, deploy, ci-cd, electron, auto-update, server, monitor]
created: 2026-06-04
modul: local/aridaipos_server · local/aridaipos_monitor · CI-CD
---

# Local server EXE auto-update + ko'p-electron channel ajratish

> Savol: "electronlar barchasi update keladimi?" — yo'q edi: faqat **POS monitor**
> auto-update olardi, **local server** olmaydi. Endi **ikkalasi ham** oladi.

## Muammo
Ikkala electron app bitta repo (`Shukurulla/aridai-pos`) relizlariga publish qilsa,
electron-builder ikkalasiga ham `latest.yml` yaratadi → **to'qnashuv**: monitor
xato bilan server build'ini o'rnatishi mumkin.

## Yechim — alohida channel
- **Monitor**: `publish.channel = "monitor"` → `monitor.yml` (interaktiv update).
- **Server**: `publish.channel = "server"` → `server.yml` (SAYLENT update).
- Manifestlar alohida → to'qnashmaydi. electron-updater har app o'z channel'ini
  (app-update.yml ichidan) o'qiydi.

## Server auto-update (yangi)
- `package.json`: `electron-updater` dep + `build.publish` (github, channel server).
- `src/main/index.js`: `autoUpdater` (autoDownload=true, autoInstallOnAppQuit=true);
  whenReady'da `checkForUpdates()` + har 6 soatda. **Saylent** — server fon
  infratuzilma, jimgina yuklab keyingi restart'da o'rnatadi (tray tooltip xabar beradi).
- `.github/workflows/release-server.yml` — `local/aridaipos_server/**` push → Win EXE
  build + publish (RELEASES_TOKEN || GITHUB_TOKEN).

## Versiya sinxron
Ishonchli avtoyangilanish uchun monitor + server `version` **birga oshiriladi**
(ikkalasi 0.2.0) — bitta GitHub Release ichida `monitor.yml` + `server.yml` bo'ladi.

## Deploy holati (DEPLOY.md yangilandi)
| Komponent | Mexanizm | Holat |
|---|---|---|
| Backend (VPS) | `deploy-backend.yml` → pm2 restart | ✅ (VPS secrets kerak) |
| Mobil APK | `release-app.yml` → app-v* + UpdateService | ✅ |
| POS monitor EXE | `release-monitor.yml` → monitor.yml | ✅ |
| Local server EXE | `release-server.yml` → server.yml | ✅ **YANGI** |

**Foydalanuvchi qiladigan ish:** GitHub Secrets (`VPS_HOST/USER/SSH_KEY/PATH` +
ixtiyoriy `RELEASES_TOKEN`) + VPS (pm2) bir martalik sozlash — DEPLOY.md 2/3-qadam.

## Bog'liq
- [[../../DEPLOY|DEPLOY.md]]
- [[2026-06-04-possiz-rejim-toggle]] (oldingi qadam)
