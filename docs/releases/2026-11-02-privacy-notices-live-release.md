# Privacy notices: live release and recovery verification

Verified on 2026-11-02 (Asia/Kolkata). PR #9 was merged into `main` as `513cefd8a899bcefa92c1a328e7ec8767df3ff0a`. The merge tree exactly matches the tested feature revision `28e692b`. The authorized release applied migration 033 and verified publication, acknowledgement, history and export on the live demonstration installation. No real patient information or real legal notice was introduced.

## Deployment and migration

- Frontend: https://medicare-vtg.vercel.app; backend: https://medicare-secure-api.onrender.com.
- Render service `srv-dbj30sg473hc73b1iu00`, deployment `dep-dbjvhknavr4c73ci7820`; `/readyz` returned 200 with `X-Application-Revision: 513cefd8a899bcefa92c1a328e7ec8767df3ff0a`.
- Backend CI [41379236676](https://github.com/vTg2208/medicare-secure/actions/runs/41379236676), frontend/container CI [41379236691](https://github.com/vTg2208/medicare-secure/actions/runs/41379236691), and backup pipeline CI [41379236686](https://github.com/vTg2208/medicare-secure/actions/runs/41379236686) passed on the merged revision. Detailed implementation checks are recorded in [the implementation report](2026-11-02-compliance-evidence-and-notices.md).
- Applied the reviewed, guarded 032-to-033 upgrade to the existing private `healthcare` schema in Supabase project `ghselatqszqnoteqwyef`. Migration 033 SHA-256: `ac4515e95249f8f0727f48f12f7de7365b44eec11a54853faea91c461cb53804`. The ledger now has 33 entries and the schema has 62 tables. The existing encrypted-file budget remained 662 bytes.
- Before publication, the added notice tables contained no versions or receipts and the current pointer was null. Effective grants were checked: application publication privileges without history UPDATE/DELETE/TRUNCATE; backup table/sequence SELECT without writes; no notice access for `anon` or `authenticated`. No new credential or application-key disclosure to the backup worker was needed.

## Live API verification

The protected operator probe used the production frontend `/api` proxy, synthetic patient/officer/wrong-role accounts, and the existing credentials. All 11 assertions passed. It published two explicitly labelled demonstration-only notices and acknowledged both as the primary synthetic patient.

| Behavior | Observed result |
| --- | --- |
| Officer publication | Two immutable versions published; current pointer advanced to version 2. |
| Anonymous/wrong-role requests | Protected history and publication denied with 401/403. |
| Explicit, owned acknowledgement | False confirmation and caller-supplied identity rejected; duplicate acknowledgement retained the same receipt, time and hash. |
| Passive viewing | No acknowledgement created by reading a notice. |
| Version change | New version required its own acknowledgement; stale-version submission returned 409. |
| Historical provenance | Version 1 and its receipt retained their exact original content and digest. |
| Private review | Officer could read private review evidence; public notice, patient history and export excluded it. |
| Patient ownership | Other patient's initial history/export were empty; patient-selection query rejected with 400. |
| Export | Primary patient's two receipts contained exact version, content, hash and acknowledgement time. |
| Medical-data consent | Consent grants were identical before and after acknowledgement. |

Current version 2 is `83ef9e78-054b-4703-9bb2-38a1bce25233`; historical version 1 is `257050fd-0c62-4738-88e4-0504bf48d688`. The protected journal retains exact public content and receipt provenance. The probe logged out its newly created sessions.

## Rendered browser verification

Chrome verified the actual deployed screens after the connection was restored:

1. The public notice rendered the current version and its demonstration label.
2. The compliance officer opened the publication form and preview. Publish stayed disabled until explicit authority confirmation. The preview was exited without a third publication; actual publication was verified through the live API above.
3. The second synthetic patient initially saw no receipts and a disabled acknowledgement button. Explicit checking and submission displayed a saved receipt and history link. Returning to the page preserved it.
4. Password-confirmed export displayed success and produced `medicare-information-2026-11-02.json` in Downloads. The browser download-event observer timed out, but the actual saved file was independently read and verified: exactly one receipt belonging to that patient, exact current content/hash, no primary-patient receipt and no private publication review. The password field cleared.
5. The original synthetic patient still saw exactly its own two history links. Opening version 1 displayed the earlier-version label, original content, its acknowledgement time and a link to the current notice.
6. No browser warnings/errors were captured. Test sessions were signed out and the public notice was left open.

The browser check intentionally added one receipt for the second synthetic patient. Final state is two published versions, two primary-patient receipts and one second-patient receipt; the earlier empty-other-history API assertion describes the state before that browser action.

Screenshots and the exact synthetic receipt proof are retained in the ignored local operator directory `.local/release-mandatory/` (`notices-patient-ack-live.jpg`, `notices-patient-export-live.jpg`, `notices-historical-live.jpg`, `notices-officer-preview-live.jpg`, `notices-ui-verification.json`). Credentials and subject exports are not committed.

## Coordinated backup and application recovery

| Stage | Successful cloud run | Recovered inventory and application evidence |
| --- | --- | --- |
| Before migration | [41378499214](https://github.com/vTg2208/medicare-secure/actions/runs/41378499214) | 59 tables, 32 migrations, one encrypted uploaded file; original application key recovered login, PDF, messages, corrections and export. |
| After API publication | [41380491367](https://github.com/vTg2208/medicare-secure/actions/runs/41380491367) | 62 tables, 33 migrations, one encrypted file; both versions, primary receipts, exact provenance and private review decrypted successfully. |
| After browser acknowledgement | [41381867946](https://github.com/vTg2208/medicare-secure/actions/runs/41381867946) | 62 tables, 33 migrations, one encrypted file; all prior checks plus exact recovery of the browser-created second-patient receipt matched the downloaded JSON. |

Each run captured one coordinated database/object snapshot, uploaded to private B2, downloaded and restored it, verified the audit/ledger and performed retention rotation. The exact downloaded final archive is 360060 bytes, SHA-256 `096ba625973041d2414f5f803e6ea534fce0c850acc11f2ac16ff96d5ce87f3f`. Its object is `medicare-backups/daily/2026-11-02/97cb9557-73d3-43f0-b7ac-7e9a5f674169.shmsbkp`.

Separate local application recovery used a network-isolated, disposable PostgreSQL container and the preserved original application/archive keys through protected process input. Final checks passed for both patients' isolated receipts, exact notice hashes/content, encrypted private review, file accounting, patient login, anonymous file denial, clinical records, encrypted messages/corrections and fulfilled privacy reviews. The 626-byte synthetic PDF decrypted to SHA-256 `e72a7403547d406e2e3a5a234b07ce9f71dfe2cd50926f7a52d4875ff417c8de`.

The operator probe initially compared PostgreSQL Date objects directly to JSON strings; normalizing the serialization fixed that probe comparison, and the fresh final drill passed. This required no product change. The application key stayed outside GitHub Actions. Existing daily scheduling at 03:07 IST and archive retention settings were preserved. These manual runs do not assert that a later timed run has executed.

## Remaining real-use boundaries

The user delegated the demonstration-content choice. Both notices say **DEMONSTRATION ONLY**, identify synthetic use, and use the deliberately inactive `demo-notices@example.invalid` fixture. This is not an operational privacy contact or approved organizational/legal notice. Accurate reviewed operator facts and real contact details remain pending before real patient use.

Publication and acknowledgement are now implemented and live verified; acknowledgement grants no medical-data consent and establishes no GDPR/HIPAA certification. Provider arrangements/storage assurances, key custody/rotation, scanner service, actual mail/alert delivery, retention-policy approval and full recovery-promotion/availability acceptance remain the separate responsibilities listed in [operational assurance](../compliance/operational-assurance.md). The recovered PDF was previously operator-seeded synthetic data; ordinary uploads still fail closed while the live scanner is unconfigured.
