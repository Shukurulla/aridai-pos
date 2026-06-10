---
tags: [tool]
created: 2026-05-28
toolKey: keldiKetti
status: ✅ core implemented (2026-06-10)
default: OFF
---

# Tool: Keldi-ketti (Davomat + maosh)

## Meta

- **Key:** `keldiKetti`
- **Status:** ✅ core implemented (2026-06-10) — check-in/out (mobil karta + admin qo'lda), kechikish/shtraf, payroll 5 tip (daily/monthly/fixedShift/percentService/perDish). Qoldi: geo-fence, alohida schedule entity, late_warning push, oylik avto-hisob scheduler
- **Default:** OFF
- **Version:** 1
- **requires:** core (user)
- **excludes:** —

## Maqsad

Restoran xodimlari (waiter, cook, cashier, ...) ishga kelishi va ketishini belgilash. Har xodim uchun maosh hisoblash — kunlik, haftalik, blyudaga (cook), foiz xizmat haqqi (waiter), qotirilgan summa (tungi smena). Kechikishga shtraflar.

## Foydalanuvchi senariolari

### Senariy 1: Waiter ishga keldi
1. Waiter mobile'da "Keldim" tugmasini bosadi
2. Geo-fence tekshiriladi (filial ichida bo'lishi kerak)
3. `attendance` record: `userId, arrivedAt, scheduled: 10:00, actual: 10:07`
4. 7 daqiqa kech qoldi — yo'qotish hisoblanadi (agar tariff'da bo'lsa)

### Senariy 2: Waiter ketdi
1. Waiter "Ketdim" tugmasini bosadi
2. `attendance.leftAt` belgilanadi
3. Bu kunlik orderlardan unga 6% xizmat haqqi hisoblanadi
4. Smena yopish paytida ko'rsatiladi

### Senariy 3: Cook — blyudaga
1. Tunda yopilgan smenada cook qancha somsa yopgani sanaladi (`order.foods` ichida)
2. Har 100 somsa = 50,000 so'm
3. Smena yopilganda hisoblanadi

### Senariy 4: Tungi smena fix summa
1. Tungi xodim shartnomada — har smena 100,000 so'm
2. Attendance `nightShift: true` belgisi bilan
3. Maosh hisoblanganda fix qiymat

## UI o'zgarishlar

| Role | UI |
|---|---|
| Waiter/Cook/Cashier (mobile) | Bosh ekranda "Keldim/Ketdim" tugma |
| Admin (web) | Yangi sahifa: "Xodimlar" — schedule, maosh, davomat, hisobot |
| Admin (web) | Har xodimga `salaryRule` sozlash UI |

## Data model

```javascript
// salary_rule (har xodim uchun)
{
  _id, userId, branchId, restaurantId,
  type: 'daily' | 'weekly' | 'monthly' | 'perDish' | 'percentService' | 'fixedShift',
  config: {
    // type ga qarab
    amount: 50000,           // daily/weekly/monthly/fixedShift
    perDishMap: { foodId: amount },  // perDish
    percent: 6,               // percentService
  },
  startDate, endDate,
  active: Boolean,
}

// schedule (qachon kelishi)
{
  _id, userId, branchId, restaurantId,
  pattern: 'weekly' | 'custom',
  weekly: { monday: { start: '10:00', end: '22:00' }, ... },
  customDates: [ { date, start, end } ],
}

// attendance
{
  _id, userId, branchId, restaurantId,
  date: '2026-05-28',
  scheduledStart: '10:00',
  scheduledEnd: '22:00',
  arrivedAt: Date,
  leftAt: Date,
  isLate: Boolean,
  lateMinutes: Number,
  penalty: Number,
  notes: String,
  nightShift: Boolean,
}

// payroll (xulosa)
{
  _id, userId, branchId, restaurantId,
  period: '2026-05',
  workedDays: Number,
  totalAmount: Number,
  breakdown: [
    { date, type: 'attendance', amount },
    { date, type: 'penalty', amount: -1000 },
    { date, type: 'service', amount: 12000 },
  ],
  paidAt: Date,
}
```

## API endpoint'lar

| Method | Path | Min role |
|---|---|---|
| POST | `/api/keldi-ketti/check-in` | xodim |
| POST | `/api/keldi-ketti/check-out` | xodim |
| GET | `/api/keldi-ketti/me/today` | xodim |
| POST | `/api/keldi-ketti/salary-rules` | admin |
| PUT | `/api/keldi-ketti/schedule/:userId` | admin |
| GET | `/api/keldi-ketti/attendance/:branchId` | admin |
| GET | `/api/keldi-ketti/payroll/:branchId/:period` | admin |
| POST | `/api/keldi-ketti/payroll/calculate` | admin |
| POST | `/api/keldi-ketti/payroll/:id/pay` | admin |

## Socket eventlar

| Yo'nalish | Event | Maqsad |
|---|---|---|
| Mobile → G | `attendance.check_in` | Keldim bosildi |
| Mobile → G | `attendance.check_out` | Ketdim bosildi |
| G → admin | `attendance.late_warning` | Xodim kech qoldi |
| G → admin | `payroll.ready` | Maosh hisoblandi |

## Rejimlar ichida xatti-harakati

### Online
- Check-in/out darhol
- Geo-fence tekshiruvi

### Offline (filial)
- Mobile global'ga ulanadi (waiter offline'da ishlamaydi qoidasi bilan ziddiyat?)
- Yo'q — keldi-ketti web/admin orqali POS'da ham qo'lda yoziladi
- Yoki: mobile lokal backend'ga ulanadi, sync orqali yetadi

### Possiz
- Mobile'da check-in bosadi → admin telefoniga peer-to-peer
- Yoki — admin qo'lda yozadi

## Boshqa toollarga bog'liqlik

- `requires`: core (user, shift)
- `excludes`: —
- Optional integration:
  - `shift` — smena yopishda waiter foiz hisoblanadi (shu xodim shu smenadagi orderlardan)

## O'chirilganda — nima bo'ladi?

- "Keldim/Ketdim" tugma mobile'da yo'qoladi
- Admin "Xodimlar → davomat" sahifasi yo'qoladi
- Maosh qo'lda hisoblanadi
- Mavjud attendance/payroll ma'lumotlari qoladi
- Order/payment buzilmaydi

## Lifecycle hook'lar

### onInstall
```javascript
async function kkOnInstall(restaurantId) {
  await db.createCollection('salary_rules');
  await db.createCollection('schedules');
  await db.createCollection('attendances');
  await db.createCollection('payrolls');
}
```

### onEnable
```javascript
async function kkOnEnable(restaurantId, config) {
  scheduler.schedule(`kk_daily_${restaurantId}`, '5 9 * * *', checkLateAlert);
  scheduler.schedule(`kk_monthly_${restaurantId}`, '0 0 1 * *', calculateAllPayrolls);
  eventBus.on(`shift.closed:${restaurantId}`, calculateServicePercent);
}
```

### onDisable
- Schedulerlarni o'chirish, listener'larni detach

## Konfiguratsiya

```javascript
features.keldiKetti.config = {
  geoFenceEnabled: true,
  geoFenceRadius: 100,        // metr
  lateGracePeriod: 5,         // minut, kechikish hisoblanmaydigan
  penaltyPerMinute: 1000,
  servicePercentDefault: 6,
  payrollPeriod: 'monthly',   // monthly | biweekly | weekly
  nightShiftDefinition: { start: '22:00', end: '06:00' },
}
```

## Test rejasi

- [ ] Default OFF
- [ ] Yoqilgan: mobile'da "Keldim" tugma chiqadi
- [ ] Check-in: attendance yoziladi
- [ ] Kech: penalty hisoblanadi
- [ ] Tungi smena: nightShift=true
- [ ] Waiter foiz: shu smena orderlaridan 6%
- [ ] Cook blyudaga: order foods'dan sanab
- [ ] Payroll calculate: barcha turlarni qo'shadi
- [ ] O'chirildi: tugma yo'qoladi, eski ma'lumot qoladi
- [ ] Geo-fence: 100m dan tashqarida check-in rad

## Bog'liq

- [[_MOC]]
- [[../03-tool-strategiyasi/feature-toggle-tizimi]]
