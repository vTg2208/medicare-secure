# Private B2 backup archives

The archive command uploads an existing, freshly created SHMSBKP1 encrypted bundle. It does not create a database backup, stop application writes, schedule jobs, change provider permissions or send external alerts. Follow [coordinated backup creation and recovery](backup-recovery.md) first. The earlier one-off `.pgp` deployment snapshot is a different format and is deliberately refused by this command.

## Bucket and credentials

On 2026-11-01, the private bucket `medicare-secure-backups-vtg2208` was created in the user's Backblaze account. Bucket ID: `6d54a6a4fa25936fa01d0e11`; endpoint: `s3.us-east-005.backblazeb2.com`. The dashboard confirmed Private and encryption Enabled. The user then explicitly approved creation of the bucket/prefix-restricted browser key. Backblaze's Read and Write preset also granted writeBuckets and other bucket-settings permissions. The integration refuses those administrative capabilities; that key has not been connected to the job. The user created the exact file-only replacement through the local setup helper; its five permissions and scope were verified against B2 and accepted by the source adapter. Revoke the unused browser-preset key; it remains separate from the verified replacement.

Use a dedicated bucket with no public access and retain all versions at the provider level; the archive command manages exact expired versions. Do not enable lifecycle expiration that can independently delete required recovery points. Review the provider region before putting real patient information there; this demonstration uses synthetic data.

Create a normal application key restricted to this bucket and **exactly** `medicare-backups/`. Read and Write access is required for verified uploads and expired-version removal. Do not grant List All Bucket Names or use the master key. The command requires listBuckets, listFiles, readFiles, writeFiles and deleteFiles, permits ordinary bucket/file read capabilities, and refuses administrative capabilities such as writeBuckets, bypassGovernance or key management.

The browser's Read and Write preset is therefore unsuitable. Use the [official B2 Native API](https://www.backblaze.com/apidocs/b2-create-key) once under an administrator principal with writeKeys to request exactly those five capabilities, bucketIds containing only this bucket, and namePrefix=medicare-backups/. The administrator credential is solely for provisioning and must never be installed in the backup job. Existing key capabilities cannot be edited in place. Generating/replacing an administrator credential in the browser is a user handoff step.

On Windows, run `backend/scripts/setup-b2-file-key.ps1` without arguments to review the exact request. Run it with `-Create` to enter the administrator key ID and hidden secret at local prompts. It saves only the restricted replacement in `.local/backup-secrets/b2-files-only.dpapi`, encrypted using Windows DPAPI for the current user. It refuses an existing output file. The folder grants access only to that user; no administrator elevation is needed. The Windows regression exercises access permissions, DPAPI read/write and safe retries under Windows PowerShell 5.1 and PowerShell 7, without a network request or real credentials.

Load B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_ID and BACKUP_ENCRYPTION_KEY from the backup operator's protected secret store. For key-separation checks, supply either the original ENCRYPTION_KEY or its BACKUP_APPLICATION_KEY_SHA256 fingerprint; the scheduled worker receives only the fingerprint. Optionally set B2_PREFIX=medicare-backups/. Keys are never command arguments and no dotenv file is automatically loaded. Keep both encryption keys outside the bucket and preserve them in a separate protected recovery location. Do not put credentials in chat, source control, screenshots or the backup itself.

## Archive and retention

From `backend`, after creating today's coordinated encrypted backup:

```text
npm run backup:archive -- /protected/backups/healthcare-today.shmsbkp
```

The command stages a private encrypted copy and authenticates it before making network requests. Only bundles created on the current UTC day, with no more than five minutes of forward clock skew, may rotate archives. An old snapshot cannot be relabelled as today's recovery point.

It uploads a daily copy and, when no archive exists for the current UTC month, a monthly copy. It downloads the new copies, compares SHA-256 and authenticates their envelopes. Before pruning, it also downloads and authenticates every prior bundle being retained, so a failed earlier upload cannot serve as a recovery anchor. It then keeps the newest **seven distinct daily dates** and **three distinct months**, one version per period. These are available recovery points; missed days are not invented. Unknown names, future dates and objects outside the exact managed naming pattern are never deleted. Deletion addresses exact B2 file versions, since hiding a filename alone does not reclaim older versions.

If creation, upload, listing, download, authentication or budget validation fails, previous backups are not pruned. Failed uploads may leave encrypted objects that consume storage; inspect them before manual removal. A deletion failure can leave extra versions and returns a failure rather than claiming retention succeeded.

Run only one archival process at a time for this bucket/prefix. There is no distributed lock. A scheduler must enforce serialization and report nonzero exit status to the operator.

## Cost boundaries

The tool refuses artifacts above 256 MiB and refuses uploads when all listed prefix versions plus the proposed copies exceed 8 GB. It does not delete recoverable data merely to make space for an upload. This prefix budget is not an account-wide billing guarantee: other buckets, unknown files, provider requests and verification downloads also consume allowances. Configure Backblaze Caps & Alerts and check current storage/download/request allowances before enabling a recurring job. The verification traffic includes retained copies and can exceed free download allowances as data grows. No payment method or paid service was configured by this task.

## Recovery

Download a selected `.shmsbkp` version through the authenticated Backblaze browser or the operator's existing protected client. Preserve its ciphertext; do not upload the recovery key. Use the existing restore drill command with the original application key and the separate backup key. That command authenticates the bundle before creating its disposable database. A successful archive upload is not proof that the application has been restored; complete the database/file/application drill separately.

## Activation status

Enabled on the private repository's main branch on 2026-11-01. The [initial database-only release](releases/2026-11-01-scheduled-backup-release.md) recovered 57 tables. The live worker now uses [coordinated PostgreSQL file capture](coordinated-file-backups.md): two fresh main-branch runs restored **59 tables, all 32 migrations, audit integrity and one synthetic encrypted file** from B2. Actual same-day rotation and separate local application decryption drills also passed. See [current activation evidence](releases/2026-11-01-durable-backup-activation.md).

The daily schedule runs at 21:37 UTC / 03:07 Asia/Kolkata the next day, using BACKUP_MODE=coordinated and durable PostgreSQL ciphertext storage. The remote worker does not depend on Render's ephemeral filesystem. The legacy manually quiesced command still requires stopped writes; BACKUP_QUIESCED=true does not coordinate them. See the [scheduled operating contract](scheduled-backups.md). The earlier [PGP snapshot verification](releases/2026-11-01-backup-cloud-verification.md) remains historical evidence, separate from the current recovery format.
