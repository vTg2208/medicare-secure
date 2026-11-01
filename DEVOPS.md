# Operations and release readiness

The repository supplies local development and production packaging. Passing tests and image builds establish code readiness; they do not establish operational readiness or certify HIPAA/GDPR compliance. Deployment owners must review the release evidence, threat model, hosting controls, clinical behavior, and applicable obligations before handling real patient data.

## Local development

Use Node.js 24 and Docker Compose 2.20 or later. On Windows:

```powershell
.\scripts\dev-bootstrap.ps1
```

Bootstrap runs `npm ci` for backend/frontend, creates missing root and backend `.env` files with cryptographically random secrets, validates the backend configuration, then starts the development stack. Existing `.env` files are preserved exactly; review older files manually if validation fails. `-SkipDocker` prepares files and dependencies only. It never deletes database volumes or installs preloaded user accounts. `-WithTools` enables local pgAdmin, whose generated password is stored in root `.env`. The current template sets `COMPOSE_PROJECT_NAME=medicare`, keeping local network names consistent across clone locations; when reusing an older environment, set the intended project name explicitly before enabling the monitoring overlay.

For manual setup, run `npm ci` in backend and frontend, then `node scripts/setup-local.js` at the root and `docker compose up --build --wait`. The default compose includes `docker-compose.dev.yaml`. PostgreSQL 18 is loopback-bound on port 55432; the frontend is at http://localhost:3000, API at http://localhost:5000, and Mailpit OTP inbox at http://localhost:8025. OTPs are delivered through local SMTP, with no fixed bypass. ClamAV is at loopback port 3310 for local backend use; signature initialization can take several minutes and uploads fail closed until scanning is available. Source changes hot reload; rebuild images after dependency changes.

The migration service applies the versioned registry before the backend starts. SQL directories are not mounted as database initialization scripts. An existing PostgreSQL 15 volume cannot be reused with PostgreSQL 18: back it up and perform a reviewed upgrade/restore into a separate volume. Never delete a volume to work around a startup error.

To run Node processes directly, start local PostgreSQL/Mailpit/ClamAV, run `npm run db:migrate` in backend, then backend `npm run dev` and frontend `npm start`. Bootstrap-generated backend settings point to loopback dependencies. Native database integration tests require an explicit disposable local test database on port 55432, `NODE_ENV=test`, `RUN_DB_TESTS=true`, and a database name containing `test`. Do not run these against application data.

## Production configuration

Copy `.env.production.example` to an ignored `.env.production`, fill every required setting, and generate independent random secrets through your secret manager. Set external HTTPS origins, WebAuthn hostname, verified SMTP sender and credentials as required by your provider. Keep database owner and application passwords distinct. Encryption keys must be exactly 64 hexadecimal characters; retain prior encryption keys securely for any planned rotation or restore workflow.

```powershell
node scripts/validate-env.js --env prod --file .env.production
docker compose --env-file .env.production -f docker-compose.prod.yaml config --quiet
docker compose --env-file .env.production -f docker-compose.prod.yaml build
```

These commands validate and build; deployment is a separate owner-controlled action. Do not print `docker compose config` without `--quiet` in shared logs because interpolated secrets are included. The root validator shares the backend validator and never prints values. Environment variables injected by the process take precedence over the file.

Production PostgreSQL is reachable only on the internal data network. A one-shot migration job uses owner credentials, applies migrations, and provisions a separate application role. Runtime uses that limited role. The backend starts only after successful migration. No accounts or automatic administrator credentials are created. Use the documented `backend/scripts/bootstrap-admin.js` command with explicit administrator details under controlled owner access; keep bootstrap credentials out of logs and shell history.

The frontend uses unprivileged nginx on container port 8080, exposed only at `127.0.0.1:8080`. Place a trusted TLS reverse proxy in front. It must overwrite `X-Forwarded-Proto`; nginx accepts only `http`/`https` and overwrites forwarded client addresses. By default all users arriving through one ingress may share an IP-based rate-limit bucket. Configure an explicit trusted ingress real-IP policy and test rate limiting before wider rollout; never trust arbitrary client `X-Forwarded-For`. The backend is not published. Requests use the same-origin `/api` proxy. Read-only roots, dropped capabilities, resource limits, persistent uploads/logs and ClamAV are included. ClamAV needs fresh signatures and sufficient memory; upload scanning fails closed on scanner errors.

AI is disabled by default. The development stack offers an `ai` Compose profile. Production uses a separately operated service: set its private `AI_SERVICE_URL`, provision the same random `AI_SERVICE_TOKEN` on both services, configure the provider key on the AI service, and explicitly enable the API integration. The production Compose template does not provision an AI container. No provider calls are made by offline tests. The minimal image does not install RAG/embedding dependencies; those require separate build and clinical/privacy review. A configured provider can receive submitted clinical text: obtain appropriate agreements and approval before use.

## Evidence and remaining operator work

Backend CI runs Node 24 dependency installation, syntax checks, unit tests, full dependency audit, real migrations, database and API/access integration suites against PostgreSQL 18, repeat migration, and a production Docker build. AI CI runs dependency checks and offline pytest on Python 3.11/3.12 and builds the minimal Python 3.12 image. Frontend CI supplies its own checks. Failed checks fail the workflow; no placeholder migration/build stages or warning-only test stages remain in these pipelines. Local results belong in the release report; a configured CI file does not prove that hosted CI has run.

Before release, the operator must supply external TLS and trusted ingress configuration, managed secrets and rotation procedures, encrypted host/storage backups, restore drills and approved recovery targets, audit retention/access controls, outbound SMTP validation, scanner update monitoring, vulnerability/image refresh policy, incident response ownership, and load/availability checks. Provider approval and clinical workflow review remain external requirements. Container-local logs and a named volume are not backups. Production data migration and rollback require their own reviewed plan; never roll back a schema by deleting migration metadata.

`/health` is liveness and `/readyz` is database/schema readiness. Monitor both, failed migrations, delivery errors, scanning failures, resource usage and audit persistence. Restrict `/metrics` using `METRICS_TOKEN` and wire Prometheus authorization explicitly. The separate monitoring Compose is a local diagnostic template, with sensitive host collectors opt-in; it is not evidence of production monitoring or regulatory compliance. Stop local services with `docker compose down` without `-v` to preserve data.

Historical supporting documents under `docs/devops` are design/reference material; this runbook and the release report describe current readiness. Resolve any conflicting historical instructions before deployment.
