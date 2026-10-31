const { query } = require('../config/db');
const logger = require('../utils/logger');
const { ORGANIZATION_STATUS } = require('../utils/constants');

/**
 * Create organization
 * @param {Object} orgData - Organization data
 * @returns {Promise<Object>} Created organization
 */
const createOrganization = async (orgData) => {
    try {
        const {
            name,
            type,
            licenseNumber,
            licenseDocumentUrl,
            address,
            city,
            state,
            country,
            postalCode,
            phone,
            email,
            adminUserId,
        } = orgData;

        // Check for duplicate license number
        const duplicateCheck = await query(
            'SELECT id FROM organizations WHERE license_number = $1',
            [licenseNumber]
        );

        if (duplicateCheck.rows.length > 0) {
            throw new Error('Organization with this license number already exists');
        }

        // Generate hospital code (e.g., H12345)
        const hospitalCode = `H${Math.floor(10000 + Math.random() * 90000)}`;

        const insertQuery = `
      INSERT INTO organizations (
        name, type, license_number, license_document_url, address, city, state, country,
        postal_code, phone, email, admin_user_id, status, hospital_code
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

        const result = await query(insertQuery, [
            name,
            type,
            licenseNumber,
            licenseDocumentUrl || null,
            address || null,
            city || null,
            state || null,
            country || null,
            postalCode || null,
            phone || null,
            email || null,
            adminUserId || null,
            ORGANIZATION_STATUS.PENDING,
            hospitalCode,
        ]);

        return result.rows[0];
    } catch (error) {
        logger.error('Failed to create organization:', error);
        throw error;
    }
};

/**
 * Find organization by ID
 * @param {String} orgId - Organization ID
 * @returns {Promise<Object>} Organization
 */
const findOrganizationById = async (orgId) => {
    try {
        const selectQuery = `
      SELECT o.*, u.email as admin_email, u.phone as admin_phone
      FROM organizations o
      LEFT JOIN users u ON o.admin_user_id = u.id
      WHERE o.id = $1
    `;

        const result = await query(selectQuery, [orgId]);
        return result.rows[0] || null;
    } catch (error) {
        logger.error('Failed to find organization by ID:', error);
        throw error;
    }
};

/**
 * Find organization by license number
 * @param {String} licenseNumber - License number
 * @returns {Promise<Object>} Organization
 */
const findOrganizationByLicense = async (licenseNumber) => {
    try {
        const result = await query(
            'SELECT * FROM organizations WHERE license_number = $1',
            [licenseNumber]
        );
        return result.rows[0] || null;
    } catch (error) {
        logger.error('Failed to find organization by license:', error);
        throw error;
    }
};

/**
 * Update organization
 * @param {String} orgId - Organization ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated organization
 */
const updateOrganization = async (orgId, updateData) => {
    try {
        const {
            name,
            address,
            city,
            state,
            country,
            postalCode,
            phone,
            email,
            verified,
            status,
        } = updateData;

        const updateQuery = `
      UPDATE organizations
      SET 
        name = COALESCE($1, name),
        address = COALESCE($2, address),
        city = COALESCE($3, city),
        state = COALESCE($4, state),
        country = COALESCE($5, country),
        postal_code = COALESCE($6, postal_code),
        phone = COALESCE($7, phone),
        email = COALESCE($8, email),
        verified = COALESCE($9, verified),
        status = COALESCE($10, status)
      WHERE id = $11
      RETURNING *
    `;

        const result = await query(updateQuery, [
            name,
            address,
            city,
            state,
            country,
            postalCode,
            phone,
            email,
            verified,
            status,
            orgId,
        ]);

        return result.rows[0];
    } catch (error) {
        logger.error('Failed to update organization:', error);
        throw error;
    }
};

/**
 * Verify organization
 * @param {String} orgId - Organization ID
 * @returns {Promise<Object>} Updated organization
 */
const verifyOrganization = async (orgId) => {
    try {
        const updateQuery = `
      UPDATE organizations
      SET verified = true, status = $1
      WHERE id = $2
      RETURNING *
    `;

        const result = await query(updateQuery, [ORGANIZATION_STATUS.ACTIVE, orgId]);
        return result.rows[0];
    } catch (error) {
        logger.error('Failed to verify organization:', error);
        throw error;
    }
};

/**
 * Get all organizations
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Organizations list
 */
const getAllOrganizations = async (options = {}) => {
    try {
        const { limit = 50, offset = 0, type, status } = options;

        let conditions = [];
        let params = [];
        let paramIndex = 1;

        if (type) {
            conditions.push(`type = $${paramIndex}`);
            params.push(type);
            paramIndex++;
        }

        if (status) {
            conditions.push(`status = $${paramIndex}`);
            params.push(status);
            paramIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const selectQuery = `
      SELECT id, name, type, license_number, city, state, verified, status, created_at
      FROM organizations
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

        params.push(limit, offset);

        const result = await query(selectQuery, params);
        return result.rows;
    } catch (error) {
        logger.error('Failed to get all organizations:', error);
        throw error;
    }
};

/**
 * Get organization staff
 * @param {String} orgId - Organization ID
 * @returns {Promise<Array>} Staff list
 */
const getOrganizationStaff = async (orgId) => {
    try {
        const selectQuery = `
      SELECT 
        u.id as user_id,
        u.email,
        u.phone,
        r.name as role,
        som.professional_license,
        som.license_verified,
        som.shift_start,
        som.shift_end,
        som.status,
        som.assigned_at
      FROM staff_org_mapping som
      JOIN users u ON som.user_id = u.id
      JOIN roles r ON som.role_id = r.id
      WHERE som.organization_id = $1 AND som.status = 'active'
      ORDER BY som.assigned_at DESC
    `;

        const result = await query(selectQuery, [orgId]);
        return result.rows;
    } catch (error) {
        logger.error('Failed to get organization staff:', error);
        throw error;
    }
};

module.exports = {
    createOrganization,
    findOrganizationById,
    findOrganizationByLicense,
    updateOrganization,
    verifyOrganization,
    getAllOrganizations,
    getOrganizationStaff,
};
