-- ============================================
-- Visit Lifecycle Management Migration
-- Adds columns and triggers for visit state management
-- ============================================

-- Add lifecycle tracking columns to visits table
ALTER TABLE visits ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES users(id);
ALTER TABLE visits ADD COLUMN IF NOT EXISTS status_history JSONB DEFAULT '[]'::jsonb;

-- Add revocation tracking to visit_staff_assignments
ALTER TABLE visit_staff_assignments ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP;
ALTER TABLE visit_staff_assignments ADD COLUMN IF NOT EXISTS revoked_by UUID REFERENCES users(id);
ALTER TABLE visit_staff_assignments ADD COLUMN IF NOT EXISTS access_level VARCHAR(20) DEFAULT 'full' CHECK (access_level IN ('full', 'read_only', 'revoked'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_visits_closed_at ON visits(closed_at);
CREATE INDEX IF NOT EXISTS idx_visit_staff_revoked ON visit_staff_assignments(revoked_at);
CREATE INDEX IF NOT EXISTS idx_visit_staff_access_level ON visit_staff_assignments(access_level);

-- Function to log status changes
CREATE OR REPLACE FUNCTION log_visit_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        NEW.status_history = COALESCE(NEW.status_history, '[]'::jsonb) || 
            jsonb_build_object(
                'from', OLD.status,
                'to', NEW.status,
                'changed_at', CURRENT_TIMESTAMP,
                'changed_by', CURRENT_USER
            );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for status change logging
DROP TRIGGER IF EXISTS trigger_log_visit_status ON visits;
CREATE TRIGGER trigger_log_visit_status
    BEFORE UPDATE ON visits
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION log_visit_status_change();

-- Function to auto-revoke staff access when visit closes
CREATE OR REPLACE FUNCTION revoke_staff_access_on_close()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('completed', 'cancelled') AND OLD.status NOT IN ('completed', 'cancelled') THEN
        -- Set closed_at timestamp
        NEW.closed_at = CURRENT_TIMESTAMP;
        
        -- Revoke access for all assigned staff
        UPDATE visit_staff_assignments
        SET 
            access_level = 'read_only',
            revoked_at = CURRENT_TIMESTAMP
        WHERE visit_id = NEW.id 
          AND revoked_at IS NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-revoking access
DROP TRIGGER IF EXISTS trigger_revoke_access_on_close ON visits;
CREATE TRIGGER trigger_revoke_access_on_close
    BEFORE UPDATE ON visits
    FOR EACH ROW
    WHEN (NEW.status IN ('completed', 'cancelled') AND OLD.status NOT IN ('completed', 'cancelled'))
    EXECUTE FUNCTION revoke_staff_access_on_close();

-- Add comment for documentation
COMMENT ON COLUMN visits.status_history IS 'JSONB array tracking all status transitions with timestamps';
COMMENT ON COLUMN visits.closed_at IS 'Timestamp when visit was closed (completed or cancelled)';
COMMENT ON COLUMN visit_staff_assignments.access_level IS 'Access level: full (active), read_only (visit closed), revoked (manually removed)';
