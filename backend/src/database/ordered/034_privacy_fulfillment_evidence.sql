ALTER TABLE privacy_rights_requests ADD CONSTRAINT privacy_request_owner UNIQUE(id,patient_id);
ALTER TABLE retention_disposals ADD CONSTRAINT retention_disposal_owner UNIQUE(id,patient_id);
CREATE TABLE privacy_export_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), request_id UUID NOT NULL, patient_id UUID NOT NULL,
    content_hash TEXT NOT NULL CHECK(content_hash ~ '^[a-f0-9]{64}$'),
    byte_length BIGINT NOT NULL CHECK(byte_length>0), schema_version INTEGER NOT NULL CHECK(schema_version>0),
    scope TEXT NOT NULL CHECK(length(scope) BETWEEN 1 AND 4000),
    exclusions JSONB NOT NULL CHECK(jsonb_typeof(exclusions)='array' AND octet_length(exclusions::text)<=16384),
    prepared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY(request_id,patient_id) REFERENCES privacy_rights_requests(id,patient_id),
    UNIQUE(id,request_id,patient_id,content_hash)
);
CREATE INDEX privacy_export_request ON privacy_export_receipts(request_id,prepared_at,id);
CREATE TABLE privacy_export_confirmations (
    receipt_id UUID PRIMARY KEY, request_id UUID NOT NULL, patient_id UUID NOT NULL, content_hash TEXT NOT NULL,
    confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY(receipt_id,request_id,patient_id,content_hash) REFERENCES privacy_export_receipts(id,request_id,patient_id,content_hash)
);
CREATE TABLE privacy_request_disposals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), request_id UUID NOT NULL, patient_id UUID NOT NULL,
    disposal_id UUID NOT NULL, linked_by UUID NOT NULL REFERENCES users(id), linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    explanation_cipher TEXT NOT NULL CHECK(length(explanation_cipher) BETWEEN 52 AND 32768),
    FOREIGN KEY(request_id,patient_id) REFERENCES privacy_rights_requests(id,patient_id),
    FOREIGN KEY(disposal_id,patient_id) REFERENCES retention_disposals(id,patient_id),
    UNIQUE(request_id,disposal_id)
);
CREATE FUNCTION protect_privacy_fulfillment_evidence() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'Privacy fulfillment evidence is immutable'; END $$;
CREATE TRIGGER protect_export_receipt BEFORE UPDATE OR DELETE ON privacy_export_receipts FOR EACH ROW EXECUTE FUNCTION protect_privacy_fulfillment_evidence();
CREATE TRIGGER protect_export_confirmation BEFORE UPDATE OR DELETE ON privacy_export_confirmations FOR EACH ROW EXECUTE FUNCTION protect_privacy_fulfillment_evidence();
CREATE TRIGGER protect_request_disposal BEFORE UPDATE OR DELETE ON privacy_request_disposals FOR EACH ROW EXECUTE FUNCTION protect_privacy_fulfillment_evidence();
REVOKE ALL ON privacy_export_receipts,privacy_export_confirmations,privacy_request_disposals FROM PUBLIC;
REVOKE ALL ON FUNCTION protect_privacy_fulfillment_evidence() FROM PUBLIC;
DO $fulfillment_roles$
DECLARE principal TEXT;
BEGIN
    FOREACH principal IN ARRAY ARRAY['healthcare_api','healthcare_backup','anon','authenticated'] LOOP
        IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=principal) THEN
            EXECUTE format('REVOKE ALL ON privacy_export_receipts,privacy_export_confirmations,privacy_request_disposals FROM %I',principal);
            EXECUTE format('REVOKE ALL ON FUNCTION protect_privacy_fulfillment_evidence() FROM %I',principal);
        END IF;
    END LOOP;
    IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='healthcare_api') THEN
        GRANT SELECT ON privacy_export_receipts,privacy_export_confirmations,privacy_request_disposals TO healthcare_api;
        GRANT INSERT(request_id,patient_id,content_hash,byte_length,schema_version,scope,exclusions) ON privacy_export_receipts TO healthcare_api;
        GRANT INSERT(receipt_id,request_id,patient_id,content_hash) ON privacy_export_confirmations TO healthcare_api;
        GRANT INSERT(id,request_id,patient_id,disposal_id,linked_by,explanation_cipher) ON privacy_request_disposals TO healthcare_api;
    END IF;
    IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='healthcare_backup') THEN
        GRANT SELECT ON privacy_export_receipts,privacy_export_confirmations,privacy_request_disposals TO healthcare_backup;
    END IF;
END
$fulfillment_roles$;
