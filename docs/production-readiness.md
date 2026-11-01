# Production-readiness repair and inspection report

Initial repair date: 2026-10-31. Branch: `codex/production-readiness`. The original workspace changes remain uncommitted for owner inspection. The initial repair was local; the subsequent owner-authorized [free synthetic-data deployment](free-hosting-deployment.md) uses a clean private source repository and is live. No real patient data, paid model call or merge was involved.

## Inspection environment

The current workspace has a local preview at **http://localhost:3001**, backed by the native API at `http://127.0.0.1:5050`. The existing Grafana process on port 3000 was preserved.

Private, randomly generated inspection credentials are in `.local/inspection-credentials.txt`. They cover all supported roles and operate only on the `healthcare_inspection` database in the task-created PostgreSQL cluster on loopback port 55432. All names, visits and clinical records in that database are synthetic. The preview's optional external AI service is disabled. Registration requires the configured local SMTP service; the browser review uses pre-created synthetic accounts.

The API and frontend are left running for inspection. To restart the API from `backend`, use `node -r dotenv/config src/server.js dotenv_config_path=../.local/inspection.env`. The frontend preview uses port 3001 and proxies `/api` to 5050. The cluster data is under the ignored `.local/pgdata`; it is separate from any database on port 5432.

Suggested inspection:

1. Sign in as the inspection patient; open medical records and the consent screen. Confirm recipients include nurses, laboratories, radiology, pharmacy, insurance and research as well as doctors.
2. Grant/revoke category-specific access. A provider requires both consent and an active authorized care context; a global administrator has no blanket clinical-record bypass.
3. Sign in as a doctor and review assigned visits. Emergency access requires an active local visit, a patient ID and justification. Check its finite expiry, revoke it, then inspect the patient's audit trail and notifications.
4. Inspect hospital staff invitations, visit assignments and the clinical order workflows. Reassigning clinicians requires patient approval of new visit grants.
5. Inspect laboratory/radiology uploads and authenticated report downloads. Production upload scanning is a required integration; the offline upload regressions use synthetic fixtures.
6. Review compliance incidents and aggregate research screens. Research counts are suppressed until at least five patients explicitly consent to the appropriate research purpose/category.

## Repairs

| Area | Result |
| --- | --- |
| Provisioning | Ordered, checksum-tracked, advisory-locked transactional migrations provision all routed features. Repeated execution is safe. Production migrations and API data access use separate database roles. |
| Authentication | Removed fallback signing secrets and fixed OTP bypasses; token uniqueness, token/session binding, revocation, idle expiry, account status and password byte limits are enforced. Anonymous registration cannot overwrite an existing pending account. |
| Clinical authorization | Resource IDs resolve to canonical patients/visits. Role, consent category, care assignment, active organization membership and tenant checks precede reads/writes. Revoked assignments remain revoked. |
| Visits and consent | Approval assigns staff without silently granting access. Patient OTP creates selected-level visit grants. Reassignment, closure and workflow transitions are consistent and transactional. Manual consent is preserved. |
| Staff administration | Hospital administrators cannot create privileged platform roles or manage other hospitals. Invitation acceptance locks and atomically consumes the invitation, updates the account/mapping and records the action. Delivery failures are explicit. |
| Clinical workflows | Fixed real lab-order queues, diagnosis addenda, pharmacy dispensing/nurse administration, radiology-to-EMR publication, notification ownership, one-time-token scope/replay and tenant-safe bed allocation. |
| Files | Encrypted authenticated file envelopes, bounded intake, production ClamAV integration and protected downloads. Download audit insertion must succeed before report/credential bytes are returned. |
| Audit and privacy | Removed database/debug endpoints and patient-data debug logging. Redacted nested credentials/clinical payloads. Database triggers serialize audit hashes and reject retained-evidence mutation. Patient trail includes record/file access. |
| Frontend | Replaced obsolete CRA tooling with Vite, corrected API paths/auth restoration/logout/downloads, removed development login, added lazy routes and error recovery, and repaired consent recipient discovery/legacy entry points. |
| AI | Optional, authenticated service; ownership before provider calls, bounded sessions/requests, offline tests, lazy provider creation, explicit failures and clinician-review notices. Model confidence does not lower clinical priority. |
| Operations | Node 24 images, nonroot services, same-origin reverse proxy, readiness/shutdown handling, strict CI gates, environment validation, safe bootstrap and current runbooks. |

