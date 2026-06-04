---
tags: [changelog, mobile, test, config, server-url]
created: 2026-06-04
modul: aridai-pos-app · login
---

# Mobil server-URL sozlanadigan (real qurilmada test uchun)

> Test blokeri: `baseUrl = http://localhost:4560/api` edi. Real telefonda
> `localhost` — telefonning **o'zi**, demak backendga yetolmaydi. Endi login
> ekranidan server manzilini kiritsa bo'ladi.

## Nima qilindi
- **`ApiService`**: `baseUrl`/`fileHost` endi dinamik (`_apiBase`, default
  localhost). `loadServerUrl()` (startup'da prefs'dan o'qiydi) + `setServerUrl()`
  (normalizatsiya: `http://` qo'shadi, `/api` bilan tugatadi, saqlaydi + Dio'ga
  qo'llaydi). `loadSession()` ichida yuklanadi.
- **Login ekrani**: kartochka ostida **"Сервер: <url>"** tugmasi → dialog'da
  manzil kiritiladi (masalan `http://192.168.1.10:4560`). Saqlanadi.

## Test ma'lumotlari (lokal DB)
Parol barchasiga: **`test1234`**
| Rol | Telefon |
|---|---|
| Владелец (owner) | +77000000001 |
| Администратор | +998901110001 |
| Официант | +77001112233 |
| Повар | +77001113355 |
| Кассир | +77001114455 |

## Qanday test qilish (mobil, real qurilma)
1. APK'ni o'rnating (CI `app-v1.7.0` release'dan).
2. Login ekranida **Сервер** → kompyuter LAN IP yoki VPS manzili (`http://IP:4560`).
   - Android emulator: `http://10.0.2.2:4560`.
3. Yuqoridagi login bilan kiring.

## Bog'liq
- [[2026-06-04-server-auto-update]] (oldingi qadam)
