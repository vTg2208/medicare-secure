CREATE TABLE privacy_notice_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_number BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE CHECK (version_number>0),
    content JSONB NOT NULL CHECK (jsonb_typeof(content)='object' AND octet_length(content::text)<=65536),
    content_hash TEXT GENERATED ALWAYS AS (encode(digest(content::text,'sha256'),'hex')) STORED,
    review_basis_ciphertext TEXT NOT NULL CHECK (length(review_basis_ciphertext) BETWEEN 52 AND 12000 AND substring(decode(review_basis_ciphertext,'base64') FROM 1 FOR 8)=decode('53484d53454e4332','hex')),
    published_by UUID NOT NULL REFERENCES users(id),
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(id,content_hash)
);
CREATE TABLE privacy_notice_current (
    singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton),
    version_id UUID REFERENCES privacy_notice_versions(id)
);
INSERT INTO privacy_notice_current(singleton) VALUES(true);
CREATE TABLE privacy_notice_acknowledgements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES users(id),
    version_id UUID NOT NULL,
    notice_hash TEXT NOT NULL,
    acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY(version_id,notice_hash) REFERENCES privacy_notice_versions(id,content_hash),
    UNIQUE(patient_id,version_id)
);

CREATE FUNCTION protect_privacy_notice_history() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'Published privacy notices and acknowledgement history are immutable'; END $$;
CREATE TRIGGER protect_privacy_notice_versions BEFORE UPDATE OR DELETE ON privacy_notice_versions FOR EACH ROW EXECUTE FUNCTION protect_privacy_notice_history();
CREATE TRIGGER protect_privacy_notice_acknowledgements BEFORE UPDATE OR DELETE ON privacy_notice_acknowledgements FOR EACH ROW EXECUTE FUNCTION protect_privacy_notice_history();

CREATE FUNCTION advance_privacy_notice_current() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE previous_number BIGINT; next_number BIGINT;
BEGIN
    IF TG_OP='DELETE' OR NEW.singleton IS DISTINCT FROM OLD.singleton OR NEW.version_id IS NULL THEN
        RAISE EXCEPTION 'The current privacy notice must move forward to a newer publication';
    END IF;
    IF NEW.version_id IS NOT DISTINCT FROM OLD.version_id THEN RETURN NEW; END IF;
    IF OLD.version_id IS NOT NULL THEN
        EXECUTE format('SELECT version_number FROM %I.privacy_notice_versions WHERE id=$1',TG_TABLE_SCHEMA) INTO previous_number USING OLD.version_id;
    END IF;
    EXECUTE format('SELECT version_number FROM %I.privacy_notice_versions WHERE id=$1',TG_TABLE_SCHEMA) INTO next_number USING NEW.version_id;
    IF next_number IS NULL OR next_number<=COALESCE(previous_number,0) THEN
        RAISE EXCEPTION 'The current privacy notice must move forward to a newer publication';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER advance_privacy_notice_current BEFORE UPDATE OR DELETE ON privacy_notice_current FOR EACH ROW EXECUTE FUNCTION advance_privacy_notice_current();

REVOKE ALL ON privacy_notice_versions,privacy_notice_current,privacy_notice_acknowledgements FROM PUBLIC;
REVOKE ALL ON FUNCTION protect_privacy_notice_history(),advance_privacy_notice_current() FROM PUBLIC;
REVOKE ALL ON SEQUENCE privacy_notice_versions_version_number_seq FROM PUBLIC;
DO $notice_roles$
DECLARE principal TEXT;
BEGIN
    FOREACH principal IN ARRAY ARRAY['healthcare_api','healthcare_backup','anon','authenticated'] LOOP
        IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=principal) THEN
            EXECUTE format('REVOKE ALL ON privacy_notice_versions,privacy_notice_current,privacy_notice_acknowledgements FROM %I',principal);
            EXECUTE format('REVOKE ALL ON FUNCTION protect_privacy_notice_history(),advance_privacy_notice_current() FROM %I',principal);
            EXECUTE format('REVOKE ALL ON SEQUENCE privacy_notice_versions_version_number_seq FROM %I',principal);
        END IF;
    END LOOP;
    IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='healthcare_api') THEN
        GRANT SELECT ON privacy_notice_versions,privacy_notice_current,privacy_notice_acknowledgements TO healthcare_api;
        GRANT INSERT(id,content,review_basis_ciphertext,published_by) ON privacy_notice_versions TO healthcare_api;
        GRANT INSERT(patient_id,version_id,notice_hash) ON privacy_notice_acknowledgements TO healthcare_api;
        GRANT UPDATE(version_id) ON privacy_notice_current TO healthcare_api;
        GRANT USAGE,SELECT ON SEQUENCE privacy_notice_versions_version_number_seq TO healthcare_api;
    END IF;
    IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='healthcare_backup') THEN
        GRANT SELECT ON privacy_notice_versions,privacy_notice_current,privacy_notice_acknowledgements TO healthcare_backup;
    END IF;
END
$notice_roles$;
