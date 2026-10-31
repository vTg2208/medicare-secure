-- ============================================
-- Epic 3: EMR (Electronic Medical Records) Schema
-- Healthcare Management System
-- ============================================

-- ============================================
-- VISITS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show')),
    visit_code VARCHAR(20) UNIQUE NOT NULL,
    visit_type VARCHAR(50) DEFAULT 'consultation',
    chief_complaint TEXT,
    check_in_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    check_out_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ensure visit_code exists (idempotent for existing tables)
ALTER TABLE visits ADD COLUMN IF NOT EXISTS visit_code VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_visits_patient ON visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_organization ON visits(organization_id);
CREATE INDEX IF NOT EXISTS idx_visits_status ON visits(status);
CREATE INDEX IF NOT EXISTS idx_visits_code ON visits(visit_code);
CREATE INDEX IF NOT EXISTS idx_visits_check_in_time ON visits(check_in_time);

-- ============================================
-- VISIT_STAFF_ASSIGNMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS visit_staff_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    visit_id UUID REFERENCES visits(id) ON DELETE CASCADE NOT NULL,
    staff_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    role VARCHAR(50) NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(visit_id, staff_user_id)
);

CREATE INDEX IF NOT EXISTS idx_visit_staff_visit ON visit_staff_assignments(visit_id);
CREATE INDEX IF NOT EXISTS idx_visit_staff_user ON visit_staff_assignments(staff_user_id);

-- ============================================
-- MEDICAL_RECORDS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS medical_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    visit_id UUID REFERENCES visits(id),
    type VARCHAR(50) NOT NULL CHECK (type IN ('consultation', 'diagnosis', 'treatment', 'prescription', 'lab_result', 'imaging', 'procedure', 'vaccination', 'other')),
    title VARCHAR(255),
    description TEXT,
    created_by UUID REFERENCES users(id) NOT NULL,
    immutable_flag BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_medical_records_patient ON medical_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_visit ON medical_records(visit_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_type ON medical_records(type);
CREATE INDEX IF NOT EXISTS idx_medical_records_created_by ON medical_records(created_by);
CREATE INDEX IF NOT EXISTS idx_medical_records_created_at ON medical_records(created_at DESC);

-- ============================================
-- DIAGNOSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS diagnoses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    record_id UUID REFERENCES medical_records(id) ON DELETE CASCADE NOT NULL,
    icd_code VARCHAR(20) NOT NULL,
    description TEXT NOT NULL,
    severity VARCHAR(20) CHECK (severity IN ('mild', 'moderate', 'severe', 'critical')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'chronic', 'ruled_out')),
    version INTEGER DEFAULT 1,
    is_primary BOOLEAN DEFAULT FALSE,
    notes TEXT,
    diagnosed_by UUID REFERENCES users(id) NOT NULL,
    diagnosed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_diagnoses_record ON diagnoses(record_id);
CREATE INDEX IF NOT EXISTS idx_diagnoses_icd_code ON diagnoses(icd_code);
CREATE INDEX IF NOT EXISTS idx_diagnoses_status ON diagnoses(status);
CREATE INDEX IF NOT EXISTS idx_diagnoses_diagnosed_by ON diagnoses(diagnosed_by);
CREATE INDEX IF NOT EXISTS idx_diagnoses_version ON diagnoses(record_id, version);

