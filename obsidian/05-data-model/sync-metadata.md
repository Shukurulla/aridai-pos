---
tags: [data-model, sync, muhim]
created: 2026-05-28
---

# Sync metadata

> Har sinxronizatsiya qilinadigan entity'da qo'shimcha field'lar to'plami. Bu field'lar sync mantiqi, konflikt yechimi va idempotentlik uchun ishlatiladi.

## Qo'shiladigan field'lar

```javascript
const syncMetaFields = {
  // Lokal'da yaratilganda UUID v4
  clientId: {
    type: String,
    sparse: true,
    unique: true,    // bitta entity bir clientId bilan
    index: true,
  },

  // Har o'zgarishda +1
  version: {
    type: Number,
    default: 1,
  },

  // Sync status
  syncStatus: {
    type: String,
    enum: ['synced', 'pending', 'in_progress', 'rejected', 'conflict'],
    default: 'synced',
    index: true,
  },

  // Oxirgi o'zgarish vaqti (wall clock)
  lastModifiedAt: {
    type: Date,
    default: Date.now,
  },

  // Oxirgi o'zgartiruvchi
  lastModifiedBy: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user',
    },
    origin: {
      type: String,
      enum: ['local', 'global', 'system'],
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,  // qaysi filialdan
    },
  },

  // Soft delete (tombstone)
  deleted: {
    type: Boolean,
    default: false,
    index: true,
  },
  deletedAt: Date,
  deletedBy: mongoose.Schema.Types.ObjectId,

  // Konflikt log (rare)
  conflictResolved: {
    at: Date,
    strategy: String,   // 'local-wins' | 'global-wins' | 'merged' | 'manual'
    notes: String,
  },
};
```

## Mongoose plugin

```javascript
// 05-data-model/sync-meta.plugin.js
export function syncMetaPlugin(schema, options = {}) {
  schema.add(syncMetaFields);

  schema.pre('save', function(next) {
    if (this.isNew && !this.clientId) {
      this.clientId = uuidv4();
    }
    if (this.isModified() && !this.isNew) {
      this.version = (this.version || 1) + 1;
      this.lastModifiedAt = new Date();
    }
    next();
  });

  schema.pre('findOneAndUpdate', function(next) {
    this.set({
      $inc: { version: 1 },
      $set: { lastModifiedAt: new Date() },
    });
    next();
  });

  // Soft delete helper
  schema.statics.softDelete = async function(id, deletedBy) {
    return this.findOneAndUpdate(
      { _id: id },
      { deleted: true, deletedAt: new Date(), deletedBy },
    );
  };

  // Default query — soft deleted'ni chiqarmaslik
  schema.pre(/^find/, function() {
    if (!this.getOptions().includeDeleted) {
      this.where({ deleted: { $ne: true } });
    }
  });
}
```

## Field'lar ma'nosi

### `clientId` (UUID v4)
- Faqat **lokal'da yaratilgan** entity'larga beriladi
- Global tomonidan yaratilgan entity'lar uchun null
- Konflikt vaziyatida `_id` ni topish/birlashtirish uchun ishlatiladi
- Misol: filial offline'da order yaratdi. Reconnect bo'lgach global'ga jo'natadi. Global'da bunday `clientId` allaqachon ko'rilganmi? Yo'q → yangi order. Ha → existing'ni qaytaradi.

### `version`
- Lamport timestamp varianti
- Har o'zgarishda +1
- Konflikt vaziyatida — kim yangiroq versiya'ga ega?
- Yo'q yo'q: ikkala tomon parallel +1 qilsa — version ikkala holatda ham 2 bo'ladi. Bu yer'da wall clock yoki branch priority kerak.

### `syncStatus`
Lokal entity'lar uchun:
| Status | Ma'nosi |
|---|---|
| `synced` | Global VPS bilan moslashgan |
| `pending` | Lokal yangi, hali jo'natilmagan |
| `in_progress` | Hozir jo'natilmoqda |
| `rejected` | Global rad qildi (validation/tenant xato) |
| `conflict` | Konflikt aniqlandi, qaror kutmoqda |

Global entity'larida `syncStatus` har doim `synced`.

### `lastModifiedAt`
- Wall clock
- Konflikt yechishda yordamchi (asosiy emas)
- Hisobotlar va sort uchun

### `lastModifiedBy.origin`
- `local` — filial POS yoki mobile'dan
- `global` — admin web yoki tashqi servis (Kaspi webhook)
- `system` — avtomatik (scheduled job, sync)

