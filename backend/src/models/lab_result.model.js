const pool = require('../config/db');
const path = require('path');

class LabResultModel {
    /**
     * Create a new lab result
     * @param {Object} labResultData - Lab result data
     * @returns {Promise<Object>} Created lab result
     */
    static async create(labResultData) {
        const {
            recordId,
            testName,
            testCode,
            testCategory,
            fileUrl,
            fileName,
            fileType,
            fileSize,
            resultsData,
            interpretation,
            referenceRange,
            abnormalFlag = false,
            orderedBy,
            performedBy,
            resultDate
        } = labResultData;

        const query = `
            INSERT INTO lab_results (
                record_id, test_name, test_code, test_category, file_url, file_name,
                file_type, file_size, results_data, interpretation, reference_range,
                abnormal_flag, ordered_by, performed_by, result_date, immutable
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, true)
            RETURNING *
        `;

        const values = [
            recordId, testName, testCode, testCategory, fileUrl, fileName,
            fileType, fileSize, resultsData, interpretation, referenceRange,
            abnormalFlag, orderedBy, performedBy, resultDate
        ];

        const result = await pool.query(query, values);
        return result.rows[0];
    }

    /**
     * Get lab result by ID
     * @param {string} labResultId - Lab result ID
     * @returns {Promise<Object>} Lab result
     */
    static async findById(labResultId) {
        const query = `
            SELECT 
                lr.*,
                u1.first_name || ' ' || u1.last_name as ordered_by_name,
                r1.name as ordered_by_role,
                u2.first_name || ' ' || u2.last_name as performed_by_name
            FROM lab_results lr
            JOIN users u1 ON lr.ordered_by = u1.id
            JOIN roles r1 ON u1.role_id = r1.id
            LEFT JOIN users u2 ON lr.performed_by = u2.id
            WHERE lr.id = $1
        `;

        const result = await pool.query(query, [labResultId]);
        return result.rows[0];
    }

    /**
     * Get all lab results for a medical record
     * @param {string} recordId - Medical record ID
     * @returns {Promise<Array>} Lab results
     */
    static async findByRecordId(recordId) {
        const query = `
            SELECT 
                lr.*,
                u1.first_name || ' ' || u1.last_name as ordered_by_name,
                u2.first_name || ' ' || u2.last_name as performed_by_name
            FROM lab_results lr
            JOIN users u1 ON lr.ordered_by = u1.id
            LEFT JOIN users u2 ON lr.performed_by = u2.id
            WHERE lr.record_id = $1
            ORDER BY lr.uploaded_at DESC
        `;

        const result = await pool.query(query, [recordId]);
        return result.rows;
    }

    /**
     * Get all lab results for a patient
     * @param {string} patientId - Patient user ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Lab results
     */
    static async findByPatientId(patientId, options = {}) {
        const { testCategory, abnormalOnly = false, limit = 50, offset = 0 } = options;

        let query = `
            SELECT 
                lr.*,
                u.first_name || ' ' || u.last_name as ordered_by_name,
                mr.type as record_type
            FROM lab_results lr
            JOIN medical_records mr ON lr.record_id = mr.id
            JOIN users u ON lr.ordered_by = u.id
            WHERE mr.patient_id = $1
        `;

        const values = [patientId];

        if (testCategory) {
            query += ` AND lr.test_category = $${values.length + 1}`;
            values.push(testCategory);
        }

        if (abnormalOnly) {
            query += ` AND lr.abnormal_flag = true`;
        }

        query += ` ORDER BY lr.uploaded_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
        values.push(limit, offset);

        const result = await pool.query(query, values);
        return result.rows;
    }

    /**
     * Search lab results by test name
     * @param {string} testName - Test name (partial match)
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Lab results
     */
    static async searchByTestName(testName, options = {}) {
        const { limit = 50, offset = 0 } = options;

        const query = `
            SELECT 
                lr.*,
                u.first_name || ' ' || u.last_name as ordered_by_name,
                mr.patient_id
            FROM lab_results lr
            JOIN users u ON lr.ordered_by = u.id
            JOIN medical_records mr ON lr.record_id = mr.id
            WHERE lr.test_name ILIKE $1
            ORDER BY lr.uploaded_at DESC
            LIMIT $2 OFFSET $3
        `;

        const result = await pool.query(query, [`%${testName}%`, limit, offset]);
        return result.rows;
    }

    /**
     * Get abnormal lab results for a patient
     * @param {string} patientId - Patient user ID
     * @returns {Promise<Array>} Abnormal lab results
     */
    static async getAbnormalResults(patientId) {
        const query = `
            SELECT 
                lr.*,
                u.first_name || ' ' || u.last_name as ordered_by_name
            FROM lab_results lr
            JOIN medical_records mr ON lr.record_id = mr.id
            JOIN users u ON lr.ordered_by = u.id
            WHERE mr.patient_id = $1 AND lr.abnormal_flag = true
            ORDER BY lr.uploaded_at DESC
        `;

        const result = await pool.query(query, [patientId]);
        return result.rows;
    }

    /**
     * Get lab results by category for a patient
     * @param {string} patientId - Patient user ID
     * @param {string} category - Test category
     * @returns {Promise<Array>} Lab results
     */
    static async getByCategory(patientId, category) {
        const query = `
            SELECT 
                lr.*,
                u.first_name || ' ' || u.last_name as ordered_by_name
            FROM lab_results lr
            JOIN medical_records mr ON lr.record_id = mr.id
            JOIN users u ON lr.ordered_by = u.id
            WHERE mr.patient_id = $1 AND lr.test_category = $2
            ORDER BY lr.uploaded_at DESC
        `;

        const result = await pool.query(query, [patientId, category]);
        return result.rows;
    }

    /**
     * Count lab results for a patient
     * @param {string} patientId - Patient user ID
     * @returns {Promise<Object>} Counts
     */
    static async countByPatient(patientId) {
        const query = `
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE abnormal_flag = true) as abnormal
            FROM lab_results lr
            JOIN medical_records mr ON lr.record_id = mr.id
            WHERE mr.patient_id = $1
        `;

        const result = await pool.query(query, [patientId]);
        return {
            total: parseInt(result.rows[0].total),
            abnormal: parseInt(result.rows[0].abnormal)
        };
    }

    /**
     * Validate file type for lab results
     * @param {string} fileType - File type/extension
     * @returns {boolean} True if valid
     */
    static validateFileType(fileType) {
        const allowedTypes = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'xml', 'hl7'];
        return allowedTypes.includes(fileType.toLowerCase());
    }
}

module.exports = LabResultModel;
