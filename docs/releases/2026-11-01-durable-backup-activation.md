# Coordinated database and durable-file backups — live activation

[PR #7](https://github.com/vTg2208/medicare-secure/pull/7) merged the coordination implementation as f9b058c. [PR #8](https://github.com/vTg2208/medicare-secure/pull/8) added encrypted PostgreSQL file storage and remote snapshot capture, merging into main as **3f3d3a9c533b910cf4538188b4555d7cb32f42e1**. This extension lets the existing free Render service retain files across restarts without a paid persistent disk or another storage credential.

## Reviewed implementation and checks

| Commit | Change |
| --- | --- |
| 3779ce4 | Bounded, immutable encrypted PostgreSQL objects and application storage adapter |
| 70cf5bc | Capture durable files and references through the exported database snapshot |
| ee70026 | Reclaim failed publications, preserve committed references and normalize file extensions |
| 6789a40 | Keep multipart credentials encrypted in memory until complete request validation |

The final implementation passed **168 unit tests across 25 files**, **226 integration tests with one skipped**, [Backend CI](https://github.com/vTg2208/medicare-secure/actions/runs/41330795555), and the [real container-client recovery pipeline](https://github.com/vTg2208/medicare-secure/actions/runs/41330795528). The merge revision also passed [Backend CI](https://github.com/vTg2208/medicare-secure/actions/runs/41332846199), [container-client recovery](https://github.com/vTg2208/medicare-secure/actions/runs/41332846152), and Vercel deployment checks. Tests include actual HTTP upload/download after source-directory loss, scanner refusal, quota contention, failed-request cleanup, retention cleanup, snapshot races and altered restored-object detection. Independent review findings were reproduced with failing regressions and fixed before merge.

## Applied database and deployment

The operator approved migration 032 before execution. A pre-change main-branch [database backup](https://github.com/vTg2208/medicare-secure/actions/runs/41329484213) passed before the migration. The guarded 031-to-032 SQL batch then applied the exact reviewed migration, with SHA-256 `a67b7aabc37c9471165720583a2098191312b6e77b424882319c5b3ea671ff05`.

Live read-only verification confirmed **59 application tables, 32 migrations**, a 64 MiB object budget, and these effective permissions:

- healthcare_api: object SELECT/INSERT/DELETE; no object UPDATE, budget access, schema CREATE or direct accounting-function execution.
- healthcare_backup: SELECT on objects and budget; no writes, schema CREATE or accounting-function execution.
- anon/authenticated: no access to the new tables or accounting function.
- The accounting trigger is SECURITY DEFINER with search_path=pg_catalog. The application cannot raise its quota.

Render deployment **dep-dbjnkhajnfac738i13pg** reported live for 3f3d3a9, using FILE_STORAGE_BACKEND=postgres and UPLOAD_PATH=/tmp/medicare-encrypted-uploads. A separate service restart was observed at **23:15 IST on November 1**. Subsequent API probes returned the same exact revision through X-Application-Revision and downloaded the same synthetic PDF after the restart. The frontend and direct API readiness probes both passed.

The serialized private GitHub workflow now has BACKUPS_ENABLED=true, BACKUP_MODE=coordinated, BACKUP_FILE_STORAGE_BACKEND=postgres and BACKUP_UPLOAD_ROOT=/tmp/medicare-encrypted-uploads. Its schedule remains **03:07 IST daily**, plus manual dispatch. Retention keeps seven distinct UTC daily dates and three UTC months. The existing restricted database login, file-only B2 key and separate backup key were preserved; the actual application encryption key and B2 administrator key remain absent from the worker. No billing upgrade was made.

## Actual cloud and application recovery

The database operator inserted one clearly marked synthetic medical record, laboratory result and context-bound encrypted PDF, with an explicit audit event. This adds no real clinical data. The known PDF is 626 plaintext bytes / 662 encrypted bytes. Its original application key was used locally and was not passed to GitHub or B2.

| Main-branch run | Snapshot time, IST | Cloud recovery result | Rotation |
| --- | --- | --- | --- |
| [41333010705](https://github.com/vTg2208/medicare-secure/actions/runs/41333010705) | Nov 1, 23:14:59 | 59 tables, ledger, audit chain and one encrypted file verified | One daily copy uploaded; older same-day version pruned |
| [41333227383](https://github.com/vTg2208/medicare-secure/actions/runs/41333227383) | Nov 1, 23:17:24 | 59 tables, ledger, audit chain and one encrypted file verified | Fresh daily copy uploaded; prior same-day version pruned |

Both successful jobs used coordinated/PostgreSQL capture, downloaded their exact newly uploaded B2 versions, restored into fresh disposable PostgreSQL databases and verified file references, ciphertext and budget accounting before deleting an expired version. Both versions were also independently downloaded and authenticated locally before subsequent rotation. The latest verified archive is:

```text
medicare-backups/daily/2026-11-01/6a693da0-27a8-43b8-af8a-941c5aaa8762.shmsbkp
335154 bytes
SHA-256: bcee3df649934cfa7e01c4c27a2411f5381cf58de5a660f2c937f47db897652c
```

Each downloaded archive passed a separate local application recovery drill using the original application key and backup key through private stdin. The recovery containers had no external network, disabled logging, read-only source mounts and memory-backed database/scratch storage. Each drill verified all 59 tables and 32 migration checksums, audit integrity, the restored object budget, patient login, actual PDF decryption and plaintext SHA-256, anonymous file denial, medical records, decrypted messages and corrections, fulfilled privacy reviews and released restrictions. The owned recovery database was removed after each drill; the owned fixture containers were removed after verification.

Live checks on the deployed application independently verified patient PDF download and exact plaintext hash, anonymous and other-patient denial, the nurse profile, existing decrypted messages/corrections, fulfilled privacy workflows and 18 real published appointment slots in Asia/Kolkata. The prior temporary booking remained cancelled. The file download and authorization checks passed again after the Render restart.

## Scope and retained evidence

**Normal production file uploads still require a configured ClamAV service.** Scanning was not disabled or bypassed in the upload route. The operator-seeded synthetic file proves durable storage, authorized retrieval, coordinated capture and application recovery; it does not establish a successful antivirus-backed live upload. Local integration tests exercise the actual HTTP upload route, including scanner failure.

These observed jobs were manual dispatches of the same main-branch workflow used by the enabled daily schedule. A future timed execution is not claimed as observed. November's earlier monthly archive remains its valid historical database-only recovery point; the next first-successful UTC monthly capture will use coordinated mode. The older PGP deployment snapshot remains outside the managed archive pattern.

Ignored local evidence under `.local/release-mandatory` includes durable-live-acl.json; durable-live-activation.json, durable-live-after-restart.json and durable-live-final.json; durable-run-41333010705/41333227383 JSON and logs; authenticated download and application-recovery reports for both runs; encrypted archive downloads; and the migration, Render and successful-backup screenshots. No passwords, keys, medical contents or backup payloads are committed. Existing unrelated project changes were preserved.
