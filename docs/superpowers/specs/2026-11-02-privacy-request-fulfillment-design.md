# Privacy-request fulfillment evidence

Status: concrete design for review; product implementation has not started.

## Intent and scope

The user requested the remaining engineering work in sequence, starting with privacy-request fulfillment, with tests and meaningful commits. This first increment makes access/portability completion depend on a request-linked export and explicit patient receipt confirmation, and makes partial erasure fulfillment depend on completed, owned disposal evidence. It preserves the existing clinical restrictions/corrections behavior and the separate privileged disposal tool.

Work starts from main `0e51a908ba78d63f5316009ed08985725d94f35c` in the existing isolated checkout `.local/mandatory-release`, on `feat/privacy-request-fulfillment`. The original workspace has unrelated edits. This implementation phase does not deploy, run a live migration, send external messages, delete live data, or invent operator policies.

## Existing behavior

- Patients submit six request types. Officers move submitted requests into review and then record a terminal outcome; details/history are encrypted and audit writes are transactional.
- Restrictions, objections and rectifications already require an effective action. Access/portability currently accept narrative-only fulfillment. Erasure rejects full fulfillment but permits narrative-only partial fulfillment.
- Patient export confirms the current password, checks ownership and emits a structured JSON snapshot. It is not linked to a particular request and has no receipt acknowledgement.
- Retention approval and execution are separate. Only a database-owner operator can execute eligible disposal. Database disposal with pending attachments is not completed disposal. Policies, holds, active care and dependencies are rechecked by that tool.

## Approach

Recommended engineering choice: extend these existing services and screens with immutable metadata evidence, without retaining another copy of the patient's full export.

Alternatives considered: an encrypted server-side export artifact store would permit repeat downloads of an identical payload but adds sensitive storage, expiry, capacity and key-management scope; an officer-entered delivery note would not fix the evidence gap. The selected design binds an exact download digest to the authenticated patient and case and records explicit patient confirmation separately. It makes no claim that a browser saved a file or that the patient read every item.

The implementation uses Express, PostgreSQL and React already in the project. Internal names and component extraction are builder decisions; the behavioral contract below is fixed for review.

## Access and portability workflow

1. Patient creates a request; officer starts review. While the case is in review, the patient can choose **Download a copy for this request** and confirm the current password. The existing general download remains available independently.
2. A dedicated request-scoped export endpoint checks the signed-in patient's ownership, eligible request type and in-review state. It generates the existing complete supported structured export under the existing repeatable-read transaction, with verified ownership and all current exclusions. It records an immutable preparation receipt with request/patient identity, export schema version, generation time, scope/exclusions, exact UTF-8 download byte count and SHA-256. The returned receipt is an envelope sibling, not part of the bytes it hashes, avoiding self-reference.
3. Define one exact JSON serialization for the downloaded data (`JSON.stringify(data, null, 2)`, UTF-8, no added newline). The browser saves those bytes. The receipt, audit event and preparation history commit with the snapshot transaction before any data is returned; failure returns no export. New export attempts create distinct receipts; they never overwrite prior provenance. Apply existing patient export throttling across general and request-scoped exports.
4. Preparation is displayed as **Copy prepared; receipt not confirmed**. Neither a server response nor a browser download action marks delivery complete. After the response, the patient must explicitly choose **I received this copy**. This submits the returned receipt identifier and digest to an owner-only confirmation endpoint. Confirmation derives actor/time server-side, validates request/receipt/hash association and is idempotent. An unchecked, forged, wrong-patient, wrong-case or unknown receipt is rejected. Confirmation is a patient assertion of receipt, not proof of reading or disk persistence.
5. Refreshing the page exposes prior preparation metadata and confirmation state. If the patient no longer has the copy, they can generate a fresh one while the case remains in review. The UI must not silently confirm a prior attempt or require that the patient remember an opaque identifier.
6. An officer closing access/portability as fulfilled or partially fulfilled must choose one confirmed receipt belonging to that request and patient, and provide the existing resolution/basis. The server records the selected immutable reference in the encrypted outcome and history. It rejects preparation-only, unrelated, missing and fabricated evidence. A general export never automatically completes a case. Confirmation itself never closes the case.
7. Full versus partial satisfaction of a free-text request remains an attributed officer assessment of scope; code verifies the evidence and explicitly shows export exclusions. Binary attachments remain separate authenticated downloads. A structured export must not be labelled as proof that all attachments or an independently requested delivery channel were supplied. If those were required but not supplied, the officer must record a partial outcome and remaining scope.

## Erasure workflow

