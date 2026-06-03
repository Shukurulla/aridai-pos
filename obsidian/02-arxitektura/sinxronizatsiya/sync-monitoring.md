---
tags: [arxitektura, sinxron, monitoring]
created: 2026-05-28
---

# Sync monitoring

## Maqsad

Sinxronizatsiya — eng murakkab va eng nazik joy. Buzilishi sezilmasdan bo'lishi mumkin (lokal'da hammasi yaxshi ko'rinadi, lekin global'da yo'q). Aniq monitoring shart.

## Metrikalar

### Per-filial real-time

| Metrika | O'lcham | Yaxshi qiymat |
|---|---|---|
| `outboxPending` | event count | < 5 (normal), < 50 (acceptable) |
| `outboxOldestAge` | sekundlar | < 30s |
| `syncLag` | ms | < 500ms |
| `lastSyncAt` | timestamp | < 30s oldin |
| `lastHeartbeatAt` | timestamp | < 5s oldin |
| `syncErrorCount` | count (oxirgi 1h) | 0 (ideal) |
| `conflictCount` | count (oxirgi 24h) | 0 (ideal), < 5 (acceptable) |

### Aggregate (barcha filiallar)

| Metrika | Maqsad |
|---|---|
| Online filiallar soni | total = N, online = M |
| Offline filiallar soni | M soatdan ko'p offline — alert |
| Average sync latency | < 200ms |
| Total events/sec | system load |
| Sync error rate | < 0.1% |
| Conflict rate | < 0.5% |

## Lokal POS UI'da

Status bar'da real-time ko'rsatish:

```
┌──────────────────────────────────────────────────────────────────────┐
│ 🟢 Online   📤 sync: 0 kutilmoqda   📡 latency: 142ms                 │
└──────────────────────────────────────────────────────────────────────┘
```

Yana ko'p detal — "Sync sozlamalari" sahifasida (admin POS PC'da):
- Outbox event'lar ro'yxati (in-progress, pending, error)
- Conflict log
- "Force sync" tugmasi
- "Outbox'ni qaytadan urinib ko'rish" tugmasi
- Network latency grafigi (kelajakda)

## Admin web dashboard

Bosh dashboard'da:

```
┌─────────────────────────────────────────┐
│ Filiallar holati                         │
│ ─────────────────────                    │
│ 🟢 Yunusobod         online   0 pending  │
│ 🟢 Markaz            online   3 pending  │
│ 🟡 Chilonzor         offline  47 pending │ ← uzoq offline alert
│ 🔴 Sergeli           syncing  152 events │ ← uzoq sync alert
└─────────────────────────────────────────┘
```

Filial ustida bossa — batafsil:
- Sync status grafik (oxirgi 24h)
- Event throughput
- Konflikt tarix
- Soatlik latency

## Audit log integration

Sync hodisalari — `audit_log`'ga (qarang [[../xavfsizlik/audit-log]]):

- `sync_started`
- `sync_batch_acknowledged`
- `sync_completed`
- `sync_failed` (severity: error)
- `sync_conflict` (severity: warn)
- `outbox_event_rejected`
- `branch_offline_long` (severity: warn, 5+ daqiqa)

## Alert'lar

### Slack/Telegram/Email

| Holat | Severity | Kim oladi |
|---|---|---|
| Filial 5+ daqiqa offline | warn | restoran admin |
| Filial 30+ daqiqa offline | critical | restoran admin + system admin |
| Outbox > 100 va o'smay turibdi | warn | restoran admin |
| Sync error rate > 1% (oxirgi 5 daqiqa) | error | system admin |
| Konflikt > 10 (oxirgi 1 soat) | warn | restoran admin |
| Sync failed (oxirgi event manual fix kerak) | error | restoran admin |
| Branch token unauthorized attempt | critical | system admin |

### Alerter implementation

