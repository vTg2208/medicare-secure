const pool = require('../config/db');

class PrescriptionModel {
    /**
     * Create a new prescription
     * @param {Object} prescriptionData - Prescription data
     * @returns {Promise<Object>} Created prescription
     */
    static async create(prescriptionData) {
        const {
            recordId,
            medication,
            genericName,
            drugCode,
            dosage,
            frequency,
            route,
            duration,
            quantity,
            refills = 0,
            instructions,
            prescribedBy
        } = prescriptionData;

        const query = `
            INSERT INTO prescriptions (
                record_id, medication, generic_name, drug_code, dosage, frequency,
                route, duration, quantity, refills, instructions, prescribed_by,
                status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending')
            RETURNING *
        `;

        const values = [
            recordId, medication, genericName, drugCode, dosage, frequency,
            route, duration, quantity, refills, instructions, prescribedBy
        ];

        return pool.transaction(async client => {
            const result = await client.query(query, values);
            const prescription = result.rows[0];
            await client.query(`INSERT INTO medication_orders(visit_id,prescription_id,medication,dosage,route,frequency,ordered_by,notes)
                SELECT visit_id,$1,$2,$3,$4,$5,$6,$7 FROM medical_records WHERE id=$8 AND visit_id IS NOT NULL`,
                [prescription.id,medication,dosage,route,frequency,prescribedBy,instructions,recordId]);
            return prescription;
        });
    }

    /**
     * Get prescription by ID
     * @param {string} prescriptionId - Prescription ID
     * @returns {Promise<Object>} Prescription
     */
    static async findById(prescriptionId) {
        const query = `
            SELECT 
                p.*,
                u1.first_name || ' ' || u1.last_name as prescribed_by_name,
                r1.name as prescribed_by_role,
                u2.first_name || ' ' || u2.last_name as dispensed_by_name
            FROM prescriptions p
            JOIN users u1 ON p.prescribed_by = u1.id
            JOIN roles r1 ON u1.role_id = r1.id
            LEFT JOIN users u2 ON p.dispensed_by = u2.id
            WHERE p.id = $1
        `;

        const result = await pool.query(query, [prescriptionId]);
        return result.rows[0];
    }

    /**
     * Get all prescriptions for a medical record
     * @param {string} recordId - Medical record ID
     * @returns {Promise<Array>} Prescriptions
     */
    static async findByRecordId(recordId) {
        const query = `
            SELECT 
                p.*,
                u.first_name || ' ' || u.last_name as prescribed_by_name,
                r.name as prescribed_by_role
            FROM prescriptions p
            JOIN users u ON p.prescribed_by = u.id
            JOIN roles r ON u.role_id = r.id
            WHERE p.record_id = $1
            ORDER BY p.prescribed_at DESC
        `;

        const result = await pool.query(query, [recordId]);
        return result.rows;
    }

    /**
     * Get all prescriptions for a visit
     * @param {string} visitId - Visit ID
     * @returns {Promise<Array>} Prescriptions
     */
    static async findByVisitId(visitId) {
        const query = `
            SELECT 
                p.*,
                u.first_name || ' ' || u.last_name as prescribed_by_name,
                r.name as prescribed_by_role
            FROM prescriptions p
            JOIN medical_records mr ON p.record_id = mr.id
            JOIN users u ON p.prescribed_by = u.id
            JOIN roles r ON u.role_id = r.id
            WHERE mr.visit_id = $1
            ORDER BY p.prescribed_at DESC
        `;

        const result = await pool.query(query, [visitId]);
        return result.rows;
    }

