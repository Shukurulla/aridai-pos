---
tags: [moc, operatsiyalar, runbook]
created: 2026-05-29
---

# Operatsiyalar (runbook) MOC

> Tizim ishga tushgandan keyin kundalik operatsiyalar va favqulodda holatlar uchun amaliy qo'llanma.

## Hujjatlar

- [[restoran-onboarding|Restoran onboarding]] — yangi restoran/filial qo'shish qadamlari
- [[troubleshooting|Troubleshooting]] — keng tarqalgan muammolar va yechimi
- [[disaster-recovery|Disaster recovery]] — falokat tiklash

## Tezkor havolalar

| Vaziyat | Hujjat |
|---|---|
| Yangi restoran qo'shish | [[restoran-onboarding]] |
| Yangi filial + POS o'rnatish | [[restoran-onboarding#Filial qo'shish]] |
| Filial offline qoldi | [[troubleshooting#Filial uzoq offline]] |
| branchToken yo'qoldi | [[troubleshooting#branchToken muammosi]] |
| Sync to'xtab qoldi | [[troubleshooting#Sync to'xtadi]] |
| POS PC buzildi | [[disaster-recovery#POS PC buzildi]] |
| Global VPS down | [[disaster-recovery#Global VPS down]] |
| Data corruption | [[disaster-recovery#Data corruption]] |

## Bog'liq

- [[../02-arxitektura/local-backend-stack]]
- [[../02-arxitektura/sinxronizatsiya/sync-monitoring]]
- [[../09-deployment/monitoring]]
