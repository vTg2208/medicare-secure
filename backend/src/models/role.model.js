const { query } = require('../config/db');
const logger = require('../utils/logger');

/**
 * Get all roles
 * @returns {Promise<Array>} All roles
 */
const getAllRoles = async () => {
    try {
        const result = await query('SELECT * FROM roles ORDER BY name');
        return result.rows;
    } catch (error) {
        logger.error('Failed to get roles:', error);
        throw error;
    }
};

/**
 * Get role by ID
 * @param {Number} roleId - Role ID
 * @returns {Promise<Object>} Role object
 */
const getRoleById = async (roleId) => {
    try {
        const result = await query('SELECT * FROM roles WHERE id = $1', [roleId]);
        return result.rows[0] || null;
    } catch (error) {
        logger.error('Failed to get role by ID:', error);
        throw error;
    }
};

/**
 * Get role by name
 * @param {String} roleName - Role name
 * @returns {Promise<Object>} Role object
 */
const getRoleByName = async (roleName) => {
    try {
        const result = await query('SELECT * FROM roles WHERE name = $1', [roleName]);
        return result.rows[0] || null;
    } catch (error) {
        logger.error('Failed to get role by name:', error);
        throw error;
    }
};

/**
 * Create new role (admin only)
 * @param {Object} roleData - Role data
 * @returns {Promise<Object>} Created role
 */
const createRole = async (roleData) => {
    try {
        const { name, description } = roleData;

        const result = await query(
            'INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING *',
            [name, description]
        );

        return result.rows[0];
    } catch (error) {
        logger.error('Failed to create role:', error);
        throw error;
    }
};

module.exports = {
    getAllRoles,
    getRoleById,
    getRoleByName,
    createRole,
};
