---
tags: [tool-strategiyasi, shablon]
created: 2026-05-28
---

# Yangi tool qo'shish shabloni

> Bu hujjat — har bir yangi tool qo'shilganda bajarilishi kerak bo'lgan **majburiy qadamlar ro'yxati**. [[99-templates/yangi-tool-template|Obsidian shabloni]] esa har bir tool hujjati uchun yozma forma.

## Qadamlar — kod tomonda

### 1. Obsidian'da dizayn

`04-toollar/{tool-nomi}.md` fayl yarating. [[../99-templates/yangi-tool-template|Shablon]] dan ko'chiring. Quyidagilarni to'ldiring:
- Maqsadi
- Foydalanuvchi senariyolari
- Data model (qanday entity'lar)
- API endpoint'lar
- Socket event'lar
- UI o'zgarishlar (qaysi role'da nimani ko'radi)
- Boshqa tool'larga bog'liqligi
- Online/Offline/Possiz rejimlarda xatti-harakati
- Migration rejasi

> [!important] Bu qadamsiz kod yozish taqiqlanadi
> Hujjat avval to'liq bo'lishi shart. Code review'da: "Obsidian'da yo'q bo'lsa, kod merge qilinmaydi".

### 2. Registry'ga qo'shish

`global/backend/features/registry.js`:
```javascript
mytool: {
  key: 'mytool',
  displayName: { uz: '...', en: '...' },
  description: { uz: '...' },
  defaultEnabled: false,
  requires: ['offline'],  // boshqa tool kerak bo'lsa
  excludes: [],
  version: 1,
  migrations: [{ v: 1, fn: mytoolInit }],
  onEnable: mytoolOnEnable,
  onDisable: mytoolOnDisable,
  onInstall: mytoolOnInstall,
  onUninstall: null,
  schemaPatch: 'mytool',
}
```

### 3. Papka tuzilishi (har tool — alohida modul)

```
global/backend/features/mytool/
├── index.js          // hook'lar export
├── models/           // mongoose schemalar
│   └── mytool.model.js
├── routes/           // REST endpoint'lar
│   └── mytool.routes.js
├── sockets/          // socket handler'lar
│   └── mytool.events.js
├── jobs/             // background scheduled
│   └── daily.js
├── migrations/       // versiya migration'lari
│   ├── v1.js
│   └── v2.js
├── hooks.js          // onEnable/onDisable mantiq
└── README.md         // ishlatish va integratsiya
```

### 4. Routelarni feature guard bilan o'rash

```javascript
// global/backend/features/mytool/routes/mytool.routes.js
import { requireFeature } from '../../middleware.js';

router.use(authMiddleware, requireFeature('mytool'));
router.post('/items', ...);
```

`index.js` da auto-register:
```javascript
import mytoolRouter from './routes/mytool.routes.js';
app.use('/api/mytool', mytoolRouter);
```

### 5. Socket event listener'lar

```javascript
// sockets/mytool.events.js
export function registerMytoolEvents(io, restaurantId) {
  io.to(`restaurant:${restaurantId}`).on('mytool.action', async (ev, cb) => {
    // ...
  });
}

// hooks.js
export async function onEnable(restaurantId) {
  registerMytoolEvents(globalIo, restaurantId);
}
```

### 6. Frontend conditional render

Mobile/web admin:
```javascript
const { features } = useRestaurant();

return (
  <>
    {features.mytool?.enabled && <MytoolMenu config={features.mytool.config} />}
  </>
);
```

### 7. Local backend tomon

Agar tool offline'da ham ishlashi kerak bo'lsa:
- `local/backend/features/mytool/` — global'dagi mirror
- Lokal MongoDB migration: `local/backend/migrations/mytool.js` (mongoose schema patch)
- Lokal socket event handler

Agar tool faqat online'da ishlasa (masalan, Kaspi Pay) — local'da `mytool` papkasi kerak emas, lekin offline'da UI uni disable qiladi.

### 8. Test rejasi yozish

`__tests__/features/mytool.test.js`:
- `it('disabled by default')`
- `it('can be enabled')`
- `it('routes 404 when disabled')`
- `it('socket events rejected when disabled')`
- `it('UI hidden when disabled')`
- `it('disable → enable → state preserved')`
- `it('does not break order flow when disabled')`
- `it('works in offline mode')` (agar tegishli bo'lsa)
- `it('correctly syncs on reconnect')`

### 9. Migration script

```javascript
// migrations/v1.js
export default async function v1(restaurantId) {
  await db.createCollection('mytool_items');
  // initial data
}
```

`onInstall` paytida ishlaydi. Idempotent bo'lishi shart.

### 10. Changelog yozish

`06-changelog/YYYY-MM-DD-mytool-qoshildi.md`:
```markdown
- Yangi tool: mytool
- Sabab: ...
- O'zgargan fayllar: ...
- Test: ...
- Bog'liq: [[../04-toollar/mytool]]
```

### 11. INDEX yangilash

`00-INDEX.md` ga link qo'shing.

### 12. Modullar bog'liqligi yangilash

`03-tool-strategiyasi/modullar-orasidagi-bogliqlik.md` da grafga qo'shing.

## Qadamlar — yumshoq tomonda

### 13. Admin panel UI'ga toggle qo'shish

Web admin'da `/restaurants/:id/settings/features` sahifasida avtomatik chiqadi (registry'dan generatsiya qilinadi).

### 14. Hujjat tilini tekshirish

- O'zbekcha tavsif aniqmi?
- Inglizcha sarlavha o'rinli ishlatilganmi?
- Misol senariy bormi?

### 15. Code review checklist

- [ ] Obsidian hujjat to'liqmi?
- [ ] `requireFeature` middleware barcha endpoint'larda bormi?
- [ ] Socket handler'larda `isFeatureEnabled` tekshiruvi bormi?
- [ ] Frontend `features.X.enabled` conditional bormi?
- [ ] `tenantGuard` ishlatilganmi?
- [ ] Test rejasi yozilganmi?
- [ ] Migration idempotentmi?
- [ ] `onDisable` data'ni o'chirmasligini tasdiqlanganmi?

## Qisqa misol: "tipping" (chayyot pul) tool qo'shish

1. **Obsidian dizayn:** [04-toollar/tipping.md] — har order'da % tip yoki absolute summa
2. **Registry:** `tipping: { requires: [], displayName: { uz: 'Chayyot pul' }, ... }`
3. **Schema patch:** `order.tip = { amount, percent }`
4. **Endpoint:** `POST /orders/:id/tip { amount }`
5. **Socket event:** `order.tipped`
6. **UI:** cashier ekraniga "Chayyot pul" input
7. **Test:** disable'da `/tip` 404 qaytaradi, order ham xato bo'lmaydi
8. **Changelog**

Bu shablon bilan har qanday tool qisqa vaqtda dizayn → kod → joriy etishga olinadi.

## Bog'liq

- [[feature-toggle-tizimi]]
- [[tool-lifecycle]]
- [[modullar-orasidagi-bogliqlik]]
- [[../99-templates/yangi-tool-template]]
