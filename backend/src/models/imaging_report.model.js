const pool = require('../config/db');

class ImagingReportModel {
    /**
     * Create a new imaging report
     * @param {Object} imagingData - Imaging report data
     * @returns {Promise<Object>} Created imaging report
     */
    static async create(imagingData, client = pool) {
        const {
            recordId,
            imagingType,
            bodyPart,
            fileUrl,
            fileName,
            fileType,
            fileSize,
            isDicom = false,
            dicomMetadata,
            findings,
            impression,
            radiologistNotes,
            orderedBy,
            performedBy,
            reportedBy,
            studyDate
        } = imagingData;

        const query = `
            INSERT INTO imaging_reports (
                record_id, imaging_type, body_part, file_url, file_name, file_type,
                file_size, is_dicom, dicom_metadata, findings, impression,
                radiologist_notes, ordered_by, performed_by, reported_by, study_date
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING *
        `;

        const values = [
            recordId, imagingType, bodyPart, fileUrl, fileName, fileType, fileSize,
            isDicom, dicomMetadata, findings, impression, radiologistNotes,
            orderedBy, performedBy, reportedBy, studyDate
        ];

        const result = await client.query(query, values);
        return result.rows[0];
    }

    /**
     * Get imaging report by ID
     * @param {string} imagingId - Imaging report ID
     * @returns {Promise<Object>} Imaging report
     */
    static async findById(imagingId) {
        const query = `
            SELECT 
                ir.*,
                u1.first_name || ' ' || u1.last_name as ordered_by_name,
                r1.name as ordered_by_role,
                u2.first_name || ' ' || u2.last_name as performed_by_name,
                u3.first_name || ' ' || u3.last_name as reported_by_name
            FROM imaging_reports ir
            JOIN users u1 ON ir.ordered_by = u1.id
            JOIN roles r1 ON u1.role_id = r1.id
            LEFT JOIN users u2 ON ir.performed_by = u2.id
            LEFT JOIN users u3 ON ir.reported_by = u3.id
            WHERE ir.id = $1
        `;

        const result = await pool.query(query, [imagingId]);
        return result.rows[0];
    }

    /**
     * Get all imaging reports for a medical record
     * @param {string} recordId - Medical record ID
     * @returns {Promise<Array>} Imaging reports
     */
    static async findByRecordId(recordId) {
        const query = `
            SELECT 
                ir.*,
                u1.first_name || ' ' || u1.last_name as ordered_by_name,
                u2.first_name || ' ' || u2.last_name as reported_by_name
            FROM imaging_reports ir
            JOIN users u1 ON ir.ordered_by = u1.id
            LEFT JOIN users u2 ON ir.reported_by = u2.id
            WHERE ir.record_id = $1
            ORDER BY ir.uploaded_at DESC
        `;

        const result = await pool.query(query, [recordId]);
        return result.rows;
    }

