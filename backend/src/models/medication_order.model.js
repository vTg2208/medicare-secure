/**
 * Medication Order Model
 * Manages medication orders linked to prescriptions
 */

const pool = require('../config/db');
const logger = require('../utils/logger');

class MedicationOrderModel {
    /**
     * Create a medication order
     * @param {Object} orderData - Order data
     * @returns {Promise<Object>} Created order
     */
    static async createOrder(orderData) {
        try {
            const {
                visitId,
                prescriptionId,
                medication,
                dosage,
                route,
                frequency,
                orderedBy,
                notes
            } = orderData;

            const query = `
                INSERT INTO medication_orders (
                    visit_id, prescription_id, medication, dosage, route,
                    frequency, ordered_by, notes
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `;

            const result = await pool.query(query, [
                visitId, prescriptionId, medication, dosage, route,
                frequency, orderedBy, notes
            ]);

            logger.info('Medication order created', {
                orderId: result.rows[0].id,
                medication
            });

            return result.rows[0];
        } catch (error) {
            logger.error('Failed to create medication order:', error);
            throw error;
        }
    }

    /**
     * Record medication dispensing
     * @param {String} orderId - Order ID
     * @param {String} dispensedBy - User ID who dispensed
     * @returns {Promise<Object>} Updated order
     */
    static async recordDispensing(orderId, dispensedBy) {
        try {
            const query = `
                UPDATE medication_orders
                SET status = 'dispensed',
                    dispensed_by = $1,
                    dispensed_at = NOW(),
                    updated_at = NOW()
                WHERE id = $2 AND status = 'ordered'
                RETURNING *
            `;

            const result = await pool.query(query, [dispensedBy, orderId]);

            if (result.rows.length === 0) {
                throw new Error('Order not found or already dispensed');
            }

            logger.info('Medication dispensed', {
                orderId,
                dispensedBy
            });

            return result.rows[0];
        } catch (error) {
            logger.error('Failed to record dispensing:', error);
            throw error;
        }
    }

    /**
     * Record medication administration
     * @param {String} orderId - Order ID
     * @param {String} administeredBy - User ID who administered
     * @returns {Promise<Object>} Updated order
     */
    static async recordAdministration(orderId, administeredBy) {
        try {
            const query = `
                UPDATE medication_orders
                SET status = 'administered',
                    administered_by = $1,
                    administered_at = NOW(),
                    updated_at = NOW()
                WHERE id = $2 AND status IN ('ordered', 'dispensed')
                RETURNING *
            `;

            const result = await pool.query(query, [administeredBy, orderId]);

            if (result.rows.length === 0) {
                throw new Error('Order not found or cannot be administered');
            }

            logger.info('Medication administered', {
                orderId,
                administeredBy
            });

            return result.rows[0];
        } catch (error) {
            logger.error('Failed to record administration:', error);
            throw error;
        }
    }

    /**
     * Discontinue medication order
     * @param {String} orderId - Order ID
     * @param {String} discontinuedBy - User ID
     * @param {String} reason - Reason for discontinuation
     * @returns {Promise<Object>} Updated order
     */
    static async discontinue(orderId, discontinuedBy, reason) {
        try {
            const query = `
                UPDATE medication_orders
                SET status = 'discontinued',
                    discontinued_by = $1,
                    discontinued_at = NOW(),
                    discontinuation_reason = $2,
                    updated_at = NOW()
                WHERE id = $3 AND status NOT IN ('discontinued', 'administered')
                RETURNING *
            `;

            const result = await pool.query(query, [discontinuedBy, reason, orderId]);

            if (result.rows.length === 0) {
                throw new Error('Order not found or cannot be discontinued');
            }

            logger.info('Medication order discontinued', {
                orderId,
                reason
            });

            return result.rows[0];
        } catch (error) {
            logger.error('Failed to discontinue medication:', error);
            throw error;
        }
    }

    /**
     * Get medication orders for a visit
     * @param {String} visitId - Visit ID
     * @returns {Promise<Array>} Medication orders
     */
    static async getVisitOrders(visitId) {
        try {
            const query = `
                SELECT 
                    mo.*,
                    u1.first_name || ' ' || u1.last_name as ordered_by_name,
                    u2.first_name || ' ' || u2.last_name as dispensed_by_name,
                    u3.first_name || ' ' || u3.last_name as administered_by_name,
                    p.dosage as prescription_dosage,
                    p.frequency as prescription_frequency
                FROM medication_orders mo
                LEFT JOIN users u1 ON mo.ordered_by = u1.id
                LEFT JOIN users u2 ON mo.dispensed_by = u2.id
                LEFT JOIN users u3 ON mo.administered_by = u3.id
                LEFT JOIN prescriptions p ON mo.prescription_id = p.id
                WHERE mo.visit_id = $1
                ORDER BY mo.created_at DESC
            `;

            const result = await pool.query(query, [visitId]);
            return result.rows;
        } catch (error) {
            logger.error('Failed to get visit medication orders:', error);
            throw error;
        }
    }

    /**
     * Get pending medication orders (ordered but not administered)
     * @param {String} visitId - Visit ID
     * @returns {Promise<Array>} Pending orders
     */
    static async getPendingOrders(visitId) {
        try {
            const query = `
                SELECT *
                FROM medication_orders
                WHERE visit_id = $1
                    AND status IN ('ordered', 'dispensed')
                ORDER BY created_at ASC
            `;

            const result = await pool.query(query, [visitId]);
            return result.rows;
        } catch (error) {
            logger.error('Failed to get pending medication orders:', error);
            throw error;
        }
    }
}

module.exports = MedicationOrderModel;
