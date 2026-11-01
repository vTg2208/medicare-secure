-- Historical diagnosis status edits had no activity timestamp. Conservatively
-- restart their clock on upgrade rather than assume old creation is last use.
ALTER TABLE diagnoses ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE TRIGGER update_diagnoses_updated_at BEFORE UPDATE ON diagnoses
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
ALTER TABLE retention_disposals ADD COLUMN superseded_at TIMESTAMPTZ;
ALTER TABLE retention_disposals ADD COLUMN superseded_by UUID REFERENCES users(id);
ALTER TABLE retention_disposals DROP CONSTRAINT retention_disposals_status_check;
ALTER TABLE retention_disposals ADD CONSTRAINT retention_disposals_status_check CHECK(status IN ('approved','superseded','database_disposed','completed'));
CREATE OR REPLACE FUNCTION protect_retention_disposal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Disposal decisions are retained'; END IF;
    IF OLD.status='approved' AND NEW.status='superseded' THEN
        IF (to_jsonb(NEW)-'status'-'superseded_at'-'superseded_by') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'superseded_at'-'superseded_by')
            OR NEW.superseded_at IS NULL OR NEW.superseded_by IS NULL
            OR EXISTS(SELECT 1 FROM retention_policies WHERE id=OLD.policy_id AND active)
            OR NOT EXISTS(SELECT 1 FROM users u JOIN roles r ON r.id=u.role_id
                WHERE u.id=NEW.superseded_by AND u.status='active' AND r.name='compliance_officer'
                AND u.id=NULLIF(current_setting('shms.actor_id',true),'')::uuid) THEN
            RAISE EXCEPTION 'Only reviewed obsolete approvals may be superseded';
        END IF;
        RETURN NEW;
    END IF;
    IF current_user<>pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid=TG_RELID)) THEN
        RAISE EXCEPTION 'A separate database owner must execute disposal' USING ERRCODE='42501';
    END IF;
    IF (to_jsonb(NEW)-'status'-'executed_at'-'executed_by') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'executed_at'-'executed_by')
        OR NOT ((OLD.status='approved' AND NEW.status IN ('database_disposed','completed')) OR (OLD.status='database_disposed' AND NEW.status='completed')) THEN
        RAISE EXCEPTION 'Disposal evidence can only advance to its actual execution state';
    END IF;
    RETURN NEW;
END $$;
