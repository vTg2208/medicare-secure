# Coordinated upload backups implementation plan

> Execute inline with superpowers:executing-plans and test-driven development; obtain one independent whole-branch review before completion.

**Goal:** Capture and recover a consistent PostgreSQL snapshot with its encrypted uploaded files during normal application activity.

**Architecture:** Database-scoped shared advisory locks protect filesystem mutations; an exclusive backup lock encloses an exported snapshot and authenticated file capture. Extend the existing recovery and scheduled archival gate.

**Tech stack:** Node 24, PostgreSQL 17+, existing SHMSBKP1/SHMSENC2 encryption and Node test/Vitest suites. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-01-coordinated-upload-backups-design.md`.

## Constraints and review focus

Preserve unrelated workspace changes and migration checksums. Work on `feat/coordinated-upload-backups` in the existing isolated checkout. Do not merge/deploy or change live secrets/scheduling in this implementation task. Never log keys or patient contents. Backup encryption remains separate from the application key.

Review especially: in-flight creation before DB commit; retention unlink/retry races; lock timeout/session loss; unknown/missing/symlinked/remote file references; incomplete recovery preventing pruning. Do not assume an assertion of quiescence freezes writes.

## Task 1: Shared file mutation gate

- [ ] Write real-PostgreSQL tests for concurrent writers, exclusive backup exclusion, timeout, reentrancy, failure release and disconnected-session rejection. Observe RED.
- [ ] Add `src/services/file-coordination.js`: `withFileMutation(run,{env,client})` and `withFileBackupLock(run,{env,client})`, using one dedicated session and bounded waits; release only owned sessions.
- [ ] Integrate uploads, credential writes, request cleanup, quarantine, retention cleanup and applied encryption migration. Preserve scanner-first encryption and existing quiescence requirements for destructive operators. Test actual service writes blocked behind backup ownership. Observe GREEN and commit.

## Task 2: Consistent coordinated capture and recovery

- [ ] Add snapshot/file tests for creation/deletion races, absolute credential and API references, missing/unsafe/unknown references, pending disposal files, failure cleanup and actual decrypted recovery. Observe RED.
- [ ] Add `scripts/backup-file-references.js` for supported reference normalization/inventory and recovery verification; add `scripts/coordinated-backup.js` for exclusive capture. Extend `withDatabaseSnapshot` with an explicit coordinated reference collector; keep database-only refusal behavior.
- [ ] Extend `backup-helper.js` descriptors to bind selected encrypted files to the exported snapshot, protect publication after lost ownership and rebase supported absolute references. Preserve old manual recovery compatibility. Run backup/snapshot/coordinated suites and commit.

## Task 3: Scheduled recovery gate and operating contract

- [ ] Test a colocated coordinated scheduled run with cloud upload/download, complete restored file inventory, and failure preserving previous recovery points. Observe RED.
- [ ] Add explicit BACKUP_MODE selection to the scheduled runner and `backup:coordinated`; verify coordinated files before pruning; add the new suite to real-container client CI. Document deployment ordering and volume access, without changing the live remote worker's fileless mode.
- [ ] Run focused tests, syntax and full backend unit/integration checks. Commit.

## Task 4: Independent review and evidence

- [ ] Review the whole branch independently, resolve material findings with failing regressions, record actual counts/commands and coherent commits, push a reviewable branch/PR, and copy only owned changes into the user's working folder.
