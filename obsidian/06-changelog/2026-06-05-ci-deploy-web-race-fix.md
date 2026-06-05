---
tags: [changelog, ci, deploy, vps, infra, bug-fix]
created: 2026-06-05
modul: .github/workflows
---

# CI fix — deploy-web "race" (concurrency group)

> deploy-web ba'zan **intermittent FAIL** bo'lardi. Sabab topildi: deploy-backend
> va deploy-web **bir xil VPS papkasida** (`$VPS_PATH`) ishlaydi va ikkalasi
> ham `git pull` qiladi. Backend+web ikkalasini o'zgartiradigan commit ikkala
> workflow'ni **bir vaqtda** ishga tushiradi → `git pull` race → web fail.

## Tashxis (qanday topildi)
- GitHub Actions: `Deploy web panels 08aed91 → failure`, `Deploy backend 08aed91 → success`.
- VPS git tree **toza**, `git pull` qo'lda ishlaydi, `dist/` gitignored (0 tracked).
- filial_admin qo'lda build → muvaffaqiyatli (`index-C0Q_ucWa.js`).
- Failing step: "SSH → pull + build panellar" — lekin bundle yangilanmagan →
  fail **filial_admin build'idan oldin** (ya'ni `git pull`da).
- Intermittent: 68703a9 (backend+web) web deploy **success** edi, 08aed91 **fail** →
  determinant emas → klassik **race** belgisi.

## Yechim — shared concurrency group
`deploy-backend.yml` + `deploy-web.yml` ikkalasiga:
```yaml
concurrency:
  group: vps-deploy
  cancel-in-progress: false
```
GitHub'da `concurrency.group` repo bo'yicha global — bir xil nomli ikki workflow
**ketma-ket** bajariladi (biri tugaguncha ikkinchisi kutadi). Race yo'qoladi.
`cancel-in-progress: false` — kutayotgani bekor bo'lmaydi, navbat bilan ishlaydi.

## Holat
- #29 web (Расходы hisoboti) hozir **jonli** — filial_admin qo'lda build qilindi
  (panel `index-C0Q_ucWa.js` xizmat qilyapti). Concurrency fix keyingi
  backend+web commitlarda race'ni oldini oladi.
- Fix faqat `.github/**` o'zgartiradi → hech qaysi deploy trigger bo'lmaydi
  (path filtrlarga tushmaydi), keyingi push'da kuchga kiradi.

## Hali ochiq (alohida)
- **release-server (EXE) FAIL** — "Build + publish EXE" (electron-builder
  `--win --publish`) qadamida. Renderer build + install OK. Build log kerak
  (ehtimol GH_TOKEN/publish yoki wine/nsis). Local server EXE branch'ga shu
  orqali yetadi — keyin tuzatish kerak.

## Bog'liq
- [[2026-06-05-reports-expense-visibility]]
- [[2026-06-04-web-panels-deploy]]
