-- Migration: Add OTP and Access Level to Visits
-- Purpose: Enable OTP verification and access level selection for visits
-- Date: 2026-02-09

-- Add OTP and access level columns to visits table
ALTER TABLE visits 
ADD COLUMN IF NOT EXISTS otp_code VARCHAR(6),
ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS otp_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS access_level VARCHAR(20) CHECK (access_level IN ('read', 'write'));

-- Index for OTP lookups (only non-verified OTPs)
DROP INDEX IF EXISTS idx_visits_otp;
CREATE INDEX IF NOT EXISTS idx_visits_otp ON visits(otp_code) WHERE NOT otp_verified;

-- Index for access level
DROP INDEX IF EXISTS idx_visits_access_level;
CREATE INDEX IF NOT EXISTS idx_visits_access_level ON visits(access_level);

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Migration completed: Added OTP and access level to visits table';
END $$;
