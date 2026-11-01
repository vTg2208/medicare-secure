# Encrypted backup and recovery drill

For automatic capture with uploaded files, use the [coordinated file backup command and rollout procedure](coordinated-file-backups.md). It acquires a real shared-writer/exclusive-backup lock and imports one PostgreSQL snapshot. The manual tools below remain available for a deployment whose writes have actually been stopped.

The manual tools back up the PostgreSQL database and the application's encrypted upload tree together. They do not configure a host, cloud service or scheduler. A scheduler can invoke the same backup command after it has stopped writes and loaded secrets into the process environment.

For the hosted demonstration with no external files, the explicit [scheduled database-only snapshot mode](scheduled-backups.md) uses an exported PostgreSQL snapshot and refuses external-file references. It does not require application downtime or claim that writes were quiesced. Its authenticated custom dump uses the same restore tooling described here, including supported extension namespace provisioning. Consult the release evidence for the actual activation status.

`backend/scripts/backup.js` streams `pg_dump --format=custom` directly into an AES-256-GCM envelope. A plaintext database dump is never written to disk. The encrypted manifest records each payload's path, size and SHA-256 hash. The envelope authenticates the manifest, dump and encrypted uploads together. An incomplete or failed dump is never published as a backup; an existing backup is never replaced.

Only `UPLOAD_PATH/documents/*.{pdf,png,jpg,jpeg}` and `UPLOAD_PATH/medical_files/<patient UUID>/{lab_results,imaging}/<report>` are supported. Files must have the application's `SHMSENC2` identity-bound encrypted format. Symbolic links, unknown directories, plaintext uploads and unrelated files cause backup failure. Environment files, logs, service credential files and encryption keys are not copied into the bundle. Database application records, including password hashes and session metadata, remain part of the encrypted database dump.

## Before backing up

