const crypto = require('crypto');

/**
 * Generate unique health ID
 * Format: UHI-YYYYMMDD-XXXXXX
 * @returns {String} Unique health ID
 */
const generateHealthID = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    // Generate 6 random alphanumeric characters
    const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();

    return `UHI-${year}${month}${day}-${randomPart}`;
};

/**
 * Generate visit access code
 * Format: 6-digit numeric code
 * @returns {String} Visit access code
 */
const generateVisitCode = () => {
    return crypto.randomInt(100000, 999999).toString();
};

/**
 * Generate UUID v4
 * @returns {String} UUID
 */
const generateUUID = () => {
    return crypto.randomUUID();
};

/**
 * Generate random token
 * @param {Number} length - Length of token in bytes
 * @returns {String} Random token
 */
const generateRandomToken = (length = 32) => {
    return crypto.randomBytes(length).toString('hex');
};

/**
 * Generate OTP code
 * @param {Number} length - Length of OTP (default 6)
 * @returns {String} OTP code
 */
const generateOTP = (length = 6) => {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return crypto.randomInt(min, max).toString();
};

module.exports = {
    generateHealthID,
    generateVisitCode,
    generateUUID,
    generateRandomToken,
    generateOTP,
};
