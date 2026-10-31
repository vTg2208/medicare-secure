const crypto = require('crypto');
const config = require('../config/env');
const MAGIC = Buffer.from('SHMSENC1');
const encryptBuffer = (plain) => {
    if (!/^[a-f\d]{64}$/i.test(config.security.encryptionKey || '')) throw new Error('File encryption key is not configured');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(config.security.encryptionKey, 'hex'), iv);
    const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
    return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), encrypted]);
};
const decryptBuffer = (stored) => {
    if (!stored.subarray(0, MAGIC.length).equals(MAGIC)) {
        throw new Error('File must be migrated to encrypted storage before download');
    }
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(config.security.encryptionKey, 'hex'), stored.subarray(8, 20));
    decipher.setAuthTag(stored.subarray(20, 36));
    return Buffer.concat([decipher.update(stored.subarray(36)), decipher.final()]);
};
module.exports = { encryptBuffer, decryptBuffer };
