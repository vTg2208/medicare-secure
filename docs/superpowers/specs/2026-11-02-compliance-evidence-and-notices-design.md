# First-statement engineering: evidence, data lifecycle and privacy notices

Status: proposed design for owner approval. No product implementation or live change is included in this design commit.

## Intent and scope

Complete the four missing engineering areas identified for the first sentence of the supplied problem statement: a reviewed control-to-evidence matrix, a current data-lifecycle inventory, versioned patient-facing processing information with acknowledgement evidence, and a clear boundary between application safeguards and external assurance. The existing healthcare workflows remain the foundation. This milestone does not claim that the later sentences' unfinished rights-fulfillment, emergency-review, clinical or advanced features have been implemented.

The user requested complete engineering for this sentence, tests for changes and meaningful commits, and meaningful conventional branch names. Work uses the existing isolated release checkout on `feat/compliance-evidence-and-notices`, based on main documentation revision bef34da; deployed application behavior was last verified at 3f3d3a9. The original workspace contains unrelated edits and must not be staged or reset wholesale.

## Existing behavior and constraints

- Express/React/PostgreSQL, with 32 ordered checksum-tracked migrations, a private healthcare schema, separate migration/API/backup principals, strict transactional audit evidence and synthetic integration fixtures.
- Existing patient Privacy Center supports rights requests, controls and an authenticated structured export. Existing consent grants are independently purpose/category/time/permission scoped.
- No published-notice version or acknowledgement ledger exists. Public registration already creates a pending account/profile before OTP verification; a click by an anonymous registrant is therefore not reliable evidence of an authenticated patient's acknowledgement.
- Some classification/runbook text refers to older tables, fixed retention figures or quiesced/database-only backups. Actual storage uses bounded encrypted PostgreSQL objects and coordinated B2 capture/recovery. Ordinary clinical columns are not all application-encrypted; provider volume encryption must remain a separate evidence requirement.
- Live scanner operation, actual external email/alert delivery, provider safeguards, operator contacts and organizational approvals must not be invented. No paid resource, live notice publication, production migration, secret change or external message is authorized by this implementation design.

## Approach

Recommended: implement the notice/version/receipt workflow in the existing application and database, with machine-checked inventory and evidence documents in the repository. This reuses current identity, officer authorization, audit, migrations, export, backup and frontend styling.

A documentation-only update would leave the missing patient-facing workflow and provenance unresolved. A separate policy/consent platform would add another trust boundary and credential without serving this project's needs. A mandatory acknowledgement gate on all care access would conflate transparency with medical-data consent and introduce unnecessary availability risks. Those alternatives are not selected in this proposal.

The recommended workflow is nonblocking for existing care, authentication, emergency access, rights requests and exports. Acknowledgement means "I have read this notice"; it does not create consent, waive rights, assert a legal basis or authorize a new recipient. Public collection pages make the published notice easy to read; existing verified patients can acknowledge it explicitly after authentication. Real-use promotion requires the owner to publish approved accurate content; synthetic examples are test fixtures only.

## Deliverable 1: control and evidence matrix

Add a version-controlled structured matrix and a readable report. Each control has a stable ID, framework/principle reference, scope, source implementation references, named verification scenarios, known limitations, evidence kind, external dependencies and accountable owner role.

Represent application implementation, automated verification and external operational evidence separately. File/test existence is structural validation, not proof a test passed. Observed results retain the actual revision/date/report or CI link. External assertions are labeled owner/provider evidence, not machine verification. No numerical "compliance score", automatic certification or all-green default is introduced.

Start from the implemented access, confidentiality, integrity, traceability, consent, privacy, retention, incident and recovery controls; mark incomplete later-sentence workflows accurately. Map to the official GDPR text and HHS Security Rule guidance as engineering references, not as a decision about legal applicability:

- https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679
- https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html
- https://www.hhs.gov/sites/default/files/ocr/privacy/hipaa/administrative/securityrule/techsafeguards.pdf

Provide an offline check command for matrix structure, valid local source/test/evidence references and required external-status fields. Add CI triggers for changes to the governance artifacts/checker. A control with pending external evidence must never render as operationally verified merely because it has a test reference.

## Deliverable 2: complete inventory and lifecycle map

Track every migrated application table, including the migration ledger and the new notice tables. For each table, identify its data categories, column inventory/sensitive overrides, processing purpose, responsible owner, permitted application audience, application encryption boundary, provider encryption dependency and retention/disposal strategy.

Validate coverage against an actual freshly migrated PostgreSQL catalog in integration tests, in both supported schema layouts. New, removed or changed unclassified tables/columns fail validation. Inventory inspection reads metadata, never live row contents. Include storage outside tables: encrypted-object staging, backups, application/monitoring logs, email delivery and optional AI working memory/provider calls. Record actual destinations only where known; otherwise record that configuration/owner evidence is required.

Document collection -> authorization/use -> sharing/export -> retention/hold -> disposal/backup expiry/recovery. Explain unsupported lifecycle categories and retained workflow dependencies honestly instead of assigning invented legal periods. Update the old data-classification document and architecture/backup descriptions to match this inventory. Do not delete historical release evidence.

The initial metadata manifest may be generated from a disposable schema, then reviewed and committed. Generated counts are not hardcoded as the verification contract; exact catalog coverage is. No database rows or credentials are committed.

## Deliverable 3: versioned public notices and patient receipts

### Publication model

Use the next additive ordered migration; never change earlier migration bytes. Store immutable published notice versions, one current-version pointer, and append-only acknowledgement receipts. Reuse existing governance/audit conventions where appropriate. No external notice service is introduced.

