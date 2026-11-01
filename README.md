# Medicare

Medicare brings patient records, visits, prescriptions, laboratory and imaging results, consent and care teams into one healthcare management application. It uses React, Express on Node 24 and PostgreSQL, with role-based access, encrypted files, durable audit evidence and privacy casework.

**Website:** [medicare-vtg.vercel.app](https://medicare-vtg.vercel.app). Both reviewed changesets are merged into `main` and deployed. See [release verification](docs/releases/2026-11-01-main-release.md).

## Hosting

- Render: Free Node web service, root `backend`, build `npm ci --omit=dev`, start `npm start`, readiness `/readyz`. Set `NODE_ENV=production` and supply the private database, verified TLS, signing, encryption and origin settings through the host's secret store.
- Supabase: the application uses a private `healthcare` schema and a restricted server database role. Keep the public Data API disabled. Use `export-browser-schema.js` only for a fresh installation. The existing migration-017 installation requires the guarded upgrade described in [the release procedure](docs/requirements-release.md).
- Vercel: Hobby static frontend, Node 24, root `frontend`, build `npm run build`, output `build`. The checked-in configuration supplies the same-origin API proxy and the API timeout.

The application has one standard interface and normal feature routes. SMTP is optional at startup; account verification returns an explicit availability error until delivery is configured. Document processing still requires malware scanning and durable encrypted storage. AI remains disabled unless its service and token are configured.

Bundled sample records and existing private account credentials are retained. Initial-data tooling is separate from application behavior: `ALLOW_SAMPLE_DATA=true node backend/scripts/seed-workspace.js` creates SQL and private account material under ignored `.local` paths without connecting to the database. It refuses populated databases and mismatched migration ledgers. Never publish the private account files or reuse their passwords.

Free hosting can sleep, pause or reach quotas. Actual clinical operation requires appropriate provider arrangements, encrypted infrastructure, verified TLS, retention procedures, monitoring and tested recovery. This source does not certify the organization or clinically validate AI output.

## Local checks

Backend: `cd backend`, `npm ci`, `npm test`, `npm run check`.

Frontend: `cd frontend`, `npm ci`, `npm test`, `npm run lint`, `npm run build`.

Run `npm run test:integration` only with the documented opt-in settings against a migrated, disposable loopback PostgreSQL database and matching PostgreSQL dump/restore tools. Enable both database and private-browser checks; skipped recovery cases are not release evidence.

See [STYLEGUIDE.md](STYLEGUIDE.md) for the shared Medicare theme. Source excludes runtime credentials, uploaded identity documents, local databases and private logs.

## Review and release

Start with [requirement coverage](docs/requirements-traceability.md), [architecture and threats](docs/architecture-threat-model.md), [audit guarantees](docs/clinical-audit-integrity.md) and [application cleanup](docs/application-cleanup.md).

The deployed `main` includes ordered migrations 018–025. The private database was upgraded before the API and frontend release. Follow [the release procedure](docs/requirements-release.md) for future upgrades, preserving database privileges, encrypted-file recovery and operational readiness requirements.
