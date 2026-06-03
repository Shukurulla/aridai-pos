---
tags: [nozik-nuqta, vaqt, muhim]
created: 2026-05-29
---

# Vaqt va soat

## Muammo 1: Lokal POS PC soati noto'g'ri

POS PC oddiy Windows kompyuter. Soati:
- NTP bilan sinxron bo'lmasligi mumkin
- Foydalanuvchi qo'lda o'zgartirgan bo'lishi mumkin
- BIOS batareyasi o'lgan bo'lsa har restart'da reset

**Bu nimaga ta'sir qiladi:**
- `order.createdAt` yolg'on → hisobot buziladi
- **Hourly tarif** (billiard) noto'g'ri hisoblanadi → mijoz ortiq/kam tolaydi
- Konflikt yechimida wall-clock taqqoslash buziladi
- Smena vaqti noto'g'ri

### Qaror

1. **Installer NTP sync sozlaydi** — Windows Time service `time.windows.com` yoki `pool.ntp.org`
2. **Lokal backend har soatda NTP tekshiradi** — global VPS vaqti bilan farqni o'lchaydi
3. **Soat farqi > 30s bo'lsa** — POS UI'da ⚠️ banner: "Kompyuter soati noto'g'ri, tuzating"
4. **Hourly tarif uchun server vaqti** — agar online bo'lsa, `selectedTariff.startedAt` server timestamp; offline bo'lsa lokal, lekin clock-drift log'lanadi

```javascript
// Lokal backend — clock drift tekshiruvi
socket.on('pong', (serverTime) => {
  const localTime = Date.now();
  const drift = Math.abs(localTime - serverTime);
  if (drift > 30000) {
    emit('system.clock_drift', { drift, localTime, serverTime });
    // POS UI banner
  }
});
```

## Muammo 2: Timezone

O'zbekiston — UTC+5 (bitta zona). Qozog'iston — UTC+5 (2024'dan butun davlat bitta zona). DST yo'q ikkala davlatda.

### Qaror

- **Saqlash: har doim UTC** (MongoDB Date — UTC)
- **Ko'rsatish: restoran timezone'ida** — `restaurant.timezone` (default `Asia/Tashkent` yoki `Asia/Almaty`)
- Frontend `Intl.DateTimeFormat` bilan local'ga aylantiradi
- Server hech qachon local time bilan ishlamaydi (faqat UTC)

```javascript
// restaurant schema
timezone: { type: String, default: 'Asia/Tashkent' }  // yoki Asia/Almaty

// Ko'rsatish (frontend)
new Intl.DateTimeFormat('uz-UZ', {
  timeZone: restaurant.timezone,
  dateStyle: 'short',
  timeStyle: 'short'
}).format(order.createdAt);
```

## Muammo 3: Biznes kun (business day) — yarim tundan o'tish

Restoran/klub tunda ishlaydi — 22:00 dan 04:00 gacha. Calendar kun yarim tunda o'zgaradi, lekin biznes kun emas.

**Ta'sir:**
- Chek raqamlash ([[chek-raqamlash]]) — `sana` qaysi sana?
- Kunlik hisobot — 00:00-04:00 orderlari oldingi kunga tegishli
- Smena ko'pincha biznes kunni belgilaydi

### Qaror

- **`restaurant.businessDayStartHour`** — default `06:00`
- Biznes kun: 06:00 dan keyingi 06:00 gacha
- 00:00-06:00 orderlari **oldingi calendar kunga** tegishli

```javascript
function businessDate(timestamp, startHour = 6) {
  const d = new Date(timestamp);
  const localHour = d.getHours(); // restaurant tz
  if (localHour < startHour) {
    d.setDate(d.getDate() - 1);
  }
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}
```

> [!note] Smena bilan munosabati
> Aslida smena (`shift`) biznes kunni tabiiy belgilaydi — smena ochilgandan yopilgangacha. Chek raqamlash uchun esa `businessDate` ishlatiladi. Ikkalasi ko'pincha mos keladi, lekin alohida.

## Muammo 4: Hourly tarif aniqligi

Billiard stoli soatlik. Mijoz 19:00 da boshladi, 21:30 da tugatdi = 2.5 soat.

```javascript
const elapsedMinutes = (endTime - startTime) / 60000;
const units = Math.ceil(elapsedMinutes / tariff.duration); // 60 min
// 150 / 60 = 2.5 → ceil → 3 units
const amount = units * tariff.price;
```

**Nozik nuqtalar:**
- `startedAt` aniq bo'lishi shart — order yaratilganda yoziladi (server time online, lokal offline)
- `endTime` — tolov vaqti yoki "stol yopish" tugmasi vaqti
- Soat noto'g'ri bo'lsa — billing xato (Muammo 1 ga bog'liq)
- Mijoz "men 2 soat o'tirdim, nega 3 soat hisoblandi?" — `ceil` siyosatini chek'da ko'rsatish

### Qaror
- `selectedTariff.startedAt` order yaratilganda yoziladi
- Hourly tugatish: cashier "Stol yopish/Hisob" tugmasi → `endTime = now()`
- Chek'da: "Boshlanish: 19:00, Tugash: 21:30, 3 × 1 soat = 150,000"

## Test rejasi

- [ ] Clock drift > 30s → banner
- [ ] NTP sync installer'da sozlanadi
- [ ] UTC saqlash, local ko'rsatish
- [ ] Business day 06:00 cutoff
- [ ] Hourly tarif ceil hisoblash
- [ ] Offline'da clock drift log'lanadi

## Bog'liq

- [[chek-raqamlash]] — businessDate ishlatadi
- [[../05-data-model/table]] — tariff
- [[../05-data-model/biznes-mantiq/total-hisoblash]]
- [[../02-arxitektura/conflict-resolution]] — wall-clock