    /**
     * Get all imaging reports for a patient
     * @param {string} patientId - Patient user ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Imaging reports
     */
    static async findByPatientId(patientId, options = {}) {
        const { imagingType, bodyPart, dicomOnly = false, limit = 50, offset = 0 } = options;

        let query = `
            SELECT 
                ir.*,
                u.first_name || ' ' || u.last_name as ordered_by_name,
                mr.type as record_type
            FROM imaging_reports ir
            JOIN medical_records mr ON ir.record_id = mr.id
            JOIN users u ON ir.ordered_by = u.id
            WHERE mr.patient_id = $1
        `;

        const values = [patientId];

        if (imagingType) {
            query += ` AND ir.imaging_type = $${values.length + 1}`;
            values.push(imagingType);
        }

        if (bodyPart) {
            query += ` AND ir.body_part = $${values.length + 1}`;
            values.push(bodyPart);
        }

        if (dicomOnly) {
            query += ` AND ir.is_dicom = true`;
        }

        query += ` ORDER BY ir.uploaded_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
        values.push(limit, offset);

        const result = await pool.query(query, values);
        return result.rows;
    }

    /**
     * Get DICOM imaging reports for a patient
     * @param {string} patientId - Patient user ID
     * @returns {Promise<Array>} DICOM imaging reports
     */
    static async getDicomReports(patientId) {
        const query = `
            SELECT 
                ir.*,
                u.first_name || ' ' || u.last_name as ordered_by_name
            FROM imaging_reports ir
            JOIN medical_records mr ON ir.record_id = mr.id
            JOIN users u ON ir.ordered_by = u.id
            WHERE mr.patient_id = $1 AND ir.is_dicom = true
            ORDER BY ir.uploaded_at DESC
        `;

        const result = await pool.query(query, [patientId]);
        return result.rows;
    }

    /**
     * Get imaging reports by type for a patient
     * @param {string} patientId - Patient user ID
     * @param {string} imagingType - Imaging type
     * @returns {Promise<Array>} Imaging reports
     */
    static async getByType(patientId, imagingType) {
        const query = `
            SELECT 
                ir.*,
                u.first_name || ' ' || u.last_name as ordered_by_name
            FROM imaging_reports ir
            JOIN medical_records mr ON ir.record_id = mr.id
            JOIN users u ON ir.ordered_by = u.id
            WHERE mr.patient_id = $1 AND ir.imaging_type = $2
            ORDER BY ir.uploaded_at DESC
        `;

        const result = await pool.query(query, [patientId, imagingType]);
        return result.rows;
    }

    /**
     * Get imaging reports by body part for a patient
     * @param {string} patientId - Patient user ID
     * @param {string} bodyPart - Body part
     * @returns {Promise<Array>} Imaging reports
     */
    static async getByBodyPart(patientId, bodyPart) {
        const query = `
            SELECT 
                ir.*,
                u.first_name || ' ' || u.last_name as ordered_by_name
            FROM imaging_reports ir
            JOIN medical_records mr ON ir.record_id = mr.id
            JOIN users u ON ir.ordered_by = u.id
            WHERE mr.patient_id = $1 AND ir.body_part = $2
            ORDER BY ir.uploaded_at DESC
        `;

        const result = await pool.query(query, [patientId, bodyPart]);
        return result.rows;
    }

    /**
     * Update imaging report findings and impression
     * @param {string} imagingId - Imaging report ID
     * @param {Object} updateData - Update data
     * @returns {Promise<Object>} Updated imaging report
     */
    static async updateReport(imagingId, updateData) {
        const { findings, impression, radiologistNotes, reportedBy } = updateData;

        const query = `
            UPDATE imaging_reports
            SET findings = COALESCE($1, findings),
                impression = COALESCE($2, impression),
                radiologist_notes = COALESCE($3, radiologist_notes),
                reported_by = COALESCE($4, reported_by)
            WHERE id = $5
            RETURNING *
        `;

        const result = await pool.query(query, [findings, impression, radiologistNotes, reportedBy, imagingId]);

        if (result.rows.length === 0) {
            throw new Error('Imaging report not found');
        }

        return result.rows[0];
    }

    /**
     * Count imaging reports for a patient
     * @param {string} patientId - Patient user ID
     * @returns {Promise<Object>} Counts by type
     */
    static async countByPatient(patientId) {
        const query = `
            SELECT 
                ir.imaging_type,
                COUNT(*) as count
            FROM imaging_reports ir
            JOIN medical_records mr ON ir.record_id = mr.id
            WHERE mr.patient_id = $1
            GROUP BY ir.imaging_type
        `;

        const result = await pool.query(query, [patientId]);

        const counts = {};
        result.rows.forEach(row => {
            counts[row.imaging_type] = parseInt(row.count);
        });

        return counts;
    }

    /**
     * Validate imaging type
     * @param {string} imagingType - Imaging type
     * @returns {boolean} True if valid
     */
    static validateImagingType(imagingType) {
        const validTypes = ['x-ray', 'ct_scan', 'mri', 'ultrasound', 'pet_scan', 'mammogram', 'dicom', 'other'];
        return validTypes.includes(imagingType);
    }

    /**
     * Validate file type for imaging
     * @param {string} fileType - File type/extension
     * @param {boolean} isDicom - Whether file is DICOM
     * @returns {boolean} True if valid
     */
    static validateFileType(fileType, isDicom = false) {
        if (isDicom) {
            return ['dcm', 'dicom', 'dic'].includes(fileType.toLowerCase());
        }
        const allowedTypes = ['jpg', 'jpeg', 'png', 'pdf', 'dcm', 'dicom', 'tiff', 'bmp'];
        return allowedTypes.includes(fileType.toLowerCase());
    }
}

module.exports = ImagingReportModel;
