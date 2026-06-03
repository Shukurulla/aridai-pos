---
tags: [moc, qaror, reestr, muhim]
created: 2026-05-29
updated: 2026-05-29
---

# Qarorlar reestri (Decision Register)

> Loyihada qabul qilingan barcha kritik qarorlar va ularning holati. Yangi qaror qabul qilinsa shu yerga qo'shiladi. Manba: [[06-changelog/2026-05-28-vault-yaratildi|changelog]] tarixi.

## 📊 Holat xulosasi

- ✅ **Hal qilingan:** 33 qaror
- ⏳ **Ochiq / vazifa:** 3 (O2, O3 — kod tayyor bo'lgach; O5 — kelajak v2)
- 🗺️ Ko'rib chiqilgan sohalar: 10+

> [!note] Loyiha bosqichi
> Hozir **dizayn/maqsad aniqlashtirish** bosqichi — hali kod yozilmagan. Test (O2/O3) kod tayyor bo'lgach. Ochiq biznes qarorlar deyarli tugadi.

---

## ✅ Hal qilingan qarorlar

### 🏛️ Arxitektura va stack
| # | Qaror | Sana | Hujjat |
|---|---|---|---|
| 1 | Global VPS + per-filial local backend | 28.05 | [[02-arxitektura/global-va-local]] |
| 2 | Local backend = **Electron + MongoDB** (Windows Service, admin huquqi) | 28.05 | [[02-arxitektura/local-backend-stack]] |
| 3 | Lokal Mongo = **single-node replica set** (transaction + change stream) | 29.05 | [[07-nozik-nuqtalar/concurrency-race]] |
| 4 | **3 rejim:** online / offline / possiz | 28.05 | [[02-arxitektura/3-rejim]] |
| 5 | Sinxron = **socket** (REST emas), outbox + idempotency | 28.05 | [[02-arxitektura/socket-sinxronizatsiya]] |
| 6 | Multi-tenant: har entity'da `restaurantId`+`branchId` guard | 28.05 | [[02-arxitektura/xavfsizlik/tenant-izolyatsiyasi]] |

### 💰 Pul va valyuta
| # | Qaror | Sana | Hujjat |
|---|---|---|---|
| 7 | Valyuta **per-restaurant** (UZS yoki KZT), immutable | 29.05 | [[07-nozik-nuqtalar/pul-valyuta-yaxlitlash]] |
| 8 | **Tip (chayyot pul): YO'Q** — faqat service charge | 29.05 | [[07-nozik-nuqtalar/pul-valyuta-yaxlitlash]] |
| 9 | **Naqd yaxlitlash: YO'Q** (narxlar toza raqamlarda) | 29.05 | [[07-nozik-nuqtalar/naqd-tolov-qaytim]] |
| 10 | Kupyura tugmalari (KZT/UZS) + qaytim hisobi | 29.05 | [[07-nozik-nuqtalar/naqd-tolov-qaytim]] |

### 🍽️ Order va menyu
| # | Qaror | Sana | Hujjat |
|---|---|---|---|
| 11 | Chek raqami = `filial + biznes-sana + ketma-ket`, offline-safe | 29.05 | [[07-nozik-nuqtalar/chek-raqamlash]] |
| 12 | Biznes kun **06:00** da boshlanadi | 29.05 | [[07-nozik-nuqtalar/vaqt-va-soat]] |
| 13 | **Modifiers (variantlar): keyinroq** toggle sifatida | 29.05 | [[04-toollar/_MOC]] |
| 14 | **Open/kg narx: YO'Q** — har taom fixed | 29.05 | [[07-nozik-nuqtalar/pul-valyuta-yaxlitlash]] |
| 15 | **Pre-bill (hisob): HA** — hisob → tolov → final chek | 29.05 | [[07-nozik-nuqtalar/pre-bill-chek-print]] |
| 16 | **Stop-list:** real-time, manual + limit-based avto (somsa 1000) | 29.05 | [[07-nozik-nuqtalar/stop-list-limit]] |
| 17 | **Menyu: har filial mustaqil** + JSON export/import | 29.05 | [[07-nozik-nuqtalar/menyu-export-import]] |
| 18 | **Chegirma:** admin yaratadi, kassir toggle (qo'lda erkin emas) | 29.05 | [[07-nozik-nuqtalar/chegirma-service-qollanishi]] |
| 19 | **Void vs Cancel:** kitchen boshlamagan=void, boshlagan=cancel | 29.05 | [[07-nozik-nuqtalar/order-operatsion-edge]] |

### 🎁 Keshbek va mijoz
| # | Qaror | Sana | Hujjat |
|---|---|---|---|
| 20 | **Keshbek offline TOLASH: YO'Q** (earn ishlaydi, deferred) | 29.05 | [[04-toollar/keshbek-tizimi]] |
| 21 | **Mijoz (customer):** WhatsApp telefonidan, tarix/keshbek/tolov | 29.05 | [[05-data-model/customer]] |

### 🔒 Xavfsizlik va firibgarlik
| # | Qaror | Sana | Hujjat |
|---|---|---|---|
| 22 | **Void/Cancel:** manager PIN (kitchen boshlangan/katta summa) | 29.05 | [[02-arxitektura/xavfsizlik/firibgarlik-nazorati]] |
| 23 | **Item o'zgartirish:** oshxonaga delta check (stol, order#, +/−) | 29.05 | [[07-nozik-nuqtalar/pre-bill-chek-print]] |
| 24 | **Anomaliya:** faqat hisobotda (real-time alert emas) | 29.05 | [[02-arxitektura/xavfsizlik/firibgarlik-nazorati]] |
| 25 | **Staff meal: YO'Q** (hozircha) | 29.05 | [[02-arxitektura/xavfsizlik/firibgarlik-nazorati]] |
| 26 | **Cash drawer no-sale:** log + asosiy nazorat = smena discrepancy | 29.05 | [[02-arxitektura/xavfsizlik/firibgarlik-nazorati]] |
| 27 | **Restoran auth:** telefon-token BEKOR → JWT login | 28.05 | [[02-arxitektura/xavfsizlik/restoran-auth-tuzatish]] |

### 💾 Data integrity
| # | Qaror | Sana | Hujjat |
|---|---|---|---|
| 28 | **Soft delete (`isDeleted`) + 1 oylik tiklash** → katalog 1 oydan keyin cleanup; moliyaviy hech qachon o'chmaydi | 29.05 | [[07-nozik-nuqtalar/ochirish-cascade]] |
| 29 | **Backup: real-time PITR** — global per-restoran 6-soatlik oyna 1 yil; lokal 3 oy | 29.05 | [[09-deployment/backup-pitr]] |
| 30 | **Snapshot:** order'da narx/ism yozib qo'yiladi (immutable) | 28.05 | [[05-data-model/snapshot-strategiyasi]] |
| 31 | **Fiskal/KKM:** hozircha yo'q, `order.fiscal` reserved | 29.05 | [[07-nozik-nuqtalar/fiskal-soliq]] |
| 32 | **Multi-POS:** bitta local server (Variant A), qolgan POS client (real-time, barcha monitor bir vaqtda yangilanadi) | 29.05 | [[02-arxitektura/multi-pos]] |
| 33 | **Stock/limit oversell: QATTIQ BLOK** — limitga yetganda bironta ortiqcha qabul qilinmaydi, real-time POS/waiter/QR disable | 29.05 | [[07-nozik-nuqtalar/stop-list-limit]] |

---

## ⏳ Ochiq qarorlar / vazifalar

> Restoran misoli bilan tushuntirilgan (chalkashlikni ko'rsatish uchun).

| # | Mavzu | Restoran misoli | Tur | Holat |
|---|---|---|---|---|
| ~~O1~~ | **Stock oversell** | 49-mijoz osh so'radi, 2 qoldi | Biznes | ✅ Hal qilindi (#33) — QATTIQ BLOK, oversell yo'q |
| O2 | **Backup test restore** | "Backup bor" deb o'ylanadi, server kuydi — backup buzuq edi (bo'sh o't o'chirgich) | Operatsion | 🔜 Kod tayyor bo'lgach (lokal 3 oy retention ✅) |
| O3 | **Penetration test** | Seyfni o'g'ridan oldin ishonchli odam sindirib ko'radi | Operatsion | 🔜 Kod tayyor → production oldidan |
| ~~O4~~ | **Multi-POS topologiya** | — | — | ✅ Hal qilindi (#32) |
| O5 | **Server alohida qutida** (Variant A→B) | POS #1 o'chsa filial to'xtaydi. Kelajakda javondagi alohida quti faqat miya | Texnik (v2) | 🔮 Kelajak (muhim filiallar) |
| ~~O6~~ | **Soft delete nomi/siyosati** | Xato o'chirilsa 1 oy ichida tiklash | — | ✅ Hal qilindi (#28) — `isDeleted` + 1 oy tiklash |

---

## 🗺️ Ko'rib chiqilgan sohalar (coverage)

| Soha | Hujjatlar | Holat |
|---|---|---|
| Vizyon + Roadmap + Glossary | [[01-vizyon/loyiha-mohiyati]], [[01-vizyon/roadmap]] | ✅ |
| Arxitektura (global/local, rejimlar, socket, conflict) | 02-arxitektura | ✅ |
| Xavfsizlik (auth, RBAC, tenant, socket, secrets, audit, rate-limit, **fraud**, **risklar**) | [[02-arxitektura/xavfsizlik/_MOC]] | ✅ |
| Sinxronizatsiya (online↔offline, initial, prioritet, monitoring) | [[02-arxitektura/sinxronizatsiya/_MOC]] | ✅ |
| Tool strategiyasi + 7 tool | [[03-tool-strategiyasi/feature-toggle-tizimi]], [[04-toollar/_MOC]] | ✅ |
| Data model (11 entity + sync + index + snapshot) | [[05-data-model/_MOC]] | ✅ |
| Biznes mantiq (order/shift lifecycle, total, tolov, cancel) | [[05-data-model/biznes-mantiq/_MOC]] | ✅ |
| Nozik nuqtalar (3 qatlam, 22 hujjat) | [[07-nozik-nuqtalar/_MOC]] | ✅ |
| Kritik risklar (5 katastrofik + 6 jiddiy) | [[02-arxitektura/xavfsizlik/kritik-risklar]] | ✅ |
| Frontend (4 ilova) | [[08-frontend/_MOC]] | ✅ |
| Deployment + **Backup PITR** | [[09-deployment/_MOC]] | ✅ |
| Operatsiyalar (onboarding, troubleshooting, DR) | [[10-operatsiyalar/_MOC]] | ✅ |

---

## 📝 Changelog tarixi (qarorlar manbai)

- [[06-changelog/2026-05-28-vault-yaratildi]]
- [[06-changelog/2026-05-28-local-stack-qarori]]
- [[06-changelog/2026-05-28-rejimlar-xavfsizlik-deepdive]]
- [[06-changelog/2026-05-28-data-model-toldirildi]]
- [[06-changelog/2026-05-28-biznes-mantiq-sinxron-toldirildi]]
- [[06-changelog/2026-05-29-nozik-nuqtalar]]
- [[06-changelog/2026-05-29-keshbek-offline-qaror]]
- [[06-changelog/2026-05-29-variant-a-toldirildi]]
- [[06-changelog/2026-05-29-nozik-nuqtalar-2qatlam]]
- [[06-changelog/2026-05-29-nozik-nuqtalar-3qatlam]]
- [[06-changelog/2026-05-29-kritik-risklar]]
- [[06-changelog/2026-05-29-cash-drawer-qaror]]
- [[06-changelog/2026-05-29-backup-pitr-no-harddelete]]

## Keyingi qadam

Hujjatlash deyarli to'liq. Ochiq qarorlardan **O1 (stock oversell)** yagona biznes qaror. Qolganlar — operatsion/kelajak. Keyin: **KOD** (Roadmap Phase 0 — [[01-vizyon/roadmap]]).

## Bog'liq

- [[00-INDEX]]
- [[01-vizyon/roadmap]]
- [[02-arxitektura/xavfsizlik/kritik-risklar]]
