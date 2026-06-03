---
tags: [changelog, kod, dizayn, pos, ui]
date: 2026-05-30
type: implementation
---

# 2026-05-30 — Kepket dizayniga o'tkazish: POS (1/3)

## Sabab

Foydalanuvchi: AridaiPos UI `kepket-kz` loyihasi (oldingi implementatsiya) bilan bir xil
bo'lishi kerak. Tanlov: **hammasi ketma-ket**, **dizayn o'zgaradi — funksional saqlanadi**.

Manba: `kepket-kz/aridai-pos-monitor` (`lib/theme.tsx`, `shell.tsx`) + screenshotlar.

## Dizayn tizimi (kepket Variant B — warm, status-coded)

| Token | Qiymat |
|---|---|
| fon | `#f4f1ea` (krem) |
| surface | `#ffffff` |
| brand/CTA | `#d72121` (qizil) |
| text | `#0a0a0a` |
| border-strong | `#0a0a0a` (tugma border) |
| status | ready `#1f7a3a`, preparing `#a86a14`, served `#22588c`, cancelled `#a8302a` |
| font | **Manrope** (400–900) |
| **radius** | **0** (keskin burchak) |

Pul: `₸` (tenge), `toLocaleString('ru-RU')`.

## Bajarilgan ish (local/renderer)

- `index.css` — to'liq kepket dizayn tizimi (CSS variables + komponent class'lar: header,
  sidenav, food-card, cart, cta, btn, pill, modal, tables, ...). Manrope (Google Fonts).
- `components/Header.jsx` — tepa header: logo + restoran/filial, ВЫРУЧКА/НАЛИЧНЫЕ/КАРТА/ПЕРЕВОД
  statistika, Смена badge + vaqt, kassir.
- `components/SideNav.jsx` — chap 116px icon-nav (Меню, Настройки) + pastda Закрыть смену / Выход.
- `pages/POS.jsx` — kepket layout (Header + SideNav + content), summary hisoblash (joriy smena
  paid orderlardan), screen state (menu/settings). Funksional o'zgarmadi.
- `pages/Settings.jsx` — Настройки (filial + "Перепривязать кассу").
- Logo `assets/logo.png` (kepket'dan).

## Tasdiqlash (Preview, 1366×768)

✅ Login ekrani — krem fon, oq card, qizil CTA, uppercase label, keskin burchak
✅ POS — header (statistika + смена badge + kassir), chap qizil-active sidebar, food-card grid
   (oq, qora chap chiziq, qalin narx ₸)
✅ Cart — `Osh 35 000 ₸` qty, **Сервис 10% +3 500**, **Итого 38 500 ₸**, Заказать/Оплатить (qizil)
✅ Calc to'g'ri (service hisoblash saqlandi)

## Qolgan (Task #23 davomi)
- **Owner panel** (owner_admin) — kepket dizayn (2/3)
- **System panel** (restaurant_admin) — kepket dizayn (3/3)
- Modallar (Payment/Table/Option/Shift) — kepket class'lar bilan ishlaydi (alias), to'liq jilolash
- Offline uchun Manrope local (@fontsource) — hozir Google Fonts (dev)

## Bog'liq
- kepket-kz/aridai-pos-monitor/src/renderer/src/lib/theme.tsx — manba
- [[2026-05-30-pos-terminal-ui]] — POS funksional (saqlandi)