```javascript
// utils/syncAlerter.js
export const syncAlerter = {
  async checkBranchOffline() {
    const offlineLong = await branchModel.find({
      currentMode: 'offline',
      modeChangedAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) }
    });
    for (const b of offlineLong) {
      await alerter.notify({
        kind: 'branch_offline_long',
        severity: 'warn',
        branchId: b._id,
        message: `Filial "${b.name}" ${minutes} daqiqadan beri offline`
      });
    }
  },

  async checkOutboxStuck() {
    // outbox o'sib lekin tushmayotgan filiallar
  },
};

// Cron har 5 daqiqada
scheduler.schedule('sync_health_check', '*/5 * * * *', syncAlerter.checkBranchOffline);
```

## Lokal backend metrics export

Lokal Electron app — Prometheus-compatible metrics endpoint emas (overkill). Lekin:
- Lokal log fayl (rotate qilingan)
- Periodik metric `sync.metrics` event'i global'ga (har 1 min)

```javascript
socket.emit('sync.metrics', {
  outboxPending,
  outboxOldestAge,
  ramUsage,
  diskUsage,
  uptimeSec,
});
```

Global'da bu metrikalar saqlanadi — analitika va alert'lar uchun.

## Latency hisoblash

Har event'da:
- `local.createdAt` — lokal'da yaratildi
- `local.sentAt` — outbox'dan jo'natildi
- `global.receivedAt` — global qabul qildi
- `global.appliedAt` — DB'ga yozildi
- `global.ackedAt` — ack qaytarildi
- `local.ackedAt` — lokal ack qabul qildi

Latency = `local.ackedAt - local.createdAt`

P50, P95, P99 — har soatda hisoblanadi.

## Sync dashboard endpoint'lar

```javascript
GET /api/admin/sync/branches              // barcha filiallar holati
GET /api/admin/sync/branches/:id          // bitta filial detallari
GET /api/admin/sync/branches/:id/outbox   // outbox event'lar (faqat in-progress/error)
GET /api/admin/sync/branches/:id/conflicts // konflikt log
POST /api/admin/sync/branches/:id/force-sync  // majburiy sync
POST /api/admin/sync/events/:id/retry     // bitta event retry
POST /api/admin/sync/events/:id/reject    // event reject (manual override)
GET /api/admin/sync/metrics?range=24h     // aggregate metrics
```

## Konflikt resolyutsiya UI

Konflikt aniqlangach — admin'ga ko'rsatiladi:

```
┌─────────────────────────────────────────────────────┐
│ ⚠️ Konflikt — Order #65fb1d2e3f4a...                  │
├─────────────────────────────────────────────────────┤
│ Local versiya:           │ Global versiya:          │
│ paymentStatus: paid      │ paymentStatus: pending   │
│ paymentMethod: cash      │ isCancel: true           │
│ paidAt: 14:30            │ cancelledAt: 14:25       │
│                           │                          │
│ Tahlil: cashier 14:30'da   Cancellation 14:25'da     │
│         tolagan deb belgila boshqa joydan keldi.     │
│                                                       │
│ [Lokal'ni qabul qilish]  [Global'ni qabul qilish]    │
│ [Manual: yangi qiymat]                                │
└─────────────────────────────────────────────────────┘
```

Admin tanlovi audit log'ga.

## Health check endpoint

```javascript
GET /api/health/sync
// Response:
{
  status: 'ok' | 'degraded' | 'down',
  branches: {
    total: 50,
    online: 47,
    offline: 2,
    syncing: 1,
  },
  metrics: {
    avgLatencyMs: 142,
    eventsPerSecond: 8.3,
    errorRate: 0.001,
    conflictRate: 0.002,
  }
}
```

Uptime monitoring (UptimeRobot, Pingdom) — har 1 min so'raydi.

## Logs aggregation

- Lokal logs — POS PC'da rotate'lanadi (`C:\ProgramData\AridaiPos\logs\sync.log`)
- Global logs — server'da (Pino structured logs)
- Kelajakda: ELK / Loki / Datadog

## Bog'liq

- [[_MOC]]
- [[offline-to-online-otish]]
- [[sync-prioritizatsiyasi]]
- [[../xavfsizlik/audit-log]]
- [[../../05-data-model/sync-metadata]]