- The officer can associate reviewed disposal decisions with an in-review erasure request. Every decision must belong to the requesting patient. Links are immutable and auditable, with an encrypted explanation of the scope they address; linking does not authorize or execute deletion.
- Allow association with an approved decision or a decision executed after this request was created. Earlier completed disposals cannot be represented as a response to a later request. Superseded approvals cannot establish fulfillment. The UI shows current execution and attachment-cleanup states; associations can remain historical if an approval is later superseded, and a new valid decision can be linked without rewriting history.
- Retain the separate owner-only dry-run/apply disposal procedure and all policy/hold/ownership/quiescence checks. Add no HTTP deletion endpoint and grant no disposal authority to the application login.
- Partial fulfillment requires at least one linked decision in `completed` state with execution evidence, no outstanding cleanup for each selected decision, and exact patient ownership. The officer explicitly selects which completed decisions support the outcome; pending or superseded links are shown as uncompleted scope and cannot be counted as deletion.
- Snapshot selected resource types/identifiers, disposal identifiers, execution times and applicable policy identifiers into the outcome/history. Validate and lock the request and selected decisions during closure. Derive deletion statements from this evidence; never accept a caller's `clinicalRecordsDeleted` claim. If only messages/intake were disposed, do not claim clinical records were deleted.
- Continue to reject full erasure fulfillment because account-wide/category-wide and historical-backup erasure are outside the current disposal scope. Partial outcomes must state the limited resources removed and what remains. Retained/declined decisions remain possible with their actual basis and do not assert deletion.

## Persistence, authorization and compatibility

- Add migration 034 with append-only export-preparation receipts, patient confirmation records, and request/disposal associations. Use foreign keys, bounds, unique confirmation-per-receipt constraints, database-derived timestamps and immutable-row protections. Sensitive explanations remain encrypted with identity-bound contexts; receipts store no export payload, password, bearer token or private key.
- Bind patient identity to the request and receipt in database constraints where practical as well as service checks. Preserve separate migration/API/backup principals. API privileges cover only required reads/inserts and no update/delete/truncate of immutable evidence; backup remains SELECT-only; browser database roles have no direct access. Update both migration-time grants and later provisioning templates, without modifying older migrations or revoking existing backup sequence privileges.
- Request state/evidence changes, encrypted history and audit append atomically. Concurrent closure, confirmation and export preparation must serialize on the request so no new preparation/confirmation silently lands after closure. Retries preserve receipt-confirmation identity. Lock disposal rows in a stable order to avoid deadlocks. Reject malformed identifiers, unexpected keys and unbounded association lists.
- Existing terminal requests are not rewritten or supplied with fabricated evidence. Their UI identifies decisions without linked evidence. Existing open requests must satisfy the new rules for future completion. Existing general exports and restriction/correction workflows retain their contracts.
- Patient history and subject exports include only their own evidence metadata and selected outcomes. Officers see the necessary case evidence but gain no patient-export endpoint. Do not expose private internal disposal review narratives to patients; publish only the case explanation and minimal provenance appropriate to that patient's request.
- Extend the checked inventory, lifecycle map, control matrix, guarded browser-upgrade export, and backup/recovery coverage for the new tables. Metadata evidence remains distinct from an assertion of legal delivery or compliance.

## Screens

Extend the Privacy Center rather than creating a second case-management application. Patient request cards show preparation, explicit receipt confirmation, selected fulfillment evidence and retained scope. Officer cards offer confirmed receipt selection for access/portability and reviewed disposal associations plus completed-evidence selection for erasure. Empty, loading, permission-denied, conflict and retry states must be explicit. General export continues to work. Use the existing accessible form patterns, theme and error reporting.

## Verification and commits

Develop each behavioral change with a failing regression first, then implement and run the affected checks. Planned coherent commits:

1. Design and implementation plan.
2. Request-scoped export receipts and patient confirmation, with migration/privileges, ownership, immutable evidence, hashing and atomic rollback tests.
3. Officer completion gating and completed-disposal associations, with state/race/ownership/cleanup/legacy tests.
4. Patient and officer UI flows with rendered tests and API contract checks.
5. Recovery/inventory/documentation evidence and any review fixes, separated where meaningful.

Required cases include: narrative-only fulfillment rejected; wrong patient/role/case/hash denied; password and rate limits preserved; preparation does not imply confirmation; duplicate confirmation idempotent; closure races; audit failure rollback; no secret/other-patient export leakage; approved/database-disposed/pending-cleanup/superseded disposals rejected as completed; partial message-only disposal never described as clinical erasure; full erasure still rejected; legacy terminal records preserved without manufactured evidence; independent restriction/correction regressions; both supported database schemas/runtime provisioning orders; exact evidence and encrypted explanations surviving coordinated backup/restore.

Run the backend unit and HTTP/database suites, frontend rendered suite, lint/build and governance catalog/reference checks in isolated synthetic fixtures. No live credentials or patient data are required. Record actual test counts, failures and limitations rather than extrapolating from a build.

## Deferred sequence

After this increment, continue the requested backlog in order: deadline/extension/escalation workflow; broader retention coverage and disposal-aware restore reconciliation; safe encryption-key rotation; reviewed minimization changes and credential/object cleanup hardening. Live scanner/mail/alert configuration and real operator policies remain distinct dependencies. This design does not claim those follow-on items are completed.
