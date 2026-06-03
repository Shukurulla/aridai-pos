---
tags: [tool, asos]
created: 2026-05-28
toolKey: offline
status: 📝
default: ON
---

# Tool: Online/Offline rejim

## Meta

- **Key:** `offline`
- **Status:** 📝 dizayn
- **Default:** ON
- **Version:** 1
- **requires:** core
- **excludes:** —

## Maqsad

Restoran offline (internetsiz) ishlay olishi yoki yo'qligini boshqarish.

- Yoq: internet uzulganda POS yozadi (lokal), reconnect'da sync bo'ladi
- Och: internet uzulganda POS ham yozmaydi, "internet kuting" deb chiqaradi

## Foydalanuvchi senariolari

### Senariy 1: Kichik kafe — offline kerak emas
- Restoran admin'i toggle'ni o'chiradi
- POS endi internet uzulganda **yozmaydi**, faqat o'qiydi (oxirgi cache)
- Sodda restoran, sync murakkabligi yo'q

### Senariy 2: Markazlashgan restoran — offline kerak
- Toggle yoqilgan
- Internet uzulsa POS oddiy ishlayveradi
- Reconnect'da [[../02-arxitektura/sinxronizatsiya/offline-to-online-otish|sync protokoli]] ishlaydi

## UI o'zgarishlar

| Role | UI |
|---|---|
| Admin (web) | Sozlamalar → "Offline rejim" toggle + sync sozlamalari |
| POS monitor | Status barda mode indikator (🟢 online / 🟡 offline / 🔄 syncing) |
| Waiter mobile | Internet uzulganda — toggle off bo'lsa: "Filial bilan ulanish yo'q" / toggle on bo'lsa: "Filial offline rejimda" |

## Data model

Yangi entity yo'q.
`branch` modeliga qo'shimcha:
```javascript
branch.currentMode: 'online' | 'offline' | 'online_syncing' | 'possiz'
branch.lastSyncedAt: Date
branch.outboxPending: Number
```

`order`, `food`, va boshqa entity'larga:
```javascript
{
  clientId: UUID,
  version: Number,
  syncStatus: 'synced' | 'pending' | 'in_progress' | 'rejected',
  lastModifiedAt: Date,
  lastModifiedBy: { userId, origin: 'local'|'global' }
}
```

Lokal MongoDB'da `outbox` collection (mongoose schema):
```javascript
{
  _id: UUID,
  eventType: String,
  entityId: ObjectId,
  payload: Object,        // BSON
  createdAt: Date,
  sentAt: Date,
  ackedAt: Date,
  retryCount: { type: Number, default: 0 },
  lastError: String,
}
// Index: { sentAt: 1, createdAt: 1 } — bo'shatish tartibi
```

> [!note] MongoDB'da nima uchun?
> Local backend Electron main process'da, lokal MongoDB Windows Service sifatida ishlaydi. Schema global bilan bir xil bo'lgani uchun mongoose model'larini ikkala tomon ulashadi. Qarang: [[../02-arxitektura/local-backend-stack]]

## API endpoint'lari

| Method | Path | Min role | Tavsif |
|---|---|---|---|
| GET | `/api/branches/:id/sync-status` | admin | Outbox holati, oxirgi sync vaqti |
| POST | `/api/branches/:id/sync-now` | admin | Majburiy sync triggeri |
| GET | `/api/branches/:id/sync-conflicts` | admin | Konflikt log'i |

## Socket eventlar

Qarang: [[../02-arxitektura/socket-sinxronizatsiya]]
- `sync.start`, `sync.batch`, `sync.batch_ack`, `sync.complete`, `sync.done`
- `mode.changed`
- `presence.heartbeat`

## Rejimlar ichida xatti-harakati

### Online
- Hammasi standart

### Offline (toggle YOQ bo'lsa)
- Lokal yozish ishlaydi
- Outbox to'ladi
- Reconnect'da sync

### Offline (toggle O'CH bo'lsa)
- Lokal yozish bloklanadi
- POS UI'da "Internet ulanishini kuting" placeholder
- O'qish lokal cache'dan (oxirgi sync'gacha bo'lgan data)

### Possiz
- Bu tool bilan bog'liq emas (alohida [[cook-waiter-possiz-rejim|possiz toggle]] kerak)

## Boshqa toollarga bog'liqlik

- `requires`: hech narsa (core'ning bir qismi)
- `excludes`: —
- `enhances`: barcha boshqa tool'lar uchun ishonchli backend

## Lifecycle hook'lar

### onEnable
- Local backend uchun sync engine'ni faollashtiradi
- Outbox monitoring boshlanadi
- Heartbeat aktiv

### onDisable
- Outbox monitoring to'xtatiladi
- "Lokal yozish bloklash" mantiq yoqiladi
- Mavjud outbox event'lari — yolg'iz qoladi (admin'ga ogohlantirish)

## Konfiguratsiya parametrlari

```javascript
features.offline.config = {
  syncBatchSize: 100,
  heartbeatIntervalMs: 3000,
  reconnectMaxRetries: 10,
  conflictResolution: 'local-wins' | 'global-wins' | 'last-writer-wins',
}
```

## Migration

| Versiya | Sana | O'zgarish |
|---|---|---|
| 1 | 2026-05-28 | Initial |

## Test rejasi

- [ ] Toggle off → POS internet uzulganda blok
- [ ] Toggle on → POS internet uzulganda yozaveradi
- [ ] Reconnect → outbox to'liq sync
- [ ] Sync paytida POS yozish davom etadi (sync paralleldir)
- [ ] Conflict → log'ga yoziladi
- [ ] 5 marta retry'dan keyin admin notification

## Bog'liq

- [[../02-arxitektura/3-rejim]]
- [[../02-arxitektura/socket-sinxronizatsiya]]
- [[../02-arxitektura/sinxronizatsiya/offline-to-online-otish]]
- [[../02-arxitektura/conflict-resolution]]
- [[cook-waiter-possiz-rejim]]
