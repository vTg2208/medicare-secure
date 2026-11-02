# Privacy-request Fulfillment Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this approved plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Make fulfilled privacy cases refer to owned, verifiable export or completed-disposal evidence.

**Architecture:** Add immutable metadata tables and a focused fulfillment-evidence service. Reuse the existing export transaction, officer decision history and operator-only disposal machinery. Extend the existing Privacy Center with evidence controls.

**Tech Stack:** Node 24, Express, PostgreSQL, React, node:test, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-02-privacy-request-fulfillment-design.md` (user approved 2026-11-02).

## Global Constraints

- Existing isolated checkout, branch `feat/privacy-request-fulfillment`; preserve unrelated root edits.
- No live migration, deployment, external messages or live disposal in this phase.
- Export digest covers `JSON.stringify(data, null, 2)` UTF-8 with no newline; evidence is outside those bytes.
- Explicit patient confirmation is an assertion of receipt, not evidence of reading or disk persistence.
- No new disposal authority; full erasure remains unsupported. Immutable old decisions are not backfilled.
- Shared export limiter, exact ownership, atomic audit/history, private narratives encrypted, metadata-only receipts.

## Review Focus

- Non-ASCII download bytes and nested dates: hash the exact saved JSON, not JSONB serialization (task 1).
- Concurrent confirmation/closure and retry after closure: preserve idempotence without admitting new evidence (tasks 1/2).
- Message-only disposal: never describe it as clinical-record deletion (task 2).
- New evidence appears inside later exports: prevent receipt self-reference and cross-patient disclosure (tasks 1/4).
- A browser refresh loses its download response: allow explicit receipt confirmation from owned history without pretending to redownload identical bytes (task 3).

## Task 1: Request-scoped exports and receipt confirmation

Files: add `backend/src/database/ordered/034_privacy_fulfillment_evidence.sql`, `backend/src/modules/privacy/fulfillment-evidence.service.js`, `backend/tests/privacy-evidence.integration.test.js`; modify `privacy-rights.service.js`, `privacy.routes.js`, `backend/scripts/private-runtime-grants.sql`.

Interfaces: `POST /privacy/requests/:id/export` accepts `{currentPassword}`, returns `{success,data,receipt}`. `POST /privacy/requests/:id/receipts/:receiptId/confirm` accepts `{received:true,contentHash}`. `evidenceForRequests(client, ids)` returns request-indexed `{exports,disposals}`; receipts contain `id,requestId,patientId,contentHash,byteLength,schemaVersion,scope,exclusions,preparedAt,confirmedAt`.

- [x] Add HTTP/DB regressions for missing route (404 before implementation), exact digest/bytes, ownership, password, no implicit confirmation, duplicate confirmation, malformed/forged fields and rollback.
- [x] Run `node --test tests/privacy-evidence.integration.test.js` in the isolated fixture and observe RED.
- [x] Implement additive tables, immutable guards/grants, export transaction hook, confirmations and owned list/export metadata. Preserve general export response.
- [x] Run focused HTTP tests and existing privacy/notice tests; expected all pass. Record RED/GREEN and commit `feat: record request-linked export receipts and patient confirmation`.

## Task 2: Evidence-required case completion and disposal associations

Files: evidence service, privacy rights/fulfillment service, routes, `backend/tests/privacy-evidence.integration.test.js`, existing rights tests.

Interfaces: `POST /privacy/requests/:id/disposals` officer-only `{disposalId,explanation}`. Closure `action` is `{type:'export_receipt',receiptId}` for access/portability or `{type:'disposal_evidence',disposalIds:[...]}` for partial erasure. `validateCompletion(client,req,row)` returns server-derived action provenance. All mutations lock case first; disposal locks sorted.

- [x] Add RED tests for narrative-only completion, prepared/unrelated receipt, pending/wrong-patient/old/superseded disposal, outstanding cleanup, message-only claims, no full erasure, legacy preservation and closure races.
- [x] Implement linking, current disposal evidence, completion validation, explicit legacy display metadata and bounded validation; retain existing restriction/correction behavior.
- [x] Update existing success fixtures to use actual confirmed evidence; run affected privacy/retention suites and commit `feat: require verified evidence for privacy case fulfillment`.

## Task 3: Patient and officer evidence controls

Files: `frontend/src/api/privacyApi.js`, `frontend/src/pages/privacy/PrivacyCenter.jsx`; add focused `RequestEvidence.jsx` and rendered tests; extend `PrivacyCenter.test.jsx`.

- [x] Add RED rendered tests for request download, unconfirmed/confirmed history, explicit confirmation, password clearing, errors/retry, reviewer confirmed-receipt selection and disposal association/selection.
- [x] Use exact saved serialization, no automatic confirmation; show limited scope and pending cleanup. Generic export unchanged. Show historical closed decisions without inventing evidence.
- [x] Run frontend suite, lint, theme check and build; commit `feat: show privacy fulfillment evidence in patient and officer workflows`.

## Task 4: Privileges, upgrade/recovery, inventory and review

Files: new evidence runtime/recovery integration tests; governance inventory/control matrix/lifecycle, privacy fulfillment docs and release evidence.

- [x] Add RED tests for restricted API immutable timestamps/rows, backup read-only access, both provisioning orders and schema layouts, 033 upgrade/replay preserving old decisions, encrypted backup/restore exact evidence and explanations.
- [x] Update migration/export/catalog references and inventory for three new tables; no edits to old SQL migrations. Correct issues exposed by tests.
- [x] Run backend unit and full integration suites, frontend suite/lint/build, syntax and governance checks; record exact results and limitations.
- [x] Obtain fresh whole-branch review; reproduce actionable findings with failing regressions and fix them. Commit coherent recovery/governance evidence and review fixes.

## Execution ledger

Use ignored `.local/release-mandatory/privacy-fulfillment-progress.md` for task boundaries, actual commands/results and rulings. Reuse existing isolated test containers/images; no dependency installation or credential loading on the host. This equivalent native ledger avoids platform-specific shell helpers while preserving their task/base/test records. User explicitly authorized implementation, so execute continuously without another plan approval pause.
