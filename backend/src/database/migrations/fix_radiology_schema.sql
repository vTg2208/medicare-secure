-- Migration: Fix Radiology Schema
-- Purpose: Add missing columns to imaging_orders to match ImagingOrderModel
-- Date: 2026-03-09

-- 1. Add columns to imaging_orders
ALTER TABLE imaging_orders ADD COLUMN IF NOT EXISTS visit_id UUID REFERENCES visits(id) ON DELETE CASCADE;
ALTER TABLE imaging_orders ADD COLUMN IF NOT EXISTS routed_to_department VARCHAR(100);
ALTER TABLE imaging_orders ADD COLUMN IF NOT EXISTS imaging_report_id UUID; -- REFERENCES radiology_reports(id) added later after table exists

-- 2. Rename or add aliases if needed, but better to keep code consistency
-- Let's add columns that match the model names if they don't exist, OR update model.
-- The model uses: visit_id, ordered_by, imaging_type, priority, routed_to_department, clinical_indication, contrast_used, notes

ALTER TABLE imaging_orders ADD COLUMN IF NOT EXISTS ordered_by UUID REFERENCES users(id);
ALTER TABLE imaging_orders ADD COLUMN IF NOT EXISTS imaging_type VARCHAR(100);
ALTER TABLE imaging_orders ADD COLUMN IF NOT EXISTS contrast_used BOOLEAN DEFAULT false;
ALTER TABLE imaging_orders ADD COLUMN IF NOT EXISTS scheduled_time TIMESTAMP;
ALTER TABLE imaging_orders ADD COLUMN IF NOT EXISTS performed_at TIMESTAMP;

-- 3. Update radiology_reports if needed
-- The model uses: imaging_order_id, patient_id, radiologist_id, report_title, findings, impression, recommendations, file_path, file_name, file_size, status

-- The table radiology_reports in schema_workflow.sql already has most of these.
-- Let's ensure it exists and has the right names.
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

-- Add foreign key back to imaging_orders if not already there
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='imaging_orders' AND column_name='imaging_report_id') THEN
        ALTER TABLE imaging_orders ADD COLUMN imaging_report_id UUID REFERENCES radiology_reports(id);
    END IF;
END $$;