    /**
     * Get all prescriptions for a patient
     * @param {string} patientId - Patient user ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Prescriptions
     */
    static async findByPatientId(patientId, options = {}) {
        const { status, limit = 50, offset = 0 } = options;

        let query = `
            SELECT 
                p.*,
                u.first_name || ' ' || u.last_name as prescribed_by_name,
                r.name as prescribed_by_role,
                mr.type as record_type
            FROM prescriptions p
            JOIN medical_records mr ON p.record_id = mr.id
            JOIN users u ON p.prescribed_by = u.id
            JOIN roles r ON u.role_id = r.id
            WHERE mr.patient_id = $1
        `;

        const values = [patientId];

        if (status) {
            query += ` AND p.status = $${values.length + 1}`;
            values.push(status);
        }

        query += ` ORDER BY p.prescribed_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
        values.push(limit, offset);

        const result = await pool.query(query, values);
        return result.rows;
    }

    /**
     * Get active prescriptions for a patient (for drug interaction checking)
     * @param {string} patientId - Patient user ID
     * @returns {Promise<Array>} Active prescriptions
     */
    static async getActiveByPatientId(patientId) {
        const query = `
            SELECT 
                p.*,
                mr.patient_id
            FROM prescriptions p
            JOIN medical_records mr ON p.record_id = mr.id
            WHERE mr.patient_id = $1 
            AND p.status IN ('pending', 'active')
            ORDER BY p.prescribed_at DESC
        `;

        const result = await pool.query(query, [patientId]);
        return result.rows;
    }

    /**
     * Update prescription status
     * @param {string} prescriptionId - Prescription ID
     * @param {string} status - New status
     * @param {string} userId - User making the update (optional)
     * @returns {Promise<Object>} Updated prescription
     */
    static allowedStatuses(status) {
        return {
            pending: ['active', 'completed', 'cancelled', 'expired'],
            active: ['completed', 'cancelled', 'expired'],
        }[status] || [];
    }

    static async updateStatus(prescriptionId, status, userId = null) {
        const validStatuses = ['pending', 'active', 'completed', 'cancelled', 'expired'];

        if (!validStatuses.includes(status)) {
            throw Object.assign(new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`), { statusCode: 400 });
        }

        let query = `
            UPDATE prescriptions
            SET status = $1,
                updated_at = CURRENT_TIMESTAMP
        `;

        const values = [status];

        // If status is completed, set dispensed info
        if (status === 'completed' && userId) {
            query += `, dispensed_at = CURRENT_TIMESTAMP, dispensed_by = $${values.length + 1}`;
            values.push(userId);
        }

        query += ` WHERE id = $${values.length + 1} RETURNING *`;
        values.push(prescriptionId);

        return pool.transaction(async client => {
        const current = (await client.query('SELECT id, status FROM prescriptions WHERE id = $1 FOR UPDATE', [prescriptionId])).rows[0];
        if (!current) throw Object.assign(new Error('Prescription not found'), { statusCode: 404 });
        if (!this.allowedStatuses(current.status).includes(status)) {
            throw Object.assign(new Error(`Cannot transition from ${current.status} to ${status}`), { statusCode: 409 });
        }
        const result = await client.query(query, values);

        if (result.rows.length === 0) {
            throw new Error('Prescription not found');
        }

        if (status === 'completed') await client.query("UPDATE medication_orders SET status='dispensed',dispensed_by=$1,dispensed_at=NOW(),updated_at=NOW() WHERE prescription_id=$2 AND status='ordered'",[userId,prescriptionId]);
        if (['cancelled','expired'].includes(status)) await client.query("UPDATE medication_orders SET status='discontinued',discontinued_by=$1,discontinued_at=NOW(),updated_at=NOW() WHERE prescription_id=$2 AND status IN ('ordered','dispensed')",[userId,prescriptionId]);
        return result.rows[0];
        });
    }

    /**
     * Search prescriptions by medication name
     * @param {string} medicationName - Medication name (partial match)
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Prescriptions
     */
    static async searchByMedication(medicationName, options = {}) {
        const { limit = 50, offset = 0 } = options;

        const query = `
            SELECT 
                p.*,
                u.first_name || ' ' || u.last_name as prescribed_by_name,
                mr.patient_id
            FROM prescriptions p
            JOIN users u ON p.prescribed_by = u.id
            JOIN medical_records mr ON p.record_id = mr.id
            WHERE p.medication ILIKE $1 OR p.generic_name ILIKE $1
            ORDER BY p.prescribed_at DESC
            LIMIT $2 OFFSET $3
        `;

        const result = await pool.query(query, [`%${medicationName}%`, limit, offset]);
        return result.rows;
    }

    /**
     * Get prescriptions by prescriber
     * @param {string} prescriberId - Prescriber user ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Prescriptions
     */
    static async findByPrescriber(prescriberId, options = {}) {
        const { status, limit = 50, offset = 0 } = options;

        let query = `
            SELECT 
                p.*,
                mr.patient_id,
                u.first_name || ' ' || u.last_name as patient_name
            FROM prescriptions p
            JOIN medical_records mr ON p.record_id = mr.id
            JOIN users u ON mr.patient_id = u.id
            WHERE p.prescribed_by = $1
        `;

        const values = [prescriberId];

        if (status) {
            query += ` AND p.status = $${values.length + 1}`;
            values.push(status);
        }

        query += ` ORDER BY p.prescribed_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
        values.push(limit, offset);

        const result = await pool.query(query, values);
        return result.rows;
    }

    /**
     * Count prescriptions by status for a patient
     * @param {string} patientId - Patient user ID
     * @returns {Promise<Object>} Count by status
     */
    static async countByStatus(patientId) {
        const query = `
            SELECT 
                p.status,
                COUNT(*) as count
            FROM prescriptions p
            JOIN medical_records mr ON p.record_id = mr.id
            WHERE mr.patient_id = $1
            GROUP BY p.status
        `;

        const result = await pool.query(query, [patientId]);

        const counts = {
            pending: 0,
            active: 0,
            completed: 0,
            cancelled: 0,
            expired: 0
        };

        result.rows.forEach(row => {
            counts[row.status] = parseInt(row.count);
        });

        return counts;
    }

    /**
     * Validate dosage format
     * @param {string} dosage - Dosage string
     * @returns {boolean} True if valid format
     */
    static validateDosage(dosage) {
        // Basic dosage validation (e.g., "500mg", "10ml", "2 tablets")
        const dosagePattern = /^\d+(\.\d+)?\s*(mg|g|ml|mcg|units?|tablets?|capsules?|drops?|puffs?)$/i;
        return dosagePattern.test(dosage.trim());
    }
}

module.exports = PrescriptionModel;
