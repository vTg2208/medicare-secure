const { query } = require('../config/db');
const logger = require('../utils/logger');

/**
 * Create doctor profile
 * @param {Object} profileData - Doctor profile data
 * @param {Object} client - Optional DB client for transaction
 * @returns {Promise<Object>} Created doctor profile
 */
const createDoctorProfile = async (profileData, client = null) => {
    try {
        const {
            userId,
            specialization,
            licenseNumber,
            experienceYears,
            bio,
            consultationFee,
            availability,
            regYear,
            stateMedicalCouncil,
            degreeCertificateUrl,
            medicalRegCertificateUrl
        } = profileData;

        // Use provided client or default query
        const dbQuery = client ? client.query.bind(client) : query;

        const insertQuery = `
      INSERT INTO doctor_profiles (
        user_id, specialization, license_number, experience_years, bio, consultation_fee, availability,
        reg_year, state_medical_council, degree_certificate_url, medical_reg_certificate_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

        const result = await dbQuery(insertQuery, [
            userId,
            specialization,
            licenseNumber,
            experienceYears || 0,
            bio || null,
            consultationFee || 0.00,
            availability || JSON.stringify({}),
            regYear || null,
            stateMedicalCouncil || null,
            degreeCertificateUrl || null,
            medicalRegCertificateUrl || null
        ]);

        return result.rows[0];
    } catch (error) {
        logger.error('Failed to create doctor profile:', error);
        throw error;
    }
};

/**
 * Find doctor profile by user ID
 * @param {String} userId - User ID
 * @returns {Promise<Object>} Doctor profile
 */
const findDoctorByUserId = async (userId) => {
    try {
        const selectQuery = `
      SELECT 
        d.*,
        u.email,
        u.phone,
        u.status as account_status,
        u.first_name,
        u.last_name,
        u.profile_photo
      FROM doctor_profiles d
      JOIN users u ON d.user_id = u.id
      WHERE d.user_id = $1
    `;

        const result = await query(selectQuery, [userId]);
        return result.rows[0] || null;
    } catch (error) {
        logger.error('Failed to find doctor by user ID:', error);
        throw error;
    }
};

/**
 * Find doctor profile by license number (Reg ID)
 * @param {String} licenseNumber - License number
 * @returns {Promise<Object>} Doctor profile
 */
const findDoctorByLicense = async (licenseNumber) => {
    try {
        const selectQuery = `
      SELECT * FROM doctor_profiles WHERE license_number = $1
    `;

        const result = await query(selectQuery, [licenseNumber]);
        return result.rows[0] || null;
    } catch (error) {
        logger.error('Failed to find doctor by license:', error);
        throw error;
    }
};

/**
 * Get all doctors
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Doctors list
 */
const getAllDoctors = async (options = {}) => {
    try {
        const { limit = 50, offset = 0 } = options;

        const selectQuery = `
      SELECT 
        d.*,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.status
      FROM doctor_profiles d
      JOIN users u ON d.user_id = u.id
      ORDER BY d.created_at DESC
      LIMIT $1 OFFSET $2
    `;

        const result = await query(selectQuery, [limit, offset]);
        return result.rows;
    } catch (error) {
        logger.error('Failed to get all doctors:', error);
        throw error;
    }
};

module.exports = {
    createDoctorProfile,
    findDoctorByUserId,
    findDoctorByLicense,
    getAllDoctors
};
