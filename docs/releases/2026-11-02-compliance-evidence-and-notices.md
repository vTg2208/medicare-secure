# Compliance evidence and notice implementation — 2026-11-02 IST

The user-approved first-sentence engineering milestone is implemented on `feat/compliance-evidence-and-notices`. This report distinguishes source verification from operation. No production migration, application deployment, real notice publication, external notification or secret/key change was performed in this phase. The existing deployed application and coordinated cloud backups were left untouched.

## Implemented

- [Control matrix](../compliance/control-matrix.json): nine controls map framework principles to source, named test scenarios, explicit execution observations, limitations and thirteen pending provider/organization responsibilities. The checker returns `references_checked_only`; it does not execute the referenced tests or certify compliance.
- [Data inventory](../compliance/data-inventory.json): all 62 migrated tables and 697 columns, plus seven non-table stores, have purpose, classification, ownership, audience, protection and retention descriptions. Catalog tests compare actual fresh `public` and `healthcare` layouts, read only metadata and reject unknown tables/columns. Hashes, bearer credentials, ciphertext and unencrypted sensitive fields are distinguished. [Lifecycle](../compliance/data-lifecycle.md) and [assurance](../compliance/operational-assurance.md) documents describe the remaining boundaries.
- Migration 033 adds immutable notice publications, a forward-only current pointer and exact patient/version/digest acknowledgement receipts. Publication and receipt audit events commit atomically. The API controls authority/ownership, derives identity/time/hash, serializes publication and rejects stale acknowledgements. Receipt retry is idempotent. Acknowledgement grants no clinical consent and does not block care. Patient export includes owned receipts and corresponding notice content.
- Public current/historical notice screens, officer preview/confirmation/publication and paginated private review history, patient explicit acknowledgement/history and sign-in/registration/privacy-center links. Text is escaped; input is bounded; no notice or operator identity is fabricated when unconfigured. Private review reasons are application-encrypted and omitted from public responses.
- Restricted application grants cover only needed columns and operations; the backup role remains SELECT-only and browser database roles cannot read these tables. The migration and later role-provisioning template both enforce these boundaries.
- A real recovery regression exposed a pre-existing public-schema restore collision. Recovery now removes only the empty `public` schema in its newly created disposable target, letting the archive recreate it. A populated notice/receipt snapshot restores exact provenance and decryptable private review evidence. Existing-target overwrite remains prohibited.

## Verification observed

Final tested implementation revision: `f4a4ad63b45a777a996cd42f85605aeb69db7d75`. Implementation commits: `f9242c1` (inventory/controls), `97ab2eb` (migration/API/export/grants), `5572bb1` (screens), `adfd06cf95714187807d2dda3a06da2456c15b3a` (recovery regression/fix and rollout). Tests ran against those implementation sources in disposable restricted offline containers with synthetic principals, database contents and keys. The PostgreSQL recovery clients matched the PostgreSQL 17 fixture. No cloud account or production data was used.

| Check | Observed result |
| --- | --- |
| Backend units | 176 passed, 26 files |
| Full backend HTTP/database integration | 246 passed, zero failures, 247 discovered; one dedicated TLS fixture skipped by the ordinary runner |
| Notice HTTP/private-role checks | 14 passed, included in the full run; authority/ownership, immutable hash/time, stale race, concurrent publication/ack, rollback on audit failure, private review pagination and own export |
| Upgrade/recovery | Three checks passed, included above: existing 032 rows/hashes retained, 033 replay seeds no notice, actual encrypted coordinated dump/restore retains receipt ownership/content/digest and private review decryption |
| Frontend rendered behavior | 128 passed, 25 files, including thirteen new notice cases; affected navigation ten cases rerun after lint cleanup |
| Static/build | Backend syntax; frontend strict lint, theme checks and production build passed |
| Metadata | 62 tables, 697 columns, nine controls, thirteen external responsibilities pending; reference and actual catalog checks passed |

Regression development observed failing tests before implementation for metadata validation, API/runtime privilege and UI behavior. The recovery failure was reproduced as PostgreSQL `schema "public" already exists`, then passed after the target-only fix. Existing private-schema and uploaded-file recovery tests also passed in the full run. Deliberate fault-injection logs are expected test evidence, not suppressed suite failures.

The ordinary runner does not set up the dedicated trusted/untrusted TLS certificate fixture. Its historical five-case proof is recorded in the previous release; this report does not claim a fresh dedicated TLS execution. Frontend behavior here was verified in jsdom, not by a fresh live browser acceptance run. No live result is inferred from a passing build.

## Independent review and decisions

A fresh read-only whole-branch review covered `bef34da..adfd06c`, including the approved design, source, tests and rollout procedure. It found no critical issue and identified two important defects: migration 033 revoked the existing backup login's sequence SELECT, and accepted multilingual private review text could exceed the ciphertext constraint. Both were reproduced before correction. The undeployed migration now preserves backup sequence SELECT without granting sequence writes, and its bound accommodates the complete 4,000-character encrypted JSON input, including escaped surrogate characters. A new test provisions the real restricted backup login before 033 and performs a successful coordinated dump under that login.

Two further findings were treated as functional correctness work: conflict recovery from a stable version URL reloaded the old notice, and a zero-column table escaped catalog enumeration. Failing regressions reproduced both. Recovery now opens the current route with an unchecked acknowledgement; catalog enumeration includes zero-column tables and rejects their absence from the inventory in both layouts. No review finding was deferred. The author made one fix pass and reran the affected whole suites; the independent reviewer did not rerun the tests or rereview those fixes.

Decisions retained from implementation:

- One global notice follows existing platform-wide officer authority. It adds no clinical acknowledgement gate. A tenant-specific publication model would need an explicit future design; this implementation must not be presented as tenant-specific notice governance.
- Private publication review reasons are encrypted and public content excludes them. Officer history is explicitly paginated, avoiding silent truncation. Removing either boundary would expose evidence or conceal older publications.
- Migration and role provisioning are tested in both deployment orders. Recovery changes touch only a newly created disposable target. An existing installation is never silently replaced; deployment still needs its own guarded upgrade and acceptance.
- Historical observations use their actual recorded revision/report and a date, avoiding borrowed timestamp precision. Reference checks establish artifact presence only. Incorrect or stale owner assertions remain a human assurance risk.
- Offline fixtures use direct Node entrypoints where the full recovery image lacks npm, and a compatible unit image for the unit runner. Already fresh checks are recorded rather than rerun for bookkeeping alone. These are test-tool choices, not waived behavior checks.
- The reviewer set aside live/provider/legal content assurance, later-sentence features and final in-progress release evidence. These remain explicit boundaries below; the author verified the final reference artifacts and execution logs. Source review is independent evidence of code assessment, not independent execution of every test.

## Boundaries and next operation

Follow [rollout.md](../compliance/rollout.md) in a separately authorized deployment phase. It covers backup/recovery before the guarded 032→033 upgrade, effective restricted-role checks, matching API/UI deployment, responsible officer publication, patient receipt/export verification and subsequent recovery. A published notice still needs truthful operator content, publication authority and retained review evidence.

This milestone does not complete all missing functionality in other problem-statement sentences. Rights-case fulfillment/delivery/disposal linkage, full retention/restore reconciliation, external scanner/mail/alert operation, broader de-identification, emergency-access oversight and clinical workflow depth retain their documented limits. Provider arrangements/storage assurance, key custody/rotation, workforce review, incident responsibility, recovery objectives/promotion rehearsal and acceptance for real patient use require actual owner evidence. No software test establishes those facts or legal certification.
