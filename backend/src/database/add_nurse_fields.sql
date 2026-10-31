-- Add assigned_wards and shift_preference to staff_org_mapping
ALTER TABLE staff_org_mapping ADD COLUMN IF NOT EXISTS assigned_wards TEXT[] DEFAULT '{}';
ALTER TABLE staff_org_mapping ADD COLUMN IF NOT EXISTS shift_preference VARCHAR(50);
