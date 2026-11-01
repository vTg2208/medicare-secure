-- Consent and break-glass policy changes must retain evidence atomically, even
-- if the later HTTP response audit is unavailable. Reuse the namespace-hardened
-- request actor and patient identity logic used by clinical row mutations.
CREATE TRIGGER clinical_change_audit AFTER INSERT OR UPDATE OR DELETE ON consents
FOR EACH ROW EXECUTE FUNCTION audit_clinical_change();
CREATE TRIGGER clinical_change_audit AFTER INSERT OR UPDATE OR DELETE ON emergency_access_grants
FOR EACH ROW EXECUTE FUNCTION audit_clinical_change();
