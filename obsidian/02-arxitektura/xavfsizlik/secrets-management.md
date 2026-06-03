---
tags: [xavfsizlik, secrets]
created: 2026-05-28
---

# Secrets management

## Tizimdagi secret'lar ro'yxati

### Global VPS
| Secret | Maqsad | Yashash davri |
|---|---|---|
| `JWT_SECRET` | User/owner JWT signing | 6 oy (rotation kerak) |
| `BRANCH_SECRET` | branchToken signing | 1 yil |
| `MONGO_URL` | Database connection | DB credentials o'zgarguncha |
| `REDIS_URL` | Cache/queue | — |
| `KASPI_WEBHOOK_SECRET` | HMAC verify | restoran-specific |
| `WHATSAPP_TOKEN` | Cloud API access | 60 kun (Meta dialog) |
| `SMS_API_KEY` | SMS gateway (Eskiz/Playmobile) | 1 yil |
| `BACKUP_S3_KEY` | Cloud backup | rotation |
| `SENTRY_DSN` | Error tracking | — |
| `FCM_SERVER_KEY` | Push notification | — |
| `ENCRYPTION_KEY` | Field-level encryption (kelajak) | uzoq |

### Local backend (POS PC)
| Secret | Maqsad | Joy |
|---|---|---|
| `branchToken` | VPS bilan ulanish | `C:\ProgramData\AridaiPos\config\local.json` |
| `mongodb credentials` | Lokal Mongo auth | shu yerda |
| `printerSerial` | Printer drayver | shu yerda |

### Mobile ilova
- Hech qanday static secret yo'q
- Token'lar — secure storage'da
- API endpoint URL — public

## Saqlash strategiyalari

