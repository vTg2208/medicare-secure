const fs = require('node:fs/promises');
const syncFs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const mockModule = (name, exports) => {
    const id = require.resolve(name);
    require.cache[id] = { id, filename: id, loaded: true, exports };
};
const uploadPath = syncFs.mkdtempSync(path.join(os.tmpdir(), 'credential-validation-'));
mockModule('../../src/config/env', { upload: { uploadPath }, security: { encryptionKey: 'ab'.repeat(32) } });
mockModule('../../src/services/file-coordination', { withFileMutation: run => run() });
const scanBuffer = vi.fn().mockResolvedValue(undefined);
mockModule('../../src/services/antivirus.service', { scanBuffer });
const objects = new Map();
const query = vi.fn(async (sql, values) => {
    if (sql.startsWith('INSERT INTO encrypted_upload_objects')) objects.set(values[0], values[1]);
    if (sql.startsWith('DELETE FROM encrypted_upload_objects')) objects.delete(values[0]);
    if (sql.startsWith('SELECT ciphertext')) {
        const bytes = objects.get(values[0]);
        return { rows: bytes ? [{ ciphertext: bytes, byte_length: bytes.length, cipher_sha256: crypto.createHash('sha256').update(bytes).digest('hex') }] : [] };
    }
    return { rows: [] };
});
mockModule('../../src/config/db', { query });
const upload = require('../../src/middleware/upload.middleware');
const { secureCredential, readCredential } = require('../../src/services/credential-file.service');
const { encryptBuffer } = require('../../src/services/file.crypto');
const pdf = Buffer.from('%PDF-1.4\nSynthetic credential');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ...Buffer.from('JFIF\0'), 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
const invalid = [
    ['unknown extension with spoofed JPEG MIME', 'license.exe', 'image/jpeg', Buffer.from('MZ executable')],
    ['unknown extension with genuine JPEG bytes', 'license.bin', 'image/jpeg', jpeg],
    ['missing extension', 'license', 'application/pdf', pdf],
    ['trailing dot', 'license.pdf.', 'application/pdf', pdf],
    ['trailing space', 'license.pdf ', 'application/pdf', pdf],
    ['double extension ending in an executable', 'license.pdf.exe', 'application/pdf', pdf],
    ['double extension with mismatched content', 'license.pdf.jpg', 'image/jpeg', pdf],
    ['MIME-extension disagreement', 'license.pdf', 'image/jpeg', pdf],
    ['MIME-content disagreement', 'license.jpg', 'image/jpeg', png],
    ['unsupported MIME', 'license.pdf', 'application/octet-stream', pdf],
    ['truncated PDF header', 'license.pdf', 'application/pdf', Buffer.from('%PDF')],
    ['truncated PNG signature', 'license.png', 'image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47])],
    ['PNG signature without its header', 'license.png', 'image/png', png.subarray(0, 8)],
    ['truncated JPEG signature', 'license.jpeg', 'image/jpeg', Buffer.from([0xff, 0xd8, 0xff])],
    ['truncated JPEG segment', 'license.jpeg', 'image/jpeg', jpeg.subarray(0, 10)],
    ['empty content', 'license.pdf', 'application/pdf', Buffer.alloc(0)],
];
const originalBackend = process.env.FILE_STORAGE_BACKEND;
beforeEach(() => { scanBuffer.mockReset().mockResolvedValue(undefined); query.mockClear(); objects.clear(); });
afterAll(async () => {
    if (originalBackend === undefined) delete process.env.FILE_STORAGE_BACKEND;
    else process.env.FILE_STORAGE_BACKEND = originalBackend;
    await fs.rm(uploadPath, { recursive: true, force: true });
});

describe.each(['filesystem', 'postgres'])('%s credential storage', backend => {
    beforeEach(() => { process.env.FILE_STORAGE_BACKEND = backend; });
    it.each(invalid)('rejects %s before scanning or storing', async (_case, originalname, mimetype, buffer) => {
        const target = path.join(uploadPath, 'documents', crypto.randomUUID() + '.pdf');
        await expect(secureCredential({ path: target, originalname, mimetype, buffer })).rejects.toMatchObject({ statusCode: 400 });
        expect(scanBuffer).not.toHaveBeenCalled();
        expect(query).not.toHaveBeenCalled();
        await expect(fs.stat(target)).rejects.toMatchObject({ code: 'ENOENT' });
    });
    it.each([
        ['PDF', 'license.PDF', 'application/pdf', pdf],
        ['JPG', 'license.jpg', 'image/jpeg', jpeg],
        ['JPEG', 'license.jpeg', 'image/jpeg', jpeg],
        ['PNG', 'license.png', 'image/png', png],
    ])('scans and encrypts valid %s with its path identity', async (_case, originalname, mimetype, buffer) => {
        const target = path.join(uploadPath, 'documents', backend + path.extname(originalname).toLowerCase());
        await secureCredential({ path: target, originalname, mimetype, buffer });
        expect(scanBuffer).toHaveBeenCalledWith(buffer);
        expect(await readCredential(target)).toEqual(buffer);
        const stored = backend === 'postgres' ? objects.values().next().value : await fs.readFile(target);
        expect(stored.subarray(0, 8).toString()).toBe('SHMSENC2');
        expect(stored.includes(buffer)).toBe(false);
        if (backend === 'filesystem') await fs.unlink(target);
    });
    it('fails closed when antivirus is unavailable', async () => {
        scanBuffer.mockRejectedValueOnce(new Error('scanner unavailable'));
        const target = path.join(uploadPath, 'documents', 'unscanned.pdf');
        await expect(secureCredential({ path: target, originalname: 'license.pdf', mimetype: 'application/pdf', buffer: pdf })).rejects.toThrow('scanner unavailable');
        expect(query).not.toHaveBeenCalled();
        await expect(fs.stat(target)).rejects.toMatchObject({ code: 'ENOENT' });
    });
});

it.each(invalid.filter(([, name, mime]) => !/\.(pdf|jpe?g|png)$/i.test(name) || mime === 'application/octet-stream' || name === 'license.pdf' && mime === 'image/jpeg'))('multipart filter rejects %s before collecting bytes', async (_case, originalname, mimetype) => {
    const result = await new Promise(resolve => upload.fileFilter({}, { originalname, mimetype }, (error, accepted) => resolve({ error, accepted })));
    expect(result.error).toMatchObject({ statusCode: 400 });
    expect(result.accepted).toBe(false);
    expect(scanBuffer).not.toHaveBeenCalled();
});

it('rejects mismatched multipart bytes without a durable database operation', async () => {
    process.env.FILE_STORAGE_BACKEND = 'postgres';
    const result = await new Promise(resolve => upload.storage._handleFile({}, { originalname: 'license.jpg', mimetype: 'image/jpeg', stream: Readable.from(pdf) }, (error, file) => resolve({ error, file })));
    expect(result.error).toMatchObject({ statusCode: 400 });
    expect(result.file).toBeUndefined();
    expect(scanBuffer).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
});

it('stages valid multipart bytes encrypted without persisting before controller validation', async () => {
    process.env.FILE_STORAGE_BACKEND = 'postgres';
    const file = await new Promise((resolve, reject) => upload.storage._handleFile({}, { originalname: 'license.pdf', mimetype: 'application/pdf', stream: Readable.from(pdf) }, (error, result) => error ? reject(error) : resolve(result)));
    expect(file.buffer.subarray(0, 8).toString()).toBe('SHMSENC2');
    expect(query).not.toHaveBeenCalled();
    await secureCredential({ ...file, originalname: 'license.pdf', mimetype: 'application/pdf' });
    expect(await readCredential(file.path)).toEqual(pdf);
});

it('retains valid encrypted legacy credentials and their path binding during migration', async () => {
    process.env.FILE_STORAGE_BACKEND = 'filesystem';
    const target = path.join(uploadPath, 'documents', 'legacy.pdf');
    await fs.writeFile(target, encryptBuffer(pdf));
    await secureCredential({ path: target, mimetype: 'application/pdf' });
    expect(await readCredential(target)).toEqual(pdf);
    const copied = path.join(uploadPath, 'documents', 'legacy-copy.pdf');
    await fs.copyFile(target, copied);
    await expect(readCredential(copied)).rejects.toThrow();
});

it('leaves invalid encrypted legacy bytes intact without scanning or rewriting', async () => {
    process.env.FILE_STORAGE_BACKEND = 'filesystem';
    const target = path.join(uploadPath, 'documents', 'invalid-legacy.pdf');
    const stored = encryptBuffer(png);
    await fs.writeFile(target, stored);
    await expect(secureCredential({ path: target, mimetype: 'image/png' })).rejects.toMatchObject({ statusCode: 400 });
    expect(await fs.readFile(target)).toEqual(stored);
    expect(scanBuffer).not.toHaveBeenCalled();
});
