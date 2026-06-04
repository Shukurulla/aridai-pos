---
sana: 2026-06-03
mavzu: FCM push — backend infratuzilma (cook/waiter bildirishnoma)
status: backend tayyor (mobil tomon Firebase config'dan keyin)
---

# FCM push — backend infratuzilma

## Bajarildi (backend — to'liq, no-op xavfsiz)
- `firebase-admin` o'rnatildi. `utils/push.js` — `sendToTokens`/`pushAsync`; Firebase FAQAT
  `FIREBASE_SERVICE_ACCOUNT` (env JSON) orqali. **Sozlanmasa → no-op** (xato bermaydi, push o'chiq).
- `users.model.js`: `pushTokens: [String]` (mobil qurilma tokenlari).
- `user.routes.js`: `POST/DELETE /api/users/me/push-token` — qurilma tokenini ro'yxatga olish/o'chirish.
- `order.routes.js` event wiring:
  - `/orders/place` → filial **cook'lariga** "Новый заказ" (biriktirilgan taom filtri bilan).
  - cooking `ready` → orderning **waiter'iga** "Блюдо готово".
- `.env.example`: `FIREBASE_SERVICE_ACCOUNT` (izoh bilan).
- ✅ Sinov: backend toza qayta yuklandi, health ok, push-token register ✅, push OFF (kutilgan).

## Mobil tomon (siz Firebase qo'shgach — keyingi)
1. **Firebase loyiha** yarating → Android app (`com.aridai...`) qo'shing → **`google-services.json`**
   ni `aridai-pos-app/android/app/` ga joylang (+ iOS uchun plist).
2. Backend secret: `FIREBASE_SERVICE_ACCOUNT` (service account JSON) → VPS .env.
3. Shundan keyin men ulayman: `firebase_core`+`firebase_messaging`, token olish →
   `POST /users/me/push-token`, foreground/background xabar handlerlari.
> Hozir firebase deps qo'shilmadi — `google-services.json` bo'lmasa Android build (CI APK) buziladi.

## Real-time holat
- **In-app** (ilova ochiq): socket.io `orders:changed` allaqachon ishlaydi (cook/waiter/cashier).
- **Background** (ilova yopiq): FCM kerak — backend tayyor, mobil Firebase config kutilmoqda.
