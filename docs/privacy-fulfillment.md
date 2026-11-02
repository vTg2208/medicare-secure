# Privacy decisions and effective processing controls

An officer cannot mark a restriction, objection or correction request fulfilled without selecting the action actually applied. The decision, encrypted explanation, action and history commit together; audit failure rolls back the action.

Restrictions can apply to treatment, research, insurance, AI intake, messaging or all of these. Existing consent does not override an active restriction. Research cohorts, insurance consent checks, clinical authorization, AI intake and messaging apply those controls server-side. Patients retain access to their own information. Justified, patient-specific, read-only emergency access remains a separately audited exception. A patient may release their own request-based restriction; this creates no consent and does not release any legal hold.

Clinical rectification appends an attributed, encrypted patient-requested correction rather than overwriting the original medical evidence. Corrections appear in clinical detail and subject exports. Officers can also correct explicitly allowlisted demographic fields, including date of birth and names. Credentials, role, account status, and government-ID fields cannot be changed through this workflow. Before/after demographic values remain in encrypted review history.

These controls implement recorded human decisions. They do not decide the applicable legal basis or automatically grant every request. Retention and disposal still require a separate policy, legal-hold check and authorized execution procedure.

## Request-linked copies and patient confirmation

Migration 034 adds immutable preparation receipts, patient confirmations and request/disposal associations. A patient with an access or portability request in review can request a password-confirmed structured copy specifically for that case. The preparation receipt records the request/owner, schema version, scope/exclusions, generation time, SHA-256 and UTF-8 byte count. It stores no export payload or password. The digest covers exactly `JSON.stringify(data, null, 2)` without a trailing newline; the receipt is outside the hashed download payload.

Preparing or downloading the copy does not mark it received. The patient explicitly selects **I received this copy**. Confirmation binds the session owner, receipt, case and hash, uses a database timestamp and is idempotent. It is the patient's assertion of receipt, not proof that the browser saved a file or that the patient read it. A confirmed retry can return its original evidence after closure; a new confirmation or export cannot be added to a closed request.

To mark an access/portability case fulfilled or partially fulfilled, the officer must select a confirmed receipt for that exact request. The outcome snapshots the selected evidence. General subject exports remain independent and do not close requests. Binary attachments remain separate authenticated downloads; the officer must assess the free-text request and record partial fulfillment if requested attachments, other categories or delivery channels remain outstanding.

## Limited erasure outcomes

An officer can link an owned disposal approval to an erasure review, with a patient-visible explanation of its limited scope. Linking does not execute deletion. A previously executed decision is eligible only if execution occurred after the request was created. Superseded approvals cannot support fulfillment.

Partial fulfillment requires explicitly selected linked decisions in `completed` state, with execution evidence and no pending attachment cleanup. The case outcome preserves exact resource, decision, policy and execution identifiers/times. A message-only or intake-only disposal does not claim clinical records were deleted. Full erasure fulfillment remains prohibited: other categories, retained audit/governance data and historical backups are outside this limited scope. Pending links remain visible and do not count as removal.

Only the separately authorized database owner executes the existing disposal tool; there is no new HTTP deletion endpoint. Closure, confirmations, preparation and association history are serialized against the request and audited transactionally. Audit failure rolls back changes and prevents export disclosure. History and evidence belong only to the requesting patient; private disposal-policy narratives are not exposed by case associations.

## Upgrade and verification

Migration 034 is additive; do not edit migrations 001–033. Existing closed decisions retain their original history and are identified as historical decisions without linked evidence. No receipts or deletions are fabricated on upgrade. Open cases must satisfy the new completion rules. Update the checked inventory (65 tables/718 columns), application role grants and existing backup-reader access together.

For the private installation, export and review the guarded upgrade using `node backend/scripts/export-browser-upgrade.js --from 033 --output .local/browser-upgrade-033-to-034.sql`. Apply only in a separately authorized deployment phase after successful pre-upgrade recovery. Verify exact migration hashes, no seeded evidence, immutable history/timestamps, restricted API writes and SELECT-only backup access. The public-schema role provisioner and private runtime grant template both preserve the evidence restrictions when run after migration.

Synthetic regressions cover exact non-ASCII download bytes, ownership/password/rate limits, explicit confirmation and retry, completion/confirmation races, audit rollback, disposal execution and pending cleanup, old decision preservation, both schemas/provisioning orders and actual encrypted coordinated recovery. Deadline extension/escalation, general disposal-aware restore reconciliation and broader retention categories remain separate work.
