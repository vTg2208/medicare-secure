-- Apply as the existing schema owner after guarded migrations through 033.
-- Existing API principal only; no login changes or schema exposure.
BEGIN;
GRANT SELECT,INSERT ON healthcare.care_message_threads,healthcare.care_messages,healthcare.medical_record_corrections TO healthcare_api;
-- UPSERT and FOR UPDATE need UPDATE on at least one thread column.
GRANT UPDATE(patient_id) ON healthcare.care_message_threads TO healthcare_api;
GRANT SELECT,INSERT,UPDATE ON healthcare.appointment_calendars,healthcare.patient_processing_controls,healthcare.retention_policies,healthcare.retention_holds,healthcare.retention_disposals TO healthcare_api;
GRANT SELECT,INSERT,UPDATE,DELETE ON healthcare.appointment_reservations TO healthcare_api;
GRANT SELECT ON healthcare.retention_file_cleanup TO healthcare_api;
GRANT USAGE,SELECT ON SEQUENCE healthcare.care_messages_sequence_seq TO healthcare_api;
REVOKE ALL ON healthcare.privacy_notice_versions,healthcare.privacy_notice_current,healthcare.privacy_notice_acknowledgements FROM healthcare_api;
GRANT SELECT ON healthcare.privacy_notice_versions,healthcare.privacy_notice_current,healthcare.privacy_notice_acknowledgements TO healthcare_api;
GRANT INSERT(id,content,review_basis_ciphertext,published_by) ON healthcare.privacy_notice_versions TO healthcare_api;
GRANT INSERT(patient_id,version_id,notice_hash) ON healthcare.privacy_notice_acknowledgements TO healthcare_api;
GRANT UPDATE(version_id) ON healthcare.privacy_notice_current TO healthcare_api;
GRANT USAGE,SELECT ON SEQUENCE healthcare.privacy_notice_versions_version_number_seq TO healthcare_api;
REVOKE ALL ON FUNCTION healthcare.protect_privacy_notice_history(),healthcare.advance_privacy_notice_current() FROM healthcare_api;
DO $runtime_contract$
BEGIN
 IF NOT has_column_privilege('healthcare_api','healthcare.care_message_threads','patient_id','UPDATE')
 OR has_table_privilege('healthcare_api','healthcare.care_messages','UPDATE')
 OR has_table_privilege('healthcare_api','healthcare.care_messages','DELETE') THEN
 RAISE EXCEPTION 'Private messaging runtime privilege contract failed'; END IF;
END $runtime_contract$;
COMMIT;
