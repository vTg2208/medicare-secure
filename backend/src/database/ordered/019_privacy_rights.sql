CREATE TABLE privacy_rights_requests (
    id UUID PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES users(id),
    request_type VARCHAR(30) NOT NULL CHECK (request_type IN ('access','rectification','erasure','restriction','portability','objection')),
    status VARCHAR(30) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','in_review','fulfilled','partially_fulfilled','retained','declined')),
    detail_cipher TEXT NOT NULL,
    outcome_cipher TEXT,
    due_at TIMESTAMPTZ NOT NULL,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (request_type <> 'erasure' OR status <> 'fulfilled')
);
CREATE INDEX idx_privacy_rights_patient ON privacy_rights_requests(patient_id,created_at DESC);
CREATE INDEX idx_privacy_rights_review ON privacy_rights_requests(status,due_at);

CREATE TABLE privacy_rights_history (
    id UUID PRIMARY KEY,
    request_id UUID NOT NULL REFERENCES privacy_rights_requests(id),
    actor_id UUID NOT NULL REFERENCES users(id),
    previous_status VARCHAR(30),
    status VARCHAR(30) NOT NULL,
    event_cipher TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_privacy_rights_history ON privacy_rights_history(request_id,created_at,id);
CREATE FUNCTION protect_privacy_rights_history() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Privacy request history is append-only'; END $$;
CREATE TRIGGER protect_privacy_rights_history BEFORE UPDATE OR DELETE ON privacy_rights_history
    FOR EACH ROW EXECUTE FUNCTION protect_privacy_rights_history();
CREATE FUNCTION protect_privacy_request_identity() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Privacy requests are retained with their decision history'; END IF;
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
        OR NEW.request_type IS DISTINCT FROM OLD.request_type OR NEW.detail_cipher IS DISTINCT FROM OLD.detail_cipher
        OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.due_at IS DISTINCT FROM OLD.due_at THEN
        RAISE EXCEPTION 'Privacy request identity, narrative and original deadline are immutable';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER protect_privacy_request_identity BEFORE UPDATE OR DELETE ON privacy_rights_requests
    FOR EACH ROW EXECUTE FUNCTION protect_privacy_request_identity();
