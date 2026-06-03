---
tags: [moc, deployment]
created: 2026-05-29
---

# Deployment / DevOps MOC

## Hujjatlar

- [[vps-deploy|Global VPS deploy]] — server, Docker, Nginx, SSL
- [[environments|Muhitlar]] — dev / staging / prod
- [[ci-cd|CI/CD pipeline]] — build, test, deploy
- [[monitoring|Monitoring va observability]] — uptime, error, metrics
- [[backup-pitr|Backup va PITR]] ⭐ — real-time, per-restoran, 6-soatlik oyna, 1 yil, hard delete YO'Q

## Komponentlar deploy joyi

| Komponent | Qayerda | Qanday |
|---|---|---|
| Global backend | VPS (cloud) | Docker + PM2 yoki Docker Compose |
| Global MongoDB | VPS yoki Atlas | Managed yoki self-hosted |
| Redis | VPS | Docker (sync dedup, rate limit) |
| Web admin | VPS / CDN | Static build (Vite) + Nginx |
| Mijoz QR web | VPS / CDN | Static build |
| Local backend | Filial POS PC | Installer (.exe) — [[../02-arxitektura/local-backend-stack]] |
| Mobile | App Store / Play Store | Flutter build |
| WhatsApp bot | VPS | Node service |

## Asosiy printsiplar

1. **Infrastructure as Code** — konfiguratsiya versiyalangan
2. **Immutable deployments** — har deploy yangi image/build
3. **Zero-downtime** — rolling update (kelajak)
4. **Secrets — env/manager** ([[../02-arxitektura/xavfsizlik/secrets-management]])
5. **Backup** — har kuni global Mongo

## Bog'liq

- [[../01-vizyon/roadmap]]
- [[../02-arxitektura/local-backend-stack]]
- [[../02-arxitektura/xavfsizlik/secrets-management]]
