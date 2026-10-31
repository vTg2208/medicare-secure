const bcrypt = require('bcrypt');
const crypto = require('crypto');
const config = require('../config/env');

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
    if (!config.security.encryptionKey) {
        throw new Error('Encryption key not configured');
    }

    const algorithm = config.security.encryptionAlgorithm || 'aes-256-gcm';
    const key = Buffer.from(config.security.encryptionKey, 'hex');
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
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
    if (!config.security.encryptionKey) {
        throw new Error('Encryption key not configured');
    }

    const algorithm = config.security.encryptionAlgorithm || 'aes-256-gcm';
    const key = Buffer.from(config.security.encryptionKey, 'hex');
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
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
    generateSecureRandom,
};
