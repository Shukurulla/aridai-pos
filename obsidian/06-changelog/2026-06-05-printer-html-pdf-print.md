---
tags: [changelog, printer, chek, pdf, local-server, electron]
created: 2026-06-05
modul: local/aridaipos_server
---

# Chek chop etish — HTML → PDF → printer (testprinter oqimi)

> Foydalanuvchi: (1) test print ishlamayapti; (2) html→pdf→print bosqichi
> bo'lishi kerak; (3) `~/Desktop/projects/testprinter` loyihasidagidek (jadval
> ko'rinish chek). Avvalgi `webContents.print({silent})` termal printerda ishlamasdi.

## Reference (testprinter/index.js)
- puppeteer → `page.setContent(html)` → `page.pdf({width:"72mm"})` → `lp -d <printer>`.
- HTML: `<table>` ko'rinish, markazda nom + sana.

## Implement qilindi — `src/main/print.js`
**Oqim:** HTML (jadval) → PDF → printer. Reference bilan bir xil bosqichlar.
- **HTML→PDF**: Electron'ning **o'z Chromium**'i (`webContents.printToPDF`) —
  puppeteer **o'rniga** (Electron'da Chromium allaqachon bor; ikkinchisini
  bundle qilsak EXE ~170MB shishadi + build buziladi). Natija bir xil (Chromium).
  Kenglik **72mm**, balandlik kontentga moslanadi (`scrollHeight` → micron).
- **PDF→printer** (reference kabi, OS bo'yicha):
  - Windows → **pdf-to-printer** (SumatraPDF).
  - macOS/Linux → **`lp -d <printer>`** (CUPS).
- `buildTestReceiptHtml()` — jadval ko'rinishida test chek (nom, filial, sana, OK).

## index.js
- `printers:test` → endi `printHtml(buildTestReceiptHtml(...), deviceName)`.
- Eski `webContents.print({silent})` olib tashlandi (termal printerda ishlamasdi).

## Paketlash
- `pdf-to-printer` dependency + `build.asarUnpack: node_modules/pdf-to-printer`
  (SumatraPDF.exe asar ichidan emas, diskdan ishlashi uchun).
- Versiya 0.3.3 → **0.3.4**.

## Tekshirish (foydalanuvchi — dev, Mac)
1. Local server **restart** (kod diskda — qayta ishga tushirish yetadi).
2. Принтеры → printer ro'yxatda (XP-C260) → qo'shish → "Сохранить".
3. **"Тест"** → HTML→PDF→`lp` → chek chiqadi.
- Xato bo'lsa endi aniq sabab ko'rsatiladi (printHtml.catch → UI msg).

## Keyingi
- Real chek (buyurtma/to'lovda avtomatik) — shu `printHtml` qayta ishlatiladi
  (login→printer→kategoriya routing bilan, Phase 2).

## Bog'liq
- [[2026-06-05-local-server-printers-phase1]]
