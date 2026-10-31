ALTER TABLE pharmacy_inventory ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_organization ON pharmacy_inventory(organization_id);

ALTER TABLE visits ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS no_show_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS workflow_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), visit_id UUID REFERENCES visits(id),
    user_id UUID REFERENCES users(id), action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100), entity_id UUID, old_state JSONB, new_state JSONB,
    metadata JSONB DEFAULT '{}', ip_address VARCHAR(45), user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_visit ON workflow_logs(visit_id,created_at);

CREATE TABLE IF NOT EXISTS one_time_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), token_hash VARCHAR(64) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id), scope JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL, used_at TIMESTAMPTZ, used_by_ip VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_one_time_tokens_expiry ON one_time_tokens(expires_at);
