---
tags: [changelog, kod, pos, electron, frontend]
date: 2026-05-30
type: implementation
---

# 2026-05-30 — POS terminal UI (Electron renderer) + Electron qobiq

## Sabab

Local backend + sync tayyor bo'lgach, kassir uchun vizual POS terminal kerak edi.
Touch-friendly, rus tilida, lokal backendga (4561) ulanadi.

## Bajarilgan ish (local/renderer + local/electron)

### POS renderer (React + Vite)
| Fayl | Maqsad |
|---|---|
| `api.js` | lokal backend (4561) client; offline-aware (NETWORK), `money()` |
| `calc.js` | optimistik total — backend order-calc bilan BIR XIL formula (service chegirmadan keyin) |
| `auth.jsx` | POS login (lokal token) |
| `pages/Login.jsx` | telefon + parol |
| `pages/POS.jsx` | asosiy terminal: menyu grid, savatcha, service/discount toggle, jonli total |
| `components/StatusBar.jsx` | online/offline, smena, xodim, chiqish |
| `components/ShiftModal.jsx` | smena ochish (boshlang'ich kassa) |
| `components/TableModal.jsx` | stol tanlash (dineIn) |
| `components/OptionModal.jsx` | service / chegirma tanlash |
| `components/PaymentModal.jsx` | to'lov (cash/card/transfer/kaspi) + naqd qaytim |
| `index.css` | touch-friendly to'q tema (katta tugmalar, grid) |

### Electron qobiq
- `electron/main.js` — main process'da **local backend** (`startLocalBackend`) ishga tushadi,
  so'ng POS oynasi ochiladi (dev: vite 5180, prod: renderer/dist). (Variant A — local-backend-stack.md)
- `electron/preload.cjs` — `window.LOCAL_API` (renderer → lokal backend manzili).
- `package.json` deps o'rnatildi (electron, vite, react).

## Tasdiqlash (jonli — Preview brauzeri orqali)

To'liq oqim ekranda ko'rsatildi va ishladi:
1. ✅ **Login** (Касса, rus tilida) → POS
2. ✅ Smena ochiq, status bar (Онлайн), menyu (sync'dan: 5 taom, 2 kategoriya)
3. ✅ Savatcha: Osh×2 + Choy×1 = 75 000, **Сервис +7 500** (10%), Итого 82 500
4. ✅ **Chegirma 10% → Сервис +6 750** (= (75000−7500)×10%, chegirmadan KEYIN), Итого **74 250**
   — foydalanuvchi talabi UI'da ham to'g'ri
5. ✅ "Оплатить" → stol so'radi → Стол 1 → to'lov oynasi (chek MKZ-20260530-0002)
6. ✅ Naqd 100 000 → **Сдача 25 750** (qaytim to'g'ri)
7. ✅ To'lov → savatcha tozalandi
8. ✅ **To'liq tsikl**: UI order → local Mongo (pending) → push → global'da `synced` (74250)

## Hozirgi tizim
| Komponent | Port | Holat |
|---|---|---|
| Global backend | 4560 | ✅ + sync |
| Local backend | 4561 | ✅ + local Mongo |
| System admin panel | 5173 | ✅ |
| Owner panel | 5174 | ✅ |
| POS terminal (renderer) | 5180 (dev) | ✅ Electron qobiq tayyor |

## Qolgan
- Electron oynani real ishga tushirib test (`npm run electron`) — hozir Preview/brauzerda tasdiqlandi
- Avtomatik davriy sync (interval/socket) — hozir manual `push-once.js`
- Cook (oshpaz) ekrani, chek print (ESC/POS), offline outbox UI
- electron-builder paketlash (Windows .exe + MongoDB installer)

## Bog'liq
- [[../08-frontend/pos-electron]] — POS spetsifikatsiyasi
- [[2026-05-30-local-backend-sync]] — local backend + sync (oldingi qadam)
- [[../05-data-model/biznes-mantiq/total-hisoblash]] — calc (service chegirmadan keyin)
