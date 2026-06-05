---
tags: [changelog, printer, chek, local-server, electron, "#chek-printer"]
created: 2026-06-05
modul: local/aridaipos_server
---

# Local server — Printerlar (Phase 1: ro'yxat + saqlash + test)

> Foydalanuvchi: "local serverda printerlar ro'yxati ko'rinmayapti". Sabab:
> `printers:*` IPC handlerlari **stub** edi (`[]` qaytarardi — "kepket printer-hub
> keyingi bosqich"). Phase 1 implement qilindi.

## Muammo
- `PrintersPage.jsx` to'liq UI bor edi (devices dropdown, saqlash, test, login,
  logo), lekin `main/index.js`dagi barcha `printers:*` handler `[]`/stub qaytarardi.
- `printers:devices` → `[]` → "Принтеры в системе не найдены" (ro'yxat bo'sh).

## Implement qilindi (Phase 1)
### Yangi model
- `models/printer.model.js` — lokal printer config (name, device_name, kind,
  is_default, ip_address). **Lokal** (sync qilinmaydi — har PC o'z printerlari).
  `index.js` model loader'ga ulandi.

### IPC handlerlar (stub → real)
- **`printers:devices`** → `mainWindow.webContents.getPrintersAsync()` — OS'ga
  ulangan printerlar (name, displayName, isDefault). **Bu — asosiy fix.**
- **`printers:list`** → saqlangan printerlar (local Mongo).
- **`printers:save`** → qo'shish/tahrir; `is_default` bitta bo'lishi ta'minlanadi.
- **`printers:remove`** → o'chirish.
- **`printers:test`** → yashirin oynada OS drayveri orqali test chek
  (`webContents.print({silent, deviceName})`) — ESC/POS shart emas, OS printeri bo'lsa bo'ldi.

### Graceful deferred (keyingi bosqich — UI buzilmaydi)
- Login biriktirish (`loginAdd` → "в следующем обновлении"), logo (`logoUpload`)
  — hozircha xato bermaydigan stub. To'liq: login→printer→kategoriya binding +
  buyurtmada avtomatik chek chop etish (Phase 2, monitorning receipt-generator bilan).

## Versiya / yetkazish
- 0.3.1 → **0.3.2**. release-server.yml → yangi EXE (build endi ishlaydi).
- ⚠️ Electron API'lar bu yerda runtime-test qilinmadi (display/printer yo'q).
  Kod standart Electron — **Windows PC + printer'da tekshirish kerak**:
  Принтеры → ro'yxat chiqishi → "+Добавить" → printer tanlash → saqlash → "Тест".

## Bog'liq
- [[2026-06-05-exe-build-fix]] (EXE build endi ishlaydi — bu feature yetkaziladi)
