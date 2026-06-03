---
tags: [changelog, qaror, multi-pos]
date: 2026-05-29
type: decision
---

# 2026-05-29 — Multi-POS qarori + Qarorlar reestri

## Qaror (multi-POS)

Foydalanuvchi savoli: *"ikkita pos monitor bo'lsa, ikkala tomonda ham local server ishlab turishi mumkinmi?"*

**Javob: YO'Q — bitta local server.** Bir filialda 2+ POS bo'lsa:
- **Bitta POS = server** (MongoDB + local backend + UI)
- **Qolgan POS = client** (faqat UI, LAN orqali serverga ulanadi, o'z bazasi yo'q)
- **Ikkita alohida server EMAS** — aks holda: duplikat chek raqami, ikki smena, chalkash stock, sync urishi

Foydalanuvchi **Variant A** ni tanladi (bitta POS server), har POS o'z chek printeri.

## Yangi fayl

- [[../02-arxitektura/multi-pos|multi-pos.md]] — to'liq dizayn: server-client, nima uchun ikki server bo'lmaydi, LAN ulanish, atomik counter, printer, SPOF (UPS), kassa, offline, test

## Asosiy nuqtalar

- **Bitta miya** (server) — barcha POS bir xil ma'lumot ko'radi
- MongoDB localhost (server), client local backend orqali ulanadi (Mongo'ga to'g'ridan emas)
- Real-time LAN broadcast (POS1 order → POS2 ko'radi)
- Atomik counter (chek/stock) serverda → duplikat yo'q
- Har POS o'z USB chek printeri, oshxona printer tarmoqda
- Smena bitta (filial), drawer'lar alohida sanaladi (fraud nazorati)
- **SPOF:** server POS o'chsa filial to'xtaydi → UPS tavsiya, muhim filialga alohida mini-server (kelajak)

## Yangilangan

- [[../02-arxitektura/local-backend-stack|local-backend-stack.md]] — multi-POS bo'limi (Variant A qaror, [[../02-arxitektura/multi-pos]] ga link)
- [[../00-INDEX]] — multi-pos link
- [[../00-QARORLAR-REESTRI]] — #32 qo'shildi, O4 yopildi (32 hal qilingan, 5 ochiq)

## Yangi artefakt: Qarorlar reestri

Shu sessiyada [[../00-QARORLAR-REESTRI]] yaratildi — barcha 32 qaror + 5 ochiq item + coverage map + changelog tarixi. INDEX'da prominent.

## Bog'liq

- [[../02-arxitektura/multi-pos]]
- [[../00-QARORLAR-REESTRI]]
- [[2026-05-29-backup-pitr-no-harddelete]]
