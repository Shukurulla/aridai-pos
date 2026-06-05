---
tags: [changelog, ci, exe, electron-builder, local-server, bug-fix]
created: 2026-06-05
modul: local/aridaipos_server · .github/workflows
---

# release-server (EXE) build fix — .env + bcrypt→bcryptjs

> `Release local server (EXE)` workflow doim FAIL bo'lardi ("Build + publish EXE"
> qadami). Monitor EXE ishlardi. Ikki sabab topildi va tuzatildi.

## Sabab 1 — `build.files`da `.env`
- `package.json` `build.files`'da `".env"` ro'yxatda edi. `.env` gitignored
  (secret) → CI checkout'da YO'Q → electron-builder uni topolmay fail.
- Monitor'da `.env` yo'q edi → u ishlardi (asosiy farq).
- Secret'ni distributable EXE'ga solish xavfsizlik jihatidan ham noto'g'ri.
- **Fix**: `.env` `build.files`'dan olib tashlandi. Runtime config defaults
  (config/index.js: `globalUrl → production`) yoki kelajakda local.json.

## Sabab 2 — `bcrypt` (native modul)
- Server `bcrypt` (^6) ishlatardi — **native** modul, Electron uchun node-gyp
  bilan qayta build bo'lishi kerak. windows runner'da bu fail bo'lardi (tez,
  ~90s). Monitor'da bcrypt yo'q → farq shu.
- **Fix**: `bcrypt` → **`bcryptjs`** (pure-JS, kompilyatsiya yo'q). Faqat bitta
  fayl: `utils/password.js` import o'zgardi (API bir xil: hash/compare promise).
- **Moslik tekshirildi**: `bcryptjs.compare("test1234", <global $2b$ hash>)` →
  **true** (production DB'dan olingan real hash bilan). Ya'ni POS login sync
  qilingan user hashlarini ($2b$) verify qila oladi. Yangi hashlar $2a$ —
  global bcrypt ularni ham verify qiladi. Ikki tomonlama mos.

## Holat
- Global VPS backend `bcrypt`da qoladi (Linux'da native ishlaydi — tegmadim).
- Faqat LOCAL server (EXE) `bcryptjs`ga o'tdi.
- Versiya 0.3.1. release-server.yml qayta ishga tushadi — natija kuzatiladi.

## Bog'liq
- [[2026-06-05-ci-deploy-web-race-fix]]
