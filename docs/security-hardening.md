# Security hardening

## Public authentication

Password login, public patient/doctor/organization registration, and verification-code resend use Cloudflare Turnstile when `TURNSTILE_ENABLED=true`. Existing rate limits run first. The server supplies the public site key in a challenge response; the frontend reveals an inline widget and submits its token in `X-Bot-Token`. Passwords, registration details and clinical data are not sent to the verification provider by this integration.

The server verifies the token over HTTPS with a five-second timeout, requires `public_auth`, checks the configured hostname and token age, and rejects missing, invalid, expired or replayed tokens before the protected controller runs. Provider outages fail closed with a retryable error. A bounded, shared process-local cache reserves token hashes before verification to prevent concurrent reuse across public routes. Multiple API replicas would need a shared atomic replay store in addition to provider verification. Tokens and the verification secret are not logged.

Authenticated staff can register patients without a challenge only after normal server authentication and a trusted staff role check. Public callers cannot claim this exemption. Delivered-code verification and passkey sign-in retain their existing controls. Registration's automatic password sign-in requests a fresh challenge token; retrying it does not verify an already consumed email code again.

## Production configuration

Create a Managed Turnstile widget restricted to `medicare-vtg.vercel.app`, with pre-clearance disabled. Store these variables in the existing API service environment, keeping the secret out of source control and frontend environment variables:

| Variable | Value |
| --- | --- |
| `TURNSTILE_ENABLED` | `true` after the compatible frontend is live |
| `TURNSTILE_SITE_KEY` | Widget's public site key |
| `TURNSTILE_SECRET_KEY` | Widget's private verification secret |
| `TURNSTILE_HOSTNAMES` | `medicare-vtg.vercel.app` |

Production rejects the provider's testing keys and an allowlist that omits the configured frontend hostname. Development defaults to disabled; provider testing keys may be used only outside production. Frontend CSP permits the fixed Cloudflare challenge host for the script, connections and frame. Deploy that frontend before enabling API enforcement. A deployment preview on another hostname cannot use the production widget.

The existing Render configuration referenced the older `medicare-ebon-seven.vercel.app` deployment. Align `FRONTEND_URL`, `CORS_ORIGIN`, `WEBAUTHN_ORIGIN` and `WEBAUTHN_RP_ID` with the current `medicare-vtg.vercel.app` site. WebAuthn credentials remain bound to their original relying-party hostname; credentials enrolled on the older hostname cannot authenticate the new hostname and must be enrolled again there.

After activation, verify that missing tokens reveal the check, valid verification reaches the normal authentication result, a second submission requires a new token, and provider errors remain retryable. Do not create patient records to test production. Expiry, invalid tokens, replay, provider outage, authenticated staff exemption, OTP retries and widget lifecycle have automated regression coverage.

## Input and upload validation

Medical-record creation validates identifiers, record type, allowed fields and bounded text after authentication/role checks and before existing clinical-access authorization and persistence. Valid multiline clinical prose is preserved. Invalid input must not trigger database writes.

Credential uploads require a supported PDF/JPEG/PNG filename extension, matching declared MIME type and identifying content header before antivirus scanning, encryption or persistence. Unknown, mismatched and trailing double extensions fail. Existing clinical-file formats and encrypted-file migration remain unchanged. Signature validation supplements the existing antivirus check; it does not establish that every document is harmless.

## HTTPS verification

On 2026-11-16, explicit HTTP navigation in the owner's Chrome reached the HTTPS website and API health endpoint successfully. An independent redirect check through the HTTPStatus website confirmed server responses: frontend HTTP **308** to HTTPS then **200**; API `/health` HTTP **301** to HTTPS then **200**. This distinguishes server enforcement from the browser's own HTTPS upgrade behavior.

The live response headers confirmed frontend `Strict-Transport-Security: max-age=31536000` and API `max-age=15552000; includeSubDomains`, along with CSP and MIME-sniffing protection. The API uses Helmet security headers. Production environment validation requires HTTPS frontend/WebAuthn origins, explicit HTTPS CORS origins and certificate-verified database TLS. Vercel's API rewrite targets the HTTPS Render endpoint. TLS terminates at the existing hosting edges, so an application redirect based on an untrusted forwarded header is unnecessary here.

## Verification record

- Backend unit suite: 322 tests across 32 files passed from the staged source export (324 with existing unrelated workspace changes); JavaScript syntax checks passed.
- Frontend suite: 181 tests across 36 files passed; lint, theme/font checks and production build passed.
- AI suite from staged source: 40 offline tests passed, including a regression that reproduced and then prevented concurrent startup from mixing one model's metadata with another model's vectors.
- Independent source review found no actionable defects in this change set.
- File-migration integration suite: five passed, four could not complete. Three require an explicit database coordination fixture and one cannot create symlinks under this Windows session. These tests exercise unchanged migration code; they are not evidence of a successful production migration.
- Backend CI subsequently passed its configured disposable-database integration suite, syntax/governance checks, npm audit and production image build. Frontend CI passed its tests, lint, theme/font checks, build, npm audit and production-container smoke test.
- All three strict Python advisory audits passed after removing the unpatched Chroma dependency. Optional reference retrieval uses a transactional standard-library SQLite index, JSON numeric vectors and explicit local embeddings. Existing reference loading and retriever interfaces remain available; old Chroma files remain untouched. This index is intended for the existing small curated corpus. See [dependency monitoring](security-dependencies.md).
- GitHub dependency graph, vulnerability alerts and security-update PRs were enabled through the owner's browser. After merge, GitHub's dependency-updates page showed monitored npm, pip, Actions and Docker manifests, active update jobs and generated update PRs. Updates require normal review and are not automatically merged.

## Production activation evidence

[PR #15](https://github.com/vTg2208/medicare-secure/pull/15) merged after all ten checks passed. The application release is commit `719e5fd2e90a8144fe0e33fb63fe9edf713897d5`, containing security commits `4ad8d93e00ca0898635790af937767efe3b34890` and `c5429a31d8eaa484158d8dd2420053d5c877c13f`. The local and remote branch is named `security-hardening`.

The [Vercel production deployment](https://vercel.com/theegela-vishnu-vardhans-projects/medicare/G1JnuRAziptL43nopSTV75zsHro5) showed Ready, Production, Current, the release commit and `medicare-vtg.vercel.app`. Render deployed that same commit and then [restarted with enforcement enabled](https://dashboard.render.com/web/srv-dbj30sg473hc73b1iu00/deploys/dep-dbtiqn8u01pc73e1lnog); its log showed the service live at 21:51 Asia/Calcutta on 2026-11-16. The verification secret was transferred through the owner's browser only to the existing Render API environment and was not placed in source, frontend configuration or this report. The canonical frontend/CORS/WebAuthn configuration now references the current hostname.

On the production sign-in page, an initial submission using a synthetic nonexistent address required the security check and disabled submission while verification was pending. Cloudflare's Managed widget completed successfully without a manual challenge. The next submission reached normal authentication and returned `Invalid email/phone or password`, followed by a fresh-token requirement. This verifies that the real server accepted the provider token and that the frontend reset it after use. No patient account or clinical record was created. The API `/readyz` endpoint returned `{"success":true}` after activation.

Expiry, replay, provider failure, authenticated-staff exemption and OTP retry behavior were verified by automated regressions. Authenticated patient/staff clinical workflows were not manually exercised against production data. Optional AI retrieval was verified offline and in CI; this release does not enable it in production. These checks establish the specific controls tested, not a guarantee against every security issue.