-- ============================================
-- PRESCRIPTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS prescriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    record_id UUID REFERENCES medical_records(id) ON DELETE CASCADE NOT NULL,
    medication VARCHAR(255) NOT NULL,
    generic_name VARCHAR(255),
    drug_code VARCHAR(50),
    dosage VARCHAR(100) NOT NULL,
    frequency VARCHAR(100) NOT NULL,
    route VARCHAR(50) CHECK (route IN ('oral', 'intravenous', 'intramuscular', 'subcutaneous', 'topical', 'inhalation', 'other')),
    duration VARCHAR(100),
    quantity INTEGER,
    refills INTEGER DEFAULT 0,
    instructions TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled', 'expired')),
    prescribed_by UUID REFERENCES users(id) NOT NULL,
    prescribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    dispensed_at TIMESTAMP,
    dispensed_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_record ON prescriptions(record_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_medication ON prescriptions(medication);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_prescriptions_prescribed_by ON prescriptions(prescribed_by);
CREATE INDEX IF NOT EXISTS idx_prescriptions_prescribed_at ON prescriptions(prescribed_at DESC);

-- ============================================
-- LAB_RESULTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS lab_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    record_id UUID REFERENCES medical_records(id) ON DELETE CASCADE NOT NULL,
    test_name VARCHAR(255) NOT NULL,
    test_code VARCHAR(50),
    test_category VARCHAR(100),
    file_url TEXT,
    file_name VARCHAR(255),
    file_type VARCHAR(50),
    file_size INTEGER,
    results_data JSONB,
    interpretation TEXT,
    reference_range TEXT,
    abnormal_flag BOOLEAN DEFAULT FALSE,
    immutable BOOLEAN DEFAULT TRUE,
    ordered_by UUID REFERENCES users(id) NOT NULL,
    performed_by UUID REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    result_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lab_results_record ON lab_results(record_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_test_name ON lab_results(test_name);
CREATE INDEX IF NOT EXISTS idx_lab_results_test_category ON lab_results(test_category);
CREATE INDEX IF NOT EXISTS idx_lab_results_ordered_by ON lab_results(ordered_by);
CREATE INDEX IF NOT EXISTS idx_lab_results_uploaded_at ON lab_results(uploaded_at DESC);

-- ============================================
-- IMAGING_REPORTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS imaging_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    record_id UUID REFERENCES medical_records(id) ON DELETE CASCADE NOT NULL,
    imaging_type VARCHAR(100) NOT NULL CHECK (imaging_type IN ('x-ray', 'ct_scan', 'mri', 'ultrasound', 'pet_scan', 'mammogram', 'dicom', 'other')),
    body_part VARCHAR(100),
    file_url TEXT NOT NULL,
    file_name VARCHAR(255),
    file_type VARCHAR(50),
    file_size INTEGER,
    is_dicom BOOLEAN DEFAULT FALSE,
    dicom_metadata JSONB,
    findings TEXT,
    impression TEXT,
    radiologist_notes TEXT,
    ordered_by UUID REFERENCES users(id) NOT NULL,
    performed_by UUID REFERENCES users(id),
    reported_by UUID REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    study_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_imaging_reports_record ON imaging_reports(record_id);
CREATE INDEX IF NOT EXISTS idx_imaging_reports_type ON imaging_reports(imaging_type);
CREATE INDEX IF NOT EXISTS idx_imaging_reports_body_part ON imaging_reports(body_part);
CREATE INDEX IF NOT EXISTS idx_imaging_reports_ordered_by ON imaging_reports(ordered_by);
CREATE INDEX IF NOT EXISTS idx_imaging_reports_uploaded_at ON imaging_reports(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_imaging_reports_is_dicom ON imaging_reports(is_dicom);

-- ============================================
-- EMERGENCY_ACCESS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS emergency_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    patient_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    justification TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    approved_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_emergency_access_doctor ON emergency_access(doctor_id);
CREATE INDEX IF NOT EXISTS idx_emergency_access_patient ON emergency_access(patient_id);
CREATE INDEX IF NOT EXISTS idx_emergency_access_status ON emergency_access(status);
CREATE INDEX IF NOT EXISTS idx_emergency_access_start_time ON emergency_access(start_time DESC);

-- ============================================
-- CONSENTS TABLE (Epic 2 - if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS consents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    recipient_user_id UUID REFERENCES users(id),
    recipient_organization_id UUID REFERENCES organizations(id),
    data_category VARCHAR(50) NOT NULL CHECK (data_category IN ('ALL_RECORDS', 'DIAGNOSES', 'PRESCRIPTIONS', 'LAB_RESULTS', 'IMAGING', 'VITAL_SIGNS', 'ALLERGIES', 'IMMUNIZATIONS')),
    purpose VARCHAR(50) NOT NULL CHECK (purpose IN ('TREATMENT', 'RESEARCH', 'BILLING', 'INSURANCE', 'EMERGENCY', 'PERSONAL')),
    access_level VARCHAR(20) DEFAULT 'read' CHECK (access_level IN ('read', 'write', 'full')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired', 'pending')),
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP,
    revocation_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_consents_patient ON consents(patient_id);
CREATE INDEX IF NOT EXISTS idx_consents_recipient_user ON consents(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_consents_recipient_org ON consents(recipient_organization_id);
CREATE INDEX IF NOT EXISTS idx_consents_status ON consents(status);
CREATE INDEX IF NOT EXISTS idx_consents_data_category ON consents(data_category);

-- ============================================
-- TRIGGERS FOR EMR TABLES
-- ============================================

DROP TRIGGER IF EXISTS update_visits_updated_at ON visits;
CREATE TRIGGER update_visits_updated_at BEFORE UPDATE ON visits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_medical_records_updated_at ON medical_records;
CREATE TRIGGER update_medical_records_updated_at BEFORE UPDATE ON medical_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_prescriptions_updated_at ON prescriptions;
CREATE TRIGGER update_prescriptions_updated_at BEFORE UPDATE ON prescriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_consents_updated_at ON consents;
CREATE TRIGGER update_consents_updated_at BEFORE UPDATE ON consents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
