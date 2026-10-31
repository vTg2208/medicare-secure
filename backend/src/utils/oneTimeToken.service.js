/**
 * One-Time Token Service
 * Generates secure, time-limited tokens for temporary access
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const logger = require('./logger');

class OneTimeTokenService {
    static inspectToken(token) {
        if (typeof token !== 'string' || token.length > 8192) throw new Error('Invalid token');
        const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
        if (payload.type !== 'one_time') throw new Error('Invalid token type');
        return payload;
    }

    /**
     * Generate a one-time token
     * @param {Object} params - Token parameters
     * @param {String} params.userId - User ID requesting the token
     * @param {String} params.createdBy - User ID creating the token
     * @param {Object} params.scope - Token scope {resourceType, resourceId, permissions}
     * @param {Number} params.expiresInMinutes - Expiration time in minutes (default: 60)
     * @returns {Promise<Object>} Token object with token string and metadata
     */
    static async generateToken({ userId, createdBy, scope, expiresInMinutes = 60 }) {
        try {
            // Generate random token
            const randomToken = crypto.randomBytes(32).toString('hex');

            // Create JWT payload
            const payload = {
                userId,
                scope,
                type: 'one_time',
                jti: crypto.randomUUID() // JWT ID for uniqueness
            };

            // Sign JWT
            const token = jwt.sign(payload, process.env.JWT_SECRET, {
                expiresIn: `${expiresInMinutes}m`
            });

            // Hash the token for storage
            const tokenHash = crypto
                .createHash('sha256')
                .update(token)
                .digest('hex');

            // Calculate expiration time
            const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

            // Store token metadata in database
            const query = `
                INSERT INTO one_time_tokens (
                    token_hash, user_id, scope, expires_at, created_by
                ) VALUES ($1, $2, $3, $4, $5)
                RETURNING id, expires_at, created_at
            `;

            const result = await pool.query(query, [
                tokenHash,
                userId,
                JSON.stringify(scope),
                expiresAt,
                createdBy
            ]);

            logger.info('One-time token generated', {
                tokenId: result.rows[0].id,
                userId,
                scope,
                expiresAt
            });

            return {
                token, // Return the actual token to the caller
                tokenId: result.rows[0].id,
                expiresAt: result.rows[0].expires_at,
                scope
            };
        } catch (error) {
            logger.error('Failed to generate one-time token:', error);
            throw error;
        }
    }

    /**
     * Validate and use a one-time token
     * @param {String} token - Token to validate
     * @param {String} ipAddress - IP address of the request
     * @returns {Promise<Object>} Token payload if valid
     */
    static async validateAndUseToken(token, ipAddress) {
        try {
            // Verify JWT
            const payload = this.inspectToken(token);

            // Hash the token to look up in database
            const tokenHash = crypto
                .createHash('sha256')
                .update(token)
                .digest('hex');

            // Check if token exists and hasn't been used
            const query = `
                SELECT id, user_id, scope, expires_at, used_at
                FROM one_time_tokens
                WHERE token_hash = $1
            `;

            const result = await pool.query(query, [tokenHash]);

            if (result.rows.length === 0) {
                throw new Error('Token not found');
            }

            const tokenRecord = result.rows[0];

            // Check if already used
            if (tokenRecord.used_at) {
                logger.warn('Attempt to reuse one-time token', {
                    tokenId: tokenRecord.id,
                    userId: tokenRecord.user_id
                });
                throw new Error('Token has already been used');
            }

            // Check if expired
            if (new Date(tokenRecord.expires_at) < new Date()) {
                throw new Error('Token has expired');
            }

            // Mark token as used
            const updateQuery = `
                UPDATE one_time_tokens
                SET used_at = NOW(), used_by_ip = $1
                WHERE id = $2 AND used_at IS NULL AND expires_at > NOW() RETURNING id
            `;

            const consumed = await pool.query(updateQuery, [ipAddress, tokenRecord.id]);
            if (!consumed.rows.length) throw new Error('Token has already been used or expired');

            logger.info('One-time token validated and used', {
                tokenId: tokenRecord.id,
                userId: tokenRecord.user_id,
                ipAddress
            });

            return {
                userId: tokenRecord.user_id,
                scope: tokenRecord.scope,
                tokenId: tokenRecord.id
            };
        } catch (error) {
            if (error.name === 'JsonWebTokenError') {
                throw new Error('Invalid token');
            }
            if (error.name === 'TokenExpiredError') {
                throw new Error('Token has expired');
            }
            throw error;
        }
    }

    /**
     * Revoke a token before it expires
     * @param {String} tokenId - Token ID to revoke
     * @returns {Promise<Boolean>} True if revoked
     */
    static async revokeToken(tokenId) {
        try {
            const query = `
                UPDATE one_time_tokens
                SET used_at = NOW()
                WHERE id = $1 AND used_at IS NULL
                RETURNING id
            `;

            const result = await pool.query(query, [tokenId]);

            if (result.rows.length > 0) {
                logger.info('One-time token revoked', { tokenId });
                return true;
            }

            return false;
        } catch (error) {
            logger.error('Failed to revoke token:', error);
            throw error;
        }
    }

    /**
     * Clean up expired tokens
     * @returns {Promise<Number>} Number of tokens deleted
     */
    static async cleanupExpiredTokens() {
        try {
            const query = `
                DELETE FROM one_time_tokens
                WHERE expires_at < NOW()
                RETURNING id
            `;

            const result = await pool.query(query);
            const count = result.rows.length;

            if (count > 0) {
                logger.info(`Cleaned up ${count} expired one-time tokens`);
            }

            return count;
        } catch (error) {
            logger.error('Failed to cleanup expired tokens:', error);
            throw error;
        }
    }
}

module.exports = OneTimeTokenService;
