ALTER TABLE bed_allocations ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
UPDATE bed_allocations b SET organization_id=v.organization_id FROM visits v WHERE b.visit_id=v.id AND b.organization_id IS NULL;
-- If legacy duplicates exist, require owner review instead of silently reassigning patients.
CREATE UNIQUE INDEX IF NOT EXISTS idx_bed_active_organization ON bed_allocations(organization_id,ward,room,bed) WHERE status='occupied';
