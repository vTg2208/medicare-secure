# Data inventory and lifecycle

[data-inventory.json](data-inventory.json) lists every migrated application table and column, its default classification and sensitive overrides, purpose, responsible role, application audience, application encryption boundary and retention strategy. It describes intended permitted use; runtime roles, ownership/care/consent checks and explicit query projections enforce access. A category label is not a database grant or an assertion that a provider encrypted its volume.

## Collection and active use

Patient/staff registration and reviewed onboarding collect identity/contact/profile and credential references. Passwords are bcrypt hashes; OTP/session/one-time-token verifier hashes and WebAuthn public verification material have distinct classifications. The existing staff invitation token column contains a bearer credential: it is not application-encrypted or a password hash. Access, expiration and one-time acceptance remain essential. A reviewed decision about identifier necessity is still required; a government-ID format/hash does not establish verified identity.

Authorized clinical workflows create visits, records, diagnoses, prescriptions, orders, notes and results. Ordinary relational clinical columns and optional AI conversation/summary rows are not all application-encrypted. They require restricted database access and provider storage-encryption assurance. Reports/credentials use identity-bound encrypted payloads; messaging, patient corrections and selected governance narratives use application envelopes. The inventory names encrypted columns rather than describing the whole database as application-encrypted.

The active clinical guard evaluates resource ownership, category, purpose, permission, active organization/care and assignment. Separately audited emergency read access is finite. Consent updates/revocation and processing restrictions affect future authorized operations. Information legitimately received earlier cannot be recalled by changing an access row.

## Sharing and secondary processing

Patients access owned information and authenticated report downloads. Clinical recipients require current care/consent authorization. Insurance uses its scoped workflow. Research endpoints return explicitly consented aggregates and suppress small cohorts; no row-level dataset anonymity guarantee is made. The legacy dataset/DICOM helpers must not be used as validated de-identification.

The subject export includes verified owned categories and separates authenticated binary downloads from the structured JSON. Notifications and configured email may carry identity or workflow information; actual provider delivery and retention are separate responsibilities. Optional AI sends bounded patient-initiated intake to its configured internal service and may use a separately approved external provider. No real model call is established by unit tests.

Known deployment paths are the private PostgreSQL application schema, the Render API, the Vercel frontend/proxy and the private Backblaze archive prefix `medicare-backups/`. These names are not evidence of approved agreements, physical location, lawful transfer arrangements or the providers' current encryption/access settings. Review those facts in the intended environment. Do not place credentials or patient rows into this inventory.

## Retention, holds and disposal

There is no universal duration built into this inventory. Versioned category/clinic policies, activity clocks, active care and legal holds determine eligibility for the implemented medical-record, care-message and completed-intake disposal types. Approval does not delete data; a separately privileged reviewed operator executes disposal and retryable attachment cleanup. Retained laboratory/imaging/medication dependencies can block a graph's disposal. Account/profile, verification, consent, audit and other independent categories require reviewed policies and handling beyond this disposal scope.

Governance evidence and audit payloads can include identifiers and clinical change snapshots. Integrity hashes are not encryption. Their access and retention must be reviewed independently of clinical-record disposal. Logs have bounded rotation, which limits disk usage but does not supply a legally approved retention schedule. The 64 MiB encrypted-object cap is likewise a quota, not a retention rule. Hard process failures can leave unreferenced completed ciphertext requiring owner reconciliation; do not silently purge it.

## Backups and recovery

The live coordinated worker captures rows, file references and encrypted PostgreSQL objects from one exported snapshot. SHMSBKP1 separately authenticates/encrypts the dump and file payloads. The worker has a restricted reader and the application-key fingerprint, not the application encryption key. Staging/recovery data is private and job-scoped. Application reads, audit integrity, migrations and file hashes are checked in disposable recovery targets before archive pruning.

Managed archives retain one latest daily snapshot for seven distinct UTC dates and a first successful snapshot for three UTC months as they accumulate. The historical PGP snapshot is outside that managed naming policy. The current operating contract and actual [cloud/application recovery evidence](../releases/2026-11-01-durable-backup-activation.md) distinguish observed manual runs from future scheduled execution.

Backups can contain previously disposed data. Preserve the organization's independent disposal ledger, apply its approved backup-expiry policy and reconcile a restored installation before promotion. The restore command does not establish organization approval or erase every historical backup. Preserve the original application key and separate archive key outside the payload store; protected custody and rotation remain operator responsibilities.
