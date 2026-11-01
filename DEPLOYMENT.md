# Free demonstration deployment

> Historical production-release evidence. The subsequent [application cleanup](docs/application-cleanup.md) removes the shared presentation mode and documents the current source behavior. Production promotion remains pending the reviewed database upgrade.

The synthetic-data demonstration is live at **https://medicare-vtg.vercel.app**. Deployment began on 2026-10-31; final verification continued on 2026-11-01 (Asia/Calcutta).

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

## Medicare identity and sign-in refresh — 2026-11-01

The canonical frontend address is https://medicare-vtg.vercel.app. The originally requested medicare.vercel.app was already assigned to another project. The previous medicare-ebon-seven.vercel.app address now redirects to the new address (307); no domain purchase was needed. Render's CORS_ORIGIN, FRONTEND_URL, WEBAUTHN_ORIGIN and WEBAUTHN_RP_ID were updated to match. The backend environment deployment reported live successfully.

The custom Medicare mark is original vector artwork in frontend/public/medicare-icon.svg, with matching favicon, Apple touch icon and manifest image assets. Browser and installed-app metadata now use Medicare. The login page replaces animated particles and translucent panels with a restrained teal healthcare layout, labelled fields, an accessible password visibility control, active-form-only rendering, and mobile and dark themes. Existing password and passkey authentication flows are retained. Demo visitors are directed to assigned accounts rather than unavailable registration.

Validation: 61 frontend tests across 10 files, frontend lint and production build. Browser visual checks covered desktop, 390px and 320px frames without horizontal overflow, and dark theme. Four new behavioral checks cover patient routing, recoverable authentication errors, passkey sign-in and demo registration guidance. Hardware passkey enrollment remains disabled in the synthetic demo.

## Site-wide Medicare theme — 2026-11-01

The public website, account flows, role workspaces and shared controls now use the Medicare design system in STYLEGUIDE.md. One brand component and product-name constant replace role-specific logos. Light/dark colors, typography, panels, forms, primary actions, feedback states and focus styling share semantic tokens. Mobile role navigation stays available, and all theme toggles use the persistent ThemeProvider state. Semantic clinical/operational status colors remain distinct.

Validation: the theme audit passes across 72 CSS files and 126 JSX files; 62 frontend tests across 11 suites pass. The build invokes the theme audit automatically. Local browser review covered 52 read-only synthetic role screens at desktop/390px, all 52 in dark mode, 12 light-theme contrast probes and eight 320px layouts. Test fixtures are excluded from deployed source. The API, database schema, authorization and demo feature limits are unchanged by this styling update.

A live follow-up also aligned six clinician page headers: theme controls now sit in normal header action flow rather than floating over the demo notice. A populated record fixture and all six header variants passed 320px checks for visible controls, no button overlap and no page-level horizontal overflow. Live patient/clinician sign-in, consent-form inspection without submission, dark-theme navigation and populated medical-record reading passed. The PDF capture subtree was checked to retain white paper and readable dark/muted ink in dark mode.
