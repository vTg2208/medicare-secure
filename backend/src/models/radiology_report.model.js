const pool = require('../config/db');
const logger = require('../utils/logger');

class RadiologyReportModel {
    /**
     * Create a radiology report
     * @param {Object} reportData - Report data
     * @returns {Promise<Object>} Created report
     */
    static async createReport(reportData) {
        try {
            const {
                orderId,
                patientId,
                radiologistId,
                reportTitle,
                findings,
                impression,
                recommendations,
                filePath,
                fileName,
                fileSize,
                status = 'finalized'
            } = reportData;

            const query = `
                INSERT INTO radiology_reports (
                    imaging_order_id, patient_id, radiologist_id,
                    report_title, findings, impression, recommendations,
                    file_path, file_name, file_size, status, finalized_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
                RETURNING *
            `;

            const result = await pool.transaction(async client => {
                const locked = await client.query('SELECT status,visit_id,ordered_by,imaging_type,body_part FROM imaging_orders WHERE id=$1 FOR UPDATE', [orderId]);
                if (!locked.rows.length || ['completed', 'cancelled'].includes(locked.rows[0].status)) throw Object.assign(new Error('Imaging order is not open'), { statusCode: 409 });
                const inserted = await client.query(query, [
                orderId, patientId, radiologistId,
                reportTitle, findings, impression, recommendations,
                filePath, fileName, fileSize, status
            ]);

                const order = locked.rows[0];
                const record = (await client.query(`INSERT INTO medical_records(patient_id,visit_id,type,title,description,created_by,immutable_flag)
                    VALUES($1,$2,'imaging',$3,$4,$5,true) RETURNING id`,[patientId,order.visit_id,reportTitle||'Imaging report',findings||impression,radiologistId])).rows[0];
                const imagingTypeMap = { 'x-ray':'x-ray', 'xray':'x-ray','ct':'ct_scan','ct scan':'ct_scan','ct_scan':'ct_scan','mri':'mri','ultrasound':'ultrasound','pet':'pet_scan','pet_scan':'pet_scan','mammogram':'mammogram','dicom':'dicom' };
                const imaging = (await client.query(`INSERT INTO imaging_reports(record_id,imaging_type,body_part,file_url,file_name,file_size,findings,impression,radiologist_notes,ordered_by,performed_by,reported_by)
                    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11) RETURNING id`,[record.id,imagingTypeMap[String(order.imaging_type).toLowerCase()]||'other',order.body_part,filePath||'',fileName,fileSize,findings,impression,recommendations,order.ordered_by,radiologistId])).rows[0];
                await client.query('UPDATE imaging_orders SET imaging_report_id=$1 WHERE id=$2',[imaging.id,orderId]);
                // Store the finalized report and order completion together.
                await client.query(
                'UPDATE imaging_orders SET status = $1, completed_at = NOW() WHERE id = $2',
                ['completed', orderId]
            );
                return inserted;
            });

            logger.info('Radiology report created and order completed', {
                reportId: result.rows[0].id,
                orderId
            });

            return result.rows[0];
        } catch (error) {
            logger.error('Failed to create radiology report:', error);
            throw error;
        }
    }

    /**
     * Get report by order ID
     * @param {String} orderId - Imaging order ID
     * @returns {Promise<Object>} Radiology report
     */
    static async getByOrderId(orderId) {
        try {
            const query = `
                SELECT rr.*, u.first_name || ' ' || u.last_name as radiologist_name
                FROM radiology_reports rr
                LEFT JOIN users u ON rr.radiologist_id = u.id
                WHERE rr.imaging_order_id = $1
            `;
            const result = await pool.query(query, [orderId]);
            return result.rows[0];
        } catch (error) {
            logger.error('Failed to get radiology report by order ID:', error);
            throw error;
        }
    }
}

module.exports = RadiologyReportModel;
