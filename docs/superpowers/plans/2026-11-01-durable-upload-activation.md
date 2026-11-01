# Durable encrypted uploads and live coordinated backup activation

The user authorized merge, deployment and live activation, then delegated the free-versus-paid storage choice. PR #7 was merged as f9b058c and Render independently reports that revision live. Render Free has no persistent disk. Choose the existing private Supabase database for bounded encrypted file storage, preserving the current role/auth/audit/antivirus boundaries and avoiding a paid host or additional storage credentials.

## Design and operating choices

Add immutable SHMSENC2 bytea objects with relative storage identities and generated size/SHA-256 metadata. A database-enforced 64 MiB budget and 10 MiB per-file limit keep this synthetic demonstration bounded; no account-wide free-tier guarantee is implied. A trigger serializes budget accounting. The API retains access checks and scanner-first publication. Existing local-filesystem mode stays supported. The application role receives SELECT/INSERT/DELETE only on encrypted objects, not the budget table or UPDATE/DDL privileges. The existing backup reader receives SELECT on both new tables.

For coordinated mode with FILE_STORAGE_BACKEND=postgres, collect file references and their ciphertext rows inside the same exported repeatable-read snapshot. Materialize selected encrypted bytes into private temporary staging, then reuse the authenticated bundle, restore, audit and retention gates. Record the logical source upload root separately from staging. Recovery verifies restored object rows as well as extracted file payloads. No backup worker receives the application encryption key. A remote GitHub worker can now capture uploaded files without access to Render's ephemeral disk.

The live scanner configuration must remain fail-closed. Do not bypass production scanning to manufacture an upload success. Verification may use an explicitly synthetic operator-seeded encrypted PDF and must distinguish that check from a normal scanned upload if ClamAV remains unavailable.

## Tasks

1. Write failing PostgreSQL/HTTP tests for encrypted persistence, access-controlled downloads after filesystem loss, immutable rows, bounded quota accounting, scanner failure and cleanup. Add migration 032 and the application storage adapter; run tests and commit.
2. Write failing coordinated PostgreSQL-file snapshot/recovery tests, including concurrent commits, fingerprint-only reader access and missing/altered blobs. Integrate source and restored-row checks; run the full suites and commit.
3. Review the complete extension independently, fix material findings with regressions, pass hosted checks, apply the additive migration before deployment and preserve exact migration hashes. Merge with meaningful commits and deploy.
4. Configure Render's durable file backend and logical root, switch the serialized GitHub backup workflow to coordinated/PostgreSQL mode, verify a live synthetic file read, a fresh B2 upload/download/full recovery, and application decryption. Check a second execution for safe retention, document actual source/deploy/run evidence and clean owned fixtures. Preserve existing keys and previous archives.

New persistent clinical data access must remain limited to the existing authorized application and backup principals. Do not add a public maintenance endpoint, install an administrator key into a worker, upgrade billing or weaken scanning/TLS.
