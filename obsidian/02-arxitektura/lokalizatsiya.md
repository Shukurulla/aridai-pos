---
tags: [arxitektura, i18n, lokalizatsiya]
created: 2026-05-29
---

# Lokalizatsiya (i18n)

## Tillar

| Til | Kod | Prioritet | Izoh |
|---|---|---|---|
| O'zbek (lotin) | `uz` | 🔴 asosiy | Default UZ |
| Rus | `ru` | 🟠 muhim | UZ + KZ keng tarqalgan |
| Qozoq | `kk` | 🟡 | KZ uchun |
| Ingliz | `en` | 🟢 | Dev/xalqaro |

> [!note] O'zbek lotin vs kirill
> Faqat lotin (`uz`). Kirill (`uz-Cyrl`) hozircha yo'q. Kerak bo'lsa keyin.

## Texnologiya

| Frontend | i18n kutubxonasi |
|---|---|
| Web (React) | `react-i18next` |
| Mobile (Flutter) | `flutter_localizations` + `intl` (arb files) |
| POS (React) | `react-i18next` |
| Backend (xabarlar) | oddiy key-value map |

## Tarjima fayllari

```
shared/i18n/
├── uz.json
├── ru.json
├── kk.json
└── en.json
```

```json
// uz.json
{
  "order.create": "Buyurtma berish",
  "order.pay": "To'lash",
  "shift.open": "Smena ochish",
  "shift.cannotClose": "Tolov kutayotgan {count} ta order bor",
  "money.som": "so'm",
  "error.unauthorized": "Ruxsat yo'q"
}
```

## Til tanlash

| Kim | Qanday |
|---|---|
| Web admin | Foydalanuvchi sozlamasi (default restaurant tili) |
| POS | Filial sozlamasi (`branch.locale` yoki `restaurant.locale`) |
| Mobile | Telefon tili yoki foydalanuvchi tanlovi |
| Mijoz QR | Brauzer tili yoki filial default |

```javascript
// restaurant/branch locale
restaurant.locale: { type: String, default: 'uz' }
```

## Valyuta formatlash bilan bog'liq

Til + valyuta birga ([[../07-nozik-nuqtalar/pul-valyuta-yaxlitlash]]):
- `uz` + `UZS` → "35 000 so'm"
- `ru` + `KZT` → "35 000 ₸"
- Raqam separatori: bo'sh joy (1 000 000) — ikkala tilda

## Sana/vaqt formatlash

`Intl.DateTimeFormat` bilan, timezone bilan ([[../07-nozik-nuqtalar/vaqt-va-soat]]):
```javascript
new Intl.DateTimeFormat('uz-UZ', { timeZone: 'Asia/Tashkent', dateStyle: 'short' });
```

## Backend xabarlar

API xato xabarlari — `code` qaytaradi, frontend tarjima qiladi:
```javascript
// Backend
return res.status(400).json({ status: 'error', code: 'SHIFT_HAS_PENDING', data: { count: 3 } });

// Frontend
t('shift.cannotClose', { count: error.data.count });
```

Backend matn yubormaydi (yoki default uz), frontend tarjima qiladi. Bu — til frontend'da hal qilinadi.

## Chek va PDF tili

- Chek printer: filial tili
- PDF chek (possiz): filial tili
- Kirill printer qo'llab-quvvatlashi ([[../07-nozik-nuqtalar/hardware-nozikliklari]])

## Tarjima qoidalari

- Hech qachon hardcoded matn — har doim `t('key')`
- Texnik atamalar tarjima qilinmaydi (online, sync, POS) — [[../01-vizyon/glossariy]]
- Domain atamalar tarjima (filial, smena, taom)

## Phase bo'yicha

- **Phase 1:** uz (asosiy) + i18n infra (kalit'lar)
- **Phase 2:** ru qo'shiladi
- **Phase 3+:** kk, en

## Bog'liq

- [[../07-nozik-nuqtalar/pul-valyuta-yaxlitlash]]
- [[../07-nozik-nuqtalar/vaqt-va-soat]]
- [[../01-vizyon/glossariy]]
- [[../08-frontend/umumiy-arxitektura]]
