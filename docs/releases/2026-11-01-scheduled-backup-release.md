# Verified scheduled backups — 2026-11-01

Encrypted off-host backups are enabled for the private `vTg2208/medicare-secure` application. [PR #6](https://github.com/vTg2208/medicare-secure/pull/6) merged the implementation into main as `01f42ae9178d3b982dff06de4e4d54138749b9c0`. Existing unrelated application changes were preserved.

## Enabled operation

- Daily at **21:37 UTC / 03:07 IST the following day**, plus manual dispatch. `BACKUPS_ENABLED=true` was independently read back after activation. The first future scheduled execution is not yet claimed as observed; the two verified executions below were manual main-branch dispatches.
- Private Backblaze bucket `medicare-secure-backups-vtg2208`, prefix `medicare-backups/`. Retention keeps one latest snapshot for each of seven distinct UTC daily dates and three UTC months. The policy accumulates recovery points over time; ten historical points do not already exist.
- Each job creates an authenticated SHMSBKP1 bundle, uploads it, downloads the exact new B2 version and restores it into an isolated memory-backed PostgreSQL server. All table counts, migration checksums, audit payloads, hashes, links and chain head must pass before retention deletion.
- Production database connections verify TLS. The `healthcare_backup` login has SELECT-only access to application tables/sequences, no application-schema create privilege, no superuser/role-creation/RLS-bypass privileges and a two-connection limit. Live metadata confirmed zero writable and zero unreadable application tables.
- The worker receives the restricted file-only B2 key, dedicated database login, separate backup encryption key and application-key SHA-256 fingerprint in encrypted repository Actions secrets. The actual application encryption key and B2 administrator key are absent from the worker. Dependencies install without lifecycle scripts before backup secrets are exposed.

## Observed cloud recovery

| Main-branch execution | Result | Total duration | Cloud changes |
| --- | --- | --- | --- |
| [41313798138](https://github.com/vTg2208/medicare-secure/actions/runs/41313798138) | Passed: 57 tables, migration ledger and audit integrity | 68 seconds | Uploaded daily and monthly copies; pruned zero |
| [41314140258](https://github.com/vTg2208/medicare-secure/actions/runs/41314140258) | Passed: 57 tables, migration ledger and audit integrity | 72 seconds | Uploaded a fresh daily copy; pruned the older same-day version |

The current downloaded archive was captured at **2026-11-01 14:02:34.364 UTC / 19:32:34.364 IST**, contains all **57 application tables and 31 migrations**, and independently passed envelope authentication and ciphertext checksum verification:

```text
medicare-backups/daily/2026-11-01/40b5585b-8cf0-4065-9598-3c99f7fa51b5.shmsbkp
321970 bytes
SHA-256: 050fb3f413c1073e90456f1ea5ff48d0cb055f167945552542bb6c605ef017b6
```

The earlier PGP deployment snapshot is historical and outside the managed retention naming pattern. It does not substitute for this current recovery proof.

## Separate application recovery

The downloaded current archive was restored into a disposable PostgreSQL database on this computer. The original application key, separate backup key and synthetic demo login were passed privately through stdin into an isolated recovery container, without placing those values in Docker arguments/configuration or logs. Recovery used memory-backed scratch storage, no external network, disabled container logging and read-only source mounts. The operator invocation and result timestamps bound this local check to approximately ten seconds; this excludes the earlier cloud download and image preparation.

Verified results: all 57 tables and the audit chain; patient login; recovered medical records; decrypted clinical messages; decrypted privacy corrections; fulfilled privacy reviews; and released processing restrictions. The proof checks stored application data through the restored application's actual authentication and privacy-export endpoints. It made no production patient changes. The disposable database, scratch container and owned PostgreSQL fixture were removed after the check.

Local evidence remains in the ignored `.local/release-mandatory` directory: `backup-main-run-1.json`, `backup-main-run-2.json`, corresponding Actions logs, `current-download-verified.json`, `application-recovery-verified.json`, the encrypted downloaded archive and `scheduled-backup-live-success.jpg`. No credentials, patient contents or backup payloads were committed.

## Validation and operating limits

Backend validation passed: 161 unit tests; 200 integration tests passed with one skipped; focused archive/snapshot checks passed. Windows credential-directory, DPAPI and opaque-header regressions passed under Windows PowerShell 5.1 and PowerShell 7. Real container-client CI reproduced the missing-stdin failure before the fix; the fixed pipeline passed. Independent review's stdin and dump-logging findings were resolved before activation.

Main-branch [backend CI](https://github.com/vTg2208/medicare-secure/actions/runs/41313794779), [container backup/recovery CI](https://github.com/vTg2208/medicare-secure/actions/runs/41313794725) and [Windows key-setup CI](https://github.com/vTg2208/medicare-secure/actions/runs/41313794786) passed. Both the live API and frontend-proxied `/readyz` returned HTTP 200 after the recovery checks.

This automation currently supports the verified **fileless** demo. It uses an exported consistent database snapshot and refuses external file references, unknown file columns or pending file cleanup. Adding attachments requires coordinated database/file backup; falsely setting `BACKUP_QUIESCED=true` is not supported. PostgreSQL roles/provider-owned schemas are deliberately outside the archive and require provisioning during a full operational promotion.

GitHub scheduling is best-effort, subject to availability and quota. Actions status/logs provide failure reporting; additional native notifications depend on the owner's preferences. No external email/SMS alert delivery is claimed. Artifact/prefix limits are 256 MiB and 8 GB; these are safeguards rather than an account-wide zero-cost guarantee. No paid plan or payment method was configured. The unused broader browser-preset B2 key remains separate from the exact file-only worker credential and should be revoked by the account owner.

See [scheduled operations](../scheduled-backups.md), [archive limits](../backup-archives.md) and [recovery procedures](../backup-recovery.md) for the operating contract. Preserve the original application key and backup key separately from B2; losing either prevents complete application recovery.
