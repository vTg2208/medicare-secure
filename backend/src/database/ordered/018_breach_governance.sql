-- Existing application event codes must be accepted so policy violations are retained.
ALTER TABLE security_events DROP CONSTRAINT IF EXISTS security_events_event_type_check;
ALTER TABLE security_events ADD CONSTRAINT security_events_event_type_check CHECK (event_type IN (
    'failed_login','account_locked','suspicious_activity','password_reset','role_change',
    'unauthorized_access','consent_violation','shift_violation','visit_violation','task_violation',
    'rate_limit_violation','suspicious_pattern','emergency_misuse','data_breach','privacy_violation',
    'availability_loss','data_integrity'
));

CREATE TABLE privacy_breaches (
    incident_id UUID PRIMARY KEY REFERENCES security_events(id),
    discovered_at TIMESTAMPTZ NOT NULL,
    assessment_version INTEGER NOT NULL DEFAULT 1 CHECK (assessment_version > 0),
    assessment_ciphertext TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE breach_assessment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES privacy_breaches(incident_id),
    version INTEGER NOT NULL,
    assessment_ciphertext TEXT NOT NULL,
    recorded_by UUID NOT NULL REFERENCES users(id),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(incident_id, version)
);

CREATE TABLE breach_notification_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES privacy_breaches(incident_id),
    assessment_version INTEGER NOT NULL,
    regime TEXT NOT NULL CHECK (regime IN ('gdpr','hipaa')),
    audience TEXT NOT NULL CHECK (audience IN ('authority','individual','secretary','media','controller','covered_entity')),
    status TEXT NOT NULL CHECK (status IN ('sent','failed')),
    occurred_at TIMESTAMPTZ NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('portal','post','email','telephone','in_person','other')),
    evidence_ciphertext TEXT NOT NULL,
    recorded_by UUID NOT NULL REFERENCES users(id),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY(incident_id,assessment_version) REFERENCES breach_assessment_history(incident_id,version)
);
CREATE INDEX idx_breach_notification_case ON breach_notification_log(incident_id,recorded_at);

CREATE OR REPLACE FUNCTION prevent_governance_history_mutation() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Governance evidence is append-only'; END $$;
CREATE TRIGGER protect_breach_assessment_history BEFORE UPDATE OR DELETE ON breach_assessment_history FOR EACH ROW EXECUTE FUNCTION prevent_governance_history_mutation();
CREATE TRIGGER protect_breach_notification_log BEFORE UPDATE OR DELETE ON breach_notification_log FOR EACH ROW EXECUTE FUNCTION prevent_governance_history_mutation();
