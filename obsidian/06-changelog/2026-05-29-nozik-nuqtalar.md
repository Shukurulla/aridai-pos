---
tags: [changelog, nozik-nuqtalar, qaror]
date: 2026-05-29
type: edge-cases + decisions
---

# 2026-05-29 — Nozik nuqtalar bo'limi + 4 biznes qaror

## Sabab

Foydalanuvchi ta'kidladi: "hozir hammasini aniqlashtirishimiz kerak. keyinchalik yana tushuntirish esdan chiqishi mumkin." Butun tizimning eng oson unutiladigan, eng katta zarar keltiradigan nozik nuqtalarini hozir, context yangi paytda tutib qoldik.

## Foydalanuvchi tasdiqlagan 4 biznes/huquqiy qaror

| # | Savol | Qaror |
|---|---|---|
| A | Valyuta | **Har restoran bitta valyuta tanlaydi** (UZS yoki KZT). Multi-market, single-currency per restoran |
| B | Fiskal/KKM | **Hozircha yo'q, keyin qo'shamiz.** Schema'da reserved joy qoldiriladi |
| C | Chayyot pul (tip) | **YO'Q.** Faqat service charge yetarli |
| D | Chek raqami | **filial + sana + ketma-ket** (YUN-20260528-0042), offline-safe |

## Yangi bo'lim: 07-nozik-nuqtalar/ (13 fayl)

- [[../07-nozik-nuqtalar/_MOC|_MOC.md]] — navigatsiya + qaror jadvali
- [[../07-nozik-nuqtalar/vaqt-va-soat|vaqt-va-soat.md]] — NTP, clock drift, UTC, business day (06:00), hourly tarif aniqligi
- [[../07-nozik-nuqtalar/pul-valyuta-yaxlitlash|pul-valyuta-yaxlitlash.md]] — integer pul, per-restoran valyuta (qaror A), tip YO'Q (qaror C), yaxlitlash
- [[../07-nozik-nuqtalar/chek-raqamlash|chek-raqamlash.md]] — offline-safe ketma-ket (qaror D), atomic counter
- [[../07-nozik-nuqtalar/fiskal-soliq|fiskal-soliq.md]] — KKM kelajak (qaror B), schema room, QQS reserved
- [[../07-nozik-nuqtalar/concurrency-race|concurrency-race.md]] — 6 race scenario, optimistic lock, transaction (replica set!)
- [[../07-nozik-nuqtalar/id-generatsiya|id-generatsiya.md]] — ObjectId lokal vs global, clientId, collision
- [[../07-nozik-nuqtalar/ochirish-cascade|ochirish-cascade.md]] — cascade jadval, soft delete, taqiqlar
- [[../07-nozik-nuqtalar/data-osishi-arxivlash|data-osishi-arxivlash.md]] — lokal 90 kun, global 1 yil archive, backup-restore duplikat
- [[../07-nozik-nuqtalar/telefon-normalizatsiya|telefon-normalizatsiya.md]] — E.164, +998/+7, keshbek matching
- [[../07-nozik-nuqtalar/hardware-nozikliklari|hardware-nozikliklari.md]] — printer offline, cash drawer, kitchen vs receipt
- [[../07-nozik-nuqtalar/split-bill-order-tahrir|split-bill-order-tahrir.md]] — split payment, parentOrderId, tolovdan keyin
- [[../07-nozik-nuqtalar/xavfsizlik-qoshimcha|xavfsizlik-qoshimcha.md]] — o'g'irlangan POS, image magic bytes, NoSQL injection, mass assignment

## Core hujjatlarga singdirilgan o'zgarishlar

| Fayl | O'zgarish |
|---|---|
| [[../05-data-model/restaurant]] | + `currency` (immutable), `timezone`, `businessDayStartHour` |
| [[../05-data-model/branch]] | + `receiptPrefix` |
| [[../05-data-model/order]] | + `receiptNumber` (unique index), `currency` snapshot, `parentOrderId`, `fiscal` (reserved), tip YO'Q izoh |
| [[../00-INDEX]] | + Nozik nuqtalar bo'limi |

## Muhim texnik kashfiyot (qaror kerak)

> [!important] Lokal MongoDB — single-node replica set
> [[../07-nozik-nuqtalar/concurrency-race]] da aniqlandi: MongoDB **transactions** (stock+order atomik) **replica set** talab qiladi. Standalone'da ishlamaydi.
>
> **Tavsiya:** Lokal MongoDB'ni installer **single-node replica set** sifatida o'rnatsin. Bu:
> 1. Transaction'ni yoqadi
> 2. Change streams beradi (sync uchun foydali)
>
> Bu [[../02-arxitektura/local-backend-stack#Open qarorlar]] dagi "MongoDB versiyasi" ochiq qarorini **hal qiladi**: single-node replica set.

## Yana identifikatsiyalangan default qarorlar (revisable)

- Lokal data retention: 90 kun (faqat synced o'chiriladi)
- Global data retention: 1 yil hot + archive (fiskal bo'lsa 5 yil)
- Outbox cleanup: acked + 7 kun
- Bir stol = bir active order (multi-order kelajak)
- Tolangan order immutable, yangi taom = linked order (parentOrderId)
- Split — payment-level (paidAmounts), full split kelajak
- Image: magic bytes + sharp re-encode
- NoSQL injection: express-mongo-sanitize

## Statistika

- Bu sessiyada: 13 yangi fayl + 4 core edit + 1 INDEX + 1 changelog
- Vault'da jami: ~83 fayl

## Bog'liq

- [[2026-05-28-data-model-toldirildi]]
- [[2026-05-28-biznes-mantiq-sinxron-toldirildi]]
- [[../07-nozik-nuqtalar/_MOC]]
