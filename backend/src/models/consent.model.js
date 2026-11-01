const { query } = require('../config/db');
const logger = require('../utils/logger');
const { consentCategories, consentPurposeSql } = require('../utils/consent.validator');
const { processingAllowedSql, purposeForCategory } = require('../modules/privacy/processing-policy');

/**
 * Grant new consent
 * @param {Object} consentData - Consent data
 * @returns {Promise<Object>} Created consent
 */
const createConsent = async (consentData) => {
    try {
        const {
            patientId,
            recipientUserId,
            dataCategory,
            purpose,
            accessLevel,
            startTime,
            endTime,
        } = consentData;

        // A new patient decision is a separate grant. Never overwrite a different
        // category, purpose, or visit-generated grant for the same recipient.
        const insertQuery = `
            INSERT INTO consents (
                patient_id,
                recipient_user_id,
                data_category,
                purpose,
                access_level,
                start_time,
                end_time,
                status,
                created_at,
                updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', NOW(), NOW())
            RETURNING *
        `;

        const result = await query(insertQuery, [
            patientId,
            recipientUserId,
            dataCategory,
            purpose,
            accessLevel,
            startTime || new Date(),
            endTime || null,
        ]);

        return result.rows[0];
    } catch (error) {
        logger.error('Failed to create consent:', error);
        throw error;
    }
};


/**
 * Update existing consent
 * @param {String} consentId - Consent ID
 * @param {String} patientId - Patient ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated consent
 */
const updateConsent = async (consentId, patientId, updateData) => {
    try {
        const {
            dataCategory,
            purpose,
            accessLevel,
            endTime,
        } = updateData;

        const updateQuery = `
            UPDATE consents 
            SET 
                data_category = COALESCE($1, data_category),
                purpose = COALESCE($2, purpose),
                access_level = COALESCE($3, access_level),
                end_time = CASE WHEN $7::boolean THEN $4::timestamptz ELSE end_time END,
                updated_at = NOW()
            WHERE id = $5 AND patient_id = $6
            RETURNING *
        `;

        const result = await query(updateQuery, [
            dataCategory,
            purpose,
            accessLevel,
            endTime, // Can be null for unlimited
            consentId,
            patientId,
            Object.prototype.hasOwnProperty.call(updateData, 'endTime')
        ]);

        return result.rows[0];
    } catch (error) {
        logger.error('Failed to update consent:', error);
        throw error;
    }
};

/**
 * Revoke consent
 * @param {String} consentId - Consent ID
 * @param {String} patientId - Patient ID (for validation)
 * @returns {Promise<Object>} Updated consent
 */
const revokeConsent = async (consentId, patientId) => {
    try {
        const updateQuery = `
            UPDATE consents 
            SET status = 'revoked', revoked_at = NOW(), updated_at = NOW()
            WHERE id = $1 AND patient_id = $2
            RETURNING *
        `;

        const result = await query(updateQuery, [consentId, patientId]);
        return result.rows[0];
    } catch (error) {
        logger.error('Failed to revoke consent:', error);
        throw error;
    }
};

/**
 * Get active consents for patient
 * @param {String} patientId - Patient ID
 * @returns {Promise<Array>} List of active consents
 */
const getActiveConsents = async (patientId) => {
    try {
        const selectQuery = `
            SELECT
                c.id,
                c.recipient_user_id as "recipientUserId",
                c.data_category as "dataCategory",
                c.purpose,
                c.access_level as "accessLevel",
                c.start_time as "startTime",
                c.end_time as "endTime",
                c.status,
                c.source,
                c.visit_id as "visitId",
                c.created_at,
                u.email as recipient_email,
                r.name as recipient_role,
                CONCAT(u.first_name, ' ', u.last_name) as "recipientName",
                COALESCE(dp.specialization, 'Medical Staff') as "specialization"
            FROM consents c
            INNER JOIN users u ON c.recipient_user_id = u.id
            INNER JOIN roles r ON u.role_id = r.id
            LEFT JOIN doctor_profiles dp ON u.id = dp.user_id
            WHERE c.patient_id = $1 
                AND c.status = 'active'
                AND (c.end_time IS NULL OR c.end_time > NOW())
            ORDER BY c.created_at DESC, c.id
        `;

        const result = await query(selectQuery, [patientId]);

        return result.rows;
    } catch (error) {
        logger.error('Failed to get active consents:', error);
        throw error;
    }
};

/**
 * Get consent history for patient
 * @param {String} patientId - Patient ID
 * @returns {Promise<Array>} List of consent history
 */
