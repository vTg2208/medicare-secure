const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { encryptionKey } = require('../../scripts/backup-helper');
const { migrateFileEncryption } = require('../../scripts/migrate-file-encryption');
const { validateEnvironment } = require('../../src/config/validate-env');
const legacy = 'ab'.repeat(32), current = 'cd'.repeat(32), backup = 'ef'.repeat(32);
const ring = { ENCRYPTION_KEY: legacy, APPLICATION_ENCRYPTION_KEYS: JSON.stringify({ current }), ENCRYPTION_ACTIVE_KEY_ID: 'current' };
const fingerprint = key => crypto.createHash('sha256').update(Buffer.from(key, 'hex')).digest('hex');

test('backup encryption refuses every retained application key and accepts independent keys', () => {
    for (const key of [legacy, current]) expect(() => encryptionKey({ ...ring, BACKUP_ENCRYPTION_KEY: key })).toThrow();
    expect(encryptionKey({ ...ring, BACKUP_ENCRYPTION_KEY: backup }).toString('hex')).toBe(backup);
    const fingerprints = JSON.stringify([fingerprint(legacy), fingerprint(current)]);
    expect(() => encryptionKey({ BACKUP_APPLICATION_KEY_SHA256S: fingerprints, BACKUP_ENCRYPTION_KEY: current })).toThrow();
    expect(encryptionKey({ BACKUP_APPLICATION_KEY_SHA256S: fingerprints, BACKUP_ENCRYPTION_KEY: backup }).toString('hex')).toBe(backup);
});
test('startup rejects malformed keyrings before serving traffic', () => {
    expect(validateEnvironment({ ...ring, APPLICATION_ENCRYPTION_KEYS: '{' }).join(' ')).toMatch(/key configuration/);
});

test('production can retire the legacy key once a valid standalone keyring is configured', () => {
    const production = { NODE_ENV: 'production', DB_PASSWORD: 'fixture', JWT_SECRET: 'a'.repeat(64),
        JWT_REFRESH_SECRET: 'b'.repeat(64), DB_SSL: 'true', CORS_ORIGIN: 'https://fixture.invalid',
        FRONTEND_URL: 'https://fixture.invalid', WEBAUTHN_RP_ID: 'fixture.invalid', WEBAUTHN_ORIGIN: 'https://fixture.invalid' };
    expect(validateEnvironment({ ...production, APPLICATION_ENCRYPTION_KEYS: JSON.stringify({ current }), ENCRYPTION_ACTIVE_KEY_ID: 'current' })).toEqual([]);
    expect(validateEnvironment(production)).toContain('ENCRYPTION_KEY is required');
});

test('an unset optional fingerprint list preserves the existing single-fingerprint backup configuration', () => {
    expect(encryptionKey({ BACKUP_APPLICATION_KEY_SHA256S: '', BACKUP_APPLICATION_KEY_SHA256: fingerprint(legacy), BACKUP_ENCRYPTION_KEY: backup }).toString('hex')).toBe(backup);
    expect(() => encryptionKey({ BACKUP_APPLICATION_KEY_SHA256S: '{', BACKUP_APPLICATION_KEY_SHA256: fingerprint(legacy), BACKUP_ENCRYPTION_KEY: backup })).toThrow();
});
test('rotation preflight authenticates mixed-key file envelopes without changing them', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'key-rotation-'));
    const directory = path.join(root, 'documents'); await fs.mkdir(directory);
    const stored = (key, context) => {
        const iv = Buffer.alloc(12, 6);
        const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
        cipher.setAAD(Buffer.from(context));
        const ciphertext = Buffer.concat([cipher.update('synthetic file'), cipher.final()]);
        return Buffer.concat([Buffer.from('SHMSENC2'), iv, cipher.getAuthTag(), ciphertext]);
    };
    const old = stored(legacy, 'documents/old.pdf'), fresh = stored(current, 'documents/new.pdf');
    try {
        await fs.writeFile(path.join(directory, 'old.pdf'), old);
        await fs.writeFile(path.join(directory, 'new.pdf'), fresh);
        const result = await migrateFileEncryption({ uploads: root, env: ring, rotateKeys: true });
        expect(result).toMatchObject({ scanned: 2, dryRun: true, rotation: 1, migrated: 0 });
        expect(await fs.readFile(path.join(directory, 'old.pdf'))).toEqual(old);
        expect(await fs.readFile(path.join(directory, 'new.pdf'))).toEqual(fresh);
    } finally { await fs.rm(root, { recursive: true, force: true }); }
});
