# Requirement-completion release procedure

The requirements and interface changes are integrated into `main` and deployed. Migrations `018`–`025` were applied to the existing private schema before releasing the API and frontend. See [the release verification](releases/2026-11-01-main-release.md). The steps below remain the migration and recovery procedure for subsequent releases.

## Review inputs

1. Read [the clause-by-clause matrix](requirements-traceability.md), [threat model](architecture-threat-model.md) and [audit integrity guarantees](clinical-audit-integrity.md).
2. Inspect the branch's focused commits and the new ordered migrations after `017`. Do not edit checksummed historical migration files or publish the original workspace's private/historical Git tree.
3. Use the retained sample dataset for verification. Normal feature routes are enabled; email verification requires configured SMTP, uploads require scanning and durable storage, and AI requires its explicitly enabled service. Actual patient information requires the operational/provider conditions in the requirement report.

## Verification and rollout order

1. Run the backend unit and real HTTP/PostgreSQL suites against a fresh disposable local database, including browser/private-schema installation, rollback, hash-chain concurrency, privacy/breach state, file migration and backup recovery. Provide matching trusted PostgreSQL client tools for the actual backup drill; skipped restore cases are not evidence of success.
2. Run frontend behavior tests, lint, the shared theme check and the production build. Review patient and officer privacy/breach screens in light/dark and narrow viewports. The local visual fixture page is intentionally distinct from real backend verification.
3. Before migrating an existing installation, make and verify an appropriate coordinated database/encrypted-file backup with separately retained keys. Apply the ordered migration chain under the migration owner, never the runtime API account. For the hosted private schema, use the reviewed browser SQL exporter/migration path and preserve the private schema and disabled public Data API.
4. Refresh runtime data privileges only as required for new tables/sequences, retain read-only `_migrations`, deny audit row update/delete, and retain the new head-table/function restrictions. Broad table grants must be followed by the explicit head/migration/audit revocations in the provisioning script. Verify the runtime role can append through the existing audit trigger but cannot modify its head or create a substitute trigger.
5. Upgrade existing encrypted files only through the explicit migration tool after its dry run and ciphertext backup. Do not silently re-enable unbound or plaintext download compatibility. No existing uploaded file was migrated by this implementation task.
6. Deploy the API only after its database migration succeeds, check `/readyz`, then deploy the frontend. Verify patient ownership, a purpose-mismatched denial, consent revocation, one clinical workflow, privacy export and officer-only breach casework with synthetic accounts.

## Existing private-schema browser upgrade

The hosted installation's reported baseline is migration `017`. Do not use `export-browser-schema.js` for that installation: it intentionally supports fresh installation only. Prepare a separate incremental artifact from the reviewed checkout:

```text
node backend/scripts/export-browser-upgrade.js --from 017 --output .local/browser-upgrade-017-to-025.sql
```

This command only writes SQL to the ignored project `.local` directory with exclusive creation; it loads no deployment credentials and makes no database or cloud connection. Review the artifact before using the SQL editor. It contains only pending migration bodies `018` through `025`, plus the exact expected ledger IDs/hashes and transaction guards. It does not rewrite historical migrations, drop/recreate the private schema or seed data.

After the coordinated encrypted backup has passed its restore drill, execute the complete artifact as one SQL-editor batch on one session under the migration owner. It takes the same migration advisory lock and a private-ledger table lock, fixes the application search path to `healthcare` with temporary objects last, and applies all pending DDL and ledger entries in one transaction. A verified exact `025` ledger makes replay a no-op. Unknown IDs, hash drift, missing entries, a different prefix or partial pending ledger all reject before changing application schema/data. A public shadow ledger cannot substitute for `healthcare._migrations`.

If the guard rejects the live ledger, stop and investigate the discrepancy; do not edit historical hashes, delete ledger entries or use the fresh installer to bypass it. Roll back an aborted SQL-editor transaction before another operation. Any pending migration failure rolls the whole batch back to the original prefix. Refresh only the runtime privileges described above after a successful upgrade. No live SQL has been applied by generating or testing this exporter.

The exporter is covered by `backend/tests/browser-upgrade.integration.test.js`, including an actual disposable PostgreSQL `017`→`025` private-schema upgrade, exact replay, advisory-lock waiting, ledger rejection without mutation, and complete-batch rollback on a late failure. Run it through the constrained offline PostgreSQL test runner; skipped database cases are not release evidence.

No cloud credential, TLS policy, public Data API setting or real notice destination needs to be weakened for this release. If actual patient deployment is later intended, first complete the environment/legal/operational evidence in the matrix and monitoring/recovery runbooks; the free demonstration is not that approval.
