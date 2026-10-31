const { query } = require('../config/db');
const logger = require('../utils/logger');
const { STAFF_STATUS } = require('../utils/constants');

/**
 * Create staff-organization mapping
 * @param {Object} mappingData - Mapping data
 * @returns {Promise<Object>} Created mapping
 */
const createStaffMapping = async (mappingData) => {
    try {
        const {
            userId,
            organizationId,
            roleId,
            professionalLicense,
            licenseVerified,
            shiftStart,
            shiftEnd,
        } = mappingData;

        // Check if mapping already exists
        const existingMapping = await query(
            'SELECT id, status FROM staff_org_mapping WHERE user_id = $1 AND organization_id = $2',
            [userId, organizationId]
        );

        if (existingMapping.rows.length > 0) {
            // Reactivate if exists but inactive
            if (existingMapping.rows[0].status === STAFF_STATUS.INACTIVE) {
                return reactivateStaffMapping(existingMapping.rows[0].id);
            }
            throw new Error('Staff member already assigned to this organization');
        }

        const insertQuery = `
      INSERT INTO staff_org_mapping (
        user_id, organization_id, role_id, professional_license,
        license_verified, shift_start, shift_end, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

        const result = await query(insertQuery, [
            userId,
            organizationId,
            roleId,
            professionalLicense || null,
            licenseVerified || false,
            shiftStart || null,
            shiftEnd || null,
            STAFF_STATUS.ACTIVE,
        ]);

        return result.rows[0];
    } catch (error) {
        logger.error('Failed to create staff mapping:', error);
        throw error;
    }
};

/**
 * Find staff mapping by user and organization
 * @param {String} userId - User ID
 * @param {String} organizationId - Organization ID
 * @returns {Promise<Object>} Staff mapping
 */
const findStaffMapping = async (userId, organizationId) => {
    try {
        const selectQuery = `
      SELECT som.*, r.name as role_name, o.name as organization_name
      FROM staff_org_mapping som
      JOIN roles r ON som.role_id = r.id
      JOIN organizations o ON som.organization_id = o.id
      WHERE som.user_id = $1 AND som.organization_id = $2
    `;

        const result = await query(selectQuery, [userId, organizationId]);
        return result.rows[0] || null;
    } catch (error) {
        logger.error('Failed to find staff mapping:', error);
        throw error;
    }
};

/**
 * Get all staff mappings for a user
 * @param {String} userId - User ID
 * @returns {Promise<Array>} Staff mappings
 */
const getUserStaffMappings = async (userId) => {
    try {
        const selectQuery = `
      SELECT 
        som.*,
        r.name as role_name,
        o.name as organization_name,
        o.type as organization_type
      FROM staff_org_mapping som
      JOIN roles r ON som.role_id = r.id
      JOIN organizations o ON som.organization_id = o.id
      WHERE som.user_id = $1 AND som.status = $2
      ORDER BY som.assigned_at DESC
    `;

        const result = await query(selectQuery, [userId, STAFF_STATUS.ACTIVE]);
        return result.rows;
    } catch (error) {
        logger.error('Failed to get user staff mappings:', error);
        throw error;
    }
};

/**
 * Update staff mapping
 * @param {String} mappingId - Mapping ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated mapping
 */
const updateStaffMapping = async (mappingId, updateData) => {
    try {
        const {
            professionalLicense,
            licenseVerified,
            shiftStart,
            shiftEnd,
            status,
        } = updateData;

        const updateQuery = `
      UPDATE staff_org_mapping
      SET 
        professional_license = COALESCE($1, professional_license),
        license_verified = COALESCE($2, license_verified),
        shift_start = COALESCE($3, shift_start),
        shift_end = COALESCE($4, shift_end),
        status = COALESCE($5, status)
      WHERE id = $6
      RETURNING *
    `;

        const result = await query(updateQuery, [
            professionalLicense,
            licenseVerified,
            shiftStart,
            shiftEnd,
            status,
            mappingId,
        ]);

        return result.rows[0];
    } catch (error) {
        logger.error('Failed to update staff mapping:', error);
        throw error;
    }
};

/**
 * Verify staff professional license
 * @param {String} mappingId - Mapping ID
 * @returns {Promise<Object>} Updated mapping
 */
const verifyStaffLicense = async (mappingId) => {
    try {
        const updateQuery = `
      UPDATE staff_org_mapping
      SET license_verified = true
      WHERE id = $1
      RETURNING *
    `;

        const result = await query(updateQuery, [mappingId]);
        return result.rows[0];
    } catch (error) {
        logger.error('Failed to verify staff license:', error);
        throw error;
    }
};

/**
 * Deactivate staff mapping
 * @param {String} userId - User ID
 * @param {String} organizationId - Organization ID
 * @returns {Promise<Object>} Updated mapping
 */
const deactivateStaffMapping = async (userId, organizationId) => {
    try {
        const updateQuery = `
      UPDATE staff_org_mapping
      SET status = $1, deactivated_at = NOW()
      WHERE user_id = $2 AND organization_id = $3
      RETURNING *
    `;

        const result = await query(updateQuery, [
            STAFF_STATUS.INACTIVE,
            userId,
            organizationId,
        ]);

        return result.rows[0];
    } catch (error) {
        logger.error('Failed to deactivate staff mapping:', error);
        throw error;
    }
};

/**
 * Reactivate staff mapping
 * @param {String} mappingId - Mapping ID
 * @returns {Promise<Object>} Updated mapping
 */
const reactivateStaffMapping = async (mappingId) => {
    try {
        const updateQuery = `
      UPDATE staff_org_mapping
      SET status = $1, deactivated_at = NULL
      WHERE id = $2
      RETURNING *
    `;

        const result = await query(updateQuery, [STAFF_STATUS.ACTIVE, mappingId]);
        return result.rows[0];
    } catch (error) {
        logger.error('Failed to reactivate staff mapping:', error);
        throw error;
    }
};

/**
 * Check if staff is currently on shift
 * @param {String} userId - User ID
 * @param {String} organizationId - Organization ID
 * @returns {Promise<Boolean>} True if on shift
 */
const isStaffOnShift = async (userId, organizationId) => {
    try {
        const selectQuery = `
      SELECT shift_start, shift_end
      FROM staff_org_mapping
      WHERE user_id = $1 AND organization_id = $2 AND status = $3
    `;

        const result = await query(selectQuery, [userId, organizationId, STAFF_STATUS.ACTIVE]);

        if (result.rows.length === 0) {
            return false;
        }

        const { shift_start, shift_end } = result.rows[0];

        if (!shift_start || !shift_end) {
            return true; // No shift restrictions
        }

        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes(); // Minutes since midnight

        const [startHour, startMinute] = shift_start.split(':').map(Number);
        const [endHour, endMinute] = shift_end.split(':').map(Number);

        const shiftStartMinutes = startHour * 60 + startMinute;
        const shiftEndMinutes = endHour * 60 + endMinute;

        return currentTime >= shiftStartMinutes && currentTime <= shiftEndMinutes;
    } catch (error) {
        logger.error('Failed to check if staff is on shift:', error);
        throw error;
    }
};

module.exports = {
    createStaffMapping,
    findStaffMapping,
    getUserStaffMappings,
    updateStaffMapping,
    verifyStaffLicense,
    deactivateStaffMapping,
    reactivateStaffMapping,
    isStaffOnShift,
};
