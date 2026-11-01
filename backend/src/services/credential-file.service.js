const fs = require('fs/promises');
const path = require('path');
const { encryptBuffer, decryptBuffer } = require('./file.crypto');
const Scanner = require('./malware.scanner.service');
const { scanBuffer } = require('./antivirus.service');
const config = require('../config/env');
function credentialContext(file) {
    const relative = path.relative(path.resolve(config.upload.uploadPath), path.resolve(file));
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Invalid credential location');
    return relative.split(path.sep).join('/');
}
async function secureCredential(file) {
    const stored = file.buffer || await fs.readFile(file.path);
    const magic = stored.subarray(0, 8).toString();
    // Legacy encryption is accepted only by this explicit migration path, never
    // by the download path. Scan before replacing it with identity-bound data.
    const bytes = magic === 'SHMSENC2' ? decryptBuffer(stored, credentialContext(file.path))
        : magic === 'SHMSENC1' ? decryptBuffer(stored) : stored;
    const valid = await Scanner.validateMagicNumber(bytes, file.originalname || file.path);
    if (!valid.passed || !['application/pdf', 'image/png', 'image/jpeg'].includes(file.mimetype)) throw Object.assign(new Error('Invalid credential document'), { statusCode: 400 });
    await scanBuffer(bytes);
    if (magic !== 'SHMSENC2') await fs.writeFile(file.path, encryptBuffer(bytes, credentialContext(file.path)), { mode: 0o600, ...(file.buffer && { flag: 'wx' }) });
}
async function readCredential(file) {
    const root = await fs.realpath(path.resolve(config.upload.uploadPath));
    const target = await fs.realpath(path.resolve(file));
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Invalid credential location');
    return decryptBuffer(await fs.readFile(target), credentialContext(target));
}
module.exports = { secureCredential, readCredential };
