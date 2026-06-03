---
tags: [changelog, qaror, arxitektura]
date: 2026-05-28
type: architectural-decision
---

# 2026-05-28 — Local backend stack qarori: Electron + MongoDB

## Qaror

Local backend: **Electron** (POS UI + Node.js local backend bitta paketda) + lokal **MongoDB** (Windows Service). Installer (.exe) MongoDB'ni avtomatik o'rnatadi va sozlaydi. Foydalanuvchi exe'ni **Administrator sifatida** ochishi kerak.

## Foydalanuvchi gapi (so'zma-so'z)

> local backend electron + mongodb boladi. yani exe ornatilayotganda tizimda local mongodb ni ornatadi va sozlaydi. exe esa administrator sifatida ochilishi kerak (buni user qiladi)

## Asoslar

| Sabab | Tafsilot |
|---|---|
| Schema bir xilligi | Global ham MongoDB → sync mantiqi sodda, bir xil mongoose model |
| Aggregation | Hisobotlar uchun MongoDB pipeline ishlatib bo'ladi |
| Electron tezligi | Tayyor texnologiya, React/Vue UI'ni packagega aylantirish oson |
| Installer | electron-builder + bundled MongoDB MSI |
| Hardware kirish | Node native modules orqali printer/cash drawer |

## Avvalgi taklif (rad etildi)

Avvalgi taklif Node.js + SQLite edi ([vault yaratilgan paytdagi 8-qaror](2026-05-28-vault-yaratildi.md#q8-local-backend-texnologiyasi--nodejs--sqlite-taklif-hali-yakunlanmagan)). Foydalanuvchi MongoDB tanladi — sync mantiqi sodda bo'lgani uchun.

## O'zgartirilgan hujjatlar

- ✨ Yangi: [[../02-arxitektura/local-backend-stack]] — to'liq stack hujjati
- 📝 Yangilandi: [[../00-INDEX]] — yangi link
- 📝 Yangilandi: [[../01-vizyon/loyiha-mohiyati]] — stack jadvali
- 📝 Yangilandi: [[../02-arxitektura/global-va-local]] — diagramma + texnologiya bo'limi
- 📝 Yangilandi: [[../02-arxitektura/3-rejim]] — SQLite → MongoDB
- 📝 Yangilandi: [[../02-arxitektura/socket-sinxronizatsiya]] — SQLite → MongoDB
- 📝 Yangilandi: [[../02-arxitektura/sinxronizatsiya/offline-to-online-otish]] — SQLite → MongoDB
- 📝 Yangilandi: [[../03-tool-strategiyasi/feature-toggle-tizimi]] — komment
- 📝 Yangilandi: [[../03-tool-strategiyasi/tool-qoshish-shabloni]] — migration fayl tipi (.sql → .js)
- 📝 Yangilandi: [[../04-toollar/online-offline-rejim]] — outbox MongoDB schema misoli
- 📝 Yangilandi: [[../04-toollar/sklad]] — lokal stock MongoDB'da
- 📝 Yangilandi: [[../05-data-model/_MOC]] — sync infra qaydi

## Konsekvensiya (ta'sirlar)

### Texnik
- Local backend kod global bilan ulashilib turishi mumkin (`shared/models/`, `shared/sync/`)
- Lokal MongoDB resurs sarfi yuqori (1-2 GB RAM) — POS PC minimum 4 GB RAM tavsiya
- electron-builder + MongoDB MSI bundling tajriba talab qiladi
- Multi-POS scenariosi yangi muammolar tug'diradi (kelajakda)

### Loyihaviy
- `local/backend/` papkasini Electron loyihasi sifatida qayta tashkillash
- Eski `local/aridaipos_monitor` papkasi — Electron app'ning bir qismi sifatida
- `electron-builder.yml` konfiguratsiya kerak
- Bundled MongoDB Windows MSI yuklab olib, build pipeline'ga qo'shish

### Birinchi installer prototipi
Birinchi versiya — sodda:
1. Windows MSI/NSIS installer
2. Bundled MongoDB MSI
3. Electron app folder
4. Service registration script
5. Default config generation
6. branchToken so'rash

## Ochiq qarorlar (keyingi sessiyalarda)

- [ ] MongoDB versiyasi — 7.x community standalone vs replica set (change stream uchun)
- [ ] Local backend joylashuvi — Electron main vs alohida Windows Service (hozircha Variant A — Electron main)
- [ ] Installer texnologiyasi — NSIS, MSI, yoki electron-builder default
- [ ] Multi-POS LAN topologiyasi (v2)
- [ ] Hardware drayverlar paketlashtirishi
- [ ] Auto-update mexanizmi (electron-updater + global VPS release server)
- [ ] Cloud backup (ixtiyoriy)

## Bog'liq

- [[../02-arxitektura/local-backend-stack]] ⭐
- [[../02-arxitektura/global-va-local]]
- [[2026-05-28-vault-yaratildi]]
