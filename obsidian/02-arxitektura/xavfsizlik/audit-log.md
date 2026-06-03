---
tags: [xavfsizlik, audit, kuzatuv]
created: 2026-05-28
---

# Audit log

## Maqsad

Har bir **xavfsizlikka oid hodisa** va **muhim biznes operatsiyasi** yozib boriladi. Maqsad:
- Kompromiss tekshirish (incident response)
- Anomaliya aniqlash
- Compliance (kelajakda — moliyaviy auditlar uchun)
- Debug — "nima sodir bo'ldi" ga javob

## Schema

```javascript
// models/audit_log.model.js
const auditLogSchema = new mongoose.Schema({
  kind: {                       // hodisa turi (qisqa kalit)
    type: String,
    required: true,
    index: true,
  },
  severity: {
    type: String,
    enum: ['info', 'warn', 'error', 'critical'],
    default: 'info',
    index: true,
  },

  // Kim
  actor: {
    type: String,                // 'user' | 'restaurant_owner' | 'branch' | 'system' | 'anonymous'
    id: String,                  // ObjectId yoki branchId
    role: String,                // user role
  },

  // Tenant
  restaurantId: { type: mongoose.Schema.Types.ObjectId, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, index: true },

  // Nima sodir bo'ldi
  message: String,               // human-readable
  data: Object,                  // hodisa-specific payload

  // Qaerda
  ip: String,
  userAgent: String,
  endpoint: String,              // REST yo'l
  method: String,                // GET/POST/...

  // Qachon
  ts: { type: Date, default: Date.now, index: true },
}, {
  timestamps: false,             // ts o'zi bor
  capped: { size: 1024 * 1024 * 1024, max: 10_000_000 }, // ixtiyoriy capped collection
});

auditLogSchema.index({ ts: -1 });
auditLogSchema.index({ kind: 1, ts: -1 });
auditLogSchema.index({ restaurantId: 1, ts: -1 });
auditLogSchema.index({ severity: 1, ts: -1 });
```

## Hodisa turlari (kind'lar)

### Authentication
| kind | severity | sabab |
|---|---|---|
| `login_success` | info | Muvaffaqiyatli login |
| `login_fail` | warn | Xato parol |
| `login_rate_limited` | warn | Brute force urinish |
| `logout` | info | |
| `token_revoked` | info | tokenVersion incremented |
| `password_changed` | warn | |
| `restaurant_login_success` | info | |
| `restaurant_login_fail` | warn | |

### Authorization
| kind | severity | sabab |
|---|---|---|
| `rbac_denied` | warn | Role yetarli emas |
| `cross_tenant_attempt` | critical | Boshqa restoran/filial resurs'iga kirish |
| `tenant_boundary_violation` | critical | URL param ↔ token mismatch |
| `socket_unauthorized_join` | warn | Mijoz `socket.join()` urindi |
| `socket_tenant_violation` | critical | Socket payload tenant mismatch |

### Socket
| kind | severity | sabab |
|---|---|---|
| `socket_auth_fail` | warn | Handshake auth fail |
| `socket_rate_limited` | warn | Event rate cap |
| `socket_ping_timeout` | info | Disconnect |
| `socket_unknown_event` | warn | Whitelist'da yo'q event |
| `branch_ip_mismatch` | critical | branchToken IP'dan kelmadi |
| `geo_anomaly` | warn | Boshqa mamlakatdan |

### Sync
| kind | severity | sabab |
|---|---|---|
| `sync_started` | info | offline → online |
| `sync_completed` | info | |
| `sync_conflict` | warn | merge konflikti |
| `sync_failed` | error | apply xato |
| `outbox_event_rejected` | warn | Per-event reject |

### Mode change
| kind | severity | sabab |
|---|---|---|
| `mode_change` | info | online → offline va h.k. |
| `possiz_activated` | warn | Admin majburiy yoqdi |
| `possiz_deactivated` | info | |

