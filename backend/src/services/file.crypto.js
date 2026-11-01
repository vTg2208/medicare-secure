const crypto = require('crypto');
const config = require('../config/env');
const MAGIC = Buffer.from('SHMSENC1');
const BOUND_MAGIC = Buffer.from('SHMSENC2');
const encryptBuffer = (plain, context) => {
    if (!/^[a-f\d]{64}$/i.test(config.security.encryptionKey || '')) throw new Error('File encryption key is not configured');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(config.security.encryptionKey, 'hex'), iv);
    if (context) cipher.setAAD(Buffer.from(context, 'utf8'));
    const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
    return Buffer.concat([context ? BOUND_MAGIC : MAGIC, iv, cipher.getAuthTag(), encrypted]);
};
const decryptBuffer = (stored, context) => {
    const bound = stored.subarray(0, 8).equals(BOUND_MAGIC);
    if (stored.length < 36 || (!bound && !stored.subarray(0, 8).equals(MAGIC)) || (!bound && context)) {
        throw new Error('File must be migrated to encrypted storage before download');
    }
    if (bound && !context) throw new Error('Encrypted file context is required');
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(config.security.encryptionKey, 'hex'), stored.subarray(8, 20));
    if (bound) decipher.setAAD(Buffer.from(context, 'utf8'));
    decipher.setAuthTag(stored.subarray(20, 36));
    return Buffer.concat([decipher.update(stored.subarray(36)), decipher.final()]);
};
module.exports = { encryptBuffer, decryptBuffer };
