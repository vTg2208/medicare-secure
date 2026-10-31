process.env.ENCRYPTION_KEY = 'ab'.repeat(32);
const { encryptBuffer, decryptBuffer } = require('../../src/services/file.crypto');
it('encrypts report bytes and authenticates the stored ciphertext', () => {
    const original = Buffer.from('%PDF-1.4 private healthcare fixture');
    const stored = encryptBuffer(original);
    expect(stored.includes(original)).toBe(false);
    expect(decryptBuffer(stored)).toEqual(original);
    stored[stored.length - 1] ^= 1;
    expect(() => decryptBuffer(stored)).toThrow();
});
it('refuses unencrypted legacy files', () => {
    expect(() => decryptBuffer(Buffer.from('plaintext'))).toThrow('migrated');
});
