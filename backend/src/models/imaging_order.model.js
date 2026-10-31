/**
 * Imaging Order Model
 * Manages imaging study orders and routing
 */

const pool = require('../config/db');
const logger = require('../utils/logger');
const { clinicalScopeSql } = require('../middleware/clinical-access.middleware');

class ImagingOrderModel {
    /**
     * Create an imaging order
     * @param {Object} orderData - Order data
     * @returns {Promise<Object>} Created order
     */
    static async createOrder(orderData) {
        try {
            const {
                visitId,
                orderedBy,
                imagingType,
                bodyPart,
                priority = 'routine',
                clinicalIndication,
                contrastUsed = false,
                notes
            } = orderData;

            // Route to appropriate department based on imaging type
            const department = this.routeToDepartment(imagingType);

            const query = `
                INSERT INTO imaging_orders (
                    visit_id, ordered_by, imaging_type, body_part,
                    priority, routed_to_department, clinical_indication,
                    contrast_used, notes
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `;

            const result = await pool.query(query, [
                visitId, orderedBy, imagingType, bodyPart,
                priority, department, clinicalIndication,
                contrastUsed, notes
            ]);

            logger.info('Imaging order created', {
                orderId: result.rows[0].id,
                imagingType,
                department
            });

            return result.rows[0];
        } catch (error) {
            logger.error('Failed to create imaging order:', error);
            throw error;
        }
    }

    /**
     * Route imaging order to appropriate department
     * @param {String} imagingType - Imaging modality
     * @returns {String} Department name
     */
    static routeToDepartment(imagingType) {
        const routing = {
            'X-Ray': 'Radiology - X-Ray',
            'CT': 'Radiology - CT Scan',
            'MRI': 'Radiology - MRI',
            'Ultrasound': 'Radiology - Ultrasound',
            'PET': 'Nuclear Medicine',
            'Mammography': 'Radiology - Mammography',
            'Fluoroscopy': 'Radiology - Fluoroscopy'
        };

        return routing[imagingType] || 'Radiology Department';
    }

    /**
     * Update order status
     * @param {String} orderId - Order ID
     * @param {String} status - New status
     * @param {Object} additionalData - Additional data
     * @returns {Promise<Object>} Updated order
     */
    static async updateStatus(orderId, status, additionalData = {}) {
        try {
            let query = 'UPDATE imaging_orders SET status = $1, updated_at = NOW()';
            const params = [status];
            let paramIndex = 2;

            // Add timestamp fields based on status
            if (status === 'scheduled' && additionalData.scheduledTime) {
                query += `, scheduled_time = $${paramIndex}`;
                params.push(additionalData.scheduledTime);
                paramIndex++;
            }

            if (status === 'completed' && !additionalData.performed_at) {
                query += `, performed_at = $${paramIndex}`;
                params.push(new Date());
                paramIndex++;
            }

            // Add imaging_report_id if provided
            if (additionalData.imagingReportId) {
                query += `, imaging_report_id = $${paramIndex}`;
                params.push(additionalData.imagingReportId);
                paramIndex++;
            }

            query += ` WHERE id = $${paramIndex} RETURNING *`;
            params.push(orderId);

            const result = await pool.query(query, params);

            if (result.rows.length === 0) {
                throw new Error('Imaging order not found');
            }

            logger.info('Imaging order status updated', {
                orderId,
                status
            });

            return result.rows[0];
        } catch (error) {
            logger.error('Failed to update imaging order status:', error);
            throw error;
        }
    }

