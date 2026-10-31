/**
 * Lab Order Model
 * Manages lab test orders and routing
 */

const pool = require('../config/db');
const logger = require('../utils/logger');

class LabOrderModel {
    /**
     * Create a lab order
     * @param {Object} orderData - Order data
     * @returns {Promise<Object>} Created order
     */
    static async createOrder(orderData) {
        try {
            const {
                visitId,
                orderedBy,
                testName,
                testCode,
                testCategory,
                priority = 'routine',
                clinicalIndication,
                notes
            } = orderData;

            // Route to appropriate department based on test category
            const department = this.routeToDepartment(testCategory);

            const query = `
                INSERT INTO lab_orders (
                    visit_id, ordered_by, test_name, test_code, test_category,
                    priority, routed_to_department, clinical_indication, notes
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `;

            const result = await pool.query(query, [
                visitId, orderedBy, testName, testCode, testCategory,
                priority, department, clinicalIndication, notes
            ]);

            logger.info('Lab order created', {
                orderId: result.rows[0].id,
                testName,
                department
            });

            return result.rows[0];
        } catch (error) {
            logger.error('Failed to create lab order:', error);
            throw error;
        }
    }

    /**
     * Route lab order to appropriate department
     * @param {String} testCategory - Test category
     * @returns {String} Department name
     */
    static routeToDepartment(testCategory) {
        const routing = {
            'hematology': 'Hematology Lab',
            'biochemistry': 'Clinical Biochemistry',
            'microbiology': 'Microbiology Lab',
            'pathology': 'Pathology Department',
            'immunology': 'Immunology Lab',
            'molecular': 'Molecular Diagnostics'
        };

        return routing[testCategory?.toLowerCase()] || 'General Laboratory';
    }

    /**
     * Update order status
     * @param {String} orderId - Order ID
     * @param {String} status - New status
     * @param {Object} additionalData - Additional data (e.g., specimen_collected_at)
     * @returns {Promise<Object>} Updated order
     */
    static async updateStatus(orderId, status, additionalData = {}) {
        try {
            let query = 'UPDATE lab_orders SET status = $1, updated_at = NOW()';
            const params = [status];
            let paramIndex = 2;

            // Add timestamp fields based on status
            if (status === 'collected' && !additionalData.specimen_collected_at) {
                query += `, specimen_collected_at = $${paramIndex}`;
                params.push(new Date());
                paramIndex++;
            }

            if (status === 'completed' && !additionalData.result_available_at) {
                query += `, result_available_at = $${paramIndex}`;
                params.push(new Date());
                paramIndex++;
            }

            // Add lab_result_id if provided
            if (additionalData.labResultId) {
                query += `, lab_result_id = $${paramIndex}`;
                params.push(additionalData.labResultId);
                paramIndex++;
            }

            query += ` WHERE id = $${paramIndex} RETURNING *`;
            params.push(orderId);

            const result = await pool.query(query, params);

            if (result.rows.length === 0) {
                throw new Error('Lab order not found');
            }

            logger.info('Lab order status updated', {
                orderId,
                status
            });

            return result.rows[0];
        } catch (error) {
            logger.error('Failed to update lab order status:', error);
            throw error;
        }
    }

    /**
     * Get lab orders for a visit
     * @param {String} visitId - Visit ID
     * @returns {Promise<Array>} Lab orders
     */
    static async getVisitOrders(visitId) {
        try {
            const query = `
                SELECT 
                    lo.*,
                    u.first_name || ' ' || u.last_name as ordered_by_name,
                    lr.results_data AS test_results
                FROM lab_orders lo
                LEFT JOIN users u ON lo.ordered_by = u.id
                LEFT JOIN lab_results lr ON lo.lab_result_id = lr.id
                WHERE lo.visit_id = $1
                ORDER BY lo.created_at DESC
            `;

            const result = await pool.query(query, [visitId]);
            return result.rows;
        } catch (error) {
            logger.error('Failed to get visit lab orders:', error);
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
                    lo.*,
                    v.patient_id,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name
                FROM lab_orders lo
                INNER JOIN visits v ON lo.visit_id = v.id
                INNER JOIN users p ON v.patient_id = p.id
                WHERE lo.routed_to_department = $1
                    AND lo.status IN ('ordered', 'collected', 'in_progress')
                ORDER BY 
                    CASE lo.priority
                        WHEN 'stat' THEN 1
                        WHEN 'urgent' THEN 2
                        WHEN 'routine' THEN 3
                    END,
                    lo.created_at ASC
            `;

            const result = await pool.query(query, [department]);
            return result.rows;
        } catch (error) {
            logger.error('Failed to get department pending orders:', error);
            throw error;
        }
    }
}

module.exports = LabOrderModel;
