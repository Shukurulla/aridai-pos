---
tags: [arxitektura, xavfsizlik, muhim]
created: 2026-05-28
---

# Multi-tenant xavfsizlik

## Muammo

Bitta VPS'da O'nlab restoranlar ma'lumotlari yashaydi. Bir restoran egasi boshqa restoran ma'lumotlarini ko'rib qolmasligi shart. Bir filial admini boshqa filialga ulanmasligi shart. Hatto xato bilan ham.

## Tahdidlar

| Tahdid | Misol | Yechim |
|---|---|---|
| **Cross-tenant read** | Restoran A egasi B ning orderlarini ko'radi | Har query'da `restaurantId` guard |
| **Cross-branch read** | Filial 1 admini Filial 2 menyuni ko'radi | Har query'da `branchId` guard |
| **Token forgery** | Birovning JWT'sini o'g'irlab boshqa restoran ID kiritish | Token'da `restaurantId` ham bo'ladi, body bilan moslashtiriladi |
| **Socket room poaching** | Socket connect bo'lib boshqa room'ga obuna bo'lish | Server tomonidan room nazorat — client `join` qilmaydi |
| **Local backend poaching** | Bir filial local backend boshqa filial token bilan ulanadi | `branchToken` server tomon JWT, `branchId` ichida fixed |

## Texnik qatlamlar

### 1. JWT'da fixed claims

```json
{
  "userId": "...",
  "restaurantId": "...",  // o'zgartirib bo'lmaydi
  "branchId": "...",       // user shu filialga bog'liq
  "role": "waiter",
  "iat": ..., "exp": ...
}
```

User boshqa filialga ko'chirilsa — eski JWT bekor qilinadi (token version yoki blacklist).

### 2. Middleware guard (har REST endpoint)

```javascript
function tenantGuard(req, res, next) {
  const reqBranch = req.params.branchId || req.body.branchId || req.query.branchId;
  if (reqBranch && reqBranch !== req.userData.branchId) {
    log.warn('CROSS-BRANCH ATTEMPT', { user: req.userData._id, ... });
    return res.status(403).json({ status: 'error', message: 'forbidden' });
  }
  next();
}
```

Bu **har bir branchli endpoint'da** majburiy bo'lishi kerak. Hozirgi backend'da yo'q — qo'shilishi shart.

### 3. Mongoose plugin (avtomatik filter)

```javascript
schema.pre('find', function() {
  if (this.getOptions().__tenantSafe !== true) {
    throw new Error('tenant filter qo`yilmagan');
  }
});
```

Yoki query helper:
```javascript
foodModel.findInBranch(branchId, {category}) // {branch: branchId, category} build qiladi
```

### 4. Socket room access

```javascript
io.on('connection', (socket) => {
  const { branchId, restaurantId } = socket.auth;
  // server avtomatik join qiladi, mijoz iltimos qilmaydi
  socket.join(`branch:${branchId}`);
  socket.join(`restaurant:${restaurantId}`);

  socket.on('subscribe', () => {
    // taqiqlangan — server'dan boshqa hech kim subscribe qila olmaydi
    socket.disconnect();
  });
});
```

### 5. Event payload guard

Har bir incoming event:
```javascript
function eventGuard(ev, socketAuth) {
  if (ev.restaurantId !== socketAuth.restaurantId) {
    return reject('tenant mismatch');
  }
  if (ev.branchId !== socketAuth.branchId) {
    return reject('branch mismatch');
  }
}
```

## Audit log

Har shubhali harakat (cross-tenant urinish, token mismatch) **alohida collection'ga**:

```javascript
{
  _id, ts, kind: 'cross_tenant_attempt',
  userId, attemptedRestaurantId, actualRestaurantId,
  ip, userAgent, eventDetails
}
```

Admin dashboard'da real-time monitoring.

## Rate limiting

| Kim | Limit |
|---|---|
| Login | 5 attempt / 15 min / IP |
| API request | 100 / min / token |
| Socket emit | 50 / s / connection |
| Cross-tenant warning | 5 attempt → token bloklanadi |

## Role-based access control (RBAC)

Tokenda role bor. Har endpoint'da minimum role:

| Endpoint | Min role |
|---|---|
| `POST /orders` | waiter, cashier, admin |
| `DELETE /orders/:id` | admin, owner |
| `POST /foods` | admin, owner |
| `GET /reports` | admin, owner |
| `POST /restaurants` | system_admin |

Hozirgi backend'da role tekshirilmaydi — qo'shilishi shart.

## Restoran egasi tokeniga ehtiyot

Hozirda [restoranAuth.middleware.js](../../global/backend/middlewares/restoranAuth.middleware.js) **owner.phone**ni token sifatida qabul qiladi. Bu:
- ❌ Parolsiz
- ❌ Eski-yangi token farqlab bo'lmaydi
- ❌ O'g'irlangan bo'lsa abadiy ishlaydi

**Yechim:** restoran egasi ham JWT oladi (login → JWT), middleware faqat JWT'ni tekshiradi. Phone — username, JWT — credential.

## Local backend ↔ Global VPS xavfsizlik

Local backend'ning VPS'ga ulanishi alohida muhim:

- Har filialga **alohida `branchToken`** (long-lived JWT yoki API key)
- Token VPS'da `branches` jadvalida hash bilan saqlanadi
- Token'da `branchId` ZASHIFROVANNAYA (server-side claim, mijoz o'zgartirolmaydi)
- TLS majburiy (`wss://`)
- IP whitelist (filial statik IP berishi mumkin bo'lsa)
- Heartbeat'da geo-IP tekshiruvi (filial Toshkent bo'lsa Pekin'dan kelgan ulanish — anomaliya)

## To'liq qoidalar yig'indisi

- [ ] Har REST endpoint'da `tenantGuard` middleware
- [ ] Har socket connect'da `branchToken` validate
- [ ] Har socket event'da `restaurantId/branchId` payload — token bilan moslashtirish
- [ ] Mongoose model'larda `restaurantId/branchId` indexlangan, query helper'lar
- [ ] Audit log collection
- [ ] Rate limiting (express-rate-limit, socket.io-throttle)
- [ ] JWT versioning (revoke uchun)
- [ ] Local backend o'ziga xos token
- [ ] Restoran egasi uchun JWT-based login (phone token bekor qilinadi)
- [ ] Role-based middleware

## Deep dive

Bu yuqori darajadagi overview. Mavzu bo'yicha chuqurroq:
- [[xavfsizlik/_MOC|Xavfsizlik MOC]]
- [[xavfsizlik/restoran-auth-tuzatish|⭐ Restoran auth tuzatish (shoshilinch)]]
- [[xavfsizlik/auth-strategiyasi|Auth strategiyasi — JWT, refresh, branchToken]]
- [[xavfsizlik/role-based-access|RBAC — role × action matrix]]
- [[xavfsizlik/tenant-izolyatsiyasi|Tenant guard'lar — middleware, mongoose plugin]]
- [[xavfsizlik/socket-xavfsizligi|Socket auth, room, event guards]]
- [[xavfsizlik/rate-limiting|Rate limiting]]
- [[xavfsizlik/secrets-management|Secrets va rotation]]
- [[xavfsizlik/audit-log|Audit log va alerting]]

## Bog'liq

- [[socket-sinxronizatsiya]]
- [[global-va-local]]
- [[conflict-resolution]]
