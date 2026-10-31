-- Reconcile the actual application contract, including features whose historical
-- standalone setup scripts were absent from production provisioning.
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_notes TEXT;
ALTER TABLE staff_invitations ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE security_events ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Open';

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS hospital_code VARCHAR(6);
CREATE UNIQUE INDEX IF NOT EXISTS unique_hospital_code ON organizations(hospital_code);

ALTER TABLE visits ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'walk_in';
ALTER TABLE visits ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal';
ALTER TABLE visits ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS symptoms TEXT;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS assigned_doctor_id UUID REFERENCES users(id);
ALTER TABLE visits ADD COLUMN IF NOT EXISTS assigned_nurse_id UUID REFERENCES users(id);
ALTER TABLE visits ADD COLUMN IF NOT EXISTS scheduled_time TIMESTAMP;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS otp_code VARCHAR(255);
ALTER TABLE visits ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS otp_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS access_level VARCHAR(20) CHECK (access_level IN ('read','write'));
ALTER TABLE visits DROP CONSTRAINT IF EXISTS visits_status_check;
ALTER TABLE visits ADD CONSTRAINT visits_status_check CHECK (status IN ('pending','approved','scheduled','checked_in','in_progress','completed','cancelled','no_show'));
ALTER TABLE visits ALTER COLUMN status SET DEFAULT 'pending';
CREATE INDEX IF NOT EXISTS idx_visits_doctor ON visits(assigned_doctor_id);
CREATE INDEX IF NOT EXISTS idx_visits_nurse ON visits(assigned_nurse_id);
ALTER TABLE medical_records DROP CONSTRAINT IF EXISTS medical_records_type_check;
ALTER TABLE medical_records ADD CONSTRAINT medical_records_type_check CHECK (type IN ('consultation','diagnosis','treatment','prescription','lab_result','imaging','procedure','vaccination','note','other'));
ALTER TABLE medical_records ADD CONSTRAINT medical_records_visit_id_fkey FOREIGN KEY(visit_id) REFERENCES visits(id);

CREATE TABLE IF NOT EXISTS care_team_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    staff_user_id UUID NOT NULL REFERENCES users(id), role VARCHAR(50) NOT NULL,
    assigned_by UUID REFERENCES users(id), assigned_at TIMESTAMP DEFAULT NOW(),
    removed_by UUID REFERENCES users(id), removed_at TIMESTAMP, notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_care_assignment ON care_team_assignments(visit_id,staff_user_id,role) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_care_team_staff ON care_team_assignments(staff_user_id);

CREATE TABLE IF NOT EXISTS bed_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    ward VARCHAR(100) NOT NULL, room VARCHAR(100) NOT NULL, bed VARCHAR(100) NOT NULL, bed_type VARCHAR(50),
    allocated_by UUID REFERENCES users(id), allocated_at TIMESTAMP DEFAULT NOW(),
    released_by UUID REFERENCES users(id), released_at TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'occupied' CHECK(status IN ('occupied','released')),
    notes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bed_allocations_visit ON bed_allocations(visit_id);

