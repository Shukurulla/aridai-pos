---
tags: [nozik-nuqta, telefon]
created: 2026-05-29
---

# Telefon raqami normalizatsiya

## Muammo

Telefon raqami har xil formatda kiritiladi:
- `+998 90 123 45 67`
- `998901234567`
- `90 123 45 67`
- `8 (90) 123-45-67` (eski rus formati)
- `+7 701 234 5678` (Qozog'iston)

Bular **bir xil raqam**, lekin string sifatida har xil. Quyidagi joylarda muammo:
- **Login** — user phone bilan kiradi
- **Keshbek** — mijoz telefoni bo'yicha balans topiladi ([[../04-toollar/keshbek-tizimi]])
- **Restoran owner** — login
- **Unique constraint** — `+998901234567` va `998901234567` ikki xil user bo'lib qoladi

## Qaror: E.164 formatda saqlash

Barcha telefon raqamlari **E.164** standartida saqlanadi:
```
+998901234567   (O'zbekiston)
+77012345678    (Qozog'iston)
```

Kiritishda normalizatsiya, saqlashda E.164, ko'rsatishda chiroyli format.

## Normalizatsiya funksiyasi

```javascript
// shared/phone.js
function normalizePhone(input, defaultCountry = 'UZ') {
  // 1. Faqat raqam va + qoldirish
  let cleaned = input.replace(/[^\d+]/g, '');

  // 2. Leading 8 (eski rus/kz format) → mamlakat kodi
  if (cleaned.startsWith('8') && cleaned.length === 11) {
    cleaned = '+7' + cleaned.slice(1);  // KZ/RU
  }

  // 3. + yo'q bo'lsa qo'shish
  if (!cleaned.startsWith('+')) {
    if (cleaned.startsWith('998')) cleaned = '+' + cleaned;        // UZ
    else if (cleaned.startsWith('7')) cleaned = '+' + cleaned;     // KZ
    else if (cleaned.length === 9 && defaultCountry === 'UZ') {
      cleaned = '+998' + cleaned;  // mahalliy UZ raqam
    }
    else if (cleaned.length === 10 && defaultCountry === 'KZ') {
      cleaned = '+7' + cleaned;
    }
  }

  // 4. Validatsiya
  if (!isValidE164(cleaned)) {
    throw new Error(`Noto'g'ri telefon raqami: ${input}`);
  }

  return cleaned;
}

function isValidE164(phone) {
  return /^\+\d{10,15}$/.test(phone);
}
```

> [!note] libphonenumber kutubxonasi
> Production'da `libphonenumber-js` (Google) ishlatish tavsiya — har mamlakat qoidalarini biladi. Yuqoridagi sodda versiya — boshlang'ich.

## defaultCountry — restaurant'dan

Restoran valyutasi ([[pul-valyuta-yaxlitlash]]) defaultCountry'ni belgilaydi:
- `currency: 'UZS'` → `defaultCountry: 'UZ'`
- `currency: 'KZT'` → `defaultCountry: 'KZ'`

```javascript
const country = restaurant.currency === 'KZT' ? 'KZ' : 'UZ';
const normalized = normalizePhone(input, country);
```

## Qayerda qo'llaniladi

| Joy | Normalizatsiya |
|---|---|
| User register/login | input → normalize → saqlash/qidirish |
| Restaurant owner | input → normalize |
| Keshbek mijoz telefoni | WhatsApp bot'dan keladi (allaqachon E.164) yoki cashier kiritadi |
| Unique constraint | normalize qilingan qiymat saqlanadi |

## Keshbek bilan munosabati

Keshbek balans `clientPhone` bo'yicha topiladi. Agar normalizatsiya bo'lmasa:
- Mijoz birinchi marta `+998901234567` bilan keshbek oldi
- Keyingi safar cashier `901234567` kiritdi
- Balans topilmaydi → mijoz "mening keshbegim qani?"

Normalizatsiya **majburiy** keshbek uchun.

## WhatsApp bot'dan kelgan raqam

WhatsApp Cloud API telefon raqamni E.164'siz, lekin to'liq formatda beradi (masalan `998901234567`). Bot uni normalize qiladi:

```javascript
// WhatsApp webhook
const rawPhone = message.from; // "998901234567"
const normalized = normalizePhone(rawPhone, restaurant_country);
```

## Ko'rsatish formati

Saqlash E.164, lekin UI chiroyli ko'rsatadi:
```javascript
function formatPhoneDisplay(e164) {
  // +998901234567 → +998 90 123 45 67
  if (e164.startsWith('+998')) {
    return e164.replace(/^(\+998)(\d{2})(\d{3})(\d{2})(\d{2})$/, '$1 $2 $3 $4 $5');
  }
  if (e164.startsWith('+7')) {
    return e164.replace(/^(\+7)(\d{3})(\d{3})(\d{2})(\d{2})$/, '$1 $2 $3 $4 $5');
  }
  return e164;
}
```

## Test rejasi

- [ ] `+998 90 123 45 67` → `+998901234567`
- [ ] `998901234567` → `+998901234567`
- [ ] `901234567` (UZ default) → `+998901234567`
- [ ] `8 701 234 5678` → `+77012345678`
- [ ] Noto'g'ri raqam → error
- [ ] Keshbek matching normalize bilan
- [ ] Display format

## Bog'liq

- [[../04-toollar/keshbek-tizimi]]
- [[pul-valyuta-yaxlitlash]] — country
- [[../05-data-model/user]]
- [[../05-data-model/restaurant]]
