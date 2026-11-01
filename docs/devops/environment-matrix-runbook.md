# Environment Matrix & Startup Runbook

## Document Control

| Field | Value |
|---|---|
| Version | 1.0 |
| Created | 2026-02-28 |
| Owner | DevOps Engineering |
| Status | Active |

---

## 1. Environment Matrix

| Attribute | Development | Staging | Production |
|---|---|---|---|
| **Compose file** | `docker-compose.dev.yaml` | `docker-compose.prod.yaml` (with staging overrides) | `docker-compose.prod.yaml` |
| **Backend target** | `development` (nodemon, hot-reload) | `production` | `production` |
| **Frontend target** | `development` (CRA dev server) | `production` (nginx) | `production` (nginx) |
| **DB port exposed** | `5432` on host | Not exposed | Not exposed |
| **API port exposed** | `5000` on host | Internal only | Internal only |
| **Debug port** | `9229` (Node inspector) | Disabled | Disabled |
| **pgAdmin** | Available (`--profile tools`) | Disabled | Disabled |
| **Read-only root FS** | No | Yes | Yes |
| **cap_drop ALL** | No | Yes | Yes |
| **Resource limits** | None | Enforced | Enforced |
| **Network segmentation** | Single bridge | 3-zone (public/app/data) | 3-zone (public/app/data) |
| **CORS** | `http://localhost:3000` | Staging domain | Production domain |
| **Rate limiting** | Relaxed (1000 req/15min) | Production values | Strict (100 req/15min) |
| **Login attempts** | 50 / 15min | 5 / 15min | 5 / 15min |
| **Session timeout** | 120 min | 30 min | 30 min |
| **Auto logout** | Disabled | Enabled | Enabled |
| **Hash chain audit** | Disabled | Enabled | Enabled |
| **bcrypt rounds** | 10 | 12 | 12 |
| **Data** | Synthetic (seed scripts) | Synthetic | Real (encrypted) |
| **TLS** | None (localhost) | Required | Required (TLS 1.2+) |
| **Email** | Optional / mock | Real SMTP | Real SMTP |
| **Backups** | None | Daily | Per RPO target |

---

## 2. Required Environment Variables

### All Environments

| Variable | Example | Required In | Tier |
|---|---|---|---|
| `NODE_ENV` | `development` / `production` | All | Config |
| `PORT` | `5000` | All | Config |
| `DB_HOST` | `postgres` (container) / hostname | Prod | Config |
| `DB_PORT` | `5432` | All | Config |
| `DB_NAME` | `healthcare_db` | All | Config |
| `DB_USER` | `postgres` | All | Config |
| `DB_PASSWORD` | (secret) | All | **Tier 1** |
| `JWT_SECRET` | (64+ char hex) | All | **Tier 1** |
| `JWT_REFRESH_SECRET` | (64+ char hex) | All | **Tier 1** |
| `ENCRYPTION_KEY` | (32+ char) | All | **Tier 1** |
| `CORS_ORIGIN` | `http://localhost:3000` | All | Config |

### Production-Only

| Variable | Example | Tier |
|---|---|---|
| `EMAIL_HOST` | `smtp.provider.com` | Config |
| `EMAIL_PORT` | `587` | Config |
| `EMAIL_USER` | (credential) | **Tier 2** |
| `EMAIL_PASSWORD` | (credential) | **Tier 2** |
| `EMAIL_FROM` | `noreply@example.com` | Config |
| `EMAIL_SECURE` | `true` | Config |

---

## 3. Startup Runbook

### 3.1 First-Time Setup (Fresh Clone)

**Time estimate: ~10–15 minutes**

```powershell
# 1. Clone the repository
git clone <repo-url>
cd Secure_Healthcare_Management_System

# 2. Run the bootstrap script (handles everything)
.\scripts\dev-bootstrap.ps1

# OR, if you want pgAdmin:
.\scripts\dev-bootstrap.ps1 -WithTools

# OR, without Docker (local npm only):
.\scripts\dev-bootstrap.ps1 -SkipDocker
```

