-- ============================================================
-- Clinical Workflow Schema (Epic 4)
-- Visit lifecycle, imaging, and reporting workflows
-- ============================================================

-- Imaging orders table (if not already created by schema_emr.sql)
CREATE TABLE IF NOT EXISTS imaging_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ordering_physician_id UUID REFERENCES users(id),
    organization_id UUID REFERENCES organizations(id),
    study_type VARCHAR(100) NOT NULL,
    body_part VARCHAR(100),
    clinical_indication TEXT,
    priority VARCHAR(20) DEFAULT 'routine' CHECK (priority IN ('routine', 'urgent', 'stat')),
    status VARCHAR(30) DEFAULT 'ordered' CHECK (status IN ('ordered', 'scheduled', 'in_progress', 'completed', 'cancelled')),
    scheduled_at TIMESTAMP,
    completed_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Radiology reports
CREATE TABLE IF NOT EXISTS radiology_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    imaging_order_id UUID REFERENCES imaging_orders(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    radiologist_id UUID REFERENCES users(id),
    organization_id UUID REFERENCES organizations(id),
    report_title VARCHAR(255),
    findings TEXT,
    impression TEXT,
    recommendations TEXT,
    file_path VARCHAR(500),
    file_name VARCHAR(255),
    file_size INTEGER,
    status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft', 'finalized', 'amended')),
    finalized_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Visit notes (SOAP notes)
CREATE TABLE IF NOT EXISTS visit_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID REFERENCES visits(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id),
    note_type VARCHAR(50) DEFAULT 'soap' CHECK (note_type IN ('soap', 'progress', 'discharge', 'referral')),
    subjective TEXT,
    objective TEXT,
    assessment TEXT,
    plan TEXT,
    is_locked BOOLEAN DEFAULT false,
    locked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_imaging_orders_patient ON imaging_orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_imaging_orders_status ON imaging_orders(status);
CREATE INDEX IF NOT EXISTS idx_radiology_reports_patient ON radiology_reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_visit_notes_visit ON visit_notes(visit_id);
