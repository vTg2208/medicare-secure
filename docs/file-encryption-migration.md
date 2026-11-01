# Migrate legacy encrypted uploads

Current report and credential downloads require `SHMSENC2`: AES-256-GCM binds each encrypted file to its path relative to `UPLOAD_PATH`. Legacy `SHMSENC1` used the same application key without that identity binding. The runtime deliberately refuses to decrypt a legacy file through an identity-bound download route.

`backend/scripts/migrate-file-encryption.js` provides an explicit compatibility backfill. It does not run during startup, weaken downloads, change database references or move existing application files. It never imports plaintext files. Run it as the account that owns the application uploads, with the existing application `ENCRYPTION_KEY` supplied securely through the environment. The tool does not load `.env` files or accept key material as command arguments.

## Inspect first

Use an absolute upload directory, either as `UPLOAD_PATH` or through `--uploads`:

```text
node backend/scripts/migrate-file-encryption.js --uploads /protected/application/uploads
```

The default is a dry-run. It authenticates every supported file, counts legacy files and verifies that existing `SHMSENC2` files match their current path context. It creates no backup directory and changes no bytes. Output contains counts only, with no patient identifiers, storage paths, key values or clinical contents.

Supported paths match the runtime's encrypted clinical storage layout: `documents` contains PDF/PNG/JPEG credentials, and `medical_files/<patient UUID>/{lab_results,imaging}` contains supported report types. Symlinks, unknown directories or types, plaintext/unknown formats, incorrect keys, tampering, identity mismatches and encrypted files larger than 10 MiB cause failure. The tool handles at most 10,000 files per run and refuses unsupported input instead of silently skipping it.

If a dry-run fails, resolve that condition before applying. Preserve the original key; changing the environment key to a newly generated value cannot decrypt existing files. Do not rename or relocate files within the upload tree: their exact case-preserving relative path becomes authenticated data.

## Apply with a separate original-file backup

1. Take a verified encrypted database/upload recovery backup and preserve the application key separately as described in [backup recovery](backup-recovery.md).
2. Stop application writes, uploads and maintenance/retention jobs. Set `FILE_MIGRATION_QUIESCED=true` only after writes have stopped.
3. Select a separate absolute backup directory outside the upload tree, with an existing protected parent directory. It must not be an ancestor of the upload root or a symlink. The tool creates the final directory when needed with restrictive permissions.
4. Run the explicit apply command:

```text
node backend/scripts/migrate-file-encryption.js --apply --uploads /protected/application/uploads --backup-dir /protected/migration-originals/legacy-20261101
```

The complete input set is authenticated before any file is changed. For each legacy file, the tool writes its **exact original encrypted bytes** under the same relative path in the separate backup directory, flushes that backup, then writes and flushes a `SHMSENC2` temporary file beside the original. It atomically replaces the original only after checking that the source has not changed. Database file paths and the application key remain unchanged. No plaintext report is written to disk.

Existing original backups are never overwritten. An existing backup with identical bytes can be reused to resume an interrupted run. Different bytes cause an explicit conflict. Already-current files are authenticated and left untouched; repeating a successful run reports zero migrations and preserves the original backups.

The atomic unit is one file. A filesystem failure or an unexpected concurrent change after preflight may leave an already-migrated subset. Keep writes stopped, retain the original backups, correct the cause and run the dry-run/apply sequence again. Do not automatically copy a legacy backup over a current file: current download routes will refuse that legacy format. Investigate a recovery case using a separate protected copy and the preserved key.

After applying, rerun the dry-run and verify authorized credential and medical-report downloads with synthetic or approved test accounts before restarting writes. Retain original ciphertext backups under the deployment's recovery retention policy. Moving an already-current file to another relative path will fail authentication by design.

## Automated verification

`backend/tests/file-migration.integration.test.js` tests actual encryption interoperability with the runtime crypto helper, dry-run byte preservation, medical/credential migration, cross-path rejection, unchanged legacy backups, repeated application, whole-input authentication preflight, tamper/wrong-key rejection, plaintext/type/size limits, symlink/traversal/invalid-directory refusal, conflicting backup preservation and safe count-only CLI output.

```text
node --test backend/tests/file-migration.integration.test.js
```

Run the suite only in the constrained offline test container. The tests create and remove synthetic fixture directories; the migration command has not been applied to any existing user upload tree as part of implementation.
