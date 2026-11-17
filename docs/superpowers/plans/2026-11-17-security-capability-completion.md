# Security capability completion

Goal: activate pseudonymization in research processing and make the security dashboard report current, evidence-based information.

Constraints: use branch `security-capability-completion`; preserve pre-existing edits; retain aggregate-only research responses and consent/processing restrictions; use the user's browser for websites; add no dependencies.

Design: derive researcher-scoped HMAC keys from the existing application encryption key with HKDF domain separation. Build materialized pseudonymized observations before research aggregation; raw patient identifiers never enter those observations or API output. Replace the unused anonymization helper's denylist and placeholder anonymity check with an explicit projection and suppression based on distinct participants. Pseudonymized data remains personal data, not a claim of anonymization.

Dashboard: query one database snapshot for event counts, unreviewed Open cases, Investigating cases, active overrides, recent unresolved events, and a generated timestamp. Derive Critical incidents open / Review required / No open alerts from these signals; never assert system security or certification. Refresh every 30 seconds without overlapping requests, support manual retry, cancel on unmount, preserve and label stale data on failure, and expose loading/error states accessibly.

## Tasks

- [x] Write failing crypto/projection/suppression tests; implement keyed pseudonymization and integrate every research analytics endpoint. Verify consent revocation, distinct-patient thresholds, key/scope separation, no identifier output, and both database schemas.
- [x] Write failing dashboard API/UI tests; implement coherent event statistics and status, recent unresolved incident selection, refresh, retry, cancellation, and stale-data behavior. Verify role restrictions and Open versus Investigating counts.
- [x] Run focused tests, database integration, backend syntax checks, frontend lint/build, and applicable broader suites. Inspect the rendered UI in the user's browser if available. Document actual guarantees and deployment dependencies; review only task changes before completion.

Evidence: backend unit suite (333 tests), frontend suite (187 tests), related API/breach/privacy/responder integration suites, and the new capability suite in public and healthcare schemas passed. The capability suite also runs the research queries under a restricted database reader. Backend syntax, frontend lint and production build passed. Chrome verified actual synthetic-account sign-in, correct dashboard counts and times, manual/automatic refresh, API-failure stale-state presentation and recovery. Independent scoped source review found no actionable issues. Database integration used disposable local PostgreSQL 17.6 and UTC process time for CI parity; production deployment was not exercised.

Longer polling validation exposed an existing after-hours detector interaction. Successful dashboard GETs now retain a dedicated durable audit action and are excluded only from that detector's activity-volume count. Failed dashboard requests and the other detectors remain counted. A failing regression established the issue; all eight capability checks then passed in each schema, including successful-polling audit retention and failed-read detection. Follow-up source review found no actionable issues.

No deployment or changes to live data are part of this implementation. Existing scanner, monitoring receiver, and key provisioning remain operator responsibilities.