const getConsentHistory = async (patientId) => {
    try {
        const selectQuery = `
            SELECT 
                c.id,
                c.recipient_user_id as "recipientUserId",
                c.data_category as "dataCategory",
                c.purpose,
                c.access_level as "accessLevel",
                c.start_time as "startTime",
                c.end_time as "endTime",
                c.status,
                c.created_at,
                c.updated_at,
                u.email as recipient_email,
                r.name as recipient_role,
                CONCAT(u.first_name, ' ', u.last_name) as "recipientName",
                COALESCE(dp.specialization, 'Medical Staff') as "specialization"
            FROM consents c
            INNER JOIN users u ON c.recipient_user_id = u.id
            INNER JOIN roles r ON u.role_id = r.id
            LEFT JOIN doctor_profiles dp ON u.id = dp.user_id
            WHERE c.patient_id = $1
            AND (c.status = 'revoked' OR c.end_time <= NOW())
            ORDER BY c.created_at DESC
        `;

        const result = await query(selectQuery, [patientId]);
        return result.rows;
    } catch (error) {
        logger.error('Failed to get consent history:', error);
        throw error;
    }
};

/**
 * Find current consent matching the server-selected workflow and scope.
 * @param {String} patientId - Patient ID
 * @param {String} recipientUserId - Recipient User ID
 * @param {String} dataCategory - Data Category
 * @param {String} accessLevel - Access Level ('read' or 'write')
 * @returns {Promise<Object|null>} The matched decision for authorization evidence.
 */
const findMatchingConsent = async (patientId, recipientUserId, dataCategory, accessLevel = 'read') => {
    try {
        const checkQuery = `
            SELECT id, purpose, data_category, source, access_level
            FROM consents consent
            WHERE patient_id = $1 
                AND recipient_user_id = $2
                AND (data_category = ANY($3::text[]) OR data_category IN ('all', 'all_medical_data', '*'))
                AND status = 'active'
                AND start_time <= NOW()
                AND (end_time IS NULL OR end_time > NOW())
                AND ${consentPurposeSql('consent', dataCategory)}
                AND ${processingAllowedSql('consent.patient_id',purposeForCategory(dataCategory))}
                AND access_level = ANY($4::text[])
            ORDER BY created_at DESC, id
            LIMIT 1
        `;

        const result = await query(checkQuery, [patientId, recipientUserId, consentCategories(dataCategory), accessLevel === 'write' ? ['write'] : ['read', 'write']]);
        return result.rows[0] || null;
    } catch (error) {
        logger.error('Failed to check consent:', error);
        throw error;
    }
};

const checkConsent = async (...args) => Boolean(await findMatchingConsent(...args));

/**
 * Find consent by ID
 * @param {String} consentId - Consent ID
 * @returns {Promise<Object>} Consent object
 */
const findConsentById = async (consentId) => {
    try {
        const result = await query('SELECT * FROM consents WHERE id = $1', [consentId]);
        return result.rows[0];
    } catch (error) {
        logger.error('Failed to find consent by ID:', error);
        throw error;
    }
};

/**
 * Get patients who have granted active consent to the doctor
 * @param {String} doctorId - Doctor User ID
 * @returns {Promise<Array>} List of patients
 */
const getPatientsWithActiveConsent = async (doctorId) => {
    try {
        const selectQuery = `
            SELECT DISTINCT
                u.id, 
                u.first_name, 
                u.last_name, 
                u.email, 
                p.unique_health_id, 
                p.date_of_birth, 
                p.gender,
                c.data_category,
                c.access_level,
                c.end_time as consent_expires_at
            FROM consents c
            JOIN users u ON c.patient_id = u.id
            LEFT JOIN patient_profiles p ON u.id = p.user_id
            WHERE c.recipient_user_id = $1
            AND c.status = 'active'
            AND c.start_time <= NOW()
            AND (c.end_time IS NULL OR c.end_time > NOW())
            AND ${consentPurposeSql('c')}
            ORDER BY u.last_name, u.first_name
        `;

        const result = await query(selectQuery, [doctorId]);
        return result.rows;
    } catch (error) {
        logger.error('Failed to get patients with active consent:', error);
        throw error;
    }
};

module.exports = {
    createConsent,
    updateConsent,
    revokeConsent,
    getActiveConsents,
    getConsentHistory,
    checkConsent,
    findMatchingConsent,
    findConsentById,
    getPatientsWithActiveConsent,
};
