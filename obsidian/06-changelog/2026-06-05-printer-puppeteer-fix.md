---
tags: [changelog, printer, chek, puppeteer, pdf, local-server, bug-fix]
created: 2026-06-05
modul: local/aridaipos_server
---

# Chek fix — printToPDF → puppeteer (CUPS "Сбой фильтра")

> Test print qog'ozda chiqmadi. macOS print navbati: **"Остановлено; Сбой
> фильтра «Filter»; 0 страниц"**. Brauzerda Ctrl+P ishlardi.

## Sabab
- Men HTML→PDF uchun **Electron `printToPDF`** ishlatdim. Uning PDF'ini XP-C260
  ning **CUPS filtri rad etadi** ("Сбой фильтра") → 0 sahifa.
- testprinter loyihasi **puppeteer** ishlatadi — uning PDF'i shu printerда
  **ishlaydi** (isbotlangan). Men noto'g'ri almashtirdim.

## Yechim — puppeteer (reference kabi) + fallback
`print.js` `htmlToPdf`:
1. **ASOSIY: puppeteer** — `page.setContent(html)` → `page.pdf({width:"72mm",
   printBackground:true})`. testprinter bilan **bir xil**. Tekshirildi: valid
   PDF (1.4, 1 sahifa, 59KB) hosil bo'ladi.
2. **FALLBACK: Electron printToPDF** — agar puppeteer topilmasa (packaged EXE).
- Print: avvalgidek `lp -d` (Mac) / pdf-to-printer (Windows).

## Paketlash strategiyasi
- **puppeteer → devDependency**: dev'da bor (Mac CUPS uchun kerak), lekin
  EXE'ga **bundle qilinmaydi** (Chromium ~170MB shishmaydi, build buzilmaydi).
- EXE'da puppeteer yo'q → `import("puppeteer")` throw → **printToPDF fallback**
  (Windows'da pdf-to-printer/SumatraPDF robust — CUPS filtri yo'q, ishlashi kutiladi).
- `release-server.yml`: `PUPPETEER_SKIP_DOWNLOAD=true` (CI Chromium yuklamaydi).
- Versiya 0.3.4 → **0.3.5**.

## Tekshirish
- Dev (Mac): puppeteer PDF generatsiyasi ✅ (valid PDF). Foydalanuvchi restart →
  Принтеры → Тест → `lp` → chek chiqishi kerak (reference kabi).
- EXE (Windows): printToPDF fallback — qurilmada tekshirish kerak.

## Bog'liq
- [[2026-06-05-printer-html-pdf-print]] (oldingi — printToPDF, rad etilgan yondashuv)