Only a compliance officer can publish. A notice contains a title and plain-text structured sections: responsible operator and privacy contact; purposes and reviewed processing-basis explanation; categories and recipients/providers; retention/disposal boundaries; transfer/provider circumstances where applicable; patient rights/request routes and complaint contact; security boundaries and human review/approval basis. Validate size, required content and contact format; escape text through React and do not render user-supplied HTML. Optional sections must have an explicit reviewed "not applicable" explanation rather than silently disappear.

Publication is explicit and auditable. The form permits editing/preview before submission; no public draft is created. A server/database-derived content digest identifies the immutable content. A serialized transaction creates the new version, advances the current pointer and appends the publication audit event. Audit failure rolls everything back. The pointer cannot move backward to an older version through ordinary application privileges. Historical versions stay readable at stable version URLs. Normal API credentials cannot update/delete version contents or receipts.

No production notice is seeded and no fabricated operator/contact appears. An unconfigured installation returns an explicit "notice not published" state. Existing officer accounts can still authenticate to configure it. No acknowledged/compliant state is fabricated for legacy patients.

### Public and patient behavior

- A public notice page shows the current published version and can display a specific historical published version. Anonymous callers cannot inspect receipts, drafts, internal evidence or patient identifiers.
- Add visible links from public registration/sign-in and the existing patient Privacy Center, using the current design system. A missing notice is displayed honestly and remains a real-use readiness issue; it does not silently manufacture a policy or stop emergency care.
- A signed-in patient can explicitly acknowledge the displayed current version. The server derives patient identity from the session, checks that the version is still current and stores the exact content digest and database timestamp. The client cannot supply another patient's identity or a forged acknowledged time/digest.
- Duplicate acknowledgement is idempotent. A version replaced between reading and submission produces a conflict requiring the patient to read the new current version. Acknowledging a new version leaves the previous receipt unchanged.
- The patient can read their own receipt history and current-version acknowledgement status. A new version is shown as not yet acknowledged. Viewing a notice alone creates no receipt.
- Include owned acknowledgement history and the associated notice version/content provenance in the existing authenticated patient export. Do not expose other patients' histories.
- Retain the existing consent workflow unchanged: acknowledgement creates zero consent grants or permission changes and does not release restrictions/holds.

The publication and acknowledgement routes use the existing auth/role/error/rate-limit/audit patterns. Publication and receipt mutations commit with their audit evidence. Public notice reads need not generate clinical audit entries, since the content contains no patient data. Requests that include unsupported identity/permission fields are rejected.

### Database/operational integration

Update the private-runtime grant template narrowly: API SELECT/INSERT for immutable rows, only required pointer operation, no UPDATE/DELETE of historical versions or receipts; backup reader SELECT; public Data API roles have no table rights. Preserve support for private and public application schemas in isolated tests. Backups include these tables automatically; receipt rows are encrypted by the backup envelope. Update the inventory, restore tests and documentation for the new migration.

Do not apply this migration or publish a notice on the live app as part of the implementation phase. Produce a reviewed upgrade/rollout procedure: backup, additive migration, effective-privilege verification, API/frontend deployment, owner publication, patient acknowledgement/export check and recovery verification. A later merge/deployment request can authorize executing that procedure. Keep publication content under the operator's review.

## Deliverable 4: external-assurance boundary

Publish an operator checklist with evidence needed, responsible role and honest initial state for provider storage encryption, signing/application/backup key custody and rotation, SMTP/scanner/incident delivery, retention approvals, workforce review, provider agreements and intended-host acceptance. Reference completed B2/application recovery evidence rather than listing backups as unimplemented.

State existing limitations explicitly, including synthetic demonstration scope, scanner configuration, free-host availability, application-key lifetime and unresolved later-sentence features. The feature must not label the installation suitable for real patients solely because a notice was published or acknowledged.

## Verification and meaningful commit sequence

1. Design/approval and implementation plan. Preserve unrelated root edits.
2. Inventory/control evidence, validators, lifecycle/assurance documents and metadata-catalog regressions; coherent commit after checks.
3. Notice migration/service/API with real HTTP/PostgreSQL regressions and export integration; coherent commit after checks.
4. Public notice, officer publication and patient acknowledgement/history UI with rendered behavior tests; coherent commit after checks.
5. Complete regression/CI validation, independent review, fixes and current release evidence; synchronize only reviewed paths back to the original workspace after collision checks.

Use test-first behavior changes. Required cases include role/anonymous denial; historical immutability; failed-audit rollback; concurrent publication; current-version race; forged identity/hash/time; duplicate receipts; owned receipt export; no consent creation; unconfigured notice; escaped malicious text; missing/invalid publication fields; false external-assurance claims; unclassified table/column detection; actual restricted API and backup privileges; fresh/upgrade/private-schema migration and backup recovery. Run appropriate full backend and frontend suites, lint/build/syntax/theme checks, and existing relevant backup/governance regressions. Run target execution in the existing bounded offline fixture containers; no live probing, real mail or provider/model calls are required.

## Completion criteria

The code, structured evidence and current documentation cover the four engineering gaps in sentence one. The notice workflow works end to end through the application, preserves exact history, is auditable and test-covered. Catalog/evidence drift is checked in CI. All external requirements remain explicitly unverified until actual evidence is supplied. Report exactly what passed and what has not been deployed; never describe this milestone as complete legal compliance or as completion of every other problem-statement sentence.
