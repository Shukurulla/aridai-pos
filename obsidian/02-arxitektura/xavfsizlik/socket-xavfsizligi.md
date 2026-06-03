---
tags: [xavfsizlik, socket]
created: 2026-05-28
---

# Socket xavfsizligi

> [[../socket-sinxronizatsiya]] dan farqi: bu yerda xavfsizlik tafsilotlari, u yerda protokol mantiqi.

## Handshake authentication

Socket.io'da `auth` payload handshake paytida o'qiladi:

```javascript
// Server
const io = new Server(httpServer, {
  cors: { origin: ALLOWED_ORIGINS },
});

io.use(async (socket, next) => {
  const auth = socket.handshake.auth;
  if (!auth?.token) {
    return next(new Error('AUTH_REQUIRED'));
  }

  try {
    // Token turi: user yoki branch
    if (auth.tokenType === 'user') {
      const payload = jwt.verify(auth.token, JWT_SECRET);
      if (payload.type !== 'user') throw new Error('wrong type');
      const user = await usersModel.findById(payload.userId);
      if (!user || user.tokenVersion !== payload.tokenVersion) {
        throw new Error('TOKEN_REVOKED');
      }
      socket.auth = {
        kind: 'user',
        userId: payload.userId,
        role: user.role,
        restaurantId: payload.restaurantId,
        branchId: payload.branchId,
      };
    } else if (auth.tokenType === 'branch') {
      const payload = jwt.verify(auth.token, BRANCH_SECRET);
      if (payload.type !== 'branch') throw new Error('wrong type');
      const branch = await branchesModel.findById(payload.branchId);
      if (!branch || branch.tokenRevoked) throw new Error('BRANCH_REVOKED');
      socket.auth = {
        kind: 'branch',
        branchId: payload.branchId,
        restaurantId: payload.restaurantId,
      };
    } else {
      throw new Error('UNKNOWN_TOKEN_TYPE');
    }

    next();
  } catch (err) {
    audit.log({ kind: 'socket_auth_fail', ip: socket.handshake.address, err: err.message });
    next(new Error('AUTH_FAILED'));
  }
});
```

## TLS majburiy

`wss://` (TLS) — `ws://` taqiqlanadi production'da.

```javascript
// Reject non-TLS
io.on('connection', (socket) => {
  if (process.env.NODE_ENV === 'production' && !socket.handshake.secure) {
    socket.disconnect();
  }
});
```

Bundan tashqari, reverse proxy (nginx) darajasida ham `ws://` rad etish.

## Room model

Server avtomatik room'larga qo'shadi, mijoz iltimosi rad etiladi:

```javascript
io.on('connection', (socket) => {
  const { kind, userId, role, restaurantId, branchId } = socket.auth;

  // Avtomatik qo'shish
  if (branchId) socket.join(`branch:${branchId}`);
  if (restaurantId) socket.join(`restaurant:${restaurantId}`);
  if (userId) socket.join(`user:${userId}`);
  if (kind === 'user' && role) socket.join(`role:${role}:branch:${branchId}`);
  if (kind === 'branch') socket.join(`local-backend:${branchId}`);

  // Mijoz iltimosi — taqiq
  socket.on('join', () => {
    audit.log({ kind: 'socket_unauthorized_join', socketId: socket.id });
    socket.disconnect();
  });
  socket.on('leave', () => socket.disconnect());
});
```

## Event payload guards

Har incoming event'da `restaurantId`/`branchId` bor — tekshiriladi:

```javascript
io.use((socket, next) => {
  socket.use(([eventName, eventData, cb], err) => {
    if (eventData && typeof eventData === 'object') {
      if (eventData.restaurantId && eventData.restaurantId !== socket.auth.restaurantId) {
        audit.log({
          kind: 'socket_tenant_violation',
          socketId: socket.id,
          userId: socket.auth.userId,
          attemptedRestaurant: eventData.restaurantId,
          actualRestaurant: socket.auth.restaurantId,
          eventName,
        });
        socket.disconnect();
        return;
      }
      if (eventData.branchId && eventData.branchId !== socket.auth.branchId) {
        socket.disconnect();
        return;
      }
    }
    next();
  });
  next();
});
```

## Event tur whitelist

Mijoz hech qanday event jo'natolmaydi — faqat ro'yxatdagi:

```javascript
const ALLOWED_INCOMING = {
  user: ['order.created', 'order.cancel_request', 'attendance.check_in', 'presence.heartbeat'],
  branch: ['sync.start', 'sync.batch', 'sync.complete', 'mode.changed', 'presence.heartbeat'],
};

socket.use(([eventName, ...args], next) => {
  const allowed = ALLOWED_INCOMING[socket.auth.kind] || [];
  if (!allowed.includes(eventName)) {
    audit.log({ kind: 'socket_unknown_event', eventName, socketId: socket.id });
    return next(new Error('UNKNOWN_EVENT'));
  }
  next();
});
```

## Replay protection (idempotency)

Har event'da `id` (UUID). Server SET'da saqlaydi (Redis):

