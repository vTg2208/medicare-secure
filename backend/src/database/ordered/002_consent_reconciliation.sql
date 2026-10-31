-- Core and EMR historically declared different versions of consents. Resolve
-- their shared contract before EMR indexes reference the organization column.
ALTER TABLE consents ADD COLUMN IF NOT EXISTS recipient_organization_id UUID REFERENCES organizations(id);
ALTER TABLE consents ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP;
ALTER TABLE consents ADD COLUMN IF NOT EXISTS revocation_reason TEXT;
ALTER TABLE consents ALTER COLUMN recipient_user_id DROP NOT NULL;
ALTER TABLE consents DROP CONSTRAINT IF EXISTS consents_access_level_check;
ALTER TABLE consents ADD CONSTRAINT consents_access_level_check CHECK (access_level IN ('read','write','full'));
ALTER TABLE consents DROP CONSTRAINT IF EXISTS consents_status_check;
ALTER TABLE consents ADD CONSTRAINT consents_status_check CHECK (status IN ('active','revoked','expired','pending'));
