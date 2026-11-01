-- Trigger depth does not establish who owns an invoking trigger. Runtime roles
-- must have no head-write privileges, even through their own temporary triggers.
SELECT pg_advisory_xact_lock(731405922);
DO $migration$
DECLARE
    application_schema TEXT := current_schema();
    crypto_schema TEXT;
    protected_table RECORD;
    grantee_oid OID;
    grantee_sql TEXT;
    columns_sql TEXT;
    chain_function OID;
    chain_owner OID;
BEGIN
    SELECT n.nspname INTO crypto_schema FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pgcrypto';
    IF crypto_schema IS NULL THEN RAISE EXCEPTION 'pgcrypto is required for the retained audit chain'; END IF;

    EXECUTE format($definition$
        CREATE OR REPLACE FUNCTION %1$I.chain_audit_insert() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $chain$
        BEGIN
            -- A previously created temporary trigger must not gain this owner's
            -- head-write authority when the function becomes SECURITY DEFINER.
            IF TG_RELID<>%3$L::regclass OR TG_OP<>'INSERT' OR TG_WHEN<>'BEFORE' THEN
                RAISE EXCEPTION 'Audit chain function is private to the retained audit insert trigger' USING ERRCODE='42501';
            END IF;
            PERFORM pg_advisory_xact_lock(731405922);
            NEW.sequence := nextval(pg_get_serial_sequence(%3$L,'sequence'));
            NEW.timestamp := clock_timestamp();
            NEW.hash_version := 1;
            SELECT last_hash INTO NEW.previous_hash FROM %1$I.audit_chain_head WHERE singleton=1 FOR UPDATE;
            IF NOT FOUND THEN RAISE EXCEPTION 'Audit chain head is missing'; END IF;
            NEW.hash_payload := %1$I.audit_payload(NEW);
            NEW.current_hash := encode(%2$I.digest(COALESCE(NEW.previous_hash,'')||NEW.hash_payload,'sha256'),'hex');
            UPDATE %1$I.audit_chain_head SET last_hash=NEW.current_hash WHERE singleton=1;
            RETURN NEW;
        END $chain$
    $definition$,application_schema,crypto_schema,format('%I.audit_logs',application_schema));

    -- Include column ACLs and inherited group grants. Remove prohibited rights
    -- without granting new read/insert authority to monitor or column-only roles.
    -- Removing TRIGGER on audit_logs also prevents cancellation or
    -- duplicate triggers from advancing the head without a retained insert.
    FOR protected_table IN SELECT c.oid,c.relowner,c.relname,c.relacl FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname=application_schema AND c.relname IN ('audit_chain_head','audit_logs')
    LOOP
        SELECT string_agg(quote_ident(attname),',') INTO columns_sql FROM pg_attribute WHERE attrelid=protected_table.oid AND attnum>0 AND NOT attisdropped;
        FOR grantee_oid IN
            SELECT DISTINCT grant_entry.grantee FROM (
                SELECT x.grantee FROM aclexplode(COALESCE(protected_table.relacl,acldefault('r',protected_table.relowner))) x
                UNION ALL SELECT x.grantee FROM pg_attribute a CROSS JOIN LATERAL aclexplode(a.attacl) x
                    WHERE a.attrelid=protected_table.oid AND a.attnum>0 AND NOT a.attisdropped
            ) grant_entry WHERE grant_entry.grantee<>protected_table.relowner
        LOOP
            grantee_sql := CASE WHEN grantee_oid=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(grantee_oid)) END;
            EXECUTE format('REVOKE UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER%s ON TABLE %I.%I FROM %s CASCADE',
                CASE WHEN protected_table.relname='audit_chain_head' THEN ',INSERT' ELSE '' END,application_schema,protected_table.relname,grantee_sql);
            EXECUTE format('REVOKE UPDATE (%s),REFERENCES (%s)%s ON TABLE %I.%I FROM %s CASCADE',columns_sql,columns_sql,
                CASE WHEN protected_table.relname='audit_chain_head' THEN format(',INSERT (%s)',columns_sql) ELSE '' END,
                application_schema,protected_table.relname,grantee_sql);
        END LOOP;
        EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE %I.%I FROM PUBLIC',application_schema,protected_table.relname);
    END LOOP;

    SELECT p.oid,p.proowner INTO chain_function,chain_owner FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname=application_schema AND p.proname='chain_audit_insert' AND p.pronargs=0;
    FOR grantee_oid IN SELECT DISTINCT x.grantee FROM pg_proc p CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) x
        WHERE p.oid=chain_function AND x.grantee<>chain_owner
    LOOP
        grantee_sql := CASE WHEN grantee_oid=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(grantee_oid)) END;
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.chain_audit_insert() FROM %s CASCADE',application_schema,grantee_sql);
    END LOOP;
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.chain_audit_insert() FROM PUBLIC',application_schema);
END $migration$;
