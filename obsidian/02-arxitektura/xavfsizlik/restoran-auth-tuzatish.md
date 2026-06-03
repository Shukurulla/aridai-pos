---
tags: [xavfsizlik, muhim, shoshilinch]
created: 2026-05-28
priority: high
---

# Restoran auth — joriy xato va tuzatish

## Joriy holat: xavfli

Mavjud [middlewares/restoranAuth.middleware.js](../../../global/backend/middlewares/restoranAuth.middleware.js):

```javascript
const restoranMiddleware = async (req, res, next) => {
  const token = req.headers.authorization && req.headers.authorization.split(" ")[1];
  if (!token) return res.status(401).json({...});

  try {
    const findRestaurant = await restaurantsModel.findOne({
      "owner.phone": token,    // ⚠️ TOKEN = TELEFON RAQAMI
    });
    if (!findRestaurant) return res.status(404).json({...});
    req.restoranData = findRestaurant;
    next();
  } catch (error) {
    return res.status(403).json({...});
  }
};
```

## Muammolar

| # | Muammo | Xavf darajasi |
|---|---|---|
| 1 | Token = telefon raqami (plain text) | 🔴 Kritik |
| 2 | Parol tekshirilmaydi | 🔴 Kritik |
| 3 | Token muddati yo'q (abadiy) | 🔴 Kritik |
| 4 | Token o'zgartirib bo'lmaydi (versioning yo'q) | 🟠 Yuqori |
| 5 | Telefon raqami leak bo'lsa — to'liq kirish | 🔴 Kritik |
| 6 | Brute-force himoyasi yo'q | 🟠 Yuqori |
| 7 | restoranAuth boshqa restoran resurs'iga ham ishlaydi (tenant guard yo'q) | 🔴 Kritik |

## Attacker stsenariolari

