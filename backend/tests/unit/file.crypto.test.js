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
it('binds encrypted reports to their patient and file identity', () => {
    const context = 'medical_files/patient-a/imaging/report.pdf';
    const stored = encryptBuffer(Buffer.from('private report'), context);
    expect(decryptBuffer(stored, context).toString()).toBe('private report');
    expect(() => decryptBuffer(stored, 'medical_files/patient-b/imaging/report.pdf')).toThrow();
    expect(() => decryptBuffer(stored)).toThrow();
});
it('requires migration before an unbound legacy ciphertext can be served in a patient context', () => {
    const stored = encryptBuffer(Buffer.from('legacy report'));
    expect(() => decryptBuffer(stored, 'medical_files/patient-a/imaging/report.pdf')).toThrow('migrated');
});
