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

- [x] Write real-PostgreSQL tests for concurrent writers, exclusive backup exclusion, timeout, reentrancy, failure release and disconnected-session rejection. Observe RED.
- [x] Add `src/services/file-coordination.js`: `withFileMutation(run,{env,client})` and `withFileBackupLock(run,{env,client})`, using one dedicated session and bounded waits; release only owned sessions.
- [x] Integrate uploads, credential writes, request cleanup, quarantine, retention cleanup and applied encryption migration. Preserve scanner-first encryption and existing quiescence requirements for destructive operators. Test actual service writes blocked behind backup ownership. Observe GREEN and commit.

## Task 2: Consistent coordinated capture and recovery

- [x] Add snapshot/file tests for creation/deletion races, absolute credential and API references, missing/unsafe/unknown references, pending disposal files, failure cleanup and actual decrypted recovery. Observe RED.
- [x] Add `scripts/backup-file-references.js` for supported reference normalization/inventory and recovery verification; add `scripts/coordinated-backup.js` for exclusive capture. Extend `withDatabaseSnapshot` with an explicit coordinated reference collector; keep database-only refusal behavior.
- [x] Extend `backup-helper.js` descriptors to bind selected encrypted files to the exported snapshot, protect publication after lost ownership and rebase supported absolute references. Preserve old manual recovery compatibility. Run backup/snapshot/coordinated suites and commit.

## Task 3: Scheduled recovery gate and operating contract

- [x] Test a colocated coordinated scheduled run with cloud upload/download, complete restored file inventory, and failure preserving previous recovery points. Observe RED.
- [x] Add explicit BACKUP_MODE selection to the scheduled runner and `backup:coordinated`; verify coordinated files before pruning; add the new suite to real-container client CI. Document deployment ordering and volume access, without changing the live remote worker's fileless mode.
- [x] Run focused tests, syntax and full backend unit/integration checks. Commit.

## Task 4: Independent review and evidence

- [x] Review the whole branch independently, resolve material findings with failing regressions, record actual counts/commands and coherent commits, push a reviewable branch/PR, and copy only owned changes into the user's working folder.

## Completion evidence

Completed in commits 1e59526 (mutation gate), c20179c (capture/recovery), 223bbdb (scheduler gate) and 1288461 (independent-review fixes). Final verification: 161 unit tests, 216 integration tests with one skip, and 49 focused checks without an ambient application key. Backend and real container-client hosted CI passed for the code revision. PR #7 contains the implementation; production deployment/activation remains outside this request.

Independent review findings were reproduced before fixes: missing actual lock-ownership verification, interrupted in-place credential rewrite, absolute medical-reference rebasing changing audit evidence, and a CI-only missing synthetic key. All passed after fixes. The review accepted snapshot-invisible in-flight uploads, retained cleanup presence/absence state, the two-connection reader limit and recovery-before-pruning behavior. Explicit operating requirements remain: all writers must participate, use session/direct connections and the same persistent volume, and serialize archival jobs. Source ciphertext corruption still requires a separate application-key decryption check; that limit is documented. No minor findings were deferred.

See [release evidence](../../releases/2026-11-01-coordinated-file-backups.md) and [operating contract](../../coordinated-file-backups.md). Only owned backup files were synchronized to the original working folder; its unrelated edits and branch history were preserved.