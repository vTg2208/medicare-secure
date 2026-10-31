-- Migration: Add passkey_credentials table for WebAuthn support
-- Safe to run multiple times (uses IF NOT EXISTS / IF EXISTS checks)

-- ============================================
-- PASSKEY CREDENTIALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS passkey_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    credential_id TEXT UNIQUE NOT NULL,        -- base64url-encoded credential ID
    public_key BYTEA NOT NULL,                 -- COSE public key bytes
    counter BIGINT NOT NULL DEFAULT 0,         -- signature counter for replay protection
    device_type VARCHAR(32),                   -- 'singleDevice' or 'multiDevice'
    backed_up BOOLEAN DEFAULT FALSE,           -- whether credential is backed up (synced passkey)
    transports TEXT[],                         -- e.g. {'internal', 'hybrid', 'ble', 'usb', 'nfc'}
    credential_name VARCHAR(255),              -- user-friendly name for the credential
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_passkey_user_id ON passkey_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_passkey_credential_id ON passkey_credentials(credential_id);

-- Allow users to have password-only, passkey-only, or both
-- Make password_hash nullable for passkey-only users
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'password_hash' AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
    END IF;
END $$;