### Development
- `.env` fayl (gitignore'd)
- `.env.example` (commit'lanadi, qiymatsiz)

### Production (global VPS)
**Variant A — Environment variables:** (oddiy boshlanish uchun)
```bash
# /etc/environment yoki systemd unit'da
JWT_SECRET=...
MONGO_URL=...
```

**Variant B — Secrets manager:** (uzoq muddatga)
- AWS Secrets Manager
- HashiCorp Vault
- Doppler
- 1Password Secrets Automation

`.env` faylga umuman ehtiyoj yo'q — secret manager runtime'da o'qiydi.

### Local backend
`local.json`:
```json
{
  "branchId": "65f...",
  "restaurantId": "65f...",
  "branchToken": "eyJhbG...",
  "mongoDb": {
    "uri": "mongodb://aridai:<random>@127.0.0.1:27017/aridai_local",
    "user": "aridai",
    "passwordEncrypted": "...",
    "passwordKeySalt": "..."
  },
  "globalApiUrl": "https://api.aridai.com",
  "encryptionVersion": 1
}
```

Fayl permission'lar (Windows):
- Owner: `SYSTEM` + `Administrators` group — RW
- Boshqalar — kirishsiz

NTFS ACL orqali, installer paytida sozlanadi.

## Rotation strategiyasi

### JWT_SECRET rotation

Doim 2 ta secret ishlaydi: `current` va `previous`. Verify ikkalasini ham sinab ko'radi, sign faqat `current` bilan.

```javascript
const secrets = {
  current: process.env.JWT_SECRET_CURRENT,
  previous: process.env.JWT_SECRET_PREVIOUS,
};

function signJWT(payload) {
  return jwt.sign(payload, secrets.current);
}

function verifyJWT(token) {
  try {
    return jwt.verify(token, secrets.current);
  } catch {
    return jwt.verify(token, secrets.previous); // fallback
  }
}
```

Rotation oqimi:
1. Yangi secret generatsiya (random 256-bit)
2. `JWT_SECRET_CURRENT` ga yozish, eski `JWT_SECRET_PREVIOUS` ga ko'chirish
3. Restart (ham server, ham Redis cache)
4. Token expiry davrigacha (7 kun) eski tokenlar ishlaydi
5. 7 kundan keyin `JWT_SECRET_PREVIOUS` o'chiriladi

Cron: har 6 oyda rotation.

### BRANCH_SECRET rotation

Yetuk holatga keladi — chunki branchToken'lar 1 yilga. Rotation paytida barcha branchToken'lar qaytadan generatsiya qilinadi va lokal PC'larga jo'natiladi (ko'p ish).

Tavsiya: **kompromiss bo'lganda rotation**. Yo'qsa 1 yilga.

### Restoran-specific secret'lar
- Kaspi webhook secret — Kaspi tomondan kelgan, mijoz rotate qilolmaydi
- WhatsApp token — har 60 kunda Meta yangilaydi

## .env fayl strukturasi

```bash
# .env.example (commit'lanadi)
NODE_ENV=production
PORT=4322

# Database
MONGO_URL=mongodb://localhost:27017/aridai
REDIS_URL=redis://localhost:6379

# Secrets (boshqaring!)
JWT_SECRET_CURRENT=
JWT_SECRET_PREVIOUS=
BRANCH_SECRET=

# External services
KASPI_API_BASE=https://api.kaspi.kz/...
WHATSAPP_API_VERSION=v18.0

# Monitoring
SENTRY_DSN=
```

`.gitignore`:
```
.env
.env.local
.env.*.local
local.json
**/secrets/
```

## Field-level encryption (kelajakda)

Ba'zi maydonlar Mongo'da plaintext bo'lmasligi kerak:
- `owner.password` — bcrypt hash (bu allaqachon hash, OK)
- `cashbackBalance.clientPhone` — encrypted bo'lishi mumkin
- `kaspi.merchantSecret` — encrypted

Mongoose-encryption yoki Application-level encryption.

```javascript
// schema'da
schema.add({
  merchantSecret: {
    type: String,
    set: (v) => encrypt(v, ENCRYPTION_KEY),
    get: (v) => decrypt(v, ENCRYPTION_KEY),
  }
});
```

Encryption key rotation — alohida murakkab (har versiyali field encrypted).

## Secret leak qachon yuz beradi

| Sabab | Yumshatuv |
|---|---|
| Git commit'ga `.env` tushdi | `.gitignore` + pre-commit hook (detect-secrets) |
| Log'larga token chiqdi | Redact middleware (qarang [[audit-log]]) |
| Error response'da secret | Generic error message, detail faqat server log'da |
| Front-end bundle'da | Faqat `NEXT_PUBLIC_` prefix bilan public secret'lar |
| CI/CD log'da | Secret variable masked |
| Backup'da plaintext secret | Backup encryption |

## Pre-commit hook

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/Yelp/detect-secrets
    rev: v1.4.0
    hooks:
      - id: detect-secrets
```

Bu — commit paytida secret pattern'larni (JWT, AWS key, etc.) topadi.

## Lokal backend installer paytida

```bash
# Installer pseudo-script
generate_password() { openssl rand -base64 32; }

mongo_root_pw=$(generate_password)
mongo_app_pw=$(generate_password)
local_key_salt=$(generate_password)

# MongoDB user yaratish
mongo --eval "
  use admin;
  db.createUser({user:'root', pwd:'$mongo_root_pw', roles:['root']});
  use aridai_local;
  db.createUser({user:'aridai', pwd:'$mongo_app_pw', roles:['readWrite']});
"

# Fayl tayyorlash
cat > C:/ProgramData/AridaiPos/config/local.json <<EOF
{
  "branchId": "$BRANCH_ID_FROM_USER",
  "branchToken": "$BRANCH_TOKEN_FROM_USER",
  "mongoDb": {
    "uri": "mongodb://aridai:$mongo_app_pw@127.0.0.1:27017/aridai_local"
  }
}
EOF

# Permission cheklash
icacls "C:\\ProgramData\\AridaiPos\\config\\local.json" /inheritance:r /grant:r "SYSTEM:F" /grant:r "Administrators:F"
```

## Disaster recovery

JWT_SECRET butunlay yo'qoldi:
- Barcha userlar majburiy logout (token verify fail)
- Frontend "Tizim yangilandi, qayta login qiling" deb chiqaradi
- Yangi secret bilan yangi login flow

BRANCH_SECRET butunlay yo'qoldi:
- Barcha local backendlar uzilib qoladi
- POS UI: "Tizim bilan ulanish yo'qotildi, admin'ga murojaat qiling"
- Tizim admin har filialga yangi branchToken jo'natadi (manual)

## Bog'liq

- [[auth-strategiyasi]]
- [[restoran-auth-tuzatish]]
- [[audit-log]]
- [[../local-backend-stack]]
