CREATE TABLE encrypted_upload_budget (
    singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton),
    max_bytes BIGINT NOT NULL DEFAULT 67108864 CHECK (max_bytes BETWEEN 37 AND 67108864),
    bytes_used BIGINT NOT NULL DEFAULT 0 CHECK (bytes_used BETWEEN 0 AND max_bytes)
);
INSERT INTO encrypted_upload_budget(singleton,bytes_used) VALUES(true,0);

CREATE TABLE encrypted_upload_objects (
    relative_key TEXT PRIMARY KEY CHECK (length(relative_key)<=600 AND relative_key ~ '^(documents/[a-zA-Z0-9][a-zA-Z0-9._-]*\.(pdf|png|jpg|jpeg)|medical_files/[a-fA-F0-9-]{36}/(lab_results|imaging)/[a-zA-Z0-9][a-zA-Z0-9._-]*\.(pdf|png|jpg|jpeg|gif|bmp|tif|tiff|doc|docx|dcm|dicom|txt|xml|csv))$'),
    ciphertext BYTEA NOT NULL CHECK (octet_length(ciphertext) BETWEEN 37 AND 10485796 AND substring(ciphertext FROM 1 FOR 8)=decode('53484d53454e4332','hex')),
    byte_length BIGINT GENERATED ALWAYS AS (octet_length(ciphertext)) STORED,
    cipher_sha256 TEXT GENERATED ALWAYS AS (encode(digest(ciphertext,'sha256'),'hex')) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE FUNCTION account_encrypted_upload_bytes() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE delta BIGINT; accounted BIGINT;
BEGIN
    IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Encrypted upload objects are immutable' USING ERRCODE='P7802'; END IF;
    delta:=CASE WHEN TG_OP='INSERT' THEN octet_length(NEW.ciphertext) ELSE -octet_length(OLD.ciphertext) END;
    EXECUTE format('UPDATE %I.encrypted_upload_budget SET bytes_used=bytes_used+$1 WHERE singleton=true AND bytes_used+$1 BETWEEN 0 AND max_bytes RETURNING bytes_used',TG_TABLE_SCHEMA)
      INTO accounted USING delta;
    IF accounted IS NULL THEN RAISE EXCEPTION 'Encrypted upload storage quota reached' USING ERRCODE='P7801'; END IF;
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION account_encrypted_upload_bytes() FROM PUBLIC;
CREATE TRIGGER account_encrypted_upload_bytes BEFORE INSERT OR UPDATE OR DELETE ON encrypted_upload_objects FOR EACH ROW EXECUTE FUNCTION account_encrypted_upload_bytes();
REVOKE ALL ON encrypted_upload_objects,encrypted_upload_budget FROM PUBLIC;

DO $upload_roles$
BEGIN
    IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='healthcare_api') THEN
        REVOKE ALL ON encrypted_upload_objects,encrypted_upload_budget FROM healthcare_api;
        GRANT SELECT,INSERT,DELETE ON encrypted_upload_objects TO healthcare_api;
    END IF;
    IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='healthcare_backup') THEN
        GRANT SELECT ON encrypted_upload_objects,encrypted_upload_budget TO healthcare_backup;
    END IF;
END
$upload_roles$;
