# Complete scheduled backups

Goal: enable an unattended daily encrypted off-host recovery point and seven daily/three monthly retention, prove a fresh cloud recovery drill, and record hosted execution evidence.

Use the existing isolated feature branch and preserve unrelated workspace changes. The user authorized completing the unfinished setup. Do not repeat design approval. Keep meaningful commits and test each behavior before relying on it.

## Chosen approach

The current hosted demonstration has uploads disabled. Add an explicit database-only snapshot mode for this case: hold a PostgreSQL repeatable-read transaction, check all known external-file reference columns in that same snapshot, and run a custom-format pg_dump using its exported snapshot. Refuse any nonempty file reference or unknown external-file column. This is a consistent database recovery point without falsely claiming application writes were stopped. Existing database-plus-file backups still require actual write quiescence. The new mode must not silently operate once attachments are introduced.

Reuse SHMSBKP1 authenticated encryption and B2 archive retention. Supply the application key's SHA-256 fingerprint to the backup job for key-separation checks, keeping the actual application key in its existing deployment/recovery store. Record any required extension namespaces in the authenticated manifest and recreate only supported namespaces in disposable restores before pg_restore.

Run GitHub Actions against the private application's main branch at 21:37 UTC (03:07 Asia/Kolkata the next day), with one serialized job, bounded duration, dedicated encrypted secrets, PostgreSQL clients matching the hosted server, generic failure output and native Actions failure notifications. No patient data or backup artifacts enter Actions artifacts/logs. A nonsecret summary records verification and retention counts. The schedule is best-effort and its next run is not represented as an observed run.

## Tasks and verification

1. Add snapshot-mode integration tests with real PostgreSQL: concurrent write excluded from imported snapshot, external attachment refusal, missing/ambiguous schema refusal, extension namespaces and complete restore. Preserve coordinated backup regressions. Observe RED, implement GREEN, commit.
2. Add the fingerprint-based key-separation option; wrong/equal keys and malformed fingerprint fail. Require the actual application key for the full application recovery drill. Commit with tests.
3. Add the scheduled runner and workflow, bounded cleanup and a cloud retrieval command. Test runner failure paths, valid cloud upload/download, retention and marker summaries. Use existing synthetic archive tests and real database fixtures, then commit.
4. Review the complete branch, resolve findings and pass full backend/Windows/hosted CI. Merge via the existing PR after checks succeed.
5. Load existing scoped B2 credentials and database connection into the backup environment, create/preserve a separate backup key, enable the schedule, dispatch one real main-branch run and inspect its result.
6. Download that run's fresh encrypted archive into a disposable isolated PostgreSQL environment, verify current migration ledger/data evidence and application reads, and record recovery duration. Keep keys separate from the bucket. Update evidence/status and clean only owned fixtures.

Risk boundaries: never install a master B2 key in the job; never set BACKUP_QUIESCED=true for an online snapshot; unknown schemas/files fail rather than omit data; invalid credentials must not leak provider responses; late/overlapping jobs must not prune newer recovery points; old PGP deployment snapshot is a separate artifact and cannot substitute for this drill.

Ruling: provision a dedicated SELECT-only healthcare_backup login instead of installing the existing application writer credentials in Actions. The offline integration tests apply the exact provisioning template, prove write denial even after read-only mode is disabled, and run the complete snapshot/cloud-download/recovery flow using that reader. The user delegated the choice after being asked specifically about this role and encrypted Actions secrets; the scoped setup was then activated.

## Completion evidence

All six tasks completed on 2026-11-01. Commits c325f4f and 306df5d implement snapshot consistency, credential separation, scheduled recovery and retention. Independent review identified missing Docker stdin and dump-output logging; regression commit 41f0e67 reproduced the client failure, and 32b741b fixed both findings. PR #6 merged into main as 01f42ae after backend, container recovery and Windows checks passed. Existing unrelated main-branch changes were preserved.

The dedicated live reader has SELECT on all 57 application tables and no application write/create privileges. Only its credentials, the restricted B2 credential, separate backup key and application-key fingerprint were installed in the private repository's encrypted Actions secrets. BACKUPS_ENABLED=true was set after the first successful main-branch cloud recovery. A second successful execution exercised actual same-day pruning. A separately downloaded current archive passed isolated application recovery, including login and encrypted messages/corrections. Owned recovery fixtures were removed. See [full release evidence](../../releases/2026-11-01-scheduled-backup-release.md) for run links, checksum, verification scope and remaining operating limits.