## Initial repair verification evidence

Initial repair command output is retained in ignored `.local/` verification logs. **163 automated tests passed** at that stage: 63 backend unit, 31 HTTP/PostgreSQL integration, 3 database provisioning, 43 frontend and 23 AI offline tests. The [subsequent deployment report](free-hosting-deployment.md) records the expanded suites and live checks after demo support and the queue correction.

| Check | Evidence |
| --- | --- |
| Backend unit regression suite | 63 tests across 13 files. |
| PostgreSQL provisioning tests | 3 tests: fresh schema/workflows, repeat migration, rollback/checksum drift and administrator validation. |
| Actual HTTP/PostgreSQL integration | 31 tests. Patient/OTP/session flows; consent/revocation and tenant boundaries; clinical orders, uploads and dispensing/administration; invitation concurrency; one-time tokens; bed occupancy; emergency/read-only/revocation; encryption/download audit; research suppression; restricted database-role privileges; clinician reassignment/re-approval. |
| Frontend | 43 behavior tests across 9 files; lint with zero warnings; production bundle. |
| AI offline | 23 tests and clean `pip check`; no model/provider calls or embedding downloads. One upstream Starlette TestClient/httpx deprecation warning remains in test tooling. |
| Dependency audits | Backend and frontend full audits report zero vulnerabilities, including development dependencies. Obsolete nodemon was replaced with Node's built-in watch mode to remove its vulnerable glob dependency. |
| Production images | Backend, frontend and AI images built locally. Isolated smoke checks verify nonroot execution, frontend read-only root/security headers/SPA routing, backend native bcrypt/config rejection, and AI liveness/readiness/authentication. Temporary test containers were removed. |
| Native browser | Playwright with installed Microsoft Edge: patient/doctor login, recipient discovery/grant, records, emergency activation/revocation and logout; desktop 1440×1000 and mobile 390×844 public screens. No console errors, page errors or failed requests in the final smoke run. |

Browser coverage does not include a real authenticator/passkey ceremony, live SMTP registration, every role dashboard, authenticated mobile screens or live AI. Hosted CI has been configured but has not run on a remote runner.

## Deployment prerequisites after inspection

These require the intended deployment environment and must be completed before real patient data is used:

- Configure the final HTTPS hostname, TLS terminator, trusted ingress/client-IP policy and matching WebAuthn relying-party origin. Backend and AI ports stay private.
- Supply independent production database-owner/app passwords, signing keys and encryption keys through a secret manager. Preserve encryption keys with the encrypted backups and plan rotation. Never copy inspection accounts or `.local/` data into production.
- Verify actual SMTP delivery and sender configuration, invitation/OTP delivery and failure/retry behavior. Phone-only registration is rejected because SMS delivery is not implemented.
- Initialize ClamAV signatures and exercise clean, rejected and unavailable scanner responses in the target network. Uploads fail closed when scanning is unavailable.
- Test the migration chain against a restored copy of an existing installation. Fresh installation and repeat runs are verified; unknown legacy schema/data variants are not silently repaired or discarded. Case/record/bed conflicts need owner review.
- Configure encrypted database volumes/backups, restore drills, monitoring/alert routing, retention/archival procedures, access review and the appropriate provider agreements. Application file encryption is not a claim that every database field or backup is encrypted by this code.
- Before enabling external AI, approve its provider/model/data handling and clinically evaluate its behavior. AI is an unvalidated intake aid, not a diagnostic or urgency-assessment system. RAG model download/startup was not exercised offline.
- Validate the actual authenticator/passkey flow over the final origin. Current in-memory passkey challenges and AI session state assume a single instance; multi-instance rollout needs shared state or routing guarantees.
- Perform environment-specific load, recovery and independent security/compliance review. No HIPAA/GDPR certification is claimed.

## Preserved private and historical material

Tracked identity/consent snapshots, old logs and unused credential-retrieval/destructive database scripts were removed from the shippable tree and preserved locally under `.local/legacy-private`. They are ignored by Git. Existing Git history still contains the original material; review it and rotate any previously committed live credentials before publishing or deploying. No history rewrite was performed.

Historical planning documents may describe unimplemented or superseded features. Use this report, the current README and DEVOPS.md for the repaired application's actual behavior and commands.
