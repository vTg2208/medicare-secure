-- Migration to add Nurse Profile fields and table
-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Add professional details to staff_org_mapping (for all staff roles)
ALTER TABLE staff_org_mapping 
ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS department VARCHAR(100),
ADD COLUMN IF NOT EXISTS assigned_wards TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS shift_preference VARCHAR(50);

-- 2. Create nurse_profiles table for personal contact data
CREATE TABLE IF NOT EXISTS nurse_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    address TEXT,
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    emergency_contact_relation VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Add trigger for updated_at if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_nurse_profiles_updated_at') THEN
        CREATE TRIGGER update_nurse_profiles_updated_at 
        BEFORE UPDATE ON nurse_profiles
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
