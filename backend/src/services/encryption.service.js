const bcrypt = require('bcrypt');
const crypto = require('crypto');
const config = require('../config/env');
const { getApplicationKeys } = require('./application-keys');
const applicationKeys = env => getApplicationKeys(env || { ...process.env, ENCRYPTION_KEY: config.security.encryptionKey });

/**
 * Hash password using bcrypt
 * @param {String} password - Plain text password
 * @returns {Promise<String>} Hashed password
 */
const hashPassword = async (password) => {
    const rounds = config.security.bcryptRounds || 12;
    return await bcrypt.hash(password, rounds);
};

/**
 * Compare password with hash
 * @param {String} password - Plain text password
 * @param {String} hash - Hashed password
 * @returns {Promise<Boolean>} Match result
 */
const comparePassword = async (password, hash) => {
    return await bcrypt.compare(password, hash);
};

/**
 * Hash government ID for privacy
 * Uses SHA-256 for one-way hashing
 * @param {String} govtId - Government ID
 * @returns {String} Hashed government ID
 */
const hashGovtId = (govtId) => {
    return crypto.createHash('sha256').update(govtId).digest('hex');
};

/**
 * Hash OTP for secure storage
 * @param {String} otp - OTP code
 * @returns {String} Hashed OTP
 */
const hashOTP = (otp) => {
    return crypto.createHash('sha256').update(otp).digest('hex');
};

/**
 * Hash token for session storage
 * @param {String} token - JWT token
 * @returns {String} Hashed token
 */
const hashToken = (token) => {
    return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Create hash chain for audit logs
 * @param {String} currentData - Current log data
 * @param {String} previousHash - Previous log hash
 * @returns {String} New hash
 */
const createHashChain = (currentData, previousHash = '') => {
    const data = previousHash + currentData;
    return crypto.createHash('sha256').update(data).digest('hex');
};

/**
 * Encrypt sensitive data
 * @param {String} text - Text to encrypt
 * @returns {Object} Encrypted data with iv and encrypted text
 */
const encrypt = (text) => {
    const { activeId, activeKey: key } = applicationKeys();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
        keyId: activeId,
        iv: iv.toString('hex'),
        encrypted,
        authTag: authTag.toString('hex'),
    };
};

/**
 * Decrypt sensitive data
 * @param {Object} encryptedData - Encrypted data object
 * @returns {String} Decrypted text
 */
const decrypt = (encryptedData) => {
    validateEnvelope(encryptedData, 16);
    const keys = applicationKeys().keys.filter(entry => !encryptedData.keyId || entry.id === encryptedData.keyId);
    for (const { key } of keys) {
        try {
            const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(encryptedData.iv, 'hex'));
            decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
            return Buffer.concat([decipher.update(Buffer.from(encryptedData.encrypted, 'hex')), decipher.final()]).toString('utf8');
        } catch { /* Try only explicitly retained keys for legacy unlabelled ciphertext. */ }
    }
    throw new Error('Encrypted data failed authentication');
};

const validateEnvelope = (envelope, ivBytes) => {
    const hex = (value, bytes) => typeof value === 'string' && /^[a-f\d]*$/i.test(value)
        && value.length % 2 === 0 && (bytes === undefined || value.length === bytes * 2);
    if (!envelope || !hex(envelope.iv, ivBytes) || !hex(envelope.authTag, 16)
        || !hex(envelope.encrypted) || envelope.encrypted.length > 131072) throw new Error('Invalid encrypted data');
};
const secretAad = (keyId, context) => {
    if (typeof context !== 'string' || !context || context.length > 512) throw new Error('Encryption context is required');
    return Buffer.from(JSON.stringify(['medicare-secret', 1, keyId, context]));
};
const encryptSecret = (value, context) => {
    if (typeof value !== 'string' || Buffer.byteLength(value) > 65536) throw new Error('Invalid secret value');
    const { activeId: keyId, activeKey } = applicationKeys();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', activeKey, iv);
    cipher.setAAD(secretAad(keyId, context));
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return { version: 1, keyId, iv: iv.toString('hex'), encrypted: encrypted.toString('hex'), authTag: cipher.getAuthTag().toString('hex') };
};
const decryptSecret = (envelope, context, env) => {
    validateEnvelope(envelope, 12);
    if (envelope.version !== 1 || typeof envelope.keyId !== 'string') throw new Error('Invalid secret envelope');
    const entry = applicationKeys(env).keys.find(item => item.id === envelope.keyId);
    if (!entry) throw new Error('Secret encryption key is unavailable');
    try {
        const decipher = crypto.createDecipheriv('aes-256-gcm', entry.key, Buffer.from(envelope.iv, 'hex'));
        decipher.setAAD(secretAad(envelope.keyId, context));
        decipher.setAuthTag(Buffer.from(envelope.authTag, 'hex'));
        return Buffer.concat([decipher.update(Buffer.from(envelope.encrypted, 'hex')), decipher.final()]).toString('utf8');
    } catch { throw new Error('Encrypted secret failed authentication'); }
};

/**
 * Generate secure random string
 * @param {Number} length - Length in bytes
 * @returns {String} Random hex string
 */
const generateSecureRandom = (length = 32) => {
    return crypto.randomBytes(length).toString('hex');
};

module.exports = {
    hashPassword,
    comparePassword,
    hashGovtId,
    hashOTP,
    hashToken,
    createHashChain,
    encrypt,
    decrypt,
    encryptSecret,
    decryptSecret,
    generateSecureRandom,
};
