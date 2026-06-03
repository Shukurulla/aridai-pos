---
tags: [deployment, environments]
created: 2026-05-29
---

# Muhitlar (environments)

## Uchta muhit

| Muhit | Maqsad | URL | Ma'lumot |
|---|---|---|---|
| **dev** | Lokal ishlab chiqish | localhost | Test data |
| **staging** | Test/QA | staging.aridai.com | Production'ga o'xshash, soxta data |
| **production** | Real foydalanuvchilar | api.aridai.com | Real data |

## Env o'zgaruvchilar

Har muhit uchun alohida `.env`:

```bash
# .env.development
NODE_ENV=development
PORT=4322
MONGO_URL=mongodb://localhost:27017/aridai_dev
REDIS_URL=redis://localhost:6379
JWT_SECRET_CURRENT=dev-secret
LOG_LEVEL=debug

# .env.staging — staging.aridai.com
# .env.production — api.aridai.com (secrets manager'dan)
```

Secrets: [[../02-arxitektura/xavfsizlik/secrets-management]]

## Dev muhit (lokal)

```bash
# Lokal ishga tushirish
docker compose -f docker-compose.dev.yml up  # mongo + redis
cd global/backend && npm run dev              # nodemon
```

- Mongo + Redis Docker'da
- Backend nodemon (hot reload)
- Web admin Vite dev server
- Lokal backend Electron dev mode

## Staging

- Production'ning aniq nusxasi (kichikroq resurs)
- Soxta restoran'lar, test data
- Yangi release avval shu yerda test
- QA shu yerda

## Production

- Real data
- Backup faol
- Monitoring faol
- Faqat tested release deploy qilinadi (staging'dan keyin)

## Mobile environments

Flutter flavors:
```
flutter run --flavor dev --dart-define=API_URL=http://localhost:4322
flutter run --flavor staging --dart-define=API_URL=https://staging.aridai.com
flutter build apk --flavor prod --dart-define=API_URL=https://api.aridai.com
```

## Local backend (POS) environments

- Dev: lokal global'ga ulanadi (`localhost`)
- Prod: `api.aridai.com`
- Installer'da configured

## Database ajratish

| Muhit | Database |
|---|---|
| dev | `aridai_dev` (lokal Mongo) |
| staging | `aridai_staging` (alohida instance) |
| prod | `aridai_prod` (alohida instance/cluster) |

**Hech qachon** dev/staging prod data'ga ulanmasligi shart.

## Feature flags vs environments

Feature toggle ([[../03-tool-strategiyasi/feature-toggle-tizimi]]) — **per-restaurant**, environment emas. Lekin yangi (beta) tool'lar avval staging restoranlarda test qilinadi.

## Bog'liq

- [[_MOC]]
- [[vps-deploy]]
- [[ci-cd]]
- [[../02-arxitektura/xavfsizlik/secrets-management]]
