# Research pseudonymization and security dashboard

## Research processing

All four research analytics endpoints now use a materialized pseudonymous observation cohort before computing aggregates. Source patient UUIDs are used for consent, processing-control checks, and clinical joins. The observation cohort carries a full-length HMAC-SHA-256 token instead of that UUID, plus only the fields needed by that analysis. Raw patient identities, notes, profile identifiers, and pseudonyms do not appear in research API responses.

The HMAC key is derived with HKDF-SHA-256 from the active application encryption key, with the fixed salt `medicare-pseudonymization-v1` and the scope `research:<authenticated researcher UUID>`. Both the legacy `ENCRYPTION_KEY` setting and `APPLICATION_ENCRYPTION_KEYS` with `ENCRYPTION_ACTIVE_KEY_ID` are supported through the shared application-key resolver. Keys are separated from direct file encryption and across researchers; the browser cannot choose another researcher's scope. The implementation requires valid key material and does not fall back to an unkeyed hash. UUID inputs are canonicalized to lowercase. PostgreSQL `pgcrypto` performs the same byte-oriented HMAC as Node; no new extension or migration is needed.

Tokens are computed per request, never stored as a mapping or sent to the browser. Rotating the active application encryption key changes tokens; there is no persisted pseudonym dataset to migrate. Existing encrypted files and governance narratives still require their existing key-rotation procedure. This derived key scheme shares a root secret with application encryption, so protect that root and database execution privileges. Do not enable SQL bind-parameter logging for these queries.

Only live, purpose-appropriate grants to the signed-in researcher are eligible. Revocation, expiry, future start times, and active research/all-purpose processing controls are checked each request. Groups below five distinct pseudonymous participants are suppressed; repeated records from one patient cannot meet the threshold. The existing aggregate-only API contract is retained.

The internal helper retains its legacy `anonymizePatientData` / `anonymizeDataset` names, but now projects an explicit demographic allowlist and suppresses joint quasi-identifier groups below five distinct participants. These are pseudonymization and suppression controls, not a guarantee against all re-identification or repeated-query inference. No row-level research export or re-identification endpoint is introduced.

## Security dashboard

`GET /api/compliance/dashboard` is restricted to compliance officers and system administrators. Counts, the three latest unresolved events, and `generatedAt` come from one database statement. Responses are not cached.

- `openIncidents`: all unresolved security events.
- `pendingReviews`: events in `Open`, meaning not yet moved into investigation.
- `investigatingIncidents`: events in `Investigating`.
- `criticalIncidents` / `highIncidents`: unresolved events at those severities.
- `activeOverrides`: unexpired active emergency grants.
- `authAnomalies`: failed-login/access-denied audit records or recorded 401/403 responses in the previous 24 hours.
- `securityStatus`: `critical` if critical events remain open; otherwise `attention` if unresolved incidents, active overrides or authentication anomalies exist; otherwise `clear` (displayed as “No open alerts”).

The dashboard refreshes 30 seconds after the preceding request finishes, supports manual refresh, and aborts on navigation/unmount. Failures show “Status unavailable” and a visible error, retain any last successful snapshot as stale, and never substitute reassuring zero counts. The page shows the server snapshot time and excludes resolved incidents from its active preview.

Successful dashboard reads retain the dedicated `view_security_dashboard` audit event. They are excluded only from the after-hours activity-volume count so routine polling cannot generate its own incidents. Failed dashboard reads, other access and the failed-access/distinct-patient detectors remain included.

This status describes these recorded signals. It is not an assertion that the entire system is secure or that an external on-call receiver is operating. Production malware scanning, observability deployment, receiver configuration and alert-delivery evidence remain covered by [monitoring readiness](monitoring-readiness.md).

## Verification

Unit tests cover key/scope separation, keyring-only deployments, projection, distinct-participant suppression, dashboard status, refreshing, cancellation and stale/error recovery. `security-capabilities.integration.test.js` checks actual PostgreSQL HMAC equivalence and the HTTP data boundaries, immediate consent/processing restriction enforcement, real incident transitions and dashboard role restrictions. Set `SECURITY_TEST_SCHEMA=healthcare` to also exercise the private-schema deployment layout. Use `TZ=UTC` for parity with Linux CI when running timestamp-based legacy API tests on Windows. The existing fixture uses the same `MFA_ALLOW_LEGACY_TEST_SESSIONS=true` test-only setting as the repository's other legacy integration suites; dedicated MFA tests verify factor enforcement separately.
