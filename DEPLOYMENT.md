# Free demonstration deployment

The synthetic-data demonstration is live at **https://medicare-ebon-seven.vercel.app**. Deployment began on 2026-10-31; final verification continued on 2026-11-01 (Asia/Calcutta).

| Component | Deployment |
| --- | --- |
| Frontend | Existing Vercel `medicare` project, Hobby plan, Node 24, Vite; root `frontend`, output `build`. |
| API | Render `medicare-secure-api`, Free plan, Singapore; https://medicare-secure-api.onrender.com; root `backend`, `npm ci --omit=dev`, `npm start`, readiness `/readyz`. |
| Database | New Supabase Free `medicare` project `ghselatqszqnoteqwyef`, Tokyo; 17 migrations and 43 tables in private `healthcare` schema. |
| Source | Private https://github.com/vTg2208/medicare-secure; fresh history and ordinary source folders. Original `medicare` repository and unrelated services were preserved. |

Vercel proxies `/api` and `/readyz` to Render. The build explicitly sets the API path to `/api`, enables the demo notice and allows a 90-second client timeout for free-server cold starts. The legacy Vercel API variable was not revealed or modified. Security headers and the SPA fallback are in `frontend/vercel.json`.

The database public Data API is disabled. Neither `anon` nor `authenticated` has usage of the application schema. The API uses the separate `healthcare_api` login, with no superuser, role creation, database creation, replication or RLS-bypass privileges. It can read/write application data; migration metadata is read-only and retained audit rows cannot be updated/deleted. The database administrator password is not used by the backend.

Database TLS certificate verification is enabled. `DB_SSL_CA` contains the CA downloaded through Supabase's Database Settings, SSL configuration, Download certificate. Its public SHA-256 fingerprint is `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`; expiry is 2031-04-26. Missing CA trust caused the initial startup to fail closed; adding the CA produced a successful verified connection and live readiness.

## Demonstration accounts and limits

Sixteen synthetic accounts cover all twelve roles, including five fictional patients. Private, randomly generated application passwords are retained only in the original workspace's ignored `.local/browser-demo-credentials.txt`; they are not committed or published. The API database password chosen by the owner is stored in Render and was not read back or copied into Git.

`DEMO_MODE=true` and `AI_ENABLED=false` are set on the API. Public registration, staff invitations/onboarding, passkey enrollment, document uploads, outbound email and AI are unavailable. Production authentication, sessions, authorization, consent, encryption and audit enforcement remain enabled. Upload scanning was not bypassed. No real patient data, real identity documents or local inspection database were uploaded.

Render's Free service sleeps when inactive; its dashboard warns that requests can then take 50 seconds or more. Its filesystem is ephemeral, so new document uploads are disabled. Free database quotas, provider pauses and the absence of configured restore operations limit availability and recovery. This deployment is for synthetic demonstration and inspection; it is not a real clinical production deployment or a regulatory certification.

## Verification

- Render reports the backend live, with a successful database connection and completed schema readiness; Vercel reports the frontend ready.
- The public frontend's `/readyz` returns `{"success":true}` through the API proxy.
- `/api/public/deployment` reports demo mode and the disabled integrations. Anonymous medical-record requests return `Authentication token required`.
- Live browser checks passed patient and clinician login, synthetic record access, patient rejection from the clinician dashboard, all seven consent-recipient roles, consent creation/update and restoration of the seeded scope, retained audit entries, logout, and the explicit AI-unavailable screen.
- The live queue initially exposed PostgreSQL microsecond precision loss through JavaScript `Date`, producing position zero and a negative wait. A real-database regression reproduced it. The model now compares the timestamps in PostgreSQL and bounds the wait at zero. The deployed patient dashboard confirms position 1 of 1 and approximately 0 minutes.
- Local follow-up checks passed: 120 backend unit tests, 57 frontend tests, 33 actual HTTP/PostgreSQL integration checks, and 4 browser schema/seed export checks. Frontend lint/build and backend syntax checks passed. Scoped independent review found no remaining confirmed medium-or-higher issue in the queue fix and Vercel configuration.

The initial production-readiness report records the earlier full dependency audits, three local container image smokes, database provisioning checks and 23 offline AI tests. This clean deployment repository does not include the original remote CI workflows; the hosted platforms built the deployed application, and the automated regression suites were run locally. Actual SMTP delivery, ClamAV signatures, passkey hardware, AI-provider calls, load/recovery tests and clinical/compliance validation remain outside this demo's enabled scope.
