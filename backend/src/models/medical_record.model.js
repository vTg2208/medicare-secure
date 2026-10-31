const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');

class MedicalRecordModel {
    /**
     * Create a new medical record
     * @param {Object} recordData - Medical record data
     * @returns {Promise<Object>} Created medical record
     */
    static async create(recordData) {
        const {
            patientId,
            visitId,
            type,
            title,
            description,
            createdBy,
            immutableFlag = false
        } = recordData;

        const query = `
            INSERT INTO medical_records (
                patient_id, visit_id, type, title, description, 
                created_by, immutable_flag
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `;

        const values = [patientId, visitId, type, title, description, createdBy, immutableFlag];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    /**
     * Get medical record by ID with related data
     * @param {string} recordId - Medical record ID
     * @returns {Promise<Object>} Medical record with related data
     */
    static async findById(recordId) {
        const query = `
            SELECT 
                mr.*,
                u.first_name || ' ' || u.last_name as created_by_name,
                r.name as created_by_role,
                p.unique_health_id,
                v.visit_code,
                v.status as visit_status
            FROM medical_records mr
            JOIN users u ON mr.created_by = u.id
            JOIN roles r ON u.role_id = r.id
            JOIN users patient_user ON mr.patient_id = patient_user.id
            JOIN patient_profiles p ON patient_user.id = p.user_id
            LEFT JOIN visits v ON mr.visit_id = v.id
            WHERE mr.id = $1
        `;

        const result = await pool.query(query, [recordId]);
        return result.rows[0];
    }

    /**
     * Get all medical records for a patient
     * @param {string} patientId - Patient user ID
     * @param {Object} options - Query options (type, limit, offset)
     * @returns {Promise<Array>} Medical records
     */
    static async findByPatientId(patientId, options = {}) {
        const { type, limit = 50, offset = 0 } = options;

        let query = `
            SELECT 
                mr.*,
                u.first_name || ' ' || u.last_name as created_by_name,
                r.name as created_by_role
            FROM medical_records mr
            JOIN users u ON mr.created_by = u.id
            JOIN roles r ON u.role_id = r.id
            WHERE mr.patient_id = $1
        `;

        const values = [patientId];

        if (type) {
            query += ` AND mr.type = $${values.length + 1}`;
            values.push(type);
        }

        query += ` ORDER BY mr.created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
        values.push(limit, offset);

        const result = await pool.query(query, values);
        return result.rows;
    }

    /**
     * Get all medical records for a visit
     * @param {string} visitId - Visit ID
     * @returns {Promise<Array>} Medical records
     */
    static async findByVisitId(visitId) {
        const query = `
            SELECT 
                mr.*,
                u.first_name || ' ' || u.last_name as created_by_name,
                r.name as created_by_role
            FROM medical_records mr
            JOIN users u ON mr.created_by = u.id
            JOIN roles r ON u.role_id = r.id
            WHERE mr.visit_id = $1
            ORDER BY mr.created_at DESC
        `;

        const result = await pool.query(query, [visitId]);
        return result.rows;
    }

    /**
     * Get medical record with all related data (diagnoses, prescriptions, lab results, imaging)
     * @param {string} recordId - Medical record ID
     * @returns {Promise<Object>} Complete medical record
     */
    static async findByIdWithRelated(recordId) {
        const record = await this.findById(recordId);
        if (!record) return null;

        // Get related diagnoses
        const diagnosesQuery = `
            SELECT d.*, u.first_name || ' ' || u.last_name as diagnosed_by_name
            FROM diagnoses d
            JOIN users u ON d.diagnosed_by = u.id
            WHERE d.record_id = $1
            ORDER BY d.is_primary DESC, d.created_at DESC
        `;
        const diagnosesResult = await pool.query(diagnosesQuery, [recordId]);

        // Get related prescriptions
        const prescriptionsQuery = `
            SELECT p.*, u.first_name || ' ' || u.last_name as prescribed_by_name
            FROM prescriptions p
            JOIN users u ON p.prescribed_by = u.id
            WHERE p.record_id = $1
            ORDER BY p.prescribed_at DESC
        `;
        const prescriptionsResult = await pool.query(prescriptionsQuery, [recordId]);

        // Get related lab results
        const labResultsQuery = `
            SELECT l.*, u.first_name || ' ' || u.last_name as ordered_by_name
            FROM lab_results l
            JOIN users u ON l.ordered_by = u.id
            WHERE l.record_id = $1
            ORDER BY l.uploaded_at DESC
        `;
        const labResultsResult = await pool.query(labResultsQuery, [recordId]);

        // Get related imaging reports
        const imagingQuery = `
            SELECT i.*, u.first_name || ' ' || u.last_name as ordered_by_name
            FROM imaging_reports i
            JOIN users u ON i.ordered_by = u.id
            WHERE i.record_id = $1
            ORDER BY i.uploaded_at DESC
        `;
        const imagingResult = await pool.query(imagingQuery, [recordId]);

        return {
            ...record,
            diagnoses: diagnosesResult.rows,
            prescriptions: prescriptionsResult.rows,
            labResults: labResultsResult.rows,
            imagingReports: imagingResult.rows
        };
    }

    /**
     * Update medical record (only if not immutable)
     * @param {string} recordId - Medical record ID
     * @param {Object} updateData - Data to update
     * @returns {Promise<Object>} Updated record
     */
    static async update(recordId, updateData) {
        // Check if record is immutable
        const checkQuery = 'SELECT immutable_flag FROM medical_records WHERE id = $1';
        const checkResult = await pool.query(checkQuery, [recordId]);

        if (!checkResult.rows[0]) {
            throw new Error('Medical record not found');
        }

        if (checkResult.rows[0].immutable_flag) {
            throw new Error('Cannot update immutable medical record');
        }

        const { title, description } = updateData;

        const query = `
            UPDATE medical_records
            SET title = COALESCE($1, title),
                description = COALESCE($2, description),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
            RETURNING *
        `;

        const result = await pool.query(query, [title, description, recordId]);
        return result.rows[0];
    }

    /**
     * Check if visit exists and is valid for record creation
     * @param {string} visitId - Visit ID
     * @returns {Promise<boolean>} True if valid
     */
    static async validateVisitLinkage(visitId) {
        if (!visitId) return true; // Visit is optional

        const query = `
            SELECT id, status 
            FROM visits 
            WHERE id = $1
        `;

        const result = await pool.query(query, [visitId]);

        if (result.rows.length === 0) {
            throw new Error('Visit not found');
        }

        const visit = result.rows[0];
        if (visit.status === 'cancelled' || visit.status === 'no_show') {
            throw new Error('Cannot create medical record for cancelled or no-show visit');
        }

        return true;
    }

    /**
     * Count medical records for a patient
     * @param {string} patientId - Patient user ID
     * @param {string} type - Optional record type filter
     * @returns {Promise<number>} Count of records
     */
    static async countByPatient(patientId, type = null) {
        let query = 'SELECT COUNT(*) FROM medical_records WHERE patient_id = $1';
        const values = [patientId];

        if (type) {
            query += ' AND type = $2';
            values.push(type);
        }

        const result = await pool.query(query, values);
        return parseInt(result.rows[0].count);
    }
}

module.exports = MedicalRecordModel;
