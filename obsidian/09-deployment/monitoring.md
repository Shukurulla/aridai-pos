---
tags: [deployment, monitoring]
created: 2026-05-29
---

# Monitoring va observability

## Uch ustun

1. **Logs** — nima sodir bo'ldi
2. **Metrics** — qancha, qanchalik tez
3. **Traces** — so'rov yo'li (kelajak)

## Logs

### Global backend
- **Pino** (structured JSON logs)
- Levels: debug, info, warn, error
- Production: info+
- Strukturali: `{ level, ts, reqId, userId, restaurantId, msg }`
- Sensitive redaction ([[../02-arxitektura/xavfsizlik/audit-log#Sensitive data redaction]])

```javascript
logger.info({ reqId, userId, restaurantId, action: 'order.created', orderId }, 'Order yaratildi');
```

### Local backend (POS)
- Lokal fayl: `C:\ProgramData\AridaiPos\logs\`
- Rotation (kunlik, 14 kun)
- Periodik metric global'ga ([[../02-arxitektura/sinxronizatsiya/sync-monitoring]])

### Log aggregation (kelajak)
- Boshlanish: server'da fayl + `docker logs`
- O'sgach: Loki + Grafana yoki ELK yoki Datadog

## Metrics

### Application metrics
- Request rate (req/s)
- Response time (P50, P95, P99)
- Error rate (4xx, 5xx)
- Active socket connections
- Sync latency ([[../02-arxitektura/sinxronizatsiya/sync-monitoring]])

### Business metrics
- Active restaurants/branches
- Online vs offline branches
- Orders/min
- Failed payments

### Infra metrics
- CPU, RAM, disk (VPS)
- MongoDB: connections, slow queries, replication lag
- Redis: memory, hit rate

### Tools
- **Prometheus** + **Grafana** (self-hosted) yoki
- **Datadog** / **New Relic** (managed, oson)
- Boshlanish: server resource monitoring (htop, MongoDB Atlas dashboard)

## Error tracking

- **Sentry** — har xato avtomatik capture
- Stack trace, context (user, restaurant, request)
- Alert (ko'p xato → notification)
- Frontend ham (web, mobile)

```javascript
Sentry.captureException(err, { tags: { restaurantId, branchId }, user: { id: userId } });
```

## Uptime monitoring

- **UptimeRobot** / **Pingdom** / **Better Uptime**
- Har 1 min: `GET /api/health`
- Down → SMS/email/Telegram alert
- `/api/health/sync` — sync salomatligi ([[../02-arxitektura/sinxronizatsiya/sync-monitoring#Health check endpoint]])

## Health check endpoints

```javascript
GET /api/health          // { status: 'ok', uptime, version }
GET /api/health/db       // MongoDB ulanish
GET /api/health/redis    // Redis ulanish
GET /api/health/sync     // filiallar sync holati
```

## Alerting kanallari

| Kanal | Nima uchun |
|---|---|
| Telegram bot | Dev team — barcha alert |
| Email | System admin — kritik |
| SMS | System admin — faqat down/critical |
| Dashboard | Real-time ko'rinish |

Audit log alerting bilan birga ([[../02-arxitektura/xavfsizlik/audit-log#Alerting kanallari]]).

## Alert qoidalari

| Holat | Severity | Harakat |
|---|---|---|
| API down | critical | SMS + Telegram darhol |
| Error rate > 5% | error | Telegram |
| Response time P95 > 2s | warn | Telegram |
| Disk > 85% | warn | email |
| Filial 30+ min offline | warn | restoran admin |
| Sync error rate > 1% | error | dev team |
| Cross-tenant attempt | critical | system admin darhol |

## Dashboard (Grafana)

- API health (uptime, latency, error rate)
- Business (orders, revenue, active branches)
- Sync (per-branch status, latency, conflicts)
- Infra (CPU, RAM, Mongo, Redis)

## Boshlanish (MVP) — minimal

Phase 1'da:
- Sentry (xato tracking) — oson, qiymatli
- UptimeRobot (uptime) — bepul
- `docker logs` + MongoDB Atlas dashboard
- Keyinroq Prometheus/Grafana

## Bog'liq

- [[_MOC]]
- [[../02-arxitektura/sinxronizatsiya/sync-monitoring]]
- [[../02-arxitektura/xavfsizlik/audit-log]]
- [[vps-deploy]]
