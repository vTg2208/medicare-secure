const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const mockModule = (modulePath, exports) => {
    const resolved = require.resolve(modulePath);
    require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
};
const config = { upload: { uploadPath: '', maxFileSizeMB: 10 }, security: { encryptionKey: 'ab'.repeat(32) } };
mockModule('../../src/config/env', config);
// This suite isolates scanning/encryption; PostgreSQL lock exclusion is covered
// by coordinated-backup.integration.test.js against independent real sessions.
mockModule('../../src/services/file-coordination', { withFileMutation: run => run() });
const scanBuffer = vi.fn().mockResolvedValue(undefined);
mockModule('../../src/services/antivirus.service', { scanBuffer });
for (const modulePath of ['../../src/services/file.crypto', '../../src/services/file.upload.service']) delete require.cache[require.resolve(modulePath)];
const Files = require('../../src/services/file.upload.service');
const { decryptBuffer } = require('../../src/services/file.crypto');
let root;
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'shms-upload-test-')); config.upload.uploadPath = root; });
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });

it('accepts an in-memory report and writes only context-bound ciphertext', async () => {
    const original = Buffer.from('%PDF-1.4 fixture private test');
    const saved = await Files.processUpload({ buffer: original, originalname: 'result.pdf', mimetype: 'application/pdf', size: original.length },
        { patientId: '11111111-1111-1111-1111-111111111111', fileType: 'lab_results' });
    const stored = await fs.readFile(saved.filePath);
    expect(stored.includes(original)).toBe(false);
    expect(await Files.getFile(saved.filePath)).toEqual(original);
    expect(() => decryptBuffer(stored, 'medical_files/another-patient/lab_results/result.pdf')).toThrow();
    expect(await fs.readdir(root)).toEqual(['medical_files']);
});

it('persists no report when the required scanner is unavailable', async () => {
    scanBuffer.mockRejectedValueOnce(new Error('scanner unavailable'));
    const bytes = Buffer.from('%PDF fixture test');
    await expect(Files.processUpload({ buffer: bytes, originalname: 'result.pdf', mimetype: 'application/pdf', size: bytes.length },
        { patientId: '11111111-1111-1111-1111-111111111111', fileType: 'lab_results' })).rejects.toThrow('scanner unavailable');
    expect(await fs.readdir(root)).toEqual([]);
});
