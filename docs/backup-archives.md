# Private B2 backup archives

The archive command uploads an existing, freshly created SHMSBKP1 encrypted bundle. It does not create a database backup, stop application writes, schedule jobs, change provider permissions or send external alerts. Follow [coordinated backup creation and recovery](backup-recovery.md) first. The earlier one-off `.pgp` deployment snapshot is a different format and is deliberately refused by this command.

## Bucket and credentials

On 2026-11-01, the private bucket `medicare-secure-backups-vtg2208` was created in the user's Backblaze account. Bucket ID: `6d54a6a4fa25936fa01d0e11`; endpoint: `s3.us-east-005.backblazeb2.com`. The dashboard confirmed Private and encryption Enabled. The user then explicitly approved creation of the bucket/prefix-restricted browser key. Backblaze's Read and Write preset also granted writeBuckets and other bucket-settings permissions. The integration refuses those administrative capabilities; that key has not been connected to the job. The user selected an exact file-only replacement. Revoke the unused preset key after the replacement is verified.

Use a dedicated bucket with no public access and retain all versions at the provider level; the archive command manages exact expired versions. Do not enable lifecycle expiration that can independently delete required recovery points. Review the provider region before putting real patient information there; this demonstration uses synthetic data.

Create a normal application key restricted to this bucket and **exactly** `medicare-backups/`. Read and Write access is required for verified uploads and expired-version removal. Do not grant List All Bucket Names or use the master key. The command requires listBuckets, listFiles, readFiles, writeFiles and deleteFiles, permits ordinary bucket/file read capabilities, and refuses administrative capabilities such as writeBuckets, bypassGovernance or key management.

The browser's Read and Write preset is therefore unsuitable. Use the [official B2 Native API](https://www.backblaze.com/apidocs/b2-create-key) once under an administrator principal with writeKeys to request exactly those five capabilities, bucketIds containing only this bucket, and namePrefix=medicare-backups/. The administrator credential is solely for provisioning and must never be installed in the backup job. Existing key capabilities cannot be edited in place. Generating/replacing an administrator credential in the browser is a user handoff step.

Load B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_ID, BACKUP_ENCRYPTION_KEY and the original ENCRYPTION_KEY from the backup operator's protected secret store. Optionally set B2_PREFIX=medicare-backups/. Keys are never command arguments and no dotenv file is automatically loaded. Keep both encryption keys outside the bucket and preserve them in a separate protected recovery location. Do not put credentials in chat, source control, screenshots or the backup itself.

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

The private bucket and empty medicare-backups/ namespace exist. The exact file-only credential, the first real coordinated archive upload, a B2 download/restore drill, and recurring scheduling are pending. A browser upload of the earlier encrypted PGP deployment snapshot was attempted but not completed; it is not a verified off-host recovery point. The live Render/Supabase deployment has no verified automatic write-quiescence/resume mechanism. Do not set BACKUP_QUIESCED=true in a scheduled job as a substitute for stopping writes. Choose and verify that host mechanism before enabling automated backup creation; the archive command can then run immediately after successful creation. Existing application behavior and deployment are unchanged.
