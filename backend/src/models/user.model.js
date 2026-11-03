const { query } = require('../config/db');
const { hashPassword } = require('../services/encryption.service');
const logger = require('../utils/logger');
const { USER_STATUS } = require('../utils/constants');
const { pagination, searchPattern } = require('../utils/pagination');

/**
 * Create new user
 * @param {Object} userData - User data
 * @returns {Promise<Object>} Created user
 */
const createUser = async (userData, client = null) => {
    try {
        const { email, phone, password, roleId, firstName, lastName, isVerified, status, verificationStatus, accountStatus } = userData;

        const passwordHash = await hashPassword(password);

        const insertQuery = `
      INSERT INTO users (email, phone, password_hash, role_id, first_name, last_name, is_verified, status, verification_status, account_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, email, phone, first_name, last_name, role_id, is_verified, status, verification_status, account_status, created_at
    `;

        const result = await (client ? client.query.bind(client) : query)(insertQuery, [
            email || null,
            phone || null,
            passwordHash,
            roleId,
            firstName || null,
            lastName || null,
            isVerified || false,
            status || USER_STATUS.PENDING,
            verificationStatus || 'unverified',
            accountStatus || 'active'
        ]);

        return result.rows[0];
    } catch (error) {
        logger.error('Failed to create user:', error);
        throw error;
    }
};

/**
 * Find user by ID
 * @param {String} userId - User ID
 * @returns {Promise<Object>} User object
 */
const findUserById = async (userId) => {
    try {
        const selectQuery = `
      SELECT u.*, r.name as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1
    `;

        const result = await query(selectQuery, [userId]);
        return result.rows[0] || null;
    } catch (error) {
        logger.error('Failed to find user by ID:', error);
        throw error;
    }
};

/**
 * Find user by email
 * @param {String} email - User email
 * @returns {Promise<Object>} User object
 */
const findUserByEmail = async (email) => {
    try {
        const selectQuery = `
      SELECT u.*, r.name as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.email = $1
    `;

        const result = await query(selectQuery, [email]);
        return result.rows[0] || null;
    } catch (error) {
        logger.error('Failed to find user by email:', error);
        throw error;
    }
};

/**
 * Find user by phone
 * @param {String} phone - User phone
 * @returns {Promise<Object>} User object
 */
const findUserByPhone = async (phone) => {
    try {
        const selectQuery = `
      SELECT u.*, r.name as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.phone = $1
    `;

        const result = await query(selectQuery, [phone]);
        return result.rows[0] || null;
    } catch (error) {
        logger.error('Failed to find user by phone:', error);
        throw error;
    }
};

/**
 * Find user by email or phone
 * @param {String} emailOrPhone - Email or phone
 * @returns {Promise<Object>} User object
 */
const findUserByEmailOrPhone = async (emailOrPhone) => {
    try {
        const selectQuery = `
      SELECT u.*, r.name as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.email = $1 OR u.phone = $1
    `;

        const result = await query(selectQuery, [emailOrPhone]);
        return result.rows[0] || null;
    } catch (error) {
        logger.error('Failed to find user by email or phone:', error);
        throw error;
    }
};

/**
 * Check if user exists (duplicate check)
 * @param {String} email - Email
 * @param {String} phone - Phone
 * @returns {Promise<Boolean>} True if user exists
 */
const userExists = async (email, phone) => {
    try {
        let conditions = [];
        let params = [];

        if (email) {
            conditions.push('email = $1');
            params.push(email);
        }

        if (phone) {
            const phoneParam = email ? '$2' : '$1';
            conditions.push(`phone = ${phoneParam}`);
            params.push(phone);
        }

        const selectQuery = `
      SELECT COUNT(*) as count
      FROM users
      WHERE ${conditions.join(' OR ')}
    `;

        const result = await query(selectQuery, params);
        return parseInt(result.rows[0].count) > 0;
    } catch (error) {
        logger.error('Failed to check if user exists:', error);
        throw error;
    }
};

/**
 * Update user verification status
 * @param {String} userId - User ID
 * @param {Boolean} isVerified - Verification status
 * @returns {Promise<Object>} Updated user
 */
const updateUserVerification = async (userId, isVerified = true) => {
    try {
        const updateQuery = `
      UPDATE users
      SET is_verified = $1, status = CASE
          WHEN role_id = (SELECT id FROM roles WHERE name = 'patient') AND status = 'pending' THEN $2
          ELSE status END
      WHERE id = $3
      RETURNING id, email, phone, is_verified, status
    `;

        const status = isVerified ? USER_STATUS.ACTIVE : USER_STATUS.PENDING;
        const result = await query(updateQuery, [isVerified, status, userId]);

        return result.rows[0];
    } catch (error) {
        logger.error('Failed to update user verification:', error);
        throw error;
    }
};

/**
 * Update user password
 * @param {String} userId - User ID
 * @param {String} newPassword - New password (plain text)
 * @returns {Promise<Boolean>} Success status
 */
const updateUserPassword = async (userId, newPassword) => {
    try {
        const passwordHash = await hashPassword(newPassword);

        const updateQuery = `
      UPDATE users
      SET password_hash = $1
      WHERE id = $2
    `;

        await query(updateQuery, [passwordHash, userId]);
        return true;
    } catch (error) {
        logger.error('Failed to update user password:', error);
        throw error;
    }
};

/**
 * Update user status
 * @param {String} userId - User ID
 * @param {String} status - New status
 * @returns {Promise<Object>} Updated user
 */
