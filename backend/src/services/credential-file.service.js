const fs = require('fs/promises');
const path = require('path');
const { encryptBuffer, decryptBuffer } = require('./file.crypto');
const Scanner = require('./malware.scanner.service');
const { scanBuffer } = require('./antivirus.service');
const config = require('../config/env');
async function secureCredential(file) {
    const bytes = await fs.readFile(file.path);
    if (bytes.subarray(0, 8).toString() === 'SHMSENC1') return;
    const valid = await Scanner.validateMagicNumber(bytes, file.path);
    if (!valid.passed || !['application/pdf', 'image/png', 'image/jpeg'].includes(file.mimetype)) throw Object.assign(new Error('Invalid credential document'), { statusCode: 400 });
    await scanBuffer(bytes);
    await fs.writeFile(file.path, encryptBuffer(bytes), { mode: 0o600 });
}
async function readCredential(file) {
    const root = await fs.realpath(path.resolve(config.upload.uploadPath));
    const target = await fs.realpath(path.resolve(file));
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Invalid credential location');
    return decryptBuffer(await fs.readFile(target));
}
module.exports = { secureCredential, readCredential };
