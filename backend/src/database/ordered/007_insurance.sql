-- Phase 5: Insurance Module Schema
-- Secure Healthcare Management System

-- Insurance Policies Table
CREATE TABLE IF NOT EXISTS insurance_policies (
    id VARCHAR(50) PRIMARY KEY, -- e.g. POL-123456
    patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    member_name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('Premium', 'Basic', 'Family', 'Standard')),
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Expired', 'Suspended', 'Pending')),
    coverage_start DATE NOT NULL,
    coverage_end DATE NOT NULL,
    copay DECIMAL(10, 2) DEFAULT 0.00,
    deductible_used DECIMAL(10, 2) DEFAULT 0.00,
    deductible_total DECIMAL(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_insurance_policies_patient ON insurance_policies(patient_id);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_status ON insurance_policies(status);

-- Insurance Claims Table
CREATE TABLE IF NOT EXISTS insurance_claims (
    id VARCHAR(50) PRIMARY KEY, -- e.g. CLM-001
    visit_id UUID REFERENCES visits(id) ON DELETE SET NULL,
    patient_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    policy_id VARCHAR(50) REFERENCES insurance_policies(id) ON DELETE RESTRICT NOT NULL,
    diagnosis VARCHAR(255) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Denied', 'Processing')),
    notes TEXT,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_insurance_claims_patient ON insurance_claims(patient_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_policy ON insurance_claims(policy_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_status ON insurance_claims(status);

-- Trigger for insurance_claims updated_at
DROP TRIGGER IF EXISTS update_insurance_claims_updated_at ON insurance_claims;
CREATE TRIGGER update_insurance_claims_updated_at BEFORE UPDATE ON insurance_claims
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for insurance_policies updated_at
DROP TRIGGER IF EXISTS update_insurance_policies_updated_at ON insurance_policies;
CREATE TRIGGER update_insurance_policies_updated_at BEFORE UPDATE ON insurance_policies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