CREATE TABLE IF NOT EXISTS lab_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    ordered_by UUID NOT NULL REFERENCES users(id), test_name VARCHAR(255) NOT NULL,
    test_code VARCHAR(50), test_category VARCHAR(100),
    priority VARCHAR(20) DEFAULT 'routine' CHECK(priority IN ('routine','urgent','stat')),
    status VARCHAR(30) DEFAULT 'ordered' CHECK(status IN ('ordered','collected','in_progress','completed','cancelled')),
    routed_to_department VARCHAR(100), clinical_indication TEXT, notes TEXT,
    specimen_collected_at TIMESTAMP, result_available_at TIMESTAMP,
    lab_result_id UUID REFERENCES lab_results(id), ordered_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lab_orders_visit ON lab_orders(visit_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_status ON lab_orders(status);

-- Imaging orders are written by visit-based clinical workflow; legacy patient
-- and study fields are optional because the visit supplies the patient identity.
ALTER TABLE imaging_orders ALTER COLUMN patient_id DROP NOT NULL;
ALTER TABLE imaging_orders ALTER COLUMN study_type DROP NOT NULL;
ALTER TABLE imaging_orders ADD COLUMN IF NOT EXISTS visit_id UUID REFERENCES visits(id) ON DELETE CASCADE;
ALTER TABLE imaging_orders ADD COLUMN IF NOT EXISTS ordered_by UUID REFERENCES users(id);
ALTER TABLE imaging_orders ADD COLUMN IF NOT EXISTS imaging_type VARCHAR(100);
ALTER TABLE imaging_orders ADD COLUMN IF NOT EXISTS routed_to_department VARCHAR(100);
ALTER TABLE imaging_orders ADD COLUMN IF NOT EXISTS contrast_used BOOLEAN DEFAULT FALSE;
ALTER TABLE imaging_orders ADD COLUMN IF NOT EXISTS scheduled_time TIMESTAMP;
ALTER TABLE imaging_orders ADD COLUMN IF NOT EXISTS performed_at TIMESTAMP;
ALTER TABLE imaging_orders ADD COLUMN IF NOT EXISTS ordered_at TIMESTAMP DEFAULT NOW();
ALTER TABLE imaging_orders ADD COLUMN IF NOT EXISTS imaging_report_id UUID REFERENCES imaging_reports(id);
CREATE INDEX IF NOT EXISTS idx_imaging_orders_visit ON imaging_orders(visit_id);

CREATE TABLE IF NOT EXISTS medication_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    prescription_id UUID REFERENCES prescriptions(id), medication VARCHAR(255) NOT NULL,
    dosage VARCHAR(100), route VARCHAR(100), frequency VARCHAR(100), ordered_by UUID NOT NULL REFERENCES users(id),
    ordered_at TIMESTAMP DEFAULT NOW(), status VARCHAR(30) DEFAULT 'ordered' CHECK(status IN ('ordered','dispensed','administered','discontinued')),
    dispensed_by UUID REFERENCES users(id), dispensed_at TIMESTAMP,
    administered_by UUID REFERENCES users(id), administered_at TIMESTAMP,
    discontinued_by UUID REFERENCES users(id), discontinued_at TIMESTAMP, discontinuation_reason TEXT,
    notes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_medication_orders_visit ON medication_orders(visit_id);
CREATE INDEX IF NOT EXISTS idx_medication_orders_status ON medication_orders(status);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL, title VARCHAR(255) NOT NULL, message TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal', channels JSONB DEFAULT '["in_app"]',
    related_entity_type VARCHAR(100), related_entity_id UUID, metadata JSONB DEFAULT '{}',
    read BOOLEAN DEFAULT FALSE, read_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS emergency_access_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id),
    patient_id UUID REFERENCES users(id), justification TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK(status IN ('active','expired','revoked')),
    expires_at TIMESTAMP NOT NULL, created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_emergency_grants_user ON emergency_access_grants(user_id,expires_at);

CREATE TABLE IF NOT EXISTS triage_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation JSONB DEFAULT '[]', soap_summary JSONB, recommended_department VARCHAR(255),
    priority VARCHAR(50) DEFAULT 'normal', confidence_score DECIMAL(3,2), status VARCHAR(50) DEFAULT 'in_progress',
    created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_triage_sessions_patient ON triage_sessions(patient_id,created_at DESC);
CREATE TRIGGER update_triage_sessions_updated_at BEFORE UPDATE ON triage_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS pharmacy_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(255) NOT NULL,
    generic_name VARCHAR(255), category VARCHAR(100), location VARCHAR(100),
    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK(stock_quantity >= 0),
    reorder_level INTEGER NOT NULL DEFAULT 10 CHECK(reorder_level >= 0), unit VARCHAR(50) DEFAULT 'units',
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