The bootstrap script will:
1. Check prerequisites (Node.js ≥ 18, Docker, npm, git)
2. Create `backend/.env` from `.env.example` and generate dev secrets
3. Install backend dependencies (`npm ci`)
4. Install frontend dependencies (`npm ci`)
5. Validate environment variables
6. Run backend tests
7. Start Docker Compose with health-check verification

### 3.2 Daily Start (Existing Setup)

```powershell
# Start all services
docker compose -f docker-compose.dev.yaml up -d

# View logs
docker compose -f docker-compose.dev.yaml logs -f

# Run backend tests
cd backend; npm test

# Stop services
docker compose -f docker-compose.dev.yaml down
```

### 3.3 Fresh Database Reset

```powershell
# Option A: Via bootstrap script
.\scripts\dev-bootstrap.ps1 -FreshDb

# Option B: Manual
docker compose -f docker-compose.dev.yaml down -v
docker compose -f docker-compose.dev.yaml up -d

# Wait for DB healthy, then run migrations
node scripts\migrate-orchestrator.js --from-scratch

# Run seeds
cd backend
npm run db:seed
```

### 3.4 Running Migrations

```powershell
# Check migration status
node scripts\migrate-orchestrator.js --status

# Preview pending migrations
node scripts\migrate-orchestrator.js --dry-run

# Apply pending migrations
node scripts\migrate-orchestrator.js

# Full schema + migrations (fresh DB)
node scripts\migrate-orchestrator.js --from-scratch
```

### 3.5 Environment Validation

```powershell
# Validate for development
node scripts\validate-env.js --env dev

# Validate for production
node scripts\validate-env.js --env prod
```

---

## 4. Service Health Verification

After starting, verify all services are healthy:

```powershell
# Docker health status
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# API health check
Invoke-RestMethod http://localhost:5000/health

# Frontend
Start-Process "http://localhost:3000"

# Database connectivity (from backend container)
docker exec healthcare_backend_dev node -e "
  const { Pool } = require('pg');
  const pool = new Pool({ host:'postgres', database:'healthcare_db', user:'postgres', password:'admin123' });
  pool.query('SELECT NOW()').then(r => { console.log('DB OK:', r.rows[0].now); pool.end(); }).catch(e => { console.error('DB FAIL:', e.message); process.exit(1); });
"
```

---

## 5. Troubleshooting

| Problem | Diagnosis | Resolution |
|---|---|---|
| Backend unhealthy | `docker logs healthcare_backend_dev` | Check `.env`, DB connectivity, port conflicts |
| DB connection refused | `docker ps` — check postgres container | Ensure postgres is healthy; check `DB_PASSWORD` |
| Port 5000 in use | `netstat -ano \| findstr :5000` | Kill conflicting process or change `PORT` in `.env` |
| Port 3000 in use | `netstat -ano \| findstr :3000` | Kill conflicting process |
| npm ci fails | Check Node.js version | Ensure Node.js ≥ 18; delete `node_modules` and retry |
| Migration fails | Check migration orchestrator output | Fix SQL error, then re-run `migrate-orchestrator.js` |
| Frontend hot-reload broken | Check `WATCHPACK_POLLING` | Ensure `CHOKIDAR_USEPOLLING=true` in compose |

---

## 6. Service Dependency Graph

```
                     ┌───────────┐
                     │  Frontend │ (:3000)
                     └─────┬─────┘
                           │ depends_on
                     ┌─────▼─────┐
                     │  Backend  │ (:5000, debug :9229)
                     └─────┬─────┘
                           │ depends_on (service_healthy)
                     ┌─────▼─────┐
                     │ PostgreSQL│ (:5432)
                     └───────────┘

  Optional:
                     ┌───────────┐
                     │  pgAdmin  │ (:5050) [--profile tools]
                     └─────┬─────┘
                           │ depends_on
                     ┌─────▼─────┐
                     │ PostgreSQL│
                     └───────────┘
```
