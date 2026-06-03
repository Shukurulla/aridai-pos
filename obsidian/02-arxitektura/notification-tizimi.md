---
tags: [arxitektura, notification]
created: 2026-05-29
---

# Notification tizimi

## Kanallar

| Kanal | Maqsad | Servis |
|---|---|---|
| **Push** | Mobile (cook, waiter, admin) | FCM (Firebase) |
| **In-app** | POS, mobile real-time | Socket event |
| **SMS** | Keshbek, login alert | Eskiz (UZ) / mobizon (KZ) |
| **WhatsApp** | Keshbek bot | WhatsApp Cloud API |
| **Email** | Hisobot, alert (admin) | SMTP / SendGrid |
| **Telegram** | Dev/system alert | Telegram Bot API |

## Markaziy notification servisi

```javascript
// global/backend/services/notification.js
class NotificationService {
  async send({ channel, to, template, data, restaurantId }) {
    switch (channel) {
      case 'push': return this.fcm.send(to, template, data);
      case 'sms': return this.smsGateway.send(to, render(template, data));
      case 'whatsapp': return this.whatsapp.send(to, template, data);
      case 'email': return this.email.send(to, template, data);
      case 'in-app': return this.socket.toUser(to).emit('notification', { template, data });
    }
  }
}
```

Yagona interfeys — har xil kanal ortida.

## Push notification (FCM)

Eng muhim — possiz va online rejimda cook/waiter aloqasi.

### Token boshqaruvi
```javascript
// user device token
user.fcmTokens: [{ token, platform, lastSeen }]
```
Mobile app ochilganda token ro'yxatdan o'tadi. Logout'da o'chiriladi.

### Asosiy push'lar
| Hodisa | Kimga | Matn |
|---|---|---|
| Yangi order | cook'lar (role:cook room) | "Stol 5 — yangi buyurtma" |
| Ovqat tayyor | waiter (order egasi) | "Stol 5 — Osh tayyor" |
| Possiz yoqildi | barcha xodimlar | "Possiz rejim faollashtirildi" |
| Tolov kerak | cashier | "Stol 3 — tolov kutilmoqda" |

### FCM fail handling
- FCM yiqilsa → lokal socket fallback (online'da)
- Possiz'da → lokal Wi-Fi
- Retry queue

## In-app (socket)

Real-time, ilova ochiq bo'lganda:
- POS: order o'zgarishlari, sync holati
- Mobile: badge, list yangilanishi
- Socket event ([[socket-sinxronizatsiya]])

## SMS

- **Keshbek:** "Sizga 250 so'm keshbek berildi" ([[../04-toollar/keshbek-tizimi]])
- **Login alert:** "Hisobingizga kirildi" (ixtiyoriy)
- Gateway: Eskiz (UZ), valyutaga qarab ([[../07-nozik-nuqtalar/pul-valyuta-yaxlitlash]])
- Telefon normalizatsiya ([[../07-nozik-nuqtalar/telefon-normalizatsiya]])

## WhatsApp (keshbek bot)

Keshbek tizimi uchun ([[../04-toollar/keshbek-tizimi#WhatsApp bot oqimi]]):
- Mijoz QR → WhatsApp bot
- Telefon capture
- Keshbek xabar

## Email

- Restoran egasi: kunlik/oylik hisobot ([[hisobotlar-analitika]])
- Alert (filial uzoq offline, anomaliya)
- Welcome (yangi restoran)

## Telegram (internal)

- Dev team alert ([[../09-deployment/monitoring]])
- System admin: critical event

## Notification preferences

Foydalanuvchi sozlamalari (kelajak):
```javascript
user.notificationPrefs: {
  push: { newOrder: true, foodReady: true },
  sms: { login: false },
  email: { dailyReport: true },
}
```

## Feature toggle bilan

- Keshbek SMS — `keshbek` toggle
- Possiz push — `possiz` toggle
- Notification servisi har doim bor, lekin tool'larga bog'liq trigger'lar

## Idempotency

Bir hodisa uchun bitta notification (duplikat yo'q):
- Event ID bo'yicha dedup
- Retry'da takror yuborilmaydi

## Rate limiting

- SMS — qimmat, cheklov (1 phone / 1 daqiqa)
- Push — FCM o'zi handle qiladi
- Spam oldini olish

## Phase bo'yicha

- **Phase 1:** in-app (socket) — POS real-time
- **Phase 2:** push (FCM) — waiter mobile
- **Phase 3:** SMS (keshbek), WhatsApp (keshbek bot), possiz push
- **Phase 4:** email hisobot, preferences

## Bog'liq

- [[socket-sinxronizatsiya]]
- [[../04-toollar/keshbek-tizimi]]
- [[../04-toollar/cook-waiter-possiz-rejim]]
- [[../07-nozik-nuqtalar/telefon-normalizatsiya]]
- [[../09-deployment/monitoring]]