### Business operations (muhim)
| kind | severity | sabab |
|---|---|---|
| `order_created` | info | (lekin balki ortiqcha — order collection o'zi bor) |
| `order_cancelled_after_payment` | warn | Anomal |
| `large_discount_applied` | warn | 50%+ discount |
| `manual_stock_adjustment` | info | Sklad qo'lda o'zgartirilgan |
| `shift_force_closed` | warn | Pending tolovli shift admin tomonidan yopilgan |
| `feature_toggle_changed` | info | Toggle yoqildi/o'chirildi |

### System
| kind | severity | sabab |
|---|---|---|
| `secret_rotated` | info | JWT_SECRET yoki BRANCH_SECRET o'zgardi |
| `backup_completed` | info | |
| `backup_failed` | error | |
| `system_alert` | critical | Watchdog xato |

## Yozish utiliti

```javascript
// utils/audit.js
export const audit = {
  log: async (event) => {
    const doc = {
      kind: event.kind,
      severity: event.severity || severityForKind(event.kind),
      actor: event.actor,
      restaurantId: event.restaurantId,
      branchId: event.branchId,
      message: event.message,
      data: event.data,
      ip: event.ip,
      userAgent: event.userAgent,
      endpoint: event.endpoint,
      method: event.method,
    };
    try {
      await auditLogModel.create(doc);
    } catch (err) {
      // Audit log fail jiddiy lekin asosiy oqimni to'xtatmaydi
      console.error('AUDIT_LOG_FAIL', err);
    }
    // Critical bo'lsa darhol alert
    if (doc.severity === 'critical') {
      await alerter.notify(doc);
    }
  },
};
```

## Sensitive data redaction

Parol, token, secret hech qachon log'ga tushmasligi kerak:

```javascript
function redact(data) {
  const SENSITIVE_KEYS = ['password', 'token', 'secret', 'authorization', 'jwt', 'apiKey'];
  return JSON.parse(JSON.stringify(data, (key, value) => {
    if (SENSITIVE_KEYS.some(s => key.toLowerCase().includes(s))) {
      return '[REDACTED]';
    }
    return value;
  }));
}

// audit'da:
data: redact(req.body)
```

## Express middleware: avtomatik log

```javascript
// Har request ni log qilish — kerak emas (toshib ketadi)
// Faqat 4xx/5xx va shubhali:

export function auditExpress(req, res, next) {
  const originalSend = res.send.bind(res);
  res.send = function(body) {
    if (res.statusCode === 401) {
      audit.log({
        kind: 'request_unauthorized',
        endpoint: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
    } else if (res.statusCode === 403) {
      audit.log({
        kind: 'request_forbidden',
        endpoint: req.path,
        method: req.method,
        actor: req.userData ? { type: 'user', id: req.userData._id, role: req.userData.role } : { type: 'anonymous' },
        ip: req.ip,
      });
    }
    return originalSend(body);
  };
  next();
}
```

## Retention va arxivlash

| Severity | Saqlash | Joy |
|---|---|---|
| info | 90 kun | MongoDB |
| warn | 1 yil | MongoDB |
| error | 2 yil | MongoDB + S3 archive |
| critical | 5 yil | MongoDB + S3 archive |

Kunlik cron:
```javascript
// scripts/audit-rotate.js
await auditLogModel.deleteMany({
  severity: 'info',
  ts: { $lt: ninetyDaysAgo }
});
// arxivlash — S3 ga JSON.gz
```

## Admin dashboard

Web admin'da yangi sahifa: `/audit`

Filtrlar:
- Sana ranji
- Severity (info/warn/error/critical)
- Kind (autocomplete)
- Restaurant/Branch
- Actor (user)
- IP

Real-time:
- Critical event'lar live feed
- Anomaliya alerts:
  - 5+ `login_fail` per minute per IP → "brute force attempt"
  - 1+ `cross_tenant_attempt` → darhol critical alert
  - `branch_ip_mismatch` → "branchToken o'g'irlangan?"

## Alerting kanallari

```javascript
// utils/alerter.js
export const alerter = {
  notify: async (auditEvent) => {
    // 1. Email — restoran owner va system admin
    // 2. Telegram bot — system admin
    // 3. SMS — kritik holatlar (system admin)
    // 4. Slack/Discord — dev channel
    // 5. Dashboard real-time banner
  }
};
```

## SIEM integratsiyasi (kelajakda)

Katta tizimda audit log'lar tashqi SIEM'ga (Splunk, ELK, Datadog) jo'natiladi. Hozircha — Mongo'da yetadi.

## Test rejasi

- [ ] Login fail → log entry yoziladi
- [ ] Cross-tenant attempt → critical severity
- [ ] Parol log'ga tushmasligi (REDACTED)
- [ ] Audit fail bo'lsa asosiy oqim davom etadi
- [ ] Old logs auto-delete cron
- [ ] Critical event → alert trigger

## Bog'liq

- [[role-based-access]]
- [[tenant-izolyatsiyasi]]
- [[socket-xavfsizligi]]
- [[restoran-auth-tuzatish]]
- [[secrets-management]]
