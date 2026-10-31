ALTER TABLE consents ADD COLUMN IF NOT EXISTS visit_id UUID REFERENCES visits(id);
ALTER TABLE consents ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'manual';
CREATE UNIQUE INDEX IF NOT EXISTS idx_consents_visit_recipient ON consents(visit_id,recipient_user_id) WHERE visit_id IS NOT NULL;
