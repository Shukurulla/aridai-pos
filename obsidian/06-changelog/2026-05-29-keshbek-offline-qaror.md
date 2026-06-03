---
tags: [changelog, qaror, keshbek]
date: 2026-05-29
type: decision
---

# 2026-05-29 — Keshbek offline qarori

## Qaror (foydalanuvchi, yakuniy va sodda)

> **Offline rejimda keshbek bilan TOLASH (spend) ishlamaydi.**

Avval murakkab variantlar muhokama qilingan edi (cached balans, lokal real-time yig'ish, hybrid, reconcile). Foydalanuvchi ularning hammasini bekor qildi: *"barchasini unut. keshbek bilan tolash ofline rejimda ishlamasligi kerak."*

## Yakuniy dizayn

| Amal | Online | Offline | Possiz |
|---|---|---|---|
| **Earn (qo'shish)** | ✅ ishlaydi | ✅ ishlaydi (deferred, QR keyin skanerlanadi) | ✅ (PDF chekka QR) |
| **Spend (tolash)** | ✅ ishlaydi | ❌ **DISABLED** | ❌ **DISABLED** |

## Asoslar

- Keshbek balansi **restoran bo'yicha umumiy** (`cashback_balance: restaurantId + clientPhone`)
- Offline'da umumiy hisoblagichni kamaytirish = **double-spend xavfi** (boshqa filial/eski cache)
- Eng sodda va xavfsiz yechim: offline spend butunlay yo'q
- **Asimmetriya:** earn balansni oshiradi (+, QR-skanerlash orqali global'da) → xavfsiz. Spend kamaytiradi (−, umumiy hisoblagich) → xavfli. Shuning uchun earn ✅, spend ❌.

## Implementatsiya

- POS tolov panelida "Keshbek" tugmasi offline/possiz'da **disabled**
- Mijozga: "Keshbek bilan tolash hozir mavjud emas. Internet qaytganda ishlatasiz."
- Hech qanday cached balans tekshiruvi, hech qanday reconcile yo'q — sodda
- Earn: chek QR offline'da chiqadi (lokal token), mijoz keyin skanerlaydi → online'da hisoblanadi

## O'zgartirilgan hujjatlar

- [[../04-toollar/keshbek-tizimi#Offline]] — qaror callout + earn/spend asimmetriya
- [[../04-toollar/keshbek-tizimi]] — Possiz bo'limi + test rejasi
- [[../05-data-model/biznes-mantiq/tolov-oqimi#Offline'da tolov]] — disabled
- [[../05-data-model/biznes-mantiq/tolov-oqimi#Possiz'da tolov]] — disabled

## Soddalashtirish foydasi

Bu qaror tizimni ancha soddalashtiradi:
- Offline'da keshbek balans cache kerak emas
- Reconcile/conflict logikasi kerak emas
- Overspend holati umuman bo'lmaydi
- Sync engine yengilroq

## Bog'liq

- [[../04-toollar/keshbek-tizimi]]
- [[2026-05-29-nozik-nuqtalar]]
