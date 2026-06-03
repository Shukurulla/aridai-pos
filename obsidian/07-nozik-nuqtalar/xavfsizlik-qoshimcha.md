---
tags: [nozik-nuqta, xavfsizlik]
created: 2026-05-29
---

# Xavfsizlik qo'shimcha nozikliklari

> Asosiy xavfsizlik [[../02-arxitektura/multi-tenant-xavfsizlik]] va [[../02-arxitektura/xavfsizlik/_MOC]] da. Bu yerda — oson unutiladigan qo'shimcha nozikliklar.

## 1. O'g'irlangan POS PC (branchToken)

POS PC o'g'irlandi yoki yo'qoldi. Unda `branchToken` plaintext (`local.json`).

### Xavf
- O'g'ri branchToken bilan global VPS'ga ulanadi
- Filial ma'lumotlarini o'qiydi
- Soxta order yaratadi

### Qaror
- Admin web'da "Filial qurilmasini bloklash" → `branch.tokenRevoked = true`
- Bloklangan token bilan ulanish rad etiladi
- Yangi POS PC → yangi branchToken (admin beradi)
- IP whitelist (agar filial statik IP) — boshqa joydan ulanish anomaliya ([[../02-arxitektura/xavfsizlik/socket-xavfsizligi#IP whitelisting]])
- Geo-anomaliya alert

## 2. Image upload xavfi

Joriy [upload.middleware.js](../../global/backend/middlewares/upload.middleware.js) faqat `mimetype` tekshiradi:
```javascript
if (!file.mimetype.startsWith("image/")) { ... }  // SPOOFABLE!
```

### Xavf
- `mimetype` HTTP header — soxtalashtirilishi mumkin
- Malicious fayl (`.php`, `.exe`) `image/png` mimetype bilan yuklanadi
- Polyglot fayllar (ham rasm ham skript)

### Qaror
- **Magic bytes** tekshirish (fayl ichidagi haqiqiy signature)
- `file-type` kutubxonasi (fayl boshini o'qiydi)
- Fayl kengaytmasini majburiy o'zgartirish (server beradi, mijoz emas)
- Upload papkasi — execute permission yo'q
- Image qayta processing (sharp) — metadata strip, re-encode (polyglot yo'q qiladi)
- Hajm limiti (joriy 5MB — yaxshi)

```javascript
import { fileTypeFromBuffer } from 'file-type';

async function validateImage(buffer) {
  const type = await fileTypeFromBuffer(buffer);
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!type || !allowed.includes(type.mime)) {
    throw new Error('Faqat haqiqiy rasm (jpeg/png/webp)');
  }
  // Re-encode with sharp (strip metadata, kill polyglot)
  return sharp(buffer).rotate().toFormat('webp').toBuffer();
}
```

## 3. NoSQL injection

MongoDB query'da user input to'g'ridan-to'g'ri ishlatilsa:

### Xavf
```javascript
// YOMON
await userModel.findOne({ phone: req.body.phone });
// req.body.phone = { $ne: null } bo'lsa — birinchi user qaytadi!
```

### Qaror
- Input validation (type check) — `phone` string bo'lishi shart
- Mongoose schema type casting (qisman himoya)
- `express-mongo-sanitize` middleware — `$` va `.` ni body'dan tozalaydi
- Hech qachon raw `req.body` ni query'ga to'g'ridan-to'g'ri

```javascript
import mongoSanitize from 'express-mongo-sanitize';
app.use(mongoSanitize());  // $, . operatorlarini tozalaydi

// Validation
if (typeof req.body.phone !== 'string') throw new Error('phone string bo\'lishi kerak');
```

## 4. Massiv assignment (mass assignment)

```javascript
// YOMON — user barcha field'larni yuborishi mumkin
await orderModel.create(req.body);
// req.body.totalPrice = 1 (soxta!), req.body.restaurantId = boshqa restoran!
```

### Qaror
- **Whitelist** — faqat ruxsat etilgan field'lar
- `totalPrice` — server hisoblaydi ([[../05-data-model/biznes-mantiq/total-hisoblash#Server-side authority]])
- `restaurantId`, `branchId` — tokendan, body'dan emas

```javascript
function pickOrderFields(body) {
  return {
    orderType: body.orderType,
    table: body.table,
    foods: body.foods,
    // totalPrice YO'Q — server hisoblaydi
    // restaurantId YO'Q — tokendan
  };
}
```

## 5. Cashback balance manipulyatsiya

### Xavf
- Cashier soxta keshbek balans qo'shadi
- Mijoz telefoniga ko'p keshbek

### Qaror
- Keshbek balans faqat **system mantiq** orqali o'zgaradi (order paid → earn)
- To'g'ridan-to'g'ri "balans qo'shish" endpoint **yo'q** (yoki faqat owner + audit)
- Har keshbek harakati `cashback_movement` log'da
- Spend atomik (qarang [[concurrency-race]])
- Anomaliya: bir kun ichida katta keshbek qo'shilishi → alert

## 6. Order narx manipulyatsiya

Qarang [[../05-data-model/biznes-mantiq/total-hisoblash#Server-side authority]] — server hisoblaydi, mijoz total ignorat.

## 7. Refund fraud

Cashier soxta refund qilib pulni o'zlashtiradi.

### Qaror
- Refund faqat `branch_admin`/`owner` ([[../05-data-model/biznes-mantiq/cancel-refund]])
- Har refund audit log (warn)
- Anomaliya: cashier ko'p refund → alert
- Refund sabab majburiy

## 8. Login brute force

Qarang [[../02-arxitektura/xavfsizlik/rate-limiting#Brute force lockout]]

## 9. JWT secret leak

Qarang [[../02-arxitektura/xavfsizlik/secrets-management]]
- Secret leak → barcha token bekor (rotation)
- `.env` git'ga tushmasin (pre-commit hook)

## 10. Waiter boshqa waiter order'ini ko'rishi

### Qaror
- Waiter faqat **o'z** order'larini ([[../02-arxitektura/xavfsizlik/role-based-access#Maxsus holatlar]])
- `requireOrderOwnership` middleware
- Lekin POS'da (umumiy ekran) — barcha ko'rinadi (cashier/admin nazorati ostida)
- Mobile'da — faqat o'ziniki

## 11. Possiz rejim suiiste'mol

Possiz rejimda chek apparat yo'q, audit kamroq.

### Qaror
- Possiz har sessiya audit log ([[../02-arxitektura/rejimlar/possiz-rejim#Audit log]])
- Possiz orderlari `createdInMode='possiz'` — hisobotda alohida
- Admin keyin tekshirib chiqadi
- Possiz faqat admin yoqadi (oddiy xodim emas)

## Test rejasi

- [ ] branchToken revoke → ulanish rad
- [ ] Image magic bytes (soxta mimetype rad)
- [ ] Image re-encode (polyglot yo'q)
- [ ] NoSQL injection (`$ne` rad)
- [ ] Mass assignment (totalPrice ignorat)
- [ ] Cashback balance faqat system
- [ ] Refund RBAC + audit
- [ ] Waiter o'z order'lari (mobile)

## Bog'liq

- [[../02-arxitektura/multi-tenant-xavfsizlik]]
- [[../02-arxitektura/xavfsizlik/_MOC]]
- [[concurrency-race]]
- [[../05-data-model/biznes-mantiq/total-hisoblash]]
