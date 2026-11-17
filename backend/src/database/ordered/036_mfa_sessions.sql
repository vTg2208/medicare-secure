-- Existing sessions deliberately cannot satisfy the new assurance requirement.
ALTER TABLE sessions ADD COLUMN mfa_method TEXT CHECK(mfa_method IN ('totp','passkey'));
ALTER TABLE sessions ADD COLUMN mfa_verified_at TIMESTAMPTZ;
ALTER TABLE sessions ADD COLUMN csrf_hash TEXT CHECK(csrf_hash ~ '^[a-f0-9]{64}$');
UPDATE sessions SET is_active=false WHERE is_active=true;

CREATE TABLE user_mfa (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    secret_cipher JSONB,
    enabled_at TIMESTAMPTZ,
    last_totp_step BIGINT NOT NULL DEFAULT -1,
    recovery_hashes TEXT[] NOT NULL DEFAULT '{}',
    factor_version UUID NOT NULL DEFAULT uuid_generate_v4(),
    CHECK ((enabled_at IS NULL AND secret_cipher IS NULL) OR (enabled_at IS NOT NULL AND secret_cipher IS NOT NULL)),
    CHECK (cardinality(recovery_hashes)<=10)
);
CREATE TABLE auth_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE CHECK(token_hash ~ '^[a-f0-9]{64}$'),
    purpose TEXT NOT NULL CHECK(purpose IN ('login','stepup','passkey_login','passkey_register')),
    payload JSONB NOT NULL DEFAULT '{}',
    factor_version UUID NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW()+INTERVAL '5 minutes'
);
CREATE INDEX auth_challenges_user ON auth_challenges(user_id,created_at);
CREATE INDEX auth_challenges_expiry ON auth_challenges(expires_at);
CREATE TABLE auth_mfa_throttles (
    scope_hash TEXT PRIMARY KEY CHECK(scope_hash ~ '^[a-f0-9]{64}$'),
    failures INTEGER NOT NULL DEFAULT 0 CHECK(failures>=0),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW()+INTERVAL '15 minutes'
);
CREATE INDEX auth_mfa_throttles_expiry ON auth_mfa_throttles(expires_at);
REVOKE ALL ON user_mfa,auth_challenges,auth_mfa_throttles FROM PUBLIC;
DO $auth_roles$
DECLARE principal TEXT;
BEGIN
    FOREACH principal IN ARRAY ARRAY['anon','authenticated','healthcare_api','healthcare_backup'] LOOP
        IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=principal) THEN
            EXECUTE format('REVOKE ALL ON user_mfa,auth_challenges,auth_mfa_throttles FROM %I',principal);
        END IF;
    END LOOP;
    IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='healthcare_api') THEN
        GRANT SELECT,INSERT,UPDATE,DELETE ON user_mfa,auth_challenges,auth_mfa_throttles TO healthcare_api;
    END IF;
    IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='healthcare_backup') THEN
        GRANT SELECT ON user_mfa,auth_challenges,auth_mfa_throttles TO healthcare_backup;
    END IF;
END
$auth_roles$;
