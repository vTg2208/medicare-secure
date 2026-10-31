CREATE OR REPLACE FUNCTION prevent_medical_record_delete() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Medical records are retained and cannot be deleted'; END $$;
CREATE TRIGGER prevent_medical_record_delete BEFORE DELETE ON medical_records FOR EACH ROW EXECUTE FUNCTION prevent_medical_record_delete();
