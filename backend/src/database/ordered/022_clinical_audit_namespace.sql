-- Explicit pg_temp placement prevents a database connection's temporary tables
-- from shadowing retained evidence or the clinical parent lookup tables.
-- This remains an invoker function and introduces no elevated privileges.
DO $migration$
BEGIN
    EXECUTE format('ALTER FUNCTION %I.audit_clinical_change() SET search_path TO pg_catalog,%I,pg_temp',
        current_schema(),current_schema());
END $migration$;
