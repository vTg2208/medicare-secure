# Retention, holds and controlled disposal

There is no built-in legal retention duration. At `/compliance/retention`, a compliance officer publishes a versioned policy with an explicit record category, clinic scope, period in days, jurisdiction and reviewed basis. An empty clinic applies only to standalone records, care correspondence and AI intake. Clinic-linked records require a matching clinic-specific policy. Policy and legal-hold explanations are encrypted.

Expiry is measured from the most recent retained activity, including clinical corrections, related result/prescription activity and linked visit closure. Active care, active diagnoses/prescriptions, legal holds and inconsistent attachment identities block disposal. A report or prescription still referenced by a retained laboratory, imaging or medication workflow is blocked for coordinated review; this tool does not silently sever those dependencies. Retained governance and audit evidence is outside this clinical disposal scope.

An officer can approve eligible medical-record graphs, individual care messages and completed AI intake sessions. Approval never deletes data and exposes no HTTP execution endpoint. Patients cannot release legal holds. Subject exports include the patient's disposal status evidence.

## Operator procedure

1. Identify the approved decision and its exact scope. Confirm the applicable policy with the responsible organization. Retain required legal evidence and a reviewed recovery/disposal ledger independently of the application host.
2. Stop application traffic and all writers, including scheduled jobs. The tool does not stop them for you. Use separate migration/database-owner credentials; the normal API role cannot apply disposal.
3. Load explicit `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` and certificate-verified `DB_SSL`/`DB_SSL_CA` settings. The script does not load `.env`. Remote connections require verified TLS.
4. Preview: `node backend/scripts/retention-dispose.js <approved-decision-UUID>`.
5. Only after review and write quiescence, set `RETENTION_DISPOSAL_ENABLED=true` and `RETENTION_WRITES_QUIESCED=true`, then rerun with `--apply`. This is irreversible data disposal. Tests run it only in disposable synthetic databases.
6. If encrypted attachments exist, the decision remains `database_disposed`. Set the correct durable `UPLOAD_PATH`, preview `--cleanup-files`, then use `--cleanup-files --apply`. Failed cleanup remains retryable; do not treat pending encrypted files as removed. Symlinked, unsupported or plaintext files are refused. Unrelated files are never traversed or removed.
7. Verify the completed decision, retained audit event and removed targeted resource. Resume writers only after reconciling every pending cleanup item and preserving the disposal ledger.

Execution rechecks the current policy, record ownership, expiry, holds and care state inside a transaction with locks. Only the database owner may temporarily disable the exact retained-row deletion guard; all clinical/audit integrity triggers remain enabled. The guard is restored before commit. Failed audit or deletion rolls back data, decision status and trigger changes together. A changed policy requires fresh approval.

Backups can contain older copies. Apply the organization's approved backup-expiry policy and reconcile the independent disposal ledger before making restored information available. This tool does not claim to erase off-host backups, documents outside supported storage, retained workflow dependencies or all information about a patient.
