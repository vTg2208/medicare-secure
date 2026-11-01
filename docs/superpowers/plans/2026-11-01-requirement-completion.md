# Healthcare requirement completion implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Close the source-confirmed gaps in the supplied healthcare problem statement and produce requirement-to-evidence traceability.

**Architecture:** Preserve the React/Express/PostgreSQL application and Medicare design tokens. Repair existing consent, clinical and encrypted-file boundaries. Add a focused privacy-governance module using transactional audit, encrypted request/incident detail, append-only notification history, authenticated subject exports and role-scoped casework.

**Tech Stack:** React, Node 24, Express, PostgreSQL, AES-256-GCM, existing test tools; no extra runtime or provider required.

**Spec:** `docs/problem-statement.md`

## Global constraints

- Demonstrate access control, confidentiality, traceability, consent-driven sharing and ethical use.
- Support patients, physicians, nurses, laboratory technicians, pharmacists and administrators.
- Preserve the shared Medicare theme, synthetic-only free deployment, disabled demo uploads/email/AI, private schema and least-privilege database role.
- Append ordered migrations; never change checksummed historical migrations or publish the original repository history.
- Do not send actual breach notices, submit regulator forms or make legal decisions automatically.
- Publish distinct, meaningful commits in the clean source repository; no secrets or private artifacts.

## Review focus

- A narrower consent or edit must not silently authorize another purpose, erase independent grants, or remove expiry.
- Terminal orders/prescriptions must not reopen, double dispense or complete without evidence under concurrency.
- Failed encryption/scanning/audit must not expose plaintext or return successful PHI responses without evidence.
- Notification histories must preserve attempts, deadlines, decisions and reasons; recording evidence is not sending a notice.
- Subject exports/casework must be owner-scoped, omit credentials/other subjects and preserve clinical retention and legal review.

### Task 1: Consent and purpose boundaries

**Files:** consent model/controller/validator, clinical-access middleware, hosted demo seed, unit/access integration tests.

- [x] Add regression cases for purpose spoofing, independent category/visit grants, missing expiry and invalid dates/updates.
- [x] Implement validated partial updates, independent grants, server-selected clinical/insurance purpose, evidence binding and canonical vitals aliases.
- [x] Run unit and PostgreSQL access tests, inspect history/revocation behavior, commit the focused changes.

### Task 2: Clinical correctness and visibility

**Files:** clinical forms, EMR/diagnosis/prescription/lab/imaging models/controllers, related-record viewer, record pages and targeted tests.

- [x] Pin actual UI/API payload mismatches, lost diagnostic history, terminal transition replay and omitted related clinical details.
- [x] Correct payload contracts, locked state transitions, visit consultation linkage and authenticated report visibility.
- [x] Verify concurrent dispense and evidence-required order completion; verify rendered clinical workflows; commit.

### Task 3: Confidentiality and durable traceability

**Files:** upload/credential/file crypto services, multer middleware, protected download and audit middleware/service, app route installation, tests.

- [x] Pin plaintext staging, ciphertext substitution and success-before-audit failure cases.
- [x] Use bounded in-memory intake and context-bound authenticated encryption; require durable audit before PHI delivery and transactionally audit touched mutations.
- [x] Verify fail-closed behavior and document legacy encrypted-file migration requirements; commit.

### Task 4: Privacy governance

**Files:** new ordered governance migration, privacy routes/service/policy/crypto module, compliance incident APIs and UI, privacy center UI and routes, governance integration tests.

- [x] Add deterministic deadline/decision tests and actual HTTP/database tests for subject boundaries, lifecycle, append-only evidence and secret-free export.
- [x] Implement encrypted, audited breach assessment and notification attempt logging; calculate GDPR/HIPAA reminder deadlines with explicit applicability/risk decisions.
- [x] Implement authenticated structured exports and owner-scoped access/rectification/erasure/restriction/portability/objection request review, including retention reasons and outcome history.
- [x] Integrate accessible Medicare-themed patient/compliance screens with explicit loading/error/empty states; verify and commit.

### Task 5: Evidence, operational gaps and release

**Files:** requirement matrix, architecture/threat model, retention/breach runbook, operational configuration/checks and deployment notes.

- [x] Map each mandatory clause to concrete implementation, tests, and any environment-only condition. Label advanced examples optional.
- [x] Correct confirmed misleading operational claims/alert configurations and cap application log growth.
- [x] Run backend unit/HTTP/PostgreSQL tests, frontend behavior/lint/theme/build, and relevant offline AI checks. Review the final diff and only publish verified source.
- [x] Report exactly what is demonstrated, what is disabled in the demo and which legal/hosting/operational prerequisites remain external.

Implementation verification: 175 backend unit tests, 141 Node checks with zero skips, 89 frontend behavior tests, backend syntax, frontend lint/theme/build, Prometheus validation and Compose configuration checks passed in the documented disposable environment. Independent review findings are closed. Cloud rollout and actual-patient operational/legal approval remain separate release conditions; see docs/requirements-release.md and docs/requirements-traceability.md.