1. Stop application writes, uploads, maintenance jobs and retention jobs for the duration of the backup. `pg_dump` provides a database snapshot; quiescing writes makes that snapshot consistent with the file tree. Set `BACKUP_QUIESCED=true` only after doing this.
2. Load the existing `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `UPLOAD_PATH` and `ENCRYPTION_KEY` settings from the deployment's secret store. These scripts intentionally do not load `.env` files.
3. Configure `BACKUP_ENCRYPTION_KEY` as a separate, randomly generated 32-byte key encoded as 64 hexadecimal characters. Missing, malformed or application-identical keys are rejected. Keep this key outside the application host and outside the backup artifact.
4. Have compatible PostgreSQL client tools available in `PATH`. `PG_DUMP_BIN` and `PG_RESTORE_BIN` can name explicit trusted executable paths. Use a client major version compatible with the database server. No dependencies are installed by these tools.
5. For a remote source database, configure PostgreSQL TLS using `PGSSLMODE=verify-full` and `PGSSLROOTCERT` as appropriate. Connection passwords go through the child process environment, never shell command arguments. Output storage must be outside `UPLOAD_PATH` and already have a protected parent directory.

Run from the project root, substituting an absolute output path:

```text
node backend/scripts/backup.js /protected/backups/healthcare-2026-11-01.shmsbkp
```

The command exits nonzero on failure. Preserve the complete artifact only after a successful exit. Transfer the encrypted artifact to separate storage using the deployment's existing protected transfer mechanism. Keep more than one version, verify copied artifact hashes, and restrict access to both storage and keys. This tool deliberately makes no retention or hosting assumptions.

The backup tool supports up to 10,000 upload files and an 8 MiB manifest. It refuses an unsupported backup rather than silently omitting data. Large installations should choose and validate a database and object-storage backup service that provides the required consistency and retention guarantees.

## Preserve keys separately

Retain both the independent backup key and the original application `ENCRYPTION_KEY` in a separately protected recovery store. The backup key opens the envelope; the application key opens the restored encrypted reports and any application-encrypted database fields. Restoring the database alone cannot recover a lost application key. Preserve required historical keys when rotating them. Do not place actual keys in this document, in source control, in a bundle manifest or alongside an artifact.

## Restore into a new disposable local database

The restore command is intentionally restricted to recovery drills. It requires a loopback database host and a new database name beginning with `healthcare_restore_`. It refuses **every existing database**, including an empty one, and every existing destination upload directory. It never overwrites a running application's data.

Configure these settings explicitly:

| Setting | Meaning |
| --- | --- |
| `RESTORE_DISPOSABLE=true` | Explicitly select the disposable drill workflow. |
| `RESTORE_DB_HOST` | `127.0.0.1`, `localhost` or `::1` only. |
| `RESTORE_DB_PORT` | Port of the isolated local PostgreSQL instance. |
| `RESTORE_DB_NAME` | A new name such as `healthcare_restore_drill_20261101`. |
| `RESTORE_DB_USER`, `RESTORE_DB_PASSWORD` | Local drill principal with permission to create/drop its disposable databases. |
| `RESTORE_ADMIN_DB` | Existing local maintenance database; defaults to `postgres`. |
| `BACKUP_ENCRYPTION_KEY` | The independent key used for this artifact. |
| `ENCRYPTION_KEY` | Original application key, retained separately. |
| `PGSSLMODE` | Use the isolated instance's configured transport; `disable` is suitable for the disposable local test fixture. |

Run with an existing encrypted artifact and a fresh absolute directory path whose parent already exists:

```text
node backend/scripts/restore-backup.js /protected/backups/healthcare-2026-11-01.shmsbkp /protected/drills/healthcare-20261101-uploads
```

Before opening a database connection, the command copies the encrypted artifact into a private temporary directory, authenticates the complete envelope, validates every file hash and rejects unsafe, duplicate, unexpected or traversal paths. The temporary copy remains encrypted. It then creates a new database from `template0`, uses `pg_restore --single-transaction --exit-on-error --no-owner --no-privileges`, and restores the already-encrypted uploads to the fresh directory. Plaintext database data only passes through memory and the restore process pipe. Credential document database paths are rebased to the new upload root while preserving relative paths required by authenticated encryption.

Credential rebasing supports the local `public` schema and the hosted private `healthcare` schema. The restorer discovers the credential table through a bounded PostgreSQL catalog query and qualifies every read/update with its safely quoted schema and table name. It does not rely on the administrator's `search_path`. Multiple candidate tables, unsupported schemas/relation types, credential uploads without a supported table, references outside the backed-up upload root, and references to missing archived files all fail recovery and trigger cleanup of the newly created drill target. The tool never guesses between a private table and a public shadow table.

On failure after creation, the tool terminates its restore process, removes only its newly created disposable database and fresh upload directory, and removes its private encrypted staging copy. If database cleanup fails, the error explicitly reports that condition; an operator should inspect that named disposable database before another drill. Existing databases and directories are never cleanup targets.

Inspect the recovered records, document references, application audit chain and a decrypted synthetic report before treating the drill as successful. Point a separately isolated application instance at the restored database/upload root using the preserved application key. Promotion into an operational deployment remains a separate reviewed procedure; this tool has no production promotion command.

## Automated restore proof

`backend/tests/backup.integration.test.js` uses Node's built-in test runner. Its non-database cases verify separate-key enforcement, authenticated tamper/wrong-key/truncation rejection, checksum mismatch, traversal/absolute path rejection, source secret/symlink exclusion and partial-dump cleanup.

With `NODE_ENV=test`, `RUN_BACKUP_DB_TESTS=true` (or `RUN_DB_TESTS=true`), an explicitly configured disposable loopback PostgreSQL instance and trusted PostgreSQL client tools, it also performs a real custom-format dump/restore. It verifies clinical rows, exact encrypted file bytes, successful decryption with the original key, rebased credential references, refusal to overwrite a nonempty database, and cleanup after a partially applied failing restore tool.

The database suite includes a real private-schema fixture with the application's `healthcare,public` search path. Its original synthetic upload location is made unavailable after backup, so successful recovery must use the rebased credential reference and decrypt the restored file. Separate database cases verify failure and target cleanup for ambiguous credential tables, unsupported schemas, a missing table and an unsupported private credential reference.

```text
node --test backend/tests/backup.integration.test.js
```

Run this suite in the project's constrained, offline disposable container, not against application or production credentials. A skipped database test is not a successful restore drill. Record the test result, PostgreSQL versions, artifact identifier and recovery duration in the deployment's operational evidence without recording keys or clinical data.