```javascript
async function applyEvent(ev) {
  const seen = await redis.sismember(`seen:${ev.branchId}`, ev.id);
  if (seen) {
    return { ok: true, idempotent: true };
  }
  await redis.sadd(`seen:${ev.branchId}`, ev.id);
  await redis.expire(`seen:${ev.branchId}`, 7 * 24 * 60 * 60); // 7 kun
  // ... apply event
}
```

Eski event'larni qaytadan jo'natilsa — sokin qabul qilinadi, ammo ikkinchi marta apply qilinmaydi.

## Rate limiting (per-socket)

```javascript
// xavfsizlik/socket-rate-limit.js
const limits = new Map(); // socketId → { count, resetAt }

function checkRateLimit(socket) {
  const now = Date.now();
  const entry = limits.get(socket.id) || { count: 0, resetAt: now + 1000 };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + 1000;
  }
  entry.count++;
  limits.set(socket.id, entry);
  if (entry.count > 50) {
    socket.emit('rate_limited');
    socket.disconnect();
    return false;
  }
  return true;
}

socket.use((packet, next) => {
  if (!checkRateLimit(socket)) return;
  next();
});
```

50 event/s — odatda yetadi. Yangi POS — 10-20 event/s peak'da.

## Heartbeat va presence

```javascript
// Server tomondan har 25s'da ping
io.on('connection', (socket) => {
  const interval = setInterval(() => {
    socket.emit('ping');
  }, 25000);

  let lastPong = Date.now();
  socket.on('pong', () => { lastPong = Date.now(); });

  const checkInterval = setInterval(() => {
    if (Date.now() - lastPong > 60000) {
      socket.disconnect();
      audit.log({ kind: 'socket_ping_timeout', socketId: socket.id });
    }
  }, 10000);

  socket.on('disconnect', () => {
    clearInterval(interval);
    clearInterval(checkInterval);
  });
});
```

## Bandwidth quotalari

Asabsiz bug yoki manipulyatsiya: bitta mijoz daqiqada 1 GB jo'natadi. Buni cheklash:

```javascript
const bandwidth = new Map(); // socketId → bytes

socket.use((packet, next) => {
  const size = JSON.stringify(packet).length;
  const entry = bandwidth.get(socket.id) || { bytes: 0, resetAt: Date.now() + 60000 };
  if (Date.now() > entry.resetAt) {
    entry.bytes = 0;
    entry.resetAt = Date.now() + 60000;
  }
  entry.bytes += size;
  if (entry.bytes > 5 * 1024 * 1024) { // 5 MB/min
    socket.disconnect();
    return;
  }
  bandwidth.set(socket.id, entry);
  next();
});
```

## IP whitelisting (branch token uchun)

`branchToken` ulanishlari uchun — agar filial statik IP berishi mumkin bo'lsa:

```javascript
async function checkBranchIp(socket) {
  const expectedIps = await branch.getAllowedIps(socket.auth.branchId);
  if (expectedIps.length === 0) return true; // ixtiyoriy
  const realIp = socket.handshake.headers['x-real-ip'] || socket.handshake.address;
  if (!expectedIps.includes(realIp)) {
    audit.log({
      kind: 'branch_ip_mismatch',
      branchId: socket.auth.branchId,
      expectedIps,
      actualIp: realIp,
    });
    return false;
  }
  return true;
}
```

Restoran admin'da "Allowed IPs" sozlamasi (kelajakda).

## Geo anomaliya

`branchToken` Toshkent'dan kelishi kutiladi. Pekin'dan kelsa — anomaliya:

```javascript
const geo = await ipToGeo(socket.handshake.address);
if (geo.country !== branch.country) {
  audit.log({ kind: 'geo_anomaly', branchId, geo });
  // disconnect emas — faqat log + alert (legitim sayohat ham mumkin)
}
```

## DOS/DDOS himoyalar

- Nginx level: connection_limit_per_ip
- Cloudflare yoki AWS Shield (kelajakda)
- Socket.io transport: `polling` o'chiriladi production'da, faqat `websocket`
- Slow client: ulanishlar timeout (60s idle)

## Audit (socket events)

Quyidagi har bir hodisa `audit_log`'ga:
- `socket_auth_fail`
- `socket_unauthorized_join`
- `socket_tenant_violation`
- `socket_unknown_event`
- `socket_rate_limited`
- `socket_ping_timeout`
- `branch_ip_mismatch`
- `geo_anomaly`

Real-time dashboard'da:
- Connections count (per restaurant/branch)
- Recent disconnects
- Auth fails per minute
- Tenant violations (kritik alert)

## Test rejasi

- [ ] No token → connect rejected
- [ ] Wrong token type → rejected
- [ ] Revoked tokenVersion → rejected
- [ ] Mismatched restaurantId in payload → disconnect
- [ ] `socket.join()` mijoz iltimosi → disconnect
- [ ] Unknown event name → rejected
- [ ] Duplicate event id → second time idempotent
- [ ] >50 events/s → rate limited + disconnect
- [ ] >5MB/min → disconnect
- [ ] No pong 60s → disconnect

## Bog'liq

- [[../socket-sinxronizatsiya]] — protokol
- [[auth-strategiyasi]]
- [[tenant-izolyatsiyasi]]
- [[rate-limiting]]
- [[audit-log]]