const updateUserStatus = async (userId, status) => {
    try {
        const updateQuery = `
      UPDATE users
      SET status = $1
      WHERE id = $2
      RETURNING id, email, phone, status
    `;

        const result = await query(updateQuery, [status, userId]);
        return result.rows[0];
    } catch (error) {
        logger.error('Failed to update user status:', error);
        throw error;
    }
};

/**
 * Update last login time
 * @param {String} userId - User ID
 * @returns {Promise<Boolean>} Success status
 */
const updateLastLogin = async (userId) => {
    try {
        const updateQuery = `
      UPDATE users
      SET last_login = NOW(), failed_login_attempts = 0, account_locked_until = NULL
      WHERE id = $1
    `;

        await query(updateQuery, [userId]);
        return true;
    } catch (error) {
        logger.error('Failed to update last login:', error);
        throw error;
    }
};

/**
 * Increment failed login attempts
 * @param {String} userId - User ID
 * @returns {Promise<Number>} Current failed attempts count
 */
const incrementFailedLoginAttempts = async (userId) => {
    try {
        const updateQuery = `
      UPDATE users
      SET failed_login_attempts = failed_login_attempts + 1
      WHERE id = $1
      RETURNING failed_login_attempts
    `;

        const result = await query(updateQuery, [userId]);
        const attempts = result.rows[0].failed_login_attempts;

        // Lock account if too many failed attempts (5)
        if (attempts >= 5) {
            await lockUserAccount(userId, 15); // Lock for 15 minutes
        }

        return attempts;
    } catch (error) {
        logger.error('Failed to increment failed login attempts:', error);
        throw error;
    }
};

/**
 * Lock user account
 * @param {String} userId - User ID
 * @param {Number} minutes - Lock duration in minutes
 * @returns {Promise<Boolean>} Success status
 */
const lockUserAccount = async (userId, minutes = 15) => {
    try {
        const updateQuery = `
      UPDATE users
      SET account_locked_until = NOW() + INTERVAL '${minutes} minutes'
      WHERE id = $1
    `;

        await query(updateQuery, [userId]);
        return true;
    } catch (error) {
        logger.error('Failed to lock user account:', error);
        throw error;
    }
};

/**
 * Check if user account is locked
 * @param {String} userId - User ID
 * @returns {Promise<Boolean>} True if locked
 */
const isAccountLocked = async (userId) => {
    try {
        const selectQuery = `
      SELECT account_locked_until
      FROM users
      WHERE id = $1
    `;

        const result = await query(selectQuery, [userId]);

        if (!result.rows[0] || !result.rows[0].account_locked_until) {
            return false;
        }

        const lockedUntil = new Date(result.rows[0].account_locked_until);
        const now = new Date();

        return lockedUntil > now;
    } catch (error) {
        logger.error('Failed to check if account is locked:', error);
        throw error;
    }
};

/**
 * Get all users (admin only)
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Users list
 */
const userListScope = ({ role, status, organizationId, search } = {}) => {
    const conditions = [], params = [];
    const bind = value => { params.push(value); return `$${params.length}`; };
    if (organizationId) conditions.push(`EXISTS (SELECT 1 FROM staff_org_mapping som WHERE som.user_id=u.id AND som.status='active' AND som.organization_id=${bind(organizationId)})`);
    if (role) conditions.push(`r.name = ${bind(role)}`);
    if (status) conditions.push(`u.status = ${bind(status)}`);
    const pattern = searchPattern(search);
    if (pattern) {
        const parameter = bind(pattern);
        conditions.push(`(concat_ws(' ',u.first_name,u.last_name) ILIKE ${parameter} OR u.email ILIKE ${parameter})`);
    }
    return { sql: `FROM users u LEFT JOIN roles r ON u.role_id = r.id ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}`, params };
};
const getAllUsers = async (options = {}) => {
    try {
        const { limit, offset } = pagination(options);
        const { sql, params } = userListScope(options);
        const result = await query(`SELECT u.id, u.email, u.phone, u.first_name, u.last_name, u.is_verified, u.status, u.created_at, r.name as role_name
            ${sql} ORDER BY u.created_at DESC,u.id DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`, [...params,limit,offset]);
        return result.rows;
    } catch (error) {
        logger.error('Failed to get all users:', error);
        throw error;
    }
};
const countAllUsers = async (options = {}) => {
    const { sql, params } = userListScope(options);
    return Number((await query(`SELECT COUNT(DISTINCT u.id) AS count ${sql}`,params)).rows[0].count);
};

/**
 * Update user profile information
 * @param {String} userId - User ID
 * @param {Object} profileData - Profile data to update
 * @returns {Promise<Object>} Updated user
 */
const updateUserProfile = async (userId, profileData) => {
    try {
        const { firstName, lastName, phone } = profileData;
        const updateQuery = `
      UPDATE users
      SET first_name = $1, last_name = $2, phone = $3
      WHERE id = $4
      RETURNING id, email, phone, first_name, last_name, role_id, is_verified, status
    `;

        const result = await query(updateQuery, [
            firstName || null,
            lastName || null,
            phone || null,
            userId
        ]);

        return result.rows[0];
    } catch (error) {
        logger.error('Failed to update user profile:', error);
        throw error;
    }
};

module.exports = {
    createUser,
    findUserById,
    findUserByEmail,
    findUserByPhone,
    findUserByEmailOrPhone,
    userExists,
    updateUserVerification,
    updateUserPassword,
    updateUserStatus,
    updateLastLogin,
    incrementFailedLoginAttempts,
    lockUserAccount,
    isAccountLocked,
    getAllUsers,
    countAllUsers,
    updateUserProfile,
};
