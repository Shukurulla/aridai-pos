---
tags: [changelog, keshbek]
created: 2026-06-12
---

# 2026-06-12 — Keshbek: web capture + toggle + POS КЕШБЭК tugma + WhatsApp prep

Foydalanuvchi 3 talabi bo'yicha keshbek tizimi to'liq ishlaydigan holatga keltirildi.
Commit: `9752038` (global backend VPS'ga deploy bo'ldi, smoke-test ✓).

## 1. QR → telefon so'raydigan web sahifa (JSON emas)

- `GET /api/keshbek/qr-session/:token` endi **content-negotiation**:
  - Brauzer (`Accept: text/html`) → server-rendered mobil HTML: "Оплата
    подтверждена", "+X кешбэка", telefon input → `POST .../phone` → "Начислено
    X, баланс Y".
  - API client (`Accept: */*`) → avvalgidek JSON.
- `whatsappNumber` sozlangan bo'lsa wa.me deep-link tugma ham.
- Eski printlangan QR'lar (shu URL'ga ishora qiladi) avtomatik web sahifa
  ko'rsatadi — qayta print shart emas.
- **XSS himoyasi:** token `<script>` ichiga kiradi → faqat `[A-Za-z0-9_]`
  qoldiriladi (live smoke: `<script>alert(1)` → 0 marta).

## 2. Chek QR toggle'ni hurmat qiladi (OFF → QR yo'q)

- `local print-hub`: `cashbackQr` faqat `keshbekConfig().enabled` bo'lsa.
- `global receipt` sahifasi: `kbBlock` enabled gate.
- Eski pending sessiya qolsa ham, toggle o'chiq → QR chiqmaydi.

## 3. POS to'lovida alohida "КЕШБЭК" tugma

- `Payment.tsx`: 5-usul (toggle ON + online). Telefon → Проверить → balans →
  balansdan to'lov (to'liq yoki gibrid). Yetmasa qolgani naqd/karta/perevod
  (tez tugma) yoki "Разделить" (qo'lda). Backend'ga `mixed` + `split.cashback`.
- Keshbek СМЕШАННАЯ ichidan chiqarildi (endi alohida usul).

## 4. WhatsApp-gacha tayyorgarlik

- Webhook `GET` verify (`hub.challenge` + `verify_token`), `POST` parser
  (`KB_token` + `from` → `capturePhone`), HMAC `X-Hub-Signature-256`
  (`rawBody` global `express.json verify`). `config.whatsapp` ixtiyoriy.
- Qoldi: Meta test account (kredensial) — `.env`: `WHATSAPP_VERIFY_TOKEN`,
  `WHATSAPP_APP_SECRET`; `features.keshbek.config.whatsappNumber`.

## Adversarial review (16 agent) → 9 tasdiqlangan masala tuzatildi

- **HIGH** — КЕШБЭК→СМЕШАННАЯ o'tishda ko'rinmas `split.cashback` mijoz
  balansidan jimgina yechilardi → usul almashganda split tozalanadi +
  `confirm()` cashback'ni faqat `cashback` usulida yuboradi.
- **MEDIUM** — `/pay`'da spend GLOBAL'da bo'lib `order.save()` uzilsa balans
  drenaj → save uzilsa `refundViaGlobal` (idempotent) kompensatsiya.
- **MEDIUM** — `capturePhone` toggle gate'siz (webhook OFF'da earn qilardi) →
  `capturePhone` ichida yagona enabled gate, sessiya pending'ga qaytadi.
- **LOW** — webhook HMAC fail-closed; `payments[].mixed.cashback` (2 model) +
  `finalizePayments` agregati (partiallyPaid+cashback yaxlitligi).

## Bog'liq

- [[../04-toollar/keshbek-tizimi]]
- [[2026-05-29-keshbek-offline-qaror]]
