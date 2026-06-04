---
tags: [changelog, ui, modal, smena, pos-monitor, filial-admin]
created: 2026-06-04
modul: global/filial_admin · local/aridaipos_monitor
---

# Maxsus modal (confirm/prompt/alert) + POS monitor smena yopish fix

> Brauzer `confirm/prompt/alert` o'rniga maxsus modal. POS monitorda smena
> yopish ishlamasdi — `confirm()` Electron'da bloklanib qolardi.

## 1. POS monitor — smena yopish FIX (#1)
- `ShiftClose.tsx`: `confirm('Закрыть смену?')` → **inline modal** (`requestClose`
  tugma → tasdiqlash modali → `doClose`). `alert(xato)` → **xato modali**.
- Sabab: Electron renderer'da `window.confirm()` ko'pincha `undefined` qaytaradi
  → `if(!confirm)` → yopish bekor bo'lardi. Endi modal — ishonchli.
- ShiftCloseScreen allaqachon bor edi (kassa sanash, summary) — faqat confirm
  to'sib qo'yardi. Versiya monitor 0.3.0.

## 2+3. Web admin (filial_admin) — barcha confirm/prompt/alert → modal
- Yangi **`ModalProvider` + `useModal()`** (`src/modal.jsx`): `confirm` /
  `prompt` / `alert` (Promise). Mavjud `.modal-bg`/`.modal` CSS qayta ishlatildi.
- **Almashtirildi (toza, browser dialog qolmadi):**
  - **Shifts**: smena ochish/yopish kassa summasi → `prompt` modal (#2)
  - **Orders**: order/pozitsiya bekor qilish sababi → `prompt` modal; xatolar → alert modal
  - **Categories/Tables/Foods**: o'chirish → `confirm` modal (danger); xatolar + import natijasi → alert modal
  - **Shell**: tizimdan chiqish → `confirm` modal
- Build: toza ✅. (Edit-forma `modal` state bilan to'qnashmaslik uchun hook `dlg`.)

## Holat
- POS monitor: smena yopish endi ishlaydi (release-monitor.yml → EXE).
- Web admin: modal hamma joyda (deploy-web.yml → VPS rebuild).

## Keyingi (ixtiyoriy)
POS monitorning BOSHQA `alert/confirm`lari (Settings, Dashboard, Reports,
CashierApp) — shared modal hook bilan almashtirish.

## Bog'liq
- [[2026-06-04-smena-filtri-monitor-local]]
