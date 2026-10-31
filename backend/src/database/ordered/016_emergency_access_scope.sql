ALTER TABLE emergency_access_grants ADD COLUMN IF NOT EXISTS visit_id UUID REFERENCES visits(id);
ALTER TABLE emergency_access_grants ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_emergency_grant_patient_user ON emergency_access_grants(patient_id,user_id,expires_at) WHERE status='active';
