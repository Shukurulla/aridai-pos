---
tags: [xavfsizlik, rate-limit]
created: 2026-05-28
---

# Rate limiting

## Maqsad

DOS, brute-force, accidental abuse oldini olish. Har manba uchun "qancha so'rov" cheklash.

## Texnologiya

- Joriy ish: `express-rate-limit` (Express middleware)
- Backend: in-memory yoki Redis store
- Multi-instance global VPS'da — **Redis** majburiy (instance'lar orasidagi shared state)

```bash
npm i express-rate-limit rate-limit-redis ioredis
```

## Konfiguratsiya jadvali

| Endpoint / harakat | Limit | Window | Kalit |
|---|---|---|---|
| `POST /auth/login` (user) | 5 | 15 daqiqa | IP + phone |
| `POST /restaurants/login` | 5 | 15 daqiqa | IP + phone |
| `POST /auth/refresh` | 30 | 1 daqiqa | userId |
| `POST /qr-order/request` | 10 | 1 daqiqa | IP |
| Standard REST (GET) | 200 | 1 daqiqa | token (userId) |
| Standard REST (POST/PUT/DEL) | 60 | 1 daqiqa | token |
| Socket emit (har event) | 50 | 1 sekund | socketId |
| Socket bandwidth | 5 MB | 1 daqiqa | socketId |
| QR public endpoints | 60 | 1 daqiqa | IP |
| Webhook (Kaspi, WhatsApp) | 1000 | 1 daqiqa | source IP (whitelist) |
| Cross-tenant attempt | 5 → ban | 5 daqiqa | userId |

## Implementatsiya: Express

```javascript
// xavfsizlik/rate-limiter.js
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis } from '../config/redis.js';

const baseStore = new RedisStore({
  sendCommand: (...args) => redis.call(...args),
  prefix: 'rl:',
});

export const loginLimiter = rateLimit({
  store: baseStore,
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `login:${req.ip}:${req.body.phone || 'unknown'}`,
  handler: (req, res) => {
    audit.log({
      kind: 'login_rate_limited',
      ip: req.ip,
      phone: req.body.phone,
    });
    res.status(429).json({
      status: 'error',
      code: 'RATE_LIMITED',
      message: '15 daqiqa keyin urinib ko\'ring',
    });
  },
});

export const apiLimiter = rateLimit({
  store: baseStore,
  windowMs: 60 * 1000,
  max: (req) => req.method === 'GET' ? 200 : 60,
  keyGenerator: (req) => {
    return req.userData?._id?.toString() || req.ip;
  },
  handler: (req, res) => res.status(429).json({ code: 'RATE_LIMITED' }),
});
```

Ishlatish:
```javascript
app.use('/api', apiLimiter);
app.use('/api/auth/login', loginLimiter);
app.use('/api/restaurants/login', loginLimiter);
```

## Socket rate limiting

```javascript
// xavfsizlik/socket-rate-limit.js
import { redis } from '../config/redis.js';

export function socketRateLimit(socket, packet, next) {
  const key = `srl:${socket.auth.userId || socket.auth.branchId}`;
  redis.multi()
    .incr(key)
    .expire(key, 1)
    .exec((err, replies) => {
      if (err) return next(new Error('RL_ERROR'));
      const count = replies[0][1];
      if (count > 50) {
        audit.log({ kind: 'socket_rate_limited', socketId: socket.id });
        socket.disconnect();
        return;
      }
      next();
    });
}

// io middleware
socket.use((packet, next) => socketRateLimit(socket, packet, next));
```

## Brute force lockout

5 marta xato login → IP+phone 15 daqiqa lockout. Lockout — rate limit'ning maxsus turi.

Qo'shimcha himoyalar:
- **Account lockout** — 10 xato login per phone (har IP) → account 1 soat lock
  - Email/SMS notification: "Sizning hisobingizga g'ayri urinishlar"
  - Admin "Unlock" qila oladi
- **Distributed brute force** — 1000+ login attempt har xil phone'lar → CAPTCHA majburiy (kelajakda)

## Bot/scraper himoyasi

QR menyu public endpoint — bot uchun ham qiziqarli (raqobatchi scraping).
- Rate limit: 60 req/min/IP (yetarli)
- User-Agent tekshiruvi (suspicious patterns)
- CAPTCHA — kelajakda agar zarur bo'lsa

## Whitelist (rate limit chetlash)

Ba'zi IP'lar yoki source'lar limitidan tashqari:

```javascript
const WHITELIST = [
  '127.0.0.1',
  ...process.env.KASPI_WEBHOOK_IPS?.split(',') || [],
  ...process.env.WHATSAPP_WEBHOOK_IPS?.split(',') || [],
];

const skipIfWhitelisted = (req) => WHITELIST.includes(req.ip);

export const webhookLimiter = rateLimit({
  store: baseStore,
  windowMs: 60 * 1000,
  max: 1000,
  skip: skipIfWhitelisted, // amalga oshmaydi
});
```

## Adaptive rate limiting (kelajakda)

Anomaliya aniqlash:
- IP normal: 100 req/min
- IP shubhali: 5 req/min
- IP whitelist: cheklov yo'q

Mashina o'rganishi yoki oddiy heuristics — kelajakda.

## Lockout uchun foydalanuvchi UX

Foydalanuvchi 429 oldi:
```
┌──────────────────────────────────────────┐
│ ⏸ Juda ko'p urinish                       │
│                                            │
│ Sizning hisobingiz 15 daqiqaga vaqtinchalik│
│ to'xtatildi. Iltimos kuting va qaytadan   │
│ urinib ko'ring.                            │
│                                            │
│ Agar bu xato deb hisoblasangiz, admin'ga  │
│ murojaat qiling.                           │
└──────────────────────────────────────────┘
```

Mobile push notification: "Hisobingizga shubhali urinishlar — agar siz emas bo'lsa parolni o'zgartiring".

## Headers

Standard rate limit headers:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset` (epoch seconds)
- `Retry-After` (429 paytida)

Mobile ilova bularni o'qib UI'da qo'shimcha info ko'rsatishi mumkin.

## Monitoring

Real-time dashboard:
- 429 javoblar soni (kunlik, soatlik)
- Eng ko'p limit yegan IP'lar
- Login fail vs login success ratio (anomaliya)
- Socket disconnect (rate limit sababli)

## Test rejasi

- [ ] 5 login attempt in 15 min → 429
- [ ] 16 daqiqadan keyin yana urinish ishlaydi
- [ ] Boshqa IP'dan login — alohida counter
- [ ] 200+ GET req/min → 429
- [ ] Socket 50+ events/s → disconnect
- [ ] Webhook whitelist'da bo'lsa cheklanmaydi
- [ ] Headers to'g'ri qaytadi (X-RateLimit-*)

## Bog'liq

- [[auth-strategiyasi]]
- [[socket-xavfsizligi]]
- [[audit-log]]
- [[restoran-auth-tuzatish]]