### `isDeleted` (tombstone) — canonical nom
- O'chirish = `isDeleted: true` (soft delete), darhol fizik o'chirilmaydi
- **1 oylik tiklash oynasi** — xato o'chirilsa qaytariladi ([[../07-nozik-nuqtalar/ochirish-cascade]])
- **Katalog** (food/category/table/user/discount/ingredient): 1 oydan keyin hard delete (cleanup), lekin PITR backup'da bor
- **Moliyaviy** (order/shift/payment/cashback): **hech qachon** hard delete (bekor/arxiv) — [[../09-deployment/backup-pitr]]
- Query'lar default `isDeleted: { $ne: true }`
- GDPR → **anonimizatsiya** (telefon/ism olib tashlanadi, yozuv qoladi)
- `onUninstall` ham hard delete emas — data qoladi (tool o'chsa ham)

> [!note] Field nomi
> Canonical = **`isDeleted`** (foydalanuvchi 2026-05-29). Eski docs'da `deleted` — bir xil semantika; kodda `isDeleted`.

## Outbox event payload

Sync mantiqi outbox orqali — har o'zgarish event'i:

```javascript
// outbox collection (faqat lokal'da)
{
  _id: UUID,                      // event ID (idempotency)
  eventType: 'order.created',     // qaysi event
  entityType: 'order',
  entityId: ObjectId,             // qaysi entity
  entityClientId: UUID,            // entity'ning clientId
  entityVersion: 1,                // entity'ning hozirgi versiyasi
  payload: { /* to'liq entity */ },
  createdAt: Date,
  sentAt: Date,                    // null = hali jo'natilmadi
  ackedAt: Date,                   // null = ack kelmadi
  retryCount: 0,
  lastError: null,
}
```

## Event idempotency

Global VPS'da event'ni qabul qilganda:

```javascript
async function applyEvent(ev) {
  // 1. Ko'rilganmi?
  const seen = await redis.sismember(`seen:${ev.branchId}`, ev._id);
  if (seen) {
    return { idempotent: true };
  }

  // 2. Entity allaqachon bormi (clientId orqali)?
  const existing = await model.findOne({ clientId: ev.entityClientId });
  if (existing) {
    if (existing.version >= ev.entityVersion) {
      // Bizniki yangiroq yoki teng
      await redis.sadd(`seen:${ev.branchId}`, ev._id);
      return { skipped: 'older_version' };
    }
    // Update
    await applyUpdate(existing, ev.payload);
  } else {
    // Yangi
    await model.create(ev.payload);
  }

  // 3. Belgilash
  await redis.sadd(`seen:${ev.branchId}`, ev._id);
  await redis.expire(`seen:${ev.branchId}`, 30 * 24 * 60 * 60); // 30 kun
}
```

## Konflikt aniqlash

Lokal `version: 3` → Global'ga jo'natadi
Global'da version: 3 keldi, lekin global'ning version: 4 (boshqa joydan o'zgartirildi)

```javascript
if (existing.version >= incomingEvent.version) {
  // Konflikt — yoki ignore qilamiz (last-writer-wins) yoki merge
  await handleConflict(existing, incomingEvent);
}
```

Tafsilot: [[../02-arxitektura/conflict-resolution]]

## Qaysi entity'larga sync metadata kerak

| Entity | Kerakmi | Sabab |
|---|---|---|
| `restaurant` | ❌ Yo'q | Faqat global'da, lokal'ga sync bo'lmaydi |
| `branch` | 🟡 Qisman | Global → lokal sync, lekin filial o'zining branch'ini o'zi yozmaydi |
| `user` | ✅ Ha | Lokal'da xodim ko'rinishi (boshqa kelmasligi mumkin) |
| `food` | ✅ Ha | Menyu lokal'da, admin global'da o'zgartirsa sync |
| `category` | ✅ Ha | Xuddi food |
| `table` | ✅ Ha | |
| `order` | ✅ Ha (eng muhim) | Doim ikkala tomonda yoziladi |
| `shift` | ✅ Ha | Lokal'da ochilishi mumkin |
| `service` | ✅ Ha | |
| `discount` | ✅ Ha | |
| Tool entity'lar | Tool'ga qarab | Sklad — ha, keshbek — qisman |

## `restaurant.features` maxsus

Toggle o'zgarganda — yangi event `restaurant.features_changed` lokal'larga push qilinadi. Bu — sync emas, sodda broadcast (chunki lokal `restaurant` collection saqlamaydi).

Lokal backend'da: `features` cache fayl sifatida (`C:\ProgramData\AridaiPos\config\feature-flags-cache.json`).

## Test rejasi

- [ ] `save()` paytida `clientId` avtomatik UUID
- [ ] `findOneAndUpdate()` version `+1`
- [ ] Idempotent event qaytarib qabul qilinmaydi
- [ ] clientId duplikat — existing'ni topadi
- [ ] Old version event — skip
- [ ] Conflict aniqlanganda log
- [ ] Soft delete — query'da chiqmaydi
- [ ] `includeDeleted: true` — chiqadi

## Bog'liq

- [[_MOC]]
- [[../02-arxitektura/conflict-resolution]]
- [[../02-arxitektura/socket-sinxronizatsiya]]
- [[../02-arxitektura/sinxronizatsiya/offline-to-online-otish]]
