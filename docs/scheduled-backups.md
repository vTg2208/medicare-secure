# Scheduled encrypted backup and recovery

The private demo's scheduler is `.github/workflows/encrypted-backup.yml`. It is enabled to run daily at **21:37 UTC / 03:07 Asia/Kolkata the next day**, plus manual dispatches. Coordinated database and uploaded-file backups are now activated; two main-branch executions passed their actual cloud recovery gates. See [current activation evidence](releases/2026-11-01-durable-backup-activation.md) and the [earlier database-only release](releases/2026-11-01-scheduled-backup-release.md). GitHub schedules are best-effort and may be delayed or prevented by platform/quota limits. The workflow runs only on `main`; scheduled executions require `BACKUPS_ENABLED=true`. One concurrency group serializes manual and scheduled runs.

## Consistency and scope

The live API uses FILE_STORAGE_BACKEND=postgres and the logical UPLOAD_PATH=/tmp/medicare-encrypted-uploads. The serialized worker uses BACKUP_MODE=coordinated, BACKUP_FILE_STORAGE_BACKEND=postgres and BACKUP_UPLOAD_ROOT with that same root. It captures references, encrypted objects and database rows from one exported repeatable-read snapshot. The remote worker needs no Render filesystem mount. See [coordination and durable storage](coordinated-file-backups.md).

`npm run backup:online -- /protected/output.shmsbkp` remains an explicit database-only option for fileless installations. It checks the checksum-tracked migration ledger, all known document/report file reference columns, pending file cleanup, durable-object inventory and table readability inside one PostgreSQL repeatable-read transaction. Unknown file reference columns, nonempty references or stored durable objects fail closed. pg_dump imports that exact exported snapshot, so concurrent commits cannot produce a mixed backup. No code claims application writes were stopped. The legacy `npm run backup` database-plus-upload command requires real write quiescence.

The custom dump includes the application schema and its three required extensions. Their namespaces and per-table row counts are authenticated inside the existing SHMSBKP1 envelope. Required supported extension namespaces are created in a fresh disposable restore database before pg_restore. The snapshot deliberately omits PostgreSQL login roles and provider-owned schemas; an operational promotion must provision the intended restricted roles separately.

Database-only mode refuses the live demonstration's stored file. Coordinated filesystem mode requires a worker with the application's real persistent upload volume; coordinated PostgreSQL mode reads durable ciphertext through the database connection. Deploy the shared mutation gate to all writers before activating either mode. Do not enable `BACKUP_QUIESCED` merely to suppress a failure.

## Credentials and privileges

Provision the reviewed `backend/scripts/backup-reader-role.sql` template with a newly generated strong password. It creates only `healthcare_backup`, refuses an existing principal, grants connection/schema usage and SELECT on application tables/sequences, and grants SELECT on future objects created by the provisioning owner. It cannot insert, update, delete, create tables, create roles or bypass row security. Default read-only transactions and a two-connection limit provide further constraints; the SELECT-only grants remain effective even if a client turns off read-only transactions. Backups fail if RLS or future ownership changes prevent complete reads.

The worker receives only this database login, the file-only B2 key, a separate backup encryption key and the application encryption key's SHA-256 fingerprint through this private repository's encrypted Actions secrets. **The B2 master key and actual application encryption key are not installed in the worker.** The fingerprint checks key separation but cannot decrypt application-encrypted fields. Preserve the original application key separately for application recovery.

Secret names: BACKUP_DB_HOST, BACKUP_DB_PORT, BACKUP_DB_NAME, BACKUP_DB_USER, BACKUP_DB_PASSWORD, BACKUP_DB_SSL_CA, BACKUP_ENCRYPTION_KEY, BACKUP_APPLICATION_KEY_SHA256, BACKUP_B2_KEY_ID, BACKUP_B2_APPLICATION_KEY and BACKUP_B2_BUCKET_ID. Public connection metadata is also treated as secret to keep the job log minimal. Dependencies are installed with lifecycle scripts disabled before these secrets become available to the execution step.

## Recovery gate and retention

`npm run backup:scheduled` creates a fresh encrypted database snapshot and uploads a daily copy. It downloads that exact B2 version, compares its ciphertext checksum, authenticates its envelope, and restores it into a newly named loopback-only PostgreSQL recovery database on the runner. The recovery database uses memory-backed storage, has a disposable password, publishes only a localhost port and suppresses statement/error-detail logging. No backup payload is uploaded as a GitHub Actions artifact.

The gate verifies the restored table inventory and every table's row count, the current migration checksums, audit payloads against actual rows, each audit hash/link and the retained chain head. Coordinated mode also verifies every recovered file/reference and pending cleanup entry; PostgreSQL mode additionally verifies restored ciphertext rows and budget accounting. Modified/missing files or audit payloads, lost rows, failed SQL restores or bad downloads fail the job before old versions are pruned. The disposable database and file tree are removed after verification. Required backup points remain protected on failure; an incomplete upload may leave additional ciphertext versions for inspection.

The first successful backup each UTC month also receives a monthly copy. The archive tool retains one latest snapshot per daily date for seven distinct dates and one per month for three distinct months. Prior retained bundles are authenticated before exact expired B2 versions are deleted. An older snapshot cannot replace a newer snapshot on the same day. Unknown filenames, including the earlier PGP deployment snapshot, are not policy deletion targets. See [archive limits and cost boundaries](backup-archives.md).

## Activation and verification

After CI/review and the main-branch merge, configure the scoped secrets while leaving the schedule disabled. Dispatch a real main-branch run and inspect the **Encrypted healthcare backup** run's summary. Only enable `BACKUPS_ENABLED=true` after its cloud download/restore gate passes. Dispatch a second fresh run to exercise actual same-day duplicate-version pruning. A future scheduled run is not claimed as observed until it actually executes.

The Actions run status and its generic failure log provide operator failure reporting. GitHub's account notification preferences control additional native workflow notifications; this implementation does not claim an email, SMS or external incident alert was delivered. No outbound clinical data notifications are sent.

Complete a separate application recovery check using the downloaded current archive and the preserved original application key in an isolated local deployment. The nightly worker verifies database recovery without needing access to decrypted clinical narratives. Record the live run links, source revision, restored table/migration counts and recovery duration in release evidence, never patient contents or key values.

The final activation status and observed run evidence belong in the release report; this guide describes the operating contract.
