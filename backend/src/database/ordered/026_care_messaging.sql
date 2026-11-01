CREATE TABLE care_message_threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES users(id),
    provider_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (patient_id <> provider_id),
    UNIQUE (patient_id, provider_id)
);
CREATE TABLE care_messages (
    id UUID PRIMARY KEY,
    sequence BIGSERIAL UNIQUE NOT NULL,
    thread_id UUID NOT NULL REFERENCES care_message_threads(id),
    patient_id UUID NOT NULL REFERENCES users(id),
    sender_id UUID NOT NULL REFERENCES users(id),
    body_cipher TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_care_messages_thread_sequence ON care_messages(thread_id,sequence DESC);
CREATE FUNCTION protect_care_message() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Care messages are retained clinical correspondence'; END $$;
CREATE TRIGGER protect_care_message BEFORE UPDATE OR DELETE ON care_messages FOR EACH ROW EXECUTE FUNCTION protect_care_message();
CREATE TRIGGER clinical_change_audit AFTER INSERT ON care_messages FOR EACH ROW EXECUTE FUNCTION audit_clinical_change();
