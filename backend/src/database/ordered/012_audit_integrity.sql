-- Serialize all writers, including direct SQL inserts, and protect retained evidence.
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS sequence BIGSERIAL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_sequence ON audit_logs(sequence);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS hash_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS hash_payload TEXT;

CREATE OR REPLACE FUNCTION audit_payload(entry audit_logs) RETURNS TEXT
LANGUAGE SQL IMMUTABLE AS $$
    SELECT (to_jsonb(entry) - ARRAY['previous_hash','current_hash','hash_payload'])::text
$$;

CREATE OR REPLACE FUNCTION chain_audit_insert() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(731405922);
    -- Allocate sequence after taking the lock, so ordering matches commit order.
    NEW.sequence := nextval(pg_get_serial_sequence('audit_logs','sequence'));
    NEW.timestamp := clock_timestamp();
    NEW.hash_version := 1;
    SELECT current_hash INTO NEW.previous_hash FROM audit_logs ORDER BY sequence DESC LIMIT 1;
    NEW.hash_payload := audit_payload(NEW);
    NEW.current_hash := encode(digest(COALESCE(NEW.previous_hash,'') || NEW.hash_payload,'sha256'),'hex');
    RETURN NEW;
END $$;
CREATE TRIGGER chain_audit_insert BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION chain_audit_insert();

CREATE OR REPLACE FUNCTION prevent_audit_mutation() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are append-only';
END $$;
CREATE TRIGGER prevent_audit_mutation BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

-- Department/profile fields used by the research account screen.
ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(255);
