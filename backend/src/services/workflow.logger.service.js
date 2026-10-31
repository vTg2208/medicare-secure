/**
 * Workflow Logger Service
 * Comprehensive logging of clinical workflow actions
 */

const pool = require('../config/db');
const logger = require('../utils/logger');

class WorkflowLoggerService {
    /**
     * Log a workflow action
     * @param {Object} logData - Log data
     * @returns {Promise<Object>} Created log entry
     */
    static async logAction(logData) {
        try {
            const {
                visitId,
                userId,
                action,
                entityType,
                entityId,
                oldState,
                newState,
                metadata = {},
                ipAddress,
                userAgent
            } = logData;

            const query = `
                INSERT INTO workflow_logs (
                    visit_id, user_id, action, entity_type, entity_id,
                    old_state, new_state, metadata, ip_address, user_agent
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *
            `;

            const result = await pool.query(query, [
                visitId,
                userId,
                action,
                entityType,
                entityId,
                oldState ? JSON.stringify(oldState) : null,
                newState ? JSON.stringify(newState) : null,
                JSON.stringify(metadata),
                ipAddress,
                userAgent
            ]);

            return result.rows[0];
        } catch (error) {
            logger.error('Failed to log workflow action:', error);
            // Don't throw - logging failure shouldn't break the workflow
            return null;
        }
    }

    /**
     * Get workflow logs for a visit
     * @param {String} visitId - Visit ID
     * @param {Object} filters - Optional filters
     * @returns {Promise<Array>} Workflow logs
     */
    static async getVisitLogs(visitId, filters = {}) {
        try {
            let query = `
                SELECT 
                    wl.*,
                    u.first_name || ' ' || u.last_name as user_name,
                    u.email as user_email
                FROM workflow_logs wl
                LEFT JOIN users u ON wl.user_id = u.id
                WHERE wl.visit_id = $1
            `;

            const params = [visitId];
            let paramIndex = 2;

            if (filters.action) {
                query += ` AND wl.action = $${paramIndex}`;
                params.push(filters.action);
                paramIndex++;
            }

            if (filters.entityType) {
                query += ` AND wl.entity_type = $${paramIndex}`;
                params.push(filters.entityType);
                paramIndex++;
            }

            if (filters.startDate) {
                query += ` AND wl.created_at >= $${paramIndex}`;
                params.push(filters.startDate);
                paramIndex++;
            }

            if (filters.endDate) {
                query += ` AND wl.created_at <= $${paramIndex}`;
                params.push(filters.endDate);
                paramIndex++;
            }

            query += ' ORDER BY wl.created_at DESC';

            if (filters.limit) {
                query += ` LIMIT $${paramIndex}`;
                params.push(filters.limit);
            }

            const result = await pool.query(query, params);
            return result.rows;
        } catch (error) {
            logger.error('Failed to get visit logs:', error);
            throw error;
        }
    }

    /**
     * Get workflow timeline for a visit
     * @param {String} visitId - Visit ID
     * @returns {Promise<Array>} Timeline events
     */
    static async getVisitTimeline(visitId) {
        try {
            const query = `
                SELECT 
                    action,
                    entity_type,
                    new_state,
                    created_at,
                    u.first_name || ' ' || u.last_name as performed_by
                FROM workflow_logs wl
                LEFT JOIN users u ON wl.user_id = u.id
                WHERE wl.visit_id = $1
                ORDER BY wl.created_at ASC
            `;

            const result = await pool.query(query, [visitId]);
            return result.rows;
        } catch (error) {
            logger.error('Failed to get visit timeline:', error);
            throw error;
        }
    }

    /**
     * Get workflow statistics
     * @param {Object} filters - Date range and other filters
     * @returns {Promise<Object>} Statistics
     */
    static async getStatistics(filters = {}) {
        try {
            let query = `
                SELECT 
                    action,
                    COUNT(*) as count,
                    COUNT(DISTINCT visit_id) as unique_visits,
                    COUNT(DISTINCT user_id) as unique_users
                FROM workflow_logs
                WHERE 1=1
            `;

            const params = [];
            let paramIndex = 1;

            if (filters.startDate) {
                query += ` AND created_at >= $${paramIndex}`;
                params.push(filters.startDate);
                paramIndex++;
            }

            if (filters.endDate) {
                query += ` AND created_at <= $${paramIndex}`;
                params.push(filters.endDate);
                paramIndex++;
            }

            query += ' GROUP BY action ORDER BY count DESC';

            const result = await pool.query(query, params);
            return result.rows;
        } catch (error) {
            logger.error('Failed to get workflow statistics:', error);
            throw error;
        }
    }

    /**
     * Log care team assignment
     */
    static async logCareTeamAssignment(visitId, userId, staffUserId, role, ipAddress) {
        return this.logAction({
            visitId,
            userId,
            action: 'care_team_assigned',
            entityType: 'care_team',
            newState: { staffUserId, role },
            ipAddress
        });
    }

    /**
     * Log order creation
     */
    static async logOrderCreation(visitId, userId, orderType, orderId, orderData, ipAddress) {
        return this.logAction({
            visitId,
            userId,
            action: `${orderType}_order_created`,
            entityType: `${orderType}_order`,
            entityId: orderId,
            newState: orderData,
            ipAddress
        });
    }

    /**
     * Log bed allocation
     */
    static async logBedAllocation(visitId, userId, allocationId, bedData, ipAddress) {
        return this.logAction({
            visitId,
            userId,
            action: 'bed_allocated',
            entityType: 'bed_allocation',
            entityId: allocationId,
            newState: bedData,
            ipAddress
        });
    }
}

module.exports = WorkflowLoggerService;
