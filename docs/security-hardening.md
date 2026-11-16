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
- Independent source review found no actionable defects in this change set.
- File-migration integration suite: five passed, four could not complete. Three require an explicit database coordination fixture and one cannot create symlinks under this Windows session. These tests exercise unchanged migration code; they are not evidence of a successful production migration.
- GitHub dependency graph, vulnerability alerts and security-update PRs were enabled through the owner's browser. The new weekly update configuration and strict Python audits require merge to the default branch and a successful initial run. See [dependency monitoring](security-dependencies.md).

The Managed production widget was created and its verification key saved only in the existing Render API environment. Enforcement remains disabled until the compatible frontend is live. GitHub showed no open dependency alerts at the time of review. Provider activation, live application revision and initial Python advisory results must be recorded after deployment; passing source tests alone does not prove production activation.
