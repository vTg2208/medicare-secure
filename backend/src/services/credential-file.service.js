const fs = require('fs/promises');
const path = require('path');
const crypto = require('node:crypto');
const { encryptBuffer, decryptBuffer } = require('./file.crypto');
const Scanner = require('./malware.scanner.service');
const { scanBuffer } = require('./antivirus.service');
const config = require('../config/env');
const { withFileMutation } = require('./file-coordination');
const storage = require('./encrypted-file-store');
function credentialContext(file) {
    const relative = path.relative(path.resolve(config.upload.uploadPath), path.resolve(file));
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Invalid credential location');
    return relative.split(path.sep).join('/');
}
async function secureCredential(file) {
    const stored = file.buffer || await storage.readEncrypted(file.path);
    const magic = stored.subarray(0, 8).toString();
    // Legacy encryption is accepted only by this explicit migration path, never
    // by the download path. Scan before replacing it with identity-bound data.
    const bytes = magic === 'SHMSENC2' ? decryptBuffer(stored, credentialContext(file.path))
        : magic === 'SHMSENC1' ? decryptBuffer(stored) : stored;
    const valid = await Scanner.validateMagicNumber(bytes, file.originalname || file.path);
    if (!valid.passed || !['application/pdf', 'image/png', 'image/jpeg'].includes(file.mimetype)) throw Object.assign(new Error('Invalid credential document'), { statusCode: 400 });
    await scanBuffer(bytes);
    if (magic !== 'SHMSENC2') await withFileMutation(async () => {
        const encrypted = encryptBuffer(bytes, credentialContext(file.path));
        if (file.buffer) return storage.writeEncrypted(file.path, encrypted);
        if (storage.isPostgresStorage()) throw new Error('Legacy credentials require migration before durable storage');
        // A legacy replacement must leave the previous file intact on failure.
        // The temporary file is on the same filesystem for atomic publication.
        const temporary = path.join(path.dirname(file.path), `.credential-rewrite-${crypto.randomUUID()}`);
        try {
            if (!(await fs.readFile(file.path)).equals(stored)) throw new Error('Credential changed before replacement');
            await fs.writeFile(temporary, encrypted, { mode: 0o600, flag: 'wx' });
            const handle = await fs.open(temporary, 'r+');
            try { await handle.sync(); } finally { await handle.close(); }
            if (!(await fs.readFile(file.path)).equals(stored)) throw new Error('Credential changed before replacement');
            await fs.rename(temporary, file.path);
        } finally { await fs.unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
    });
}
async function readCredential(file) {
    if (storage.isPostgresStorage()) return decryptBuffer(await storage.readEncrypted(file), credentialContext(file));
    const root = await fs.realpath(path.resolve(config.upload.uploadPath));
    const target = await fs.realpath(path.resolve(file));
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Invalid credential location');
    return decryptBuffer(await fs.readFile(target), credentialContext(target));
}
module.exports = { secureCredential, readCredential };
