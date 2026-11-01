-- A locked head row makes stale repeatable-read writers fail with 40001 rather
-- than selecting an old chain tip and silently creating a fork.
SELECT pg_advisory_xact_lock(731405922);
CREATE TABLE audit_chain_head (
    singleton INTEGER PRIMARY KEY CHECK (singleton=1),
    last_hash TEXT
);
INSERT INTO audit_chain_head(singleton,last_hash)
VALUES(1,(SELECT current_hash FROM audit_logs ORDER BY sequence DESC LIMIT 1));
REVOKE ALL ON audit_chain_head FROM PUBLIC;

CREATE FUNCTION protect_audit_chain_head() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
    IF TG_OP <> 'UPDATE' OR pg_trigger_depth() < 2 OR NEW.singleton <> OLD.singleton THEN
        RAISE EXCEPTION 'Audit chain head can only advance inside the audit insert trigger';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER protect_audit_chain_head BEFORE INSERT OR UPDATE OR DELETE ON audit_chain_head
FOR EACH ROW EXECUTE FUNCTION protect_audit_chain_head();

DO $migration$
DECLARE
    application_schema TEXT := current_schema();
    crypto_schema TEXT;
BEGIN
    SELECT n.nspname INTO crypto_schema FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pgcrypto';
    IF crypto_schema IS NULL THEN RAISE EXCEPTION 'pgcrypto is required for the retained audit chain'; END IF;
    -- Explicit schema qualification prevents temporary tables/functions from
    -- shadowing integrity state. No SECURITY DEFINER privileges are introduced.
    EXECUTE format($definition$
        CREATE OR REPLACE FUNCTION %1$I.chain_audit_insert() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=pg_catalog AS $chain$
        BEGIN
            PERFORM pg_advisory_xact_lock(731405922);
            NEW.sequence := nextval(pg_get_serial_sequence(%3$L,'sequence'));
            NEW.timestamp := clock_timestamp();
            NEW.hash_version := 1;
            SELECT last_hash INTO NEW.previous_hash FROM %1$I.audit_chain_head WHERE singleton=1 FOR UPDATE;
            IF NOT FOUND THEN RAISE EXCEPTION 'Audit chain head is missing'; END IF;
            NEW.hash_payload := %1$I.audit_payload(NEW);
            NEW.current_hash := encode(%2$I.digest(COALESCE(NEW.previous_hash,'') || NEW.hash_payload,'sha256'),'hex');
            UPDATE %1$I.audit_chain_head SET last_hash=NEW.current_hash WHERE singleton=1;
            RETURN NEW;
        END $chain$
    $definition$,application_schema,crypto_schema,format('%I.audit_logs',application_schema));
END $migration$;
