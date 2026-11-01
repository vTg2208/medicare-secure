-- Retain clinical mutation evidence in the same PostgreSQL transaction as the
-- changed row. Failure to append the existing hash chain aborts the mutation.
-- Request identity comes only from transaction-local, server-bound settings.
CREATE OR REPLACE FUNCTION audit_clinical_change() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    entry JSONB;
    resource_id UUID;
    patient UUID;
    visit UUID;
    record UUID;
    organization UUID;
    actor UUID;
    correlation TEXT;
BEGIN
    entry := CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
    resource_id := (entry->>'id')::uuid;
    patient := NULLIF(entry->>'patient_id','')::uuid;
    visit := NULLIF(entry->>'visit_id','')::uuid;
    record := NULLIF(entry->>'record_id','')::uuid;
    organization := NULLIF(entry->>'organization_id','')::uuid;
    actor := NULLIF(current_setting('shms.actor_id',true),'')::uuid;
    correlation := NULLIF(current_setting('shms.request_id',true),'');

    IF correlation IS NOT NULL AND actor IS NULL THEN
        RAISE EXCEPTION 'Authenticated actor is required for request-bound clinical mutations';
    END IF;
    IF record IS NOT NULL THEN
        SELECT mr.patient_id, mr.visit_id INTO patient,visit FROM medical_records mr WHERE mr.id=record;
    END IF;
    IF TG_TABLE_NAME='visits' THEN visit := resource_id; END IF;
    IF visit IS NOT NULL THEN
        SELECT COALESCE(patient,v.patient_id),COALESCE(organization,v.organization_id)
        INTO patient,organization FROM visits v WHERE v.id=visit;
    END IF;

    INSERT INTO audit_logs(user_id,action,entity_type,entity_id,purpose,request_method,metadata)
    VALUES(actor,'clinical_change',TG_TABLE_NAME,resource_id,'Clinical mutation evidence',
        NULLIF(current_setting('shms.request_method',true),''),
        jsonb_build_object('operation',TG_OP,'table',TG_TABLE_NAME,'resourceId',resource_id,
            'patientId',patient,'visitId',visit,'organizationId',organization,
            'requestId',correlation,'databasePrincipal',session_user,
            'actorSource',CASE WHEN actor IS NULL THEN 'database_principal' ELSE 'authenticated_request' END));
    RETURN NULL;
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Clinical change audit could not be recorded' USING ERRCODE='P7501';
END $$;

DO $$
DECLARE table_name TEXT;
BEGIN
    -- Nurse vital signs are stored as medical_records of type note/procedure/
    -- other, so the medical_records trigger also covers their creation.
    FOREACH table_name IN ARRAY ARRAY['medical_records','diagnoses','prescriptions',
        'lab_results','imaging_reports','radiology_reports','lab_orders','imaging_orders',
        'medication_orders','visits','visit_notes','triage_sessions','care_team_assignments',
        'visit_staff_assignments','bed_allocations']
    LOOP
        EXECUTE format('CREATE TRIGGER clinical_change_audit AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_clinical_change()',table_name);
    END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_patient_ids ON audit_logs USING GIN ((metadata->'patientIds'));