### Stsenariy A: Telefon raqami ma'lum
Hujumchi restoran egasi telefon raqamini biladi (oson — chek'da, vizitkada, internetda):
1. `Authorization: Bearer +998901234567`
2. Restoran egasi sifatida barcha endpoint'larni chaqiradi
3. Filial qo'shadi, o'chiradi, sozlamalarni o'zgartiradi
4. Menyu o'zgartiradi, narxlarni manipulyatsiya qiladi

### Stsenariy B: API enumeration
Hujumchi telefon raqamlarini sinab ko'radi:
1. `+998900000001`, `+998900000002`, ...
2. 404 ↔ 200 javob orqali mavjud raqamlarni topadi
3. Topilgan raqamlarga to'liq kirish

### Stsenariy C: Insider attack
Bir restoran egasi boshqa restoran telefonini biladi:
1. O'zining vizitka almashtirgan tanishlari orqali
2. Raqobatchining ma'lumotlarini o'g'irlaydi

## Yangi dizayn

### POST /api/restaurants/login

```javascript
router.post('/login', rateLimiter(5, 15*60*1000), async (req, res) => {
  const { phone, password } = req.body;

  const restaurant = await restaurantsModel.findOne({ "owner.phone": phone });
  if (!restaurant) {
    // Timing attack oldini olish — bcrypt baribir
    await bcrypt.compare(password, '$2b$10$invalidhashtoavoidtimingattack');
    return res.status(401).json({ status: 'error', code: 'INVALID_CREDENTIALS' });
  }

  const ok = await bcrypt.compare(password, restaurant.owner.password);
  if (!ok) {
    audit.log({ kind: 'restaurant_login_fail', restaurantId: restaurant._id, ip: req.ip });
    return res.status(401).json({ status: 'error', code: 'INVALID_CREDENTIALS' });
  }

  const tokenVersion = restaurant.tokenVersion || 1;
  const ownerToken = jwt.sign({
    type: 'owner',
    restaurantId: restaurant._id.toString(),
    role: 'owner',
    tokenVersion,
  }, JWT_SECRET, { expiresIn: '7d' });

  const refreshToken = jwt.sign({
    type: 'refresh',
    subjectType: 'restaurant',
    restaurantId: restaurant._id.toString(),
    tokenVersion,
    jti: uuid(),
  }, JWT_SECRET, { expiresIn: '30d' });

  audit.log({ kind: 'restaurant_login_success', restaurantId: restaurant._id });

  return res.status(200).json({
    status: 'success',
    data: {
      restaurant: sanitize(restaurant),
      ownerToken,
      refreshToken,
    },
  });
});
```

### Yangi restoranMiddleware

```javascript
export async function restoranMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ code: 'AUTH_REQUIRED' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.type !== 'owner') {
      return res.status(403).json({ code: 'WRONG_TOKEN_TYPE' });
    }

    const restaurant = await restaurantsModel.findById(payload.restaurantId);
    if (!restaurant) return res.status(404).json({ code: 'RESTAURANT_NOT_FOUND' });

    if ((restaurant.tokenVersion || 1) !== payload.tokenVersion) {
      return res.status(401).json({ code: 'TOKEN_REVOKED' });
    }

    req.restoranData = restaurant;
    req.restoranPayload = payload;
    next();
  } catch (err) {
    return res.status(403).json({ code: 'TOKEN_INVALID' });
  }
}
```

### restaurant schema patch

```javascript
// models/restaurants.model.js
{
  brand: String,
  logo: String,
  owner: { ... },
  tokenVersion: { type: Number, default: 1 },
  features: { ... },  // toggle tizimi uchun ham
}
```

## Migratsiya

Mavjud foydalanuvchilarni qanday ko'chirish:

1. Backend yangi endpoint'larni qo'shadi (eski middleware **vaqtinchalik qoladi**)
2. Frontend (web admin) yangi `/login` endpoint'iga o'tadi
3. Eski mijozlar (agar bor bo'lsa) — login qaytarib qaytadan token oladi
4. **2 hafta** dan keyin eski middleware butunlay o'chiriladi

> [!warning] Real migrate
> Hozircha mijoz yo'q deb taxmin qilamiz. Eski middleware'ni **darhol** olib tashlash mumkin. Bu mukammal.

## Tuzatish rejasi

### Bosqich 1: Yangi auth yaratish (yangi PR)
- [ ] `JWT_SECRET` env'da bor (joriy bor)
- [ ] `tokenVersion` field qo'shish — restaurant schema
- [ ] `bcrypt` allaqachon ishlatilyapti — login'da o'zgartirish kerak emas
- [ ] Yangi `POST /api/restaurants/login` (JWT bilan)
- [ ] Yangi `restoranMiddleware` (JWT verify)
- [ ] Test e2e: login → token → endpoint → 200

### Bosqich 2: Eski auth o'chirish
- [ ] Telefon raqami sifatida token ishlatadigan barcha joylar topish
- [ ] Yangi token'ga o'tkazish
- [ ] Eski middleware o'chirish

### Bosqich 3: Audit qatlami
- [ ] `audit_log` collection
- [ ] login fail/success log
- [ ] tokenVersion change log

### Bosqich 4: Bonus xavfsizlik
- [ ] Rate limit: 5 login attempt / 15 min / IP
- [ ] Anomaly detection: bir kun ichida 5+ login fail → admin'ga alert
- [ ] Refresh token rotation
- [ ] Logout endpoint (refresh blacklist)

## Bog'liqliklar va konsekvensiyalar

### `branch.routes.js` ga ta'sir
[branch.routes.js](../../../global/backend/routes/branch.routes.js) `restoranMiddleware` ishlatadi:
```javascript
router.post("/branch/create", authMiddleware, restoranMiddleware, ...)
```

Yangi middleware bilan ham bir xil ishlaydi (interface o'zgarmaydi — `req.restoranData` qoladi).

### `branch/login` endpoint chalkash
[branch.routes.js:40](../../../global/backend/routes/branch.routes.js) `/branch/login` aslida restoran egasi login bo'ladi. Bu — nom xato:
- Yo bu endpoint olib tashlanadi (duplikat `/api/restaurants/login` bilan)
- Yo nomi to'g'rilanadi: `/owner/login`

Tavsiya: **olib tashlash** — duplikat.

## Test rejasi

- [ ] Login muvaffaqiyatli — token qaytadi
- [ ] Parol xato — 401
- [ ] Phone topilmadi — 401 (404 emas, anonim)
- [ ] Token expired — 401
- [ ] Token tampered — 403
- [ ] tokenVersion mismatch — 401
- [ ] 5 login fail in 15 min — 429
- [ ] Boshqa restoran ID ishlatish — 403 (tenant guard)
- [ ] Refresh token bilan yangi access token — 200

## Bog'liq

- [[auth-strategiyasi]]
- [[tenant-izolyatsiyasi]]
- [[audit-log]]
- [[rate-limiting]]
- [[secrets-management]]
