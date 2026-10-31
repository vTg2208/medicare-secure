const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');

const JWT_CONFIG = {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    issuer: 'healthcare-system',
    audience: 'healthcare-api',
};

/**
 * Generate access token
 * @param {Object} payload - User data to encode in token
 * @returns {String} JWT access token
 */
const generateAccessToken = (payload) => {
    return jwt.sign(payload, JWT_CONFIG.secret, {
        algorithm: 'HS256',
        jwtid: randomUUID(),
        expiresIn: JWT_CONFIG.expiresIn,
        issuer: JWT_CONFIG.issuer,
        audience: JWT_CONFIG.audience,
    });
};

/**
 * Generate refresh token
 * @param {Object} payload - User data to encode in token
 * @returns {String} JWT refresh token
 */
const generateRefreshToken = (payload) => {
    return jwt.sign(payload, JWT_CONFIG.refreshSecret, {
        algorithm: 'HS256',
        jwtid: randomUUID(),
        expiresIn: JWT_CONFIG.refreshExpiresIn,
        issuer: JWT_CONFIG.issuer,
        audience: JWT_CONFIG.audience,
    });
};

/**
 * Verify access token
 * @param {String} token - JWT token to verify
 * @returns {Object} Decoded token payload
 */
const verifyAccessToken = (token) => {
    try {
        return jwt.verify(token, JWT_CONFIG.secret, {
            algorithms: ['HS256'],
            issuer: JWT_CONFIG.issuer,
            audience: JWT_CONFIG.audience,
        });
    } catch (error) {
        throw new Error(`Token verification failed: ${error.message}`);
    }
};

/**
 * Verify refresh token
 * @param {String} token - JWT refresh token to verify
 * @returns {Object} Decoded token payload
 */
const verifyRefreshToken = (token) => {
    try {
        return jwt.verify(token, JWT_CONFIG.refreshSecret, {
            algorithms: ['HS256'],
            issuer: JWT_CONFIG.issuer,
            audience: JWT_CONFIG.audience,
        });
    } catch (error) {
        throw new Error(`Refresh token verification failed: ${error.message}`);
    }
};

/**
 * Decode token without verification (for debugging)
 * @param {String} token - JWT token to decode
 * @returns {Object} Decoded token payload
 */
const decodeToken = (token) => {
    return jwt.decode(token);
};

module.exports = {
    JWT_CONFIG,
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    decodeToken,
};
