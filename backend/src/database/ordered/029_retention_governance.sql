CREATE TABLE retention_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), organization_id UUID REFERENCES organizations(id),
    record_type TEXT NOT NULL, retention_days INTEGER NOT NULL CHECK (retention_days BETWEEN 1 AND 365000),
    jurisdiction TEXT NOT NULL, basis_cipher TEXT NOT NULL, created_by UUID NOT NULL REFERENCES users(id),
    active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_retention_policy_active ON retention_policies(organization_id,record_type) NULLS NOT DISTINCT WHERE active;
CREATE TABLE retention_holds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), patient_id UUID NOT NULL REFERENCES users(id),
    basis_cipher TEXT NOT NULL, created_by UUID NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    released_at TIMESTAMPTZ, released_by UUID REFERENCES users(id)
);
CREATE INDEX idx_retention_holds_patient ON retention_holds(patient_id) WHERE released_at IS NULL;
CREATE TABLE retention_disposals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), record_id UUID NOT NULL, patient_id UUID NOT NULL REFERENCES users(id),
    resource_type TEXT NOT NULL DEFAULT 'medical_record' CHECK (resource_type IN ('medical_record','care_message','triage_session')),
    policy_id UUID NOT NULL REFERENCES retention_policies(id), basis_cipher TEXT NOT NULL,
    approved_by UUID NOT NULL REFERENCES users(id), approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved','database_disposed','completed')),
    executed_at TIMESTAMPTZ, executed_by TEXT
);
CREATE UNIQUE INDEX idx_retention_disposal_approved ON retention_disposals(record_id) WHERE status='approved';
CREATE TABLE retention_file_cleanup (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), disposal_id UUID NOT NULL REFERENCES retention_disposals(id),
    patient_id UUID NOT NULL REFERENCES users(id), file_type TEXT NOT NULL, file_name TEXT NOT NULL, cleaned_at TIMESTAMPTZ,
    UNIQUE(disposal_id,file_type,file_name)
);
CREATE FUNCTION protect_retention_policy() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Retention policy history is retained'; END IF;
    IF (to_jsonb(NEW)-'active') IS DISTINCT FROM (to_jsonb(OLD)-'active') OR NOT OLD.active OR NEW.active THEN
        RAISE EXCEPTION 'Policies can only be superseded by a new reviewed policy';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER protect_retention_policy BEFORE UPDATE OR DELETE ON retention_policies FOR EACH ROW EXECUTE FUNCTION protect_retention_policy();
CREATE TRIGGER protect_retention_hold BEFORE UPDATE OR DELETE ON retention_holds FOR EACH ROW EXECUTE FUNCTION protect_processing_control();
CREATE FUNCTION protect_retention_disposal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Disposal decisions are retained'; END IF;
    IF current_user<>pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid=TG_RELID)) THEN
        RAISE EXCEPTION 'A separate database owner must execute disposal' USING ERRCODE='42501';
    END IF;
    IF (to_jsonb(NEW)-'status'-'executed_at'-'executed_by') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'executed_at'-'executed_by')
        OR NOT ((OLD.status='approved' AND NEW.status IN ('database_disposed','completed')) OR (OLD.status='database_disposed' AND NEW.status='completed')) THEN
        RAISE EXCEPTION 'Disposal evidence can only advance to its actual execution state';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER protect_retention_disposal BEFORE UPDATE OR DELETE ON retention_disposals FOR EACH ROW EXECUTE FUNCTION protect_retention_disposal();
CREATE TRIGGER clinical_change_audit AFTER INSERT OR UPDATE ON retention_holds FOR EACH ROW EXECUTE FUNCTION audit_clinical_change();
