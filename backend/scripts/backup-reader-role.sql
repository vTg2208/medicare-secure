-- Reviewed provisioning template. Replace the placeholder with a generated
-- password of at least 40 characters through the operator's protected setup.
-- Refuse an existing principal rather than rotate or expand another login.
BEGIN;
DO $backup_reader$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='healthcare_backup') THEN
        RAISE EXCEPTION 'Backup login already exists; inspect its configuration before retrying';
    END IF;
    IF length('__BACKUP_READER_PASSWORD__') < 40 THEN
        RAISE EXCEPTION 'Supply the separately generated backup login password';
    END IF;
    CREATE ROLE healthcare_backup LOGIN PASSWORD '__BACKUP_READER_PASSWORD__'
        NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 2;
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO healthcare_backup',current_database());
    EXECUTE format('ALTER ROLE healthcare_backup IN DATABASE %I SET search_path=healthcare,extensions,public',current_database());
END
$backup_reader$;
GRANT USAGE ON SCHEMA healthcare,extensions TO healthcare_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA healthcare TO healthcare_backup;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA healthcare TO healthcare_backup;
ALTER DEFAULT PRIVILEGES IN SCHEMA healthcare GRANT SELECT ON TABLES TO healthcare_backup;
ALTER DEFAULT PRIVILEGES IN SCHEMA healthcare GRANT SELECT ON SEQUENCES TO healthcare_backup;
ALTER ROLE healthcare_backup SET default_transaction_read_only=on;
COMMIT;
