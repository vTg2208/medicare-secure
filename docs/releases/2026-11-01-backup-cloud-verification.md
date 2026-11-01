# First verified off-host snapshot

Historical first-upload report. The later [scheduled backup release](2026-11-01-scheduled-backup-release.md) supersedes the pending activation status below: fresh 57-table SHMSBKP1 recovery and recurring backups are now verified and enabled.

Verified on 2026-11-01 against the user's private Backblaze B2 bucket `medicare-secure-backups-vtg2208`.

- The local setup helper created an exact file-only key, stored encrypted using Windows DPAPI for the current Windows user. The administrator key is not stored by the helper or installed in the backup job.
- B2 authentication independently confirmed exactly listBuckets, listFiles, readFiles, writeFiles and deleteFiles; one permitted bucket; and the `medicare-backups/` filename prefix. No bucket-settings or key-management permissions are present.
- The bucket was independently confirmed private through its authenticated API. The dashboard also shows server encryption enabled.
- Object: `medicare-backups/deployment-snapshots/2026-11-01/database-before-026.pgp`.
- Size: **18,712 bytes**. SHA-256: `11023558eb864610a463439197578c4d4dd20f7b13c631ca7a1b279e9f7314c5`.
- The uploaded object was downloaded by its exact file version; its SHA-256 and size match the local ciphertext. The recovery key was not uploaded.
- The application's actual `connectB2` adapter authenticated using the protected replacement key, verified the private bucket and found this object. This was a real provider read, separate from synthetic transport tests.

This is the logical snapshot taken at **08:24:46 UTC / 13:54:46 IST**, before migrations 026–031. It contains the earlier 47-table synthetic dataset and migration ledger through 025. It does not contain subsequent messaging, appointment, privacy or other database changes. It uses the existing `medicare-private-db-v1` PGP format, not the SHMSBKP1 coordinated-backup format; it cannot be passed to the SHMSBKP1 restore command. Its original manifest records authenticated decryption and typed reconstruction verification. The cloud checksum match establishes an identical ciphertext copy; no new full application restore or disaster-recovery drill is claimed.

No source secrets or backup payloads were committed. Local evidence is retained under the ignored `.local/release-mandatory` directory: `b2-cloud-verification.json`, the verified downloaded ciphertext and `backblaze-cloud-backup-verified.jpg`.

The user-selected retention of seven daily recovery points and three monthly archives is implemented in the archive tool on the feature branch. **Recurring backup creation and retention are not enabled in the hosted deployment.** A verified mechanism to coordinate writes and encrypted files, a fresh coordinated backup, a full restore drill and operator failure reporting remain required. The unused, broader browser-preset key should be revoked separately; it was not installed in the application.

The local credential-directory regression passes on Windows PowerShell 5.1 and PowerShell 7. A live verification request exposed PowerShell 7's rejection of B2's opaque Authorization token. The helper now passes that token without HTTP header-syntax validation on PowerShell 7, retaining certificate validation and refusing redirects. The regression first reproduced the format failure without this handling, then passed on both PowerShell versions. CI coverage for the Windows credential tests and the existing backend checks passed before this final header compatibility update; subsequent PR checks provide hosted confirmation of the update.
