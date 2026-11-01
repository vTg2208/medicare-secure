# Audit head privilege upgrade

This is a deployment runbook for the reviewed source. No hosted account, database role, or cloud database was changed by the source implementation or its isolated tests.

Use the migration-owner connection for ordered migrations. The running API must use a different, restricted application role. Preserve the existing encryption keys and obtain a verified encrypted database/file backup using the backup runbook before upgrading an existing installation.

1. Deploy the reviewed source and apply the entire ordered chain with `npm run db:migrate` from `backend` using migration-owner credentials. Migration `025` keeps the chain lock, qualifies the private hash function's schema, narrows its definer authority to the actual retained audit trigger, revokes runtime head mutation/function-execution rights and removes runtime audit-table trigger/truncate/update/delete rights. It does not revoke database-wide TEMP privileges or expand monitor/column-only grants.
2. In the same owner-controlled provisioning environment, set a distinct `DB_APP_USER` and `DB_APP_PASSWORD` and run `node scripts/provision-app-role.js`. The script grants application data access, then explicitly revokes head writes/private-function execution and retained-audit mutation/trigger privileges. Run the API with the application credentials; do not give it the migration-owner connection.
3. Restart the API and workers with the matching source and verify readiness. Confirm an ordinary authenticated clinical operation can append audit evidence, and run the integrity check. A stale repeatable-read operation may return a retryable serialization failure; it must not fork the retained chain.

For a fresh private browser installation, generate the installation SQL from the current source with `node scripts/export-browser-schema.js --output <new-output-file>`. It includes migration `025` under the `healthcare` schema and final PUBLIC revocations. Existing schemas must use ordered upgrades with owner review; do not bypass the installer's existing-schema guard or apply fresh-install SQL over retained data. Never reapply historical migration files by editing their recorded hashes.

With the runtime connection, these checks should return true, false, false and false respectively for a public-schema installation:

```sql
SELECT
  has_table_privilege(current_user,'public.audit_chain_head','SELECT') AS can_verify_head,
  has_table_privilege(current_user,'public.audit_chain_head','UPDATE') AS can_move_head,
  has_table_privilege(current_user,'public.audit_logs','TRIGGER') AS can_attach_audit_trigger,
  has_function_privilege(current_user,'public.chain_audit_insert()','EXECUTE') AS can_attach_private_function;
```

Use `healthcare` instead of `public` for a private-schema installation. An existing audit trigger remains able to append even though the runtime role cannot attach the definer function to another trigger. The disposable PostgreSQL regression suite verifies both schema layouts, broad default grants, reprovisioning and a pre-upgrade temporary trigger without modifying a hosted account.