    /**
     * Get imaging orders for a visit
     * @param {String} visitId - Visit ID
     * @returns {Promise<Array>} Imaging orders
     */
    static async getVisitOrders(visitId) {
        try {
            const query = `
                SELECT 
                    io.*,
                    u.first_name || ' ' || u.last_name as ordered_by_name,
                    COALESCE(ir.findings, rr.findings) AS findings
                FROM imaging_orders io
                LEFT JOIN users u ON io.ordered_by = u.id
                LEFT JOIN imaging_reports ir ON io.imaging_report_id = ir.id
                LEFT JOIN LATERAL (SELECT rr.id, rr.findings FROM radiology_reports rr WHERE rr.imaging_order_id=io.id ORDER BY rr.created_at DESC LIMIT 1) rr ON true
                WHERE io.visit_id = $1
                ORDER BY io.created_at DESC
            `;

            const result = await pool.query(query, [visitId]);
            return result.rows;
        } catch (error) {
            logger.error('Failed to get visit imaging orders:', error);
            throw error;
        }
    }

    /**
     * Get pending orders for a department
     * @param {String} department - Department name
     * @returns {Promise<Array>} Pending orders
     */
    static async getDepartmentPendingOrders(department) {
        try {
            const query = `
                SELECT 
                    io.*,
                    v.patient_id,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name
                FROM imaging_orders io
                INNER JOIN visits v ON io.visit_id = v.id
                INNER JOIN users p ON v.patient_id = p.id
                WHERE io.routed_to_department = $1
                    AND io.status IN ('ordered', 'scheduled', 'in_progress')
                ORDER BY 
                    CASE io.priority
                        WHEN 'stat' THEN 1
                        WHEN 'urgent' THEN 2
                        WHEN 'routine' THEN 3
                    END,
                    io.scheduled_time NULLS LAST,
                    io.created_at ASC
            `;

            const result = await pool.query(query, [department]);
            return result.rows;
        } catch (error) {
            logger.error('Failed to get department pending orders:', error);
            throw error;
        }
    }

    /**
     * Get all imaging orders for radiology department (radiologist queue)
     * @param {Object} options - Query options
     * @param {String} options.status - Filter by status (optional)
     * @param {Number} options.limit - Max results (default 100)
     * @param {Number} options.offset - Offset for pagination (default 0)
     * @returns {Promise<Array>} Imaging orders with patient and doctor info
     */
    static async getAllRadiologyOrders(options = {}) {
        try {
            const { status, limit = 100, offset = 0, userId, roleName = 'radiologist' } = options;
            if (!userId) throw new Error('Queue principal is required');

            let query = `
                SELECT 
                    io.*,
                    v.patient_id,
                    p.first_name AS patient_first_name,
                    p.last_name AS patient_last_name,
                    u.first_name || ' ' || u.last_name AS ordered_by_name,
                    COALESCE(ir.findings, rr.findings) AS report_findings,
                    COALESCE(ir.id, rr.id) AS report_id
                FROM imaging_orders io
                INNER JOIN visits v ON io.visit_id = v.id
                INNER JOIN users p ON v.patient_id = p.id
                LEFT JOIN users u ON io.ordered_by = u.id
                LEFT JOIN imaging_reports ir ON io.imaging_report_id = ir.id
                LEFT JOIN LATERAL (SELECT rr.id, rr.findings FROM radiology_reports rr WHERE rr.imaging_order_id=io.id ORDER BY rr.created_at DESC LIMIT 1) rr ON true
                WHERE io.routed_to_department LIKE 'Radiology%' AND ${clinicalScopeSql('v.patient_id', 'v.id', '$1', roleName, 'imaging')}
            `;

            const params = [userId];
            let paramIndex = 2;

            if (status) {
                query += ` AND io.status = $${paramIndex}`;
                params.push(status);
                paramIndex++;
            }

            query += `
                ORDER BY 
                    CASE io.priority
                        WHEN 'stat' THEN 1
                        WHEN 'urgent' THEN 2
                        WHEN 'routine' THEN 3
                        ELSE 4
                    END,
                    io.created_at DESC
                LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
            `;
            params.push(limit, offset);

            const result = await pool.query(query, params);

            logger.info('Fetched radiology orders', {
                count: result.rows.length,
                status: status || 'all'
            });

            return result.rows;
        } catch (error) {
            logger.error('Failed to get radiology orders:', error);
            throw error;
        }
    }
}

module.exports = ImagingOrderModel;
