---
tags: [changelog, qaror, xavfsizlik, kassa]
date: 2026-05-29
type: decision
---

# 2026-05-29 — Cash drawer / smena kassa qarori

## Qaror

Foydalanuvchi: *"har doim smena ochilganda qancha pul bilan ochilayotgani va qancha pul bilan yopilayotgani muhim."*

### Asosiy nazorat — smena kassa farqi (allaqachon dizaynda)
- `shift.openingCash` — smena ochilganda kassada qancha pul (kassir kiritadi)
- `shift.closingCash` — yopilganda real kassa (kassir sanaydi)
- `discrepancy = closingCash − (openingCash + cashRevenue)`
- Bu **har qanday naqd o'g'irlikni ushlaydi** — void fraud, no-sale, oddiy o'g'irlik — yakuniy nazorat

### No-sale drawer ochish — log qilinadi (manager shart emas)
- Kassir no-sale ochib pul olsa ham → smena yopilishida kassa kam → discrepancy → aniqlanadi
- Demak manager ruxsati shart emas (ish sekinlashmasin)
- No-sale shunchaki audit log'da (kim/qachon/sabab) — tergov uchun

## Mantiq

> Discrepancy — yakuniy nazorat. Boshqa barcha nazoratlar (manager PIN void, audit, no-sale log) — uni **qo'llab-quvvatlaydi**. Pul qanday yo'qolsa ham, smena yopilishida kassa kam chiqadi.

## Yangilangan

- [[../02-arxitektura/xavfsizlik/firibgarlik-nazorati|firibgarlik-nazorati.md]] — no-sale qarori, discrepancy ASOSIY nazorat sifatida
- [[../02-arxitektura/xavfsizlik/kritik-risklar|kritik-risklar.md]] — gap yopildi
- Xotira yangilandi

## Holat

Firibgarlik nazoratidagi barcha ochiq savollar endi **yopildi**:
- ✅ Void/cancel — manager PIN
- ✅ Item o'zgartirish — oshxona delta
- ✅ Anomaliya — hisobotda
- ✅ Staff meal — yo'q
- ✅ Cash drawer no-sale — log + discrepancy asosiy

## Bog'liq

- [[2026-05-29-kritik-risklar]]
- [[../02-arxitektura/xavfsizlik/firibgarlik-nazorati]]
- [[../05-data-model/biznes-mantiq/shift-lifecycle]]
