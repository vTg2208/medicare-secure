const crypto = require('node:crypto');
process.env.ENCRYPTION_KEY = 'ab'.repeat(32);
const encryption = require('../../src/services/encryption.service');
const files = require('../../src/services/file.crypto');
const legacy = process.env.ENCRYPTION_KEY;
const current = 'cd'.repeat(32);
const rotate = () => {
    process.env.APPLICATION_ENCRYPTION_KEYS = JSON.stringify({ current });
    process.env.ENCRYPTION_ACTIVE_KEY_ID = 'current';
};
afterEach(() => {
    delete process.env.APPLICATION_ENCRYPTION_KEYS;
    delete process.env.ENCRYPTION_ACTIVE_KEY_ID;
});

describe('historical ciphertext and identity-bound secrets', () => {
    test('reads legacy database ciphertext after selecting a new active key', () => {
        const iv = Buffer.alloc(16, 7);
        const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(legacy, 'hex'), iv);
        const encrypted = Buffer.concat([cipher.update('historical'), cipher.final()]).toString('hex');
        const stored = { iv: iv.toString('hex'), encrypted, authTag: cipher.getAuthTag().toString('hex') };
        rotate();
        expect(encryption.decrypt(stored)).toBe('historical');
        const fresh = encryption.encrypt('fresh');
        expect(fresh.keyId).toBe('current');
        expect(encryption.decrypt(fresh)).toBe('fresh');
    });
    test('binds MFA secrets to their purpose and user, authenticates metadata and rejects corruption', () => {
        expect(encryption.encryptSecret).toBeTypeOf('function');
        rotate();
        const stored = encryption.encryptSecret('authenticator seed', 'mfa/user-a');
        expect(stored.keyId).toBe('current');
        expect(encryption.decryptSecret(stored, 'mfa/user-a')).toBe('authenticator seed');
        expect(() => encryption.decryptSecret(stored, 'mfa/user-b')).toThrow();
        expect(() => encryption.decryptSecret(stored, 'backup/user-a')).toThrow();
        expect(() => encryption.decryptSecret({ ...stored, keyId: 'legacy' }, 'mfa/user-a')).toThrow();
        expect(() => encryption.decryptSecret({ ...stored, encrypted: '00' }, 'mfa/user-a')).toThrow();
        expect(() => encryption.decryptSecret({ ...stored, version: 2 }, 'mfa/user-a')).toThrow();
        expect(() => encryption.encryptSecret('seed', '')).toThrow();
    });
    test('retains mixed-key encrypted files without changing the SHMSENC2 backup format', () => {
        const context = 'medical_files/patient-a/imaging/report.pdf';
        const old = files.encryptBuffer(Buffer.from('old file'), context);
        rotate();
        const fresh = files.encryptBuffer(Buffer.from('new file'), context);
        expect(fresh.subarray(0, 8).toString()).toBe('SHMSENC2');
        expect(files.decryptBuffer(old, context).toString()).toBe('old file');
        expect(files.decryptBuffer(fresh, context).toString()).toBe('new file');
        // Independently confirm the writer used the new key, rather than simply round-tripping.
        const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(current, 'hex'), fresh.subarray(8, 20));
        decipher.setAAD(Buffer.from(context)); decipher.setAuthTag(fresh.subarray(20, 36));
        expect(Buffer.concat([decipher.update(fresh.subarray(36)), decipher.final()]).toString()).toBe('new file');
        expect(() => files.decryptBuffer(old, 'medical_files/patient-b/imaging/report.pdf')).toThrow();
    });
});
