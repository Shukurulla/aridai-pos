---
tags: [shablon]
created: 2026-05-28
---

# Tool: {NOMI}

> Bu shablon. Yangi tool yozayotganda **butun shu fayl'ni** `04-toollar/{tool-key}.md` ga ko'chirib, to'ldiring.

## Meta

- **Key:** `{toolKey}` (kichik harf, kebab-case yoki camelCase)
- **Status:** 💭 g'oya / 📝 dizayn / 🚧 kod / ✅ tayyor
- **Default:** ON / OFF
- **Version:** 1
- **requires:** `[...]`
- **excludes:** `[...]`

## Maqsad

Bir abzasda — bu tool nima qiladi va nima uchun kerak.

## Foydalanuvchi senariolari

### Senariy 1: ...
- Foydalanuvchi: ...
- Harakat: ...
- Natija: ...

### Senariy 2: ...

## UI o'zgarishlar

| Role | Yangi UI | Eski UI o'zgarishi |
|---|---|---|
| Admin (web) | Yangi sahifa: `/sklad` | "Sozlamalar" → "Sklad" toggle |
| Waiter (mobile) | - | - |
| Cook (mobile) | "Tayyorlash" view'ida ingredient ko'rsatish | - |
| Cashier (mobile/POS) | - | Order ekranida "low stock" bayroq |

## Data model

```javascript
// models/...js
const xSchema = new mongoose.Schema({...});
```

Yangi collection'lar:
- `...`

Mavjud model'larga patch:
- `order` — qo'shimcha `xField`

## API endpointlari

| Method | Path | Min role | Tavsif |
|---|---|---|---|
| POST | `/api/{tool}/x` | admin | ... |
| GET | `/api/{tool}/x` | * | ... |

Barcha endpoint'lar `requireFeature('{toolKey}')` middleware bilan o'ralgan.

## Socket eventlar

| Yo'nalish | Event | Payload | Maqsad |
|---|---|---|---|
| L → G | `{tool}.created` | `{...}` | ... |
| G → L | `{tool}.updated` | `{...}` | ... |
| G → role:X | `{tool}.notification` | `{...}` | ... |

## Rejimlar ichida xatti-harakati

### Online
- Hammasi ishlaydi

### Offline
- ... (ishlaydi / cheklangan / ishlamaydi)
- Lokal'da yoziladi, reconnect'da sync

### Possiz
- ... (ishlaydi / ishlamaydi)

## Boshqa tool'larga bog'liqlik

- `requires`: ... sababi: ...
- `excludes`: ... sababi: ...
- Optional integration: ... bilan

## Lifecycle hook'lar

### onInstall
```javascript
async function {tool}OnInstall(restaurantId) {
  // collection yaratish, default data
}
```

### onEnable
```javascript
async function {tool}OnEnable(restaurantId, config) {
  // listener'lar, joblar
}
```

### onDisable
```javascript
async function {tool}OnDisable(restaurantId) {
  // detach, lekin data qoldiriladi
}
```

## Konfiguratsiya parametrlari

```javascript
features.{toolKey}.config = {
  param1: defaultValue,
  param2: defaultValue,
}
```

| Param | Tur | Default | Tavsif |
|---|---|---|---|
| `param1` | number | 10 | ... |

## Migration tarixi

| Versiya | Sana | O'zgarish |
|---|---|---|
| 1 | 2026-05-28 | Initial |

## Test rejasi

- [ ] Default OFF
- [ ] Enable success
- [ ] Disable success (data qoladi)
- [ ] Re-enable (eski data qaytadi)
- [ ] Disabled'da endpoint 404
- [ ] Disabled'da socket event ignored
- [ ] Disabled'da UI ko'rinmaydi
- [ ] Tool o'chiq paytda order/payment flow buzilmaydi
- [ ] Offline yaratilgan ma'lumotlar reconnect'da sync bo'ladi
- [ ] Multi-tenant — boshqa restorandan ko'rinmaydi
- [ ] requires/excludes validation

## Bog'liq

- [[../03-tool-strategiyasi/feature-toggle-tizimi]]
- [[../03-tool-strategiyasi/tool-lifecycle]]
- [[../03-tool-strategiyasi/modullar-orasidagi-bogliqlik]]
- [[_MOC]]
