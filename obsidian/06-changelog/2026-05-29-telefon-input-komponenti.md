---
tags: [changelog, kod, frontend, ux]
date: 2026-05-29
type: implementation
---

# 2026-05-29 — Telefon kiritish komponenti (mamlakat kodi + mask)

## Sabab

Foydalanuvchi: telefon maydonida `+998` qismi **select** bo'lsin, qolgani mask bo'yicha —
`+998` → `XX XXX XX XX`, `+7` → `XXX XXX XX XX`.

## Bajarilgan ish

**Yangi komponent** `PhoneInput.jsx` (ikkala panelda bir xil nusxa):
- Mamlakat kodi **select**: `+998` (9 raqam) / `+7` (10 raqam)
- Raqam maydoni — kiritish paytida avtomatik guruhlanadi (mask):
  - `+998` → `XX XXX XX XX` (2-3-2-2)
  - `+7` → `XXX XXX XX XX` (3-3-2-2)
- Tashqariga **E.164** formatda beradi (`+998901234567`) — backend `normalizePhone` shuni kutadi
- `value` (initial) ni parse qiladi (edit'da to'g'ri kod + raqam ko'rsatiladi)
- Mamlakat o'zgarsa, raqam yangi uzunlikка trim bo'ladi
- `disabled` (edit'da telefon o'zgarmasligi uchun) qo'llab-quvvatlanadi

**Ishlatilgan joylar:**
| Panel | Joy |
|---|---|
| owner_admin | Login (telefon), StaffForm (xodim telefoni) |
| restaurant_admin | RestaurantForm (egasi telefoni) |

CSS: `.phone-input` (flex), `.phone-cc` (select, 92px), `.phone-num` (raqam, letter-spacing).

## Tasdiqlash

✅ Mantiq (Node test): format `90 123 45 67` / `700 123 45 67`, qisman kiritish, parse, E.164 emit
✅ Ikkala panel build — toza
✅ Edit'да initial value to'g'ri parse (`+998901112233` → +998 / 901112233)

## Bog'liq
- [[2026-05-29-rus-tili-filial-detal-xodimlar]]
- [[../07-nozik-nuqtalar/telefon-normalizatsiya]] — backend E.164 normalizatsiya
