CREATE TABLE patient_processing_controls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES users(id),
    request_id UUID NOT NULL REFERENCES privacy_rights_requests(id),
    purpose TEXT NOT NULL CHECK (purpose IN ('treatment','research','insurance','ai','messaging','all')),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    released_at TIMESTAMPTZ,
    released_by UUID REFERENCES users(id)
);
CREATE UNIQUE INDEX idx_processing_active ON patient_processing_controls(patient_id,purpose) WHERE released_at IS NULL;
CREATE FUNCTION protect_processing_control() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Processing decisions are retained'; END IF;
    IF (to_jsonb(NEW)-'released_at'-'released_by') IS DISTINCT FROM (to_jsonb(OLD)-'released_at'-'released_by')
        OR OLD.released_at IS NOT NULL OR NEW.released_at IS NULL OR NEW.released_by IS NULL THEN
        RAISE EXCEPTION 'Processing decisions can only be released once';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER protect_processing_control BEFORE UPDATE OR DELETE ON patient_processing_controls FOR EACH ROW EXECUTE FUNCTION protect_processing_control();
CREATE TRIGGER clinical_change_audit AFTER INSERT OR UPDATE ON patient_processing_controls FOR EACH ROW EXECUTE FUNCTION audit_clinical_change();
CREATE TABLE medical_record_corrections (
    id UUID PRIMARY KEY,
    record_id UUID NOT NULL REFERENCES medical_records(id),
    patient_id UUID NOT NULL REFERENCES users(id),
    request_id UUID NOT NULL REFERENCES privacy_rights_requests(id),
    created_by UUID NOT NULL REFERENCES users(id),
    text_cipher TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE FUNCTION protect_record_correction() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Clinical corrections are retained addenda'; END $$;
CREATE TRIGGER protect_record_correction BEFORE UPDATE OR DELETE ON medical_record_corrections FOR EACH ROW EXECUTE FUNCTION protect_record_correction();
CREATE TRIGGER clinical_change_audit AFTER INSERT ON medical_record_corrections FOR EACH ROW EXECUTE FUNCTION audit_clinical_change();
