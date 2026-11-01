# Compliance evidence and privacy notices implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the approved first-statement engineering: verified data/control inventories, immutable public notices, owned patient acknowledgement history and honest operational-assurance boundaries.

**Architecture:** Reuse the existing Express/React application, checksum-tracked PostgreSQL migrations and transactional audit evidence. Tracked metadata records describe the schema and controls; a checker validates references and a catalog integration test prevents classification drift. Notices are globally published by the existing platform compliance officer; historical versions/receipts are immutable and acknowledgements are separate from consent.

**Tech Stack:** Node 24, PostgreSQL 17/18, React 19, existing Vitest/Node integration tests, no new dependencies.

**Spec:** ../specs/2026-11-02-compliance-evidence-and-notices-design.md (user approved on 2026-11-02 IST).

## Global constraints

- Use feat/compliance-evidence-and-notices in the existing isolated .local/mandatory-release checkout. Preserve unrelated original-workspace edits.
- No live migration, notice publication, paid resources, real notifications or production secret changes.
- Never equate notice acknowledgement with consent, a waiver or certification. Existing care/auth/emergency/rights/export remain available.
- No seeded production notice or fabricated operator contacts; all examples belong in synthetic test fixtures.
- Append migration 033; do not edit previous migrations. Preserve public/private-schema operation, API/backup role boundaries and authenticated backups.
- Separate structural evidence checks, actual observed test reports and owner/provider assertions. No invented retention periods or compliance percentages.
- Meaningful commits per completed/tested deliverable; independent whole-branch review at the end.

## Review focus

- Publish/read/acknowledge races: stale-page acknowledgement must conflict and simultaneous publications must serialize.
- Audit failures: publication/current pointer/receipt must roll back together.
- Old-version/private-history access: public historical notice content is readable; other-patient receipts are inaccessible.
- Metadata drift/false assurance: adding a table/column or claiming operational verification without evidence must fail checks.
- Malicious/oversized notice text and unconfigured installations: text is escaped, input is bounded, missing publication is explicit and clinical access remains unaffected.

## Task 1: data and control evidence

**Files:** docs/compliance/data-inventory.json, control-matrix.json, data-lifecycle.md, operational-assurance.md; backend/scripts/governance-evidence.js; backend/tests/unit/governance-evidence.test.js; backend/tests/governance-inventory.integration.test.js; backend/package.json; docs/devops/data-classification.md; docs/architecture-threat-model.md; .github/workflows/backend-ci.yml.

**Interfaces:** `checkEvidence({root,inventory,controls})` returns summary or throws; `verifyCatalog(client,inventory,schema)` reads only catalog metadata and rejects table/column drift. Inventory stores table columns plus classification/purpose/owner/audience/applicationEncryption/providerEncryption/retention. Matrix stores stable IDs, framework references, source/tests/evidence/limits/owner/external requirements.

- [ ] Write unit regressions for bad references, missing external-evidence state and a forged verified assertion; observe RED.
- [ ] Implement minimal structural checker and initial reviewed control/data inventory; produce GREEN units.
- [ ] Generate column inventory from a disposable migrated schema; classify every table and non-table store. Add real catalog tests: exact coverage, new table, new column and wrong schema; observe RED then GREEN for verifier.
- [ ] Document collection/use/share/retention/disposal/recovery and external assurance; reconcile stale classifications/architecture.
- [ ] Add governance:check command and CI artifact path triggers; run units, catalog tests, syntax and metadata checks; commit feat(governance): track checked control and data lifecycle evidence.

## Task 2: immutable notice API and provenance

**Files:** backend/src/database/ordered/033_privacy_notices.sql; backend/src/modules/privacy/notices.service.js, notices.routes.js; backend/src/app.js; backend/src/modules/privacy/privacy-rights.service.js; backend/scripts/private-runtime-grants.sql; backend/tests/privacy-notices.integration.test.js; inventory/matrix from Task 1.

**Interfaces:** public GET /api/notices/current and /api/notices/versions/:id; officer POST /api/notices/versions; patient GET /api/notices/acknowledgements and POST /api/notices/acknowledgements `{versionId,acknowledged:true}`. Publication body `{title,operatorName,contactEmail,sections,reviewBasis}` with fixed section keys purposes,processingBasis,dataCategories,recipients,retention,transfers,rights,complaints,security. Public bodies contain immutable version ID/number/content/hash/publishedAt. Own history includes currentVersionId, acknowledgedCurrent and receipts with notice provenance. A missing current notice returns data:null; acknowledgement without a publication fails 409.

- [ ] Add HTTP integration tests expecting publication/current/history/ack/export; run RED on missing routes.
- [ ] Add 033 versions/current-pointer/receipt tables, generated SHA-256, immutable guards, monotonic publication trigger and narrow conditional grants. No seed content. Implement strict publication validation, officer checks and same-transaction audit.
- [ ] Implement owned patient acknowledgement, idempotency, current-pointer locking, historical reads and export. Reject extra identity/hash/time fields. No consent writes.
- [ ] Test invalid input/roles/anonymous/history ownership/stale version/concurrency/audit rollback. Test DB guards and actual API/backup role permissions in public and healthcare schema fixtures.
- [ ] Update metadata inventory and private grant template; run all units and notice/catalog/privacy/backup regressions; commit feat(privacy): publish immutable notices and patient receipt provenance.

## Task 3: rendered notice workflows

**Files:** frontend/src/api/noticeApi.js; frontend/src/pages/privacy/PrivacyNotice.jsx, NoticeGovernance.jsx, PrivacyNotice.css; frontend/src/routes/AppRoutes.jsx; frontend/src/pages/privacy/PrivacyCenter.jsx; frontend/src/pages/auth/Login.jsx, Register.jsx; matching frontend tests and existing navigation tests.

**Interfaces:** noticeApi exposes current/version/publish/acknowledgements/acknowledge using existing API client. Public /privacy-notice and /privacy-notice/:versionId; officer-only /compliance/notices. Patient Privacy Center links current notice and history; officer Privacy Center links publication. No clinical-route acknowledgement guard.

- [ ] Add rendered tests for unconfigured/public/current/historical notice, explicit patient acknowledgement, stale-version conflict, duplicate/loading states, escaped text and officer preview/publication; run RED.
- [ ] Implement pages using current semantic theme and accessible labels/status/errors. Officer input has preview and explicit publish. Public reads never acknowledge automatically. Show current-version status and owned historical receipts.
- [ ] Link sign-in/registration and Privacy Center; update intentional API mocks in existing affected tests.
- [ ] Run full frontend tests, lint, theme and build; commit feat(privacy): add notice publication and acknowledgement screens.

## Task 4: integrated verification and completion

**Files:** notice/catalog/runtime/backup regression suites; docs/compliance/rollout.md; current release report; matrix/spec/plan.

- [ ] Run full backend units/integration, frontend tests/lint/build/theme, syntax and governance checks, both schema layouts and matching-client backup recovery with new receipt rows.
- [ ] Prepare guarded migration rollout/grant verification procedure and exact observed results. Update status: external evidence remains pending, no live deployment claimed.
- [ ] Obtain one fresh whole-branch review; resolve material findings with RED/GREEN regressions and rerun relevant full suites.
- [ ] Commit reviewed fixes/evidence, synchronize owned paths to original workspace with baseline collision checks, leave no fixture containers or uncommitted implementation changes.

Plan self-review: all four approved deliverables are covered; the five review-focus conditions have explicit tests. Native execution follows the approved implement instruction; no additional scope/approval gate is introduced by this plan.
