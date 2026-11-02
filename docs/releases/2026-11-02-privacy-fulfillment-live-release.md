# Privacy-request fulfillment: live release and recovery

PR [#10](https://github.com/vTg2208/medicare-secure/pull/10) was merged into main as `f0ef2c2d4970a2da55059ce8f3a0523fcaaf469d` on 2026-11-02. Its tree exactly matches the tested feature revision `b679e02`. The user approved the live migration, merge, deployment and synthetic verification. No real patient information, credential changes, disposal execution or external notification was introduced.

## Deployment and migration

- Frontend: https://medicare-vtg.vercel.app, Vercel production deployment `9yYrAmPX2sgzLerknwA9vuKRAw8K`.
- Backend: https://medicare-secure-api.onrender.com, Render service `srv-dbj30sg473hc73b1iu00`, deployment `dep-dbkaj8fb9u1s73ck0r3g`. The service is live; `/readyz` returned 200 with `X-Application-Revision: f0ef2c2d4970a2da55059ce8f3a0523fcaaf469d`.
- Merged-revision [backend CI](https://github.com/vTg2208/medicare-secure/actions/runs/41470197981), [frontend/container CI](https://github.com/vTg2208/medicare-secure/actions/runs/41470198622) and [backup pipeline CI](https://github.com/vTg2208/medicare-secure/actions/runs/41470197576) passed. Local tests and independent source review are recorded in [implementation evidence](2026-11-02-privacy-request-fulfillment.md).
- Applied the reviewed, guarded 033-to-034 upgrade to the existing private `healthcare` schema in Supabase project `ghselatqszqnoteqwyef`. Migration 034 SHA-256: `d00f61ea29e953aa6da62b6f96a5d97f7560809e4e7279beaf3de89d142f7910`. The ledger has 34 entries and the schema has 65 tables; the checked inventory classifies 718 columns.
- Immediately after migration, the three new evidence tables were empty and the three existing closed cases were unchanged in count. No historical receipts were fabricated. Legacy preservation was separately tested during implementation.
- Effective privileges passed for all three new tables: application SELECT and allowed-column INSERT, without unrestricted INSERT, history UPDATE/DELETE/TRUNCATE or caller-controlled timestamps; backup SELECT without writes; no access for `anon` or `authenticated`. Existing credentials and keys were reused.

## Live API verification

The operator probe used the production frontend `/api` proxy with existing synthetic patient, other-patient, physician and compliance-officer accounts. It created one access case, one portability case and one explicitly non-destructive erasure guard case.

| Behavior | Observed result |
| --- | --- |
| Ownership and role boundaries | Anonymous, physician, wrong-patient and patient-as-reviewer requests denied. |
| General export | Did not create a request receipt or fulfill the case. |
| Request preparation | Password required; exact non-ASCII UTF-8 JSON bytes matched the stored digest and length. The receipt was outside its own snapshot. |
| Explicit receipt | False confirmation, incorrect hash and wrong owner rejected. Preparation did not confirm receipt. Confirmation did not close the case. |
| Completion evidence | Narrative-only completion, an unconfirmed copy and a receipt from another case were rejected. Selecting the owned confirmed copy fulfilled the access case. |
| Retry and closure | Repeated confirmation retained the same receipt/time after closure; new export preparation on the closed case was rejected. |
| History and export | Confirmed receipt and selected outcome persisted; other patient evidence was excluded. |
| Limited erasure | Full erasure, partial erasure without evidence and a nonexistent disposal association were denied. The synthetic case was recorded as retained, with `clinicalRecordsDeleted: false`. |

Positive completed-disposal association and partial-erasure execution were covered by isolated integration/recovery tests. This release did not execute a disposal or claim that positive destructive flow was exercised on production.

## Rendered browser verification

1. The second synthetic patient opened its portability request and downloaded a request-linked JSON file. The password field cleared; the receipt remained unconfirmed and the case remained in review.
2. The actual downloaded `medicare-information-2026-11-02 (1).json` was 22,959 bytes, SHA-256 `daddd995204bce2e24d0675dd1e67908671273982272a7352b6b1b9c4830ccbe`, exactly matching receipt `77959a03-c7c7-4070-9907-0c7b153f2c0b`. It contained no other-patient receipt and no self-referential preparation receipt.
3. The persisted unconfirmed receipt remained available after reauthentication. Selecting **I received this copy** recorded explicit confirmation and a fourth history event, while leaving the case in review.
4. The officer saw the confirmed receipt. **Save review** remained disabled until a receipt was selected. Selecting it and supplying the limited-scope resolution/basis fulfilled the request; the page displayed the exact selected receipt and five history events.
5. A separate authenticated API check verified the browser-created confirmation, selected outcome, fulfilled status, owned history and subject export. Sessions were signed out. No browser warnings/errors were captured.

The initial browser navigation needed a reload after slow loading. The download-verification probe's logout invalidated the patient's browser session through the existing all-session logout behavior; the browser was reauthenticated before checking persisted evidence. This required no product change. Screenshots, synthetic case journal and exact download proof remain in ignored `.local/release-mandatory/`; no credential or subject export is committed.

## Coordinated backup and application recovery

Before migration, [backup run 41468414526](https://github.com/vTg2208/medicare-secure/actions/runs/41468414526) captured and recovered 62 tables, 33 migrations and one encrypted uploaded file. The exact B2 object was downloaded and authenticated: 362,989 bytes, SHA-256 `5e909b06b5f6d83eeb873d5bfe443aae0ec824c42003a4c79018d330f94740dc`. A network-isolated application recovery using the original application key recovered login, PDF decryption, clinical records, messages, corrections, prior privacy decisions, notice versions and all prior acknowledgement receipts.

After both live cases were fulfilled, [backup run 41472467816](https://github.com/vTg2208/medicare-secure/actions/runs/41472467816) captured 65 tables and one encrypted uploaded file, uploaded the coordinated archive, downloaded and restored it, verified audit/ledger integrity and completed configured retention rotation. The exact downloaded archive was 396,883 bytes, SHA-256 `339109fefa2a6fc7cc6c4513926bd9e9d5b085a3f23504e30d8479c7eb1a4fff`, object `medicare-backups/daily/2026-11-02/42a58390-e605-4128-961f-276d127635cd.shmsbkp`.

A separate application recovery in a disposable network-isolated PostgreSQL container passed:

- All 65 tables and 34 migrations recovered; audit, ledger and encrypted-object budget verified.
- Both patient-confirmed fulfillment receipts recovered exactly, including the browser download's hash/length and timestamps; selected encrypted outcomes decrypted and retained their scope.
- Recovered patient requests/export excluded the other patient's receipt. The erasure guard case remained retained with no deletion claim.
- Prior notice versions, all three acknowledgement receipts and private notice review evidence recovered exactly.
- Patient login, authenticated synthetic PDF decryption, anonymous file denial, clinical records, encrypted messages and corrections continued to work. The PDF remained 626 bytes with its original digest.

Application and archive keys were supplied only to the isolated local recovery process through protected input. The application encryption key remains outside the GitHub backup job. Daily scheduling and retention configuration were preserved; these manual runs do not claim that a subsequent scheduled run has executed. Exact recovery proof is retained in ignored `fulfillment-after-recovery-41472467816.json` and the corresponding private console log.

## Remaining scope

The release establishes request-linked preparation, explicit confirmation and evidence-backed decisions. Receipt confirmation is an assertion of receipt, not proof of reading or durable browser storage. Structured-copy receipts do not establish binary attachment delivery, complete account erasure or deletion from historical backups.

Deadline extension/escalation, broader retention categories, disposal-aware recovery reconciliation and key rotation remain separate engineering work. Real operator facts, notice/contact approval, provider agreements and actual scanner/mail/alert integrations remain operational prerequisites. This demonstration does not establish GDPR/HIPAA certification or readiness for real patient use.
