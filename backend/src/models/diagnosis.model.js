const pool = require('../config/db');

class DiagnosisModel {
    /**
     * Create a new diagnosis (immutable)
     * @param {Object} diagnosisData - Diagnosis data
     * @returns {Promise<Object>} Created diagnosis
     */
    static async create(diagnosisData) {
        const {
            recordId,
            icdCode,
            description,
            severity,
            status = 'active',
            isPrimary = false,
            notes,
            diagnosedBy
        } = diagnosisData;

        const query = `
            INSERT INTO diagnoses (
                record_id, icd_code, description, severity, status,
                is_primary, notes, diagnosed_by, version
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)
            RETURNING *
        `;

        const values = [recordId, icdCode, description, severity, status, isPrimary, notes, diagnosedBy];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    /**
     * Create an addendum/correction (new version of diagnosis)
     * @param {string} originalDiagnosisId - Original diagnosis ID
     * @param {Object} addendumData - Addendum data
     * @returns {Promise<Object>} New diagnosis version
     */
    static async createAddendum(originalDiagnosisId, addendumData) {
        const client = await pool.pool.connect();

        try {
            await client.query('BEGIN');

            // Get original diagnosis
            await client.query('SELECT id FROM medical_records WHERE id=(SELECT record_id FROM diagnoses WHERE id=$1) FOR UPDATE',[originalDiagnosisId]);
            const originalQuery = 'SELECT * FROM diagnoses WHERE id = $1';
            const originalResult = await client.query(originalQuery, [originalDiagnosisId]);

            if (originalResult.rows.length === 0) {
                throw new Error('Original diagnosis not found');
            }

            const original = originalResult.rows[0];

            // Get max version for this record
            const versionQuery = `
                SELECT MAX(version) as max_version 
                FROM diagnoses 
                WHERE record_id = $1
            `;
            const versionResult = await client.query(versionQuery, [original.record_id]);
            const nextVersion = (versionResult.rows[0].max_version || 0) + 1;

            // Create new version
            const insertQuery = `
                INSERT INTO diagnoses (
                    record_id, icd_code, description, severity, status,
                    is_primary, notes, diagnosed_by, version
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `;

            const values = [
                original.record_id,
                addendumData.icdCode || original.icd_code,
                addendumData.description || original.description,
                addendumData.severity || original.severity,
                addendumData.status || original.status,
                addendumData.isPrimary !== undefined ? addendumData.isPrimary : original.is_primary,
                addendumData.notes || original.notes,
                addendumData.diagnosedBy,
                nextVersion
            ];

            const result = await client.query(insertQuery, values);

            await client.query('COMMIT');
            return result.rows[0];

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get diagnosis by ID
     * @param {string} diagnosisId - Diagnosis ID
     * @returns {Promise<Object>} Diagnosis
     */
    static async findById(diagnosisId) {
        const query = `
            SELECT 
                d.*,
                u.first_name || ' ' || u.last_name as diagnosed_by_name,
                r.name as diagnosed_by_role
            FROM diagnoses d
            JOIN users u ON d.diagnosed_by = u.id
            JOIN roles r ON u.role_id = r.id
            WHERE d.id = $1
        `;

        const result = await pool.query(query, [diagnosisId]);
        return result.rows[0];
    }

    /**
     * Get all diagnoses for a medical record
     * @param {string} recordId - Medical record ID
     * @returns {Promise<Array>} Diagnoses
     */
    static async findByRecordId(recordId) {
        const query = `
            SELECT 
                d.*,
                u.first_name || ' ' || u.last_name as diagnosed_by_name,
                r.name as diagnosed_by_role
            FROM diagnoses d
            JOIN users u ON d.diagnosed_by = u.id
            JOIN roles r ON u.role_id = r.id
            WHERE d.record_id = $1
            ORDER BY d.is_primary DESC, d.version DESC, d.created_at DESC
        `;

        const result = await pool.query(query, [recordId]);
        return result.rows;
    }

    /**
     * Get all versions of a diagnosis
     * @param {string} recordId - Medical record ID
     * @param {string} icdCode - ICD code to track versions
     * @returns {Promise<Array>} Diagnosis versions
     */
    static async getVersionHistory(recordId, icdCode) {
        const query = `
            SELECT 
                d.*,
                u.first_name || ' ' || u.last_name as diagnosed_by_name,
                r.name as diagnosed_by_role
            FROM diagnoses d
            JOIN users u ON d.diagnosed_by = u.id
            JOIN roles r ON u.role_id = r.id
            WHERE d.record_id = $1 AND d.icd_code = $2
            ORDER BY d.version DESC
        `;

        const result = await pool.query(query, [recordId, icdCode]);
        return result.rows;
    }

    /**
     * Get all diagnoses for a patient
     * @param {string} patientId - Patient user ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Diagnoses
     */
    static async findByPatientId(patientId, options = {}) {
        const { status, limit = 50, offset = 0 } = options;

        let query = `
            SELECT 
                d.*,
                u.first_name || ' ' || u.last_name as diagnosed_by_name,
                r.name as diagnosed_by_role,
                mr.type as record_type,
                mr.created_at as record_date
            FROM diagnoses d
            JOIN medical_records mr ON d.record_id = mr.id
            JOIN users u ON d.diagnosed_by = u.id
            JOIN roles r ON u.role_id = r.id
            WHERE mr.patient_id = $1
        `;

        const values = [patientId];

        if (status) {
            query += ` AND d.status = $${values.length + 1}`;
            values.push(status);
        }

        query += ` ORDER BY d.created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
        values.push(limit, offset);

        const result = await pool.query(query, values);
        return result.rows;
    }

    /**
     * Update diagnosis status (one of the few allowed updates)
     * @param {string} diagnosisId - Diagnosis ID
     * @param {string} status - New status
     * @returns {Promise<Object>} Updated diagnosis
     */
    static async updateStatus(diagnosisId, status) {
        const validStatuses = ['active', 'resolved', 'chronic', 'ruled_out'];

        if (!validStatuses.includes(status)) {
            throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
        }

        const query = `
            UPDATE diagnoses
            SET status = $1
            WHERE id = $2
            RETURNING *
        `;

        const result = await pool.query(query, [status, diagnosisId]);

        if (result.rows.length === 0) {
            throw new Error('Diagnosis not found');
        }

        return result.rows[0];
    }

    /**
     * Validate ICD code format
     * @param {string} icdCode - ICD code to validate
     * @returns {boolean} True if valid
     */
    static validateIcdCode(icdCode) {
        // Basic ICD-10 format validation (can be enhanced)
        // ICD-10 codes are alphanumeric, 3-7 characters
        const icd10Pattern = /^[A-Z][0-9]{2}(\.[0-9A-Z]{1,4})?$/;
        return icd10Pattern.test(icdCode);
    }

    /**
     * Search diagnoses by ICD code
     * @param {string} icdCode - ICD code
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Diagnoses
     */
    static async searchByIcdCode(icdCode, options = {}) {
        const { limit = 50, offset = 0 } = options;

        const query = `
            SELECT 
                d.*,
                u.first_name || ' ' || u.last_name as diagnosed_by_name,
                mr.patient_id
            FROM diagnoses d
            JOIN users u ON d.diagnosed_by = u.id
            JOIN medical_records mr ON d.record_id = mr.id
            WHERE d.icd_code LIKE $1
            ORDER BY d.created_at DESC
            LIMIT $2 OFFSET $3
        `;

        const result = await pool.query(query, [`${icdCode}%`, limit, offset]);
        return result.rows;
    }

    /**
     * Get latest version of diagnosis for a record
     * @param {string} recordId - Medical record ID
     * @returns {Promise<Array>} Latest diagnoses (one per ICD code)
     */
    static async getLatestVersions(recordId) {
        const query = `
            SELECT DISTINCT ON (icd_code) 
                d.*,
                u.first_name || ' ' || u.last_name as diagnosed_by_name
            FROM diagnoses d
            JOIN users u ON d.diagnosed_by = u.id
            WHERE d.record_id = $1
            ORDER BY d.icd_code, d.version DESC
        `;

        const result = await pool.query(query, [recordId]);
        return result.rows;
    }
}

module.exports = DiagnosisModel;
