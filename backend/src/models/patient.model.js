const { query } = require('../config/db');
const { generateHealthID, hashGovtId } = require('../utils/idGenerator');
const { hashGovtId: hashGovtIdService } = require('../services/encryption.service');
const logger = require('../utils/logger');

/**
 * Create patient profile
 * @param {Object} profileData - Patient profile data
 * @returns {Promise<Object>} Created patient profile
 */
const createPatientProfile = async (profileData, client = null) => {
    try {
        const {
            userId,
            govtId,
            dateOfBirth,
            gender,
            bloodGroup,
            emergencyContactName,
            emergencyContactPhone,
            emergencyContactRelation,
            address,
            city,
            state,
            country,
            postalCode,
            insuranceProvider,
            insurancePolicyNumber,
        } = profileData;

        // Use provided client or default query
        const dbQuery = client ? client.query.bind(client) : query;

        // Generate unique health ID
        let uniqueHealthId;
        let isUnique = false;
        let attempts = 0;
        const maxAttempts = 10;

        // Ensure unique health ID (retry if collision)
        while (!isUnique && attempts < maxAttempts) {
            uniqueHealthId = generateHealthID();
            const checkQuery = 'SELECT id FROM patient_profiles WHERE unique_health_id = $1';
            const checkResult = await dbQuery(checkQuery, [uniqueHealthId]);
            isUnique = checkResult.rows.length === 0;
            attempts++;
        }

        if (!isUnique) {
            throw new Error('Failed to generate unique health ID');
        }

        // Hash government ID for privacy (if provided)
        let govtIdHash = null;
        if (govtId) {
            govtIdHash = hashGovtIdService(govtId);

            // Check for duplicate government ID
            const duplicateCheck = await dbQuery(
                'SELECT id FROM patient_profiles WHERE govt_id_hash = $1',
                [govtIdHash]
            );

            if (duplicateCheck.rows.length > 0) {
                throw new Error('Patient with this government ID already exists');
            }
        }

        const insertQuery = `
      INSERT INTO patient_profiles (
        user_id, unique_health_id, govt_id_hash,
        date_of_birth, gender, blood_group,
        emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
        address, city, state, country, postal_code,
        insurance_provider, insurance_policy_number
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING id, user_id, unique_health_id, date_of_birth, gender, blood_group, created_at
    `;

        const result = await dbQuery(insertQuery, [
            userId,
            uniqueHealthId,
            govtIdHash,
            dateOfBirth || null,
            gender || null,
            bloodGroup || null,
            emergencyContactName || null,
            emergencyContactPhone || null,
            emergencyContactRelation || null,
            address || null,
            city || null,
            state || null,
            country || null,
            postalCode || null,
            insuranceProvider || null,
            insurancePolicyNumber || null,
        ]);

        return result.rows[0];
    } catch (error) {
        logger.error('Failed to create patient profile:', error);
        throw error;
    }
};

/**
 * Find patient profile by user ID
 * @param {String} userId - User ID
 * @returns {Promise<Object>} Patient profile
 */
const findPatientByUserId = async (userId) => {
    try {
        const selectQuery = `
      SELECT 
        p.*,
        u.email,
        u.phone,
        u.status as account_status
      FROM patient_profiles p
      JOIN users u ON p.user_id = u.id
      WHERE p.user_id = $1
    `;

        const result = await query(selectQuery, [userId]);
        return result.rows[0] || null;
    } catch (error) {
        logger.error('Failed to find patient by user ID:', error);
        throw error;
    }
};

/**
 * Find patient profile by health ID
 * @param {String} healthId - Unique health ID
 * @returns {Promise<Object>} Patient profile
 */
const findPatientByHealthId = async (healthId) => {
    try {
        const selectQuery = `
      SELECT 
        p.*,
        u.email,
        u.phone,
        u.status as account_status
      FROM patient_profiles p
      JOIN users u ON p.user_id = u.id
      WHERE p.unique_health_id = $1
    `;

        const result = await query(selectQuery, [healthId]);
        return result.rows[0] || null;
    } catch (error) {
        logger.error('Failed to find patient by health ID:', error);
        throw error;
    }
};

/**
 * Update patient profile
 * @param {String} userId - User ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated patient profile
 */
const updatePatientProfile = async (userId, updateData) => {
    try {
        const {
            dateOfBirth,
            gender,
            bloodGroup,
            emergencyContactName,
            emergencyContactPhone,
            emergencyContactRelation,
            address,
            city,
            state,
            country,
            postalCode,
        } = updateData;

        const updateQuery = `
      UPDATE patient_profiles
      SET 
        date_of_birth = COALESCE($1, date_of_birth),
        gender = COALESCE($2, gender),
        blood_group = COALESCE($3, blood_group),
        emergency_contact_name = COALESCE($4, emergency_contact_name),
        emergency_contact_phone = COALESCE($5, emergency_contact_phone),
        emergency_contact_relation = COALESCE($6, emergency_contact_relation),
        address = COALESCE($7, address),
        city = COALESCE($8, city),
        state = COALESCE($9, state),
        country = COALESCE($10, country),
        postal_code = COALESCE($11, postal_code)
      WHERE user_id = $12
      RETURNING *
    `;

        const result = await query(updateQuery, [
            dateOfBirth,
            gender,
            bloodGroup,
            emergencyContactName,
            emergencyContactPhone,
            emergencyContactRelation,
            address,
            city,
            state,
            country,
            postalCode,
            userId,
        ]);

        return result.rows[0];
    } catch (error) {
        logger.error('Failed to update patient profile:', error);
        throw error;
    }
};

/**
 * Get all patients (admin only)
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Patients list
 */
const getAllPatients = async (options = {}) => {
    try {
        const { limit = 50, offset = 0 } = options;

        const selectQuery = `
      SELECT 
        p.id,
        p.unique_health_id,
        p.date_of_birth,
        p.gender,
        p.blood_group,
        p.created_at,
        u.email,
        u.phone,
        u.status
      FROM patient_profiles p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2
    `;

        const result = await query(selectQuery, [limit, offset]);
        return result.rows;
    } catch (error) {
        logger.error('Failed to get all patients:', error);
        throw error;
    }
};

module.exports = {
    createPatientProfile,
    findPatientByUserId,
    findPatientByHealthId,
    updatePatientProfile,
    getAllPatients,
};
