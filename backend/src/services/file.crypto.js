const crypto = require('crypto');
const config = require('../config/env');
const { getApplicationKeys } = require('./application-keys');
const applicationKeys = env => getApplicationKeys(env || { ...process.env, ENCRYPTION_KEY: config.security.encryptionKey });
const MAGIC = Buffer.from('SHMSENC1');
const BOUND_MAGIC = Buffer.from('SHMSENC2');
const encryptBuffer = (plain, context) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', applicationKeys().activeKey, iv);
    if (context) cipher.setAAD(Buffer.from(context, 'utf8'));
    const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
    return Buffer.concat([context ? BOUND_MAGIC : MAGIC, iv, cipher.getAuthTag(), encrypted]);
};
const decryptBuffer = (stored, context, env) => {
    const bound = stored.subarray(0, 8).equals(BOUND_MAGIC);
    if (stored.length < 36 || (!bound && !stored.subarray(0, 8).equals(MAGIC)) || (!bound && context)) {
        throw new Error('File must be migrated to encrypted storage before download');
    }
    if (bound && !context) throw new Error('Encrypted file context is required');
    for (const { key } of applicationKeys(env).keys) {
        try {
            const decipher = crypto.createDecipheriv('aes-256-gcm', key, stored.subarray(8, 20));
            if (bound) decipher.setAAD(Buffer.from(context, 'utf8'));
            decipher.setAuthTag(stored.subarray(20, 36));
            return Buffer.concat([decipher.update(stored.subarray(36)), decipher.final()]);
        } catch { /* A retained key is accepted only after GCM authenticates the file. */ }
    }
    throw new Error('Encrypted file failed key, integrity or identity verification');
};
module.exports = { encryptBuffer, decryptBuffer };
