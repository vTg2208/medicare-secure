# Medicare

Private source snapshot of the repaired healthcare management application, configured for a synthetic-data demonstration on free hosting.

**Live demo:** https://medicare-ebon-seven.vercel.app. See [deployment details and verification](DEPLOYMENT.md).

The React frontend, Express API, role and consent controls, audit trail, immutable migrations, and automated tests are included as ordinary source files. Legacy Git history, uploaded identity documents, runtime credentials, patient snapshots, logs, and local databases are excluded.

## Hosting

- Render: Free Node web service, Node 24, root `backend`, build `npm ci --omit=dev`, start `npm start`, health check `/readyz`. Set `NODE_ENV=production`, `DEMO_MODE=true`, `AI_ENABLED=false`, and the private database/signing settings in the hosting environment.
- Supabase: dedicated Free PostgreSQL project. The application uses a private `healthcare` schema and a restricted server database role. The Supabase public Data API is disabled. Browser SQL exports are generated with `node backend/scripts/export-browser-schema.js` and, only with `DEMO_MODE=true`, `node backend/scripts/hosted-demo-seed.js`. Their output belongs in ignored `.local` files, never in Git.
- Vercel: Hobby static frontend, Node 24, root `frontend`, build `npm run build`, output `build`. Set `REACT_APP_DEMO_MODE=true` and `REACT_APP_API_TIMEOUT_MS=90000`. The same-origin `/api` proxy points to the Render service.

Only synthetic patient information belongs in this deployment. Public registration, staff onboarding and invitations, passkey enrollment, document uploads, outbound email, and external AI are unavailable in demo mode. Existing-account authentication, authorization, consent, and audit enforcement remain enabled. A visible application notice explains these limits.

Free hosting can sleep, pause, or reach quotas; it does not provide the availability, backups, storage, or operational guarantees needed for real clinical use. This demonstration is not a regulatory certification or a clinically validated system.

## Local checks

Backend: `cd backend`, `npm ci`, `npm test`, `npm run check`.

Frontend: `cd frontend`, `npm ci`, `npm test`, `npm run lint`, `npm run build`.

The native database integration suites run only when explicitly enabled against a disposable loopback PostgreSQL database. Credentials and generated synthetic account passwords must stay private.
