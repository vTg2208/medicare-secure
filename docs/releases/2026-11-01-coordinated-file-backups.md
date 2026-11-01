# Coordinated uploaded-file backup implementation

Implemented on `feat/coordinated-upload-backups`, based on main `f484dd6`, with [PR #7](https://github.com/vTg2208/medicare-secure/pull/7). This release record covers implementation and isolated verification; it does not claim deployment or live activation of uploaded-file backups.

## Changes and commits

| Commit | Verified change |
| --- | --- |
| `1e59526` | Shared PostgreSQL gate for upload, credential, rollback-cleanup, quarantine and maintenance filesystem mutations |
| `c20179c` | Exclusive capture lock, one exported database snapshot, referenced encrypted-file inventory, cleanup tombstones and portable recovery |
| `223bbdb` | Coordinated scheduled mode and cloud-download/file-recovery gate before retention deletion |
| `1288461` | Review fixes: actual lock-ownership checks, atomic legacy credential replacement, preserved audit evidence during absolute medical-path relocation, and self-contained CI keys |

`npm run backup:coordinated -- /protected/output.shmsbkp` captures the migrated application schema and its supported encrypted uploads without setting BACKUP_QUIESCED. A colocated scheduler can set BACKUP_MODE=coordinated and reuse the existing encrypted B2 archive and seven daily/three monthly retention policy.

## Verification

The final code passed on Node 24 with isolated PostgreSQL 17 fixtures:

- **161 unit tests passed**, across 24 files.
- **216 integration tests passed; one skipped**, with syntax checks and migrations also passing.
- **49 focused archive/backup/snapshot/coordination checks passed** with the ambient ENCRYPTION_KEY removed. The coordinated suite supplies only its own explicit synthetic fixture key, matching the clean hosted pipeline's environment.
- Real concurrent sessions verified shared writers, exclusive backup exclusion, timeout/failure release, disconnected sessions and silent loss of an advisory lock on an otherwise live session.
- Recovery exercised the complete 31-migration private application schema plus a concurrency fixture, absolute credential/organization/lab/imaging/radiology references, portable API references, real encrypted-file decryption, exact table counts and audit-chain integrity.
- A database commit made after snapshot export stayed outside the restored snapshot. A file deletion attempted during capture waited until encrypted publication. Unpublished orphan files were omitted.
- Pending retention files and already-unlinked cleanup entries recovered correctly, and audited cleanup resumed without resurrecting deleted bytes.
- Missing files, unsafe/remote references, unknown file columns, symlinks, failed dumps and lost capture ownership refused successful publication. Interrupted legacy credential replacement preserved the previous ciphertext.
- The complete coordinated scheduled pipeline ran with the SELECT-only backup role's **two-connection limit**, using only the application-key fingerprint. A corrupted cloud download left every previous recovery point unpruned, and no disposable recovery databases remained.

Hosted code checks for `12884612fe9494328ffbf41723fddd6f2a961d40`: [Backend CI](https://github.com/vTg2208/medicare-secure/actions/runs/41325604749) and [actual container-client recovery pipeline](https://github.com/vTg2208/medicare-secure/actions/runs/41325604827). Final PR checks remain visible on the linked pull request.

Independent review identified four material issues. Each was reproduced by a failing regression before its fix: absolute medical-path rebasing altered the audit inventory; connectivity did not prove lock ownership; a truncating credential rewrite could damage its original; and the new suite depended on an ambient encryption key. All regressions subsequently passed. No minor findings were deferred.

Local test logs are preserved under the ignored `.local/release-mandatory` directory: `coordination-red.log`, `coordinated-capture-red.log`, `coordinated-scheduler-red.log`, `coordinated-faults-red.log`, `absolute-medical-red.log`, `coordinated-clean-env-red.log`, `coordinated-unit-final.log`, `coordinated-full-final.log` and `coordinated-clean-pipeline-final.log`. They contain synthetic fixtures; no production credentials or clinical contents were copied into committed evidence.

## Operating decisions

The capture freezes filesystem changes while PostgreSQL's exported snapshot controls database visibility. Creating encrypted files before committing references and deleting them only after reference removal makes in-flight uploads and retention safe without pausing unrelated clinical database work. Recovery preserves absent cleanup entries, uses the source's table counts and verifies files before allowing archive deletion.

The lock and dump share two source connections in total; no additional write privilege was granted to the backup role. Supported missing/unsafe references fail closed. Ciphertext checksums prove recovery of the captured bytes; source ciphertext already damaged before capture still requires diagnosis using the separately preserved application key. Fixture recovery explicitly exercised that decryption path.

All writers must run the shared-gate code, use the same database and access the real persistent/shared upload volume. Direct connections or session-mode pooling are required. Unsupported external writers, mixed deployment versions and concurrent archive schedulers must be stopped or coordinated before activation. These are deployment requirements, not permission to bypass a failed backup check.

The current live GitHub worker remains **database-only** and continues to refuse uploaded-file references. Activating uploaded-file backups live requires deployment of this branch and a worker colocated with the persistent volume. No production credentials, storage permissions, active backup mode or schedule were changed by this implementation task. See [coordinated operations and rollout](../coordinated-file-backups.md).
