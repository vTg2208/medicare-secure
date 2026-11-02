# Privacy-request fulfillment implementation — 2026-11-02

The approved privacy-request fulfillment design is implemented on `feat/privacy-request-fulfillment`, based on main `0e51a908ba78d63f5316009ed08985725d94f35c`. This is source/test evidence, not a deployment report. Migration 034 has not been applied to the live installation, and no live patient information, credentials, notices or disposal decisions were changed.

## Implemented behavior

- Access/portability requests in review can generate password-confirmed, case-linked exports. Immutable receipts bind the requesting patient, exact UTF-8 JSON digest/byte count, schema version, scope and exclusions. Full export payloads are not retained in these tables.
- Patients explicitly confirm receipt. Preparation and download do not imply confirmation; confirmation does not close a case. Owner/case/hash validation, idempotent retries and serialized closure preserve the evidence boundary.
- Officers cannot mark access/portability fulfilled or partially fulfilled without selecting that case's patient-confirmed receipt. Outcomes preserve the selected evidence and explain structured-copy limitations. General subject export stays independent.
- Erasure reviews can link owned disposal approvals and execution evidence. Partial fulfillment requires selected completed decisions and finished attachment cleanup; message-only disposal does not claim clinical-record deletion. Full erasure remains prohibited and execution remains separately privileged.
- Existing closed cases retain their original history without fabricated evidence. Patient and officer screens distinguish preparation, confirmation, pending cleanup, actual selected evidence and limited retained scope.
- Migration 034 adds three immutable evidence tables with ownership constraints and restricted grants. The inventory now covers 65 tables and 718 columns. Public and private provisioning paths preserve column-level inserts and prohibit caller-supplied evidence timestamps.

## Verification

Implementation sources through `4aeb987` were tested in disposable network-isolated containers with synthetic databases/accounts and fixture keys. No live credentials were loaded for these checks.

| Check | Result |
| --- | --- |
| Backend units | 176 passed across 26 files |
| Full backend integration | 263 passed, zero failures, 264 discovered; one dedicated TLS fixture skipped by the ordinary runner |
| Focused privacy/retention suite | 42 passed, included in integration coverage |
| Frontend suite | 135 passed across 25 files |
| Frontend lint/theme/build | Passed |
| Backend syntax | Passed |
| Inventory/catalog | 65 tables/718 columns; public and private schemas passed drift checks; nine controls, thirteen external responsibilities remain pending |
| Runtime and upgrade | Three checks passed: immutable evidence privileges, legacy preservation/replay and both migration/provisioning orders across the supported schemas |
| Coordinated recovery | Actual encrypted private-schema dump/restore retained exact receipt and confirmation metadata, selected outcome and decryptable case disposal explanation; audit and ledger verification passed |

Observed failing regressions preceded implementation: missing request export endpoint, narrative-only completion accepted, missing disposal association endpoint, missing UI flows and selected outcome display. A later actual-provisioning regression exposed the public role provisioner's broad INSERT grant; narrowing the new evidence tables fixed the forged-timestamp path. Catalog validation failed until the three new tables were classified.

The first full integration command omitted initialization of the shared disposable baseline database. The two failures were `migration failures roll back DDL and metadata; applied migrations reject drift` and `fresh provisioning supports patient, visit and clinical workflows without preloaded records`. The owned test fixture was recreated and initialized using the normal migrator; the full rerun passed without a product workaround. Expected denial/audit-fault logs appear in tests. The dedicated TLS fixture was not rerun by this change. Frontend results are rendered jsdom tests, not live browser acceptance.

Private execution logs are retained under ignored `.local/release-mandatory/`: `fulfillment-task1-red.log`, `fulfillment-task1-green.log`, `fulfillment-task2-red.log`, `fulfillment-task2-all-green.log`, `fulfillment-ui-red.log`, `fulfillment-ui-outcome-red.log`, `fulfillment-ui-all-green.log`, `fulfillment-runtime-red.log`, `fulfillment-runtime-green.log`, `fulfillment-catalog-green.log`, `fulfillment-recovery.log`, `fulfillment-full-units.log`, and `fulfillment-full-integration-green.log`.

## Independent review

A fresh reviewer inspected the entire `0e51a908..4aeb987` diff and surrounding transaction, disposal, migration, provisioning and recovery code. No critical or important findings remained. The review checked exact saved bytes, owner-bound confirmation and closure locking, completed disposal provenance, message-only deletion claims, refreshed receipt controls and legacy preservation. The reviewer inspected source and relied on the recorded test execution; it did not independently rerun the suites.

Production configuration, effective live privileges, operator backup readiness and legal sufficiency were not assessed in this source implementation review. Deferred deadline escalation, broader retention, disposal-aware recovery reconciliation and key rotation remain separate work. This was a focused branch review, not a general security audit.

## Limits and next steps

Patient confirmation is an assertion of receipt, not proof of reading or browser persistence. The digest identifies the exact prepared structured copy; subsequent downloads are new snapshots. Binary attachments and independently requested delivery channels are not evidenced by that receipt. The officer remains accountable for full versus partial satisfaction of the request's reviewed scope.

Partial erasure evidence does not establish account-wide deletion or erase historical backups. Deadline extension/escalation, broader category retention, independent disposal-ledger reconciliation before recovery promotion, key rotation and operator/provider assurance remain separate work. No legal policy or completion percentage is inferred from these tests.

Deploy only in a separately authorized release: recover a pre-upgrade coordinated snapshot, review/apply the guarded 033-to-034 migration, verify runtime and backup privileges, deploy matching API/UI, test synthetic patient/officer flows and recover a post-change snapshot. See [workflow and rollout details](../privacy-fulfillment.md).
