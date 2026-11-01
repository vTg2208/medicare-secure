-- Wall-clock timestamps can move backward. Retain them as recorded evidence,
-- and assign a stable, database-generated append ordinal for presentation.
-- Existing evidence fields and the append-only protection remain unchanged.
ALTER TABLE privacy_rights_history ADD COLUMN event_sequence BIGSERIAL;
CREATE UNIQUE INDEX idx_privacy_history_event_sequence ON privacy_rights_history(event_sequence);
CREATE INDEX idx_privacy_history_request_sequence ON privacy_rights_history(request_id,event_sequence);

ALTER TABLE breach_notification_log ADD COLUMN event_sequence BIGSERIAL;
CREATE UNIQUE INDEX idx_breach_notice_event_sequence ON breach_notification_log(event_sequence);
CREATE INDEX idx_breach_notice_case_sequence ON breach_notification_log(incident_id,event_sequence);
