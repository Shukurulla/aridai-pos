---
tags: [frontend, arxitektura]
created: 2026-05-29
---

# Umumiy frontend arxitekturasi

> Barcha frontend ilovalar ulashadigan patternlar. Har biri (web, POS, mobile, QR) shu poydevorga tayanadi.

## Ulashilgan kod (shared)

```
shared/
├── types/           # TypeScript turlari (entity'lar)
├── api-client/      # REST client (auth, retry, error handling)
├── socket-client/   # Socket.io client wrapper
├── money/           # formatMoney, round, percentOf ([[../07-nozik-nuqtalar/pul-valyuta-yaxlitlash]])
├── phone/           # normalizePhone ([[../07-nozik-nuqtalar/telefon-normalizatsiya]])
├── calc/            # calculateOrderTotals ([[../05-data-model/biznes-mantiq/total-hisoblash]])
└── i18n/            # tarjima kalit'lari ([[../02-arxitektura/lokalizatsiya]])
```

> [!important] calc shared — lokal va global bir xil
> `calculateOrderTotals` — frontend (optimistic UI), local backend, global backend — **uchchovi bir xil kod** ishlatadi. Aks holda hisoblar farq qiladi.

## API client

```typescript
// shared/api-client
class ApiClient {
  constructor(baseUrl, getToken, onUnauthorized) {}

  async request(method, path, body) {
    const token = await this.getToken();
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) {
      // tokenVersion bekor — refresh urinish yoki logout
      await this.handleUnauthorized();
    }
    return res.json();
  }
}
```

Xususiyatlar:
- Auto token attach
- 401 → refresh token urinish ([[../02-arxitektura/xavfsizlik/auth-strategiyasi]])
- Retry (network xato)
- Error normalize (`{ status, code, message }`)

## Socket client

```typescript
// shared/socket-client
class SocketClient {
  connect(token, tokenType) {
    this.socket = io(this.url, { auth: { token, tokenType } });
    this.socket.on('connect', () => this.onConnect());
    this.socket.on('disconnect', () => this.onDisconnect());
    this.setupReconnect();  // exponential backoff
  }

  on(event, handler) { this.socket.on(event, handler); }
  emit(event, data) { return this.socket.emitWithAck(event, data); }
}
```

Xususiyatlar:
- Auto-reconnect (exponential backoff)
- Event subscription (room'lar server tomonidan)
- `emitWithAck` — ack kutadigan emit
- Connection status (online/degraded/down)

## State management

| Ilova | State |
|---|---|
| Web admin | React Query (server state) + Zustand (UI state) |
| POS Electron | Zustand + lokal cache (IPC orqali local backend) |
| Mobile Flutter | Riverpod (yoki BLoC) |
| Mijoz QR | React Query (sodda) |

> [!note] Server state vs UI state
> Server state (orderlar, menyu) — React Query / Riverpod cache. UI state (modal ochiq, tanlangan tab) — Zustand / local. Aralashtirmaslik.

## Optimistic UI (POS uchun muhim)

POS'da har harakat **darhol** ko'rinadi, sync fonda:

```typescript
async function addFoodToOrder(orderId, food) {
  // 1. Darhol UI'da ko'rsatish (optimistic)
  updateLocalOrder(orderId, food);

  // 2. Local backend'ga (IPC)
  try {
    const updated = await localApi.addFood(orderId, food);
    reconcile(updated);  // server javobini moslashtirish
  } catch (err) {
    rollback(orderId, food);  // xato bo'lsa qaytarish
    showError(err);
  }
}
```

## Feature-flag aware rendering

```tsx
const { features } = useRestaurant();

return (
  <>
    {features.sklad?.enabled && <SkladMenu />}
    {features.qrPay?.enabled && <KaspiButton />}
    {features.keshbek?.enabled && <CashbackPanel />}
  </>
);
```

Feature o'zgarsa — `restaurant.features_changed` socket event → refetch → UI yangilanadi.

## Real-time updates

```tsx
useEffect(() => {
  socket.on('order.created', (order) => queryClient.invalidate(['orders']));
  socket.on('order.paid', (order) => updateOrder(order));
  socket.on('food.ready', (data) => showNotification(data));  // waiter'ga
  return () => socket.off(...);
}, []);
```

## Xato handling

- Network xato → retry banner
- 401 → refresh yoki login
- 403 (RBAC) → "Ruxsat yo'q" xabar
- 404 FEATURE_DISABLED → menyuni yashirish
- 409 conflict → "Yangilang, kimdir o'zgartirdi"
- 500 → "Server xatosi, qayta urinib ko'ring"

## i18n

Barcha matn `t('key')` orqali. Default uz, qo'shimcha ru. ([[../02-arxitektura/lokalizatsiya]])

## Test

- Component test (React Testing Library / Flutter widget test)
- E2E (Playwright web, integration test mobile)
- Shared `calc` unit test (kritik)

## Bog'liq

- [[_MOC]]
- [[../02-arxitektura/socket-sinxronizatsiya]]
- [[../02-arxitektura/xavfsizlik/auth-strategiyasi]]
- [[../05-data-model/biznes-mantiq/total-hisoblash]]
- [[../02-arxitektura/lokalizatsiya]]
