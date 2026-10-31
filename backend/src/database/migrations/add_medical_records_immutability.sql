-- Migration: Add immutability constraints to medical_records
-- Purpose: Prevent any updates to medical records once created
-- Date: 2026-02-09

-- Set default value for immutable_flag to true
ALTER TABLE medical_records 
ALTER COLUMN immutable_flag SET DEFAULT true;

-- Update existing records to be immutable
UPDATE medical_records 
SET immutable_flag = true 
WHERE immutable_flag IS NULL OR immutable_flag = false;

-- Make immutable_flag NOT NULL
ALTER TABLE medical_records 
ALTER COLUMN immutable_flag SET NOT NULL;

-- Create function to prevent updates to immutable records
CREATE OR REPLACE FUNCTION prevent_medical_record_updates()
RETURNS TRIGGER AS $$
BEGIN
    -- Prevent any updates to immutable medical records
    IF OLD.immutable_flag = true THEN
        RAISE EXCEPTION 'Medical records are immutable and cannot be updated. Record ID: %', OLD.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce immutability
DROP TRIGGER IF EXISTS prevent_record_updates ON medical_records;

CREATE TRIGGER prevent_record_updates
    BEFORE UPDATE ON medical_records
    FOR EACH ROW
    EXECUTE FUNCTION prevent_medical_record_updates();

-- Add comment for documentation
COMMENT ON TRIGGER prevent_record_updates ON medical_records IS 
'Prevents updates to medical records to maintain data integrity and audit trail';

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'Migration completed: Medical records immutability constraints added';
END $$;
