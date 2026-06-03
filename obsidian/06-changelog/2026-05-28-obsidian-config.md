---
tags: [changelog, konfig]
date: 2026-05-28
type: tooling
---

# 2026-05-28 — Obsidian vault konfiguratsiyasi

## O'zgarish

Vault root sifatida butun loyiha papkasi (`AridaiPos_v2/`) ochildi. Bu — kod va hujjatlarni bir joyda ko'rish uchun qulay, lekin Obsidian `node_modules` va boshqa kerakmas papkalarni ham indekslay boshlaydi.

## Yechim

`.obsidian/app.json` da `userIgnoreFilters` ro'yxati o'rnatildi.

## Filtrlangan papkalar/fayllar

| Filtr | Sabab |
|---|---|
| `node_modules/` | NPM bog'liqliklari (minglab fayllar) |
| `global/backend/node_modules/` | Aniq yo'l (filter ishonchli bo'lsin) |
| `local/backend/node_modules/` | Kelajakda yaratiladi |
| `.git/` | Git ichki fayllar |
| `uploads/` | Foydalanuvchi yuklagan rasm/fayllar |
| `global/backend/uploads/` | Aniq yo'l |
| `dist/`, `build/` | Build chiqishlari |
| `*.lock`, `package-lock.json`, `yarn.lock` | Katta JSON fayllar |
| `*.log` | Log fayllar |
| `.DS_Store` | macOS Finder metadata |
| `.env` | Maxfiy ma'lumotlar |
| `*.exe`, `*.dmg` | Binarniy paketlar |

## Foydalanish

Obsidian ushbu o'zgarishni avtomatik qabul qilmasligi mumkin. Quyidagi yo'llardan biri:

1. **`Cmd+P` → "Reload app without saving"** — eng tez yo'l
2. Yoki vault'ni yopib qayta ochish

## Tekshirish

Reload'dan keyin chap paneldagi file explorer'da `global/backend/node_modules` ko'rinmasligi va graf yengillashishi kerak.

## Bog'liq

- [[2026-05-28-vault-yaratildi]]
- [[2026-05-28-local-stack-qarori]]
