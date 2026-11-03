const { query } = require('../config/db');
const { redactSensitive } = require('../utils/redact');
const logger = require('../utils/logger');
const { recordAuditError } = require('../middleware/metrics');
const { searchPattern } = require('../utils/pagination');
const { measurePhase } = require('./request-timing');

/**
 * Create audit log entry
 * @param {Object} logData - Audit log data
 * @param {String} logData.userId - User ID performing the action
 * @param {String} logData.action - Action performed
 * @param {String} logData.entityType - Type of entity affected
 * @param {String} logData.entityId - ID of entity affected
 * @param {String} logData.purpose - Purpose of the action
 * @param {String} logData.ipAddress - IP address of the request
 * @param {String} logData.userAgent - User agent string
 * @param {String} logData.requestMethod - HTTP method
 * @param {String} logData.requestPath - Request path
 * @param {Number} logData.statusCode - HTTP status code
 * @param {Object} logData.metadata - Additional metadata
 * @returns {Promise<Object>} Created audit log
 */
const logAuditEvent = async (logData, client = null) => {
    try {
        const {
            userId,
            action,
            entityType,
            entityId,
            purpose,
            ipAddress,
            userAgent,
            requestMethod,
            requestPath,
            statusCode,
            metadata,
        } = logData;

        // Insert audit log
        const insertQuery = `
      INSERT INTO audit_logs (
        user_id, action, entity_type, entity_id, purpose,
        ip_address, user_agent, request_method, request_path,
        status_code, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

        const execute = client ? client.query.bind(client) : query;
        const result = await execute(insertQuery, [
            userId || null,
            action,
            entityType || null,
            entityId || null,
            purpose || null,
            ipAddress || null,
            userAgent || null,
            requestMethod || null,
            requestPath ? requestPath.replace(/(\/invitations\/)[^/]+(\/(?:accept|validate))/g, '$1[REDACTED]$2') : null,
            statusCode || null,
            metadata ? JSON.stringify(redactSensitive(metadata)) : null,
        ]);

        logger.debug('Audit log created', { action, userId, entityType });

        if (!result.rows[0]?.id) throw new Error('Audit event was not stored');
        return result.rows[0];
    } catch (error) {
        recordAuditError();
        throw error;
    }
};

// Legacy callers retain their return-null contract. Security-sensitive responses
// and transaction writers use logAuditEvent, which never suppresses failures.
const createAuditLog = async (logData) => {
    try {
        return await logAuditEvent(logData);
    } catch (error) {
        logger.error('Failed to create audit log:', error);
        // Don't throw error to prevent audit logging from breaking the main flow
        return null;
    }
};

/**
 * Get audit logs for a user
 * @param {String} userId - User ID
 * @param {Object} options - Query options
 * @param {Number} options.limit - Number of records to return
 * @param {Number} options.offset - Offset for pagination
 * @param {String} options.action - Filter by action
 * @param {Date} options.startDate - Start date filter
 * @param {Date} options.endDate - End date filter
 * @returns {Promise<Array>} Audit logs
 */
const getUserAuditLogs = async (userId, options = {}) => {
    try {
        const {
            limit = 50,
            offset = 0,
            action,
            startDate,
            endDate,
        } = options;

        let conditions = ['user_id = $1'];
        let params = [userId];
        let paramIndex = 2;

        if (action) {
            conditions.push(`action = $${paramIndex}`);
            params.push(action);
            paramIndex++;
        }

        if (startDate) {
            conditions.push(`timestamp >= $${paramIndex}`);
            params.push(startDate);
            paramIndex++;
        }

        if (endDate) {
            conditions.push(`timestamp <= $${paramIndex}`);
            params.push(endDate);
            paramIndex++;
        }

        const selectQuery = `
      SELECT 
        id, user_id, action, entity_type, entity_id,
        purpose, ip_address, timestamp, status_code
      FROM audit_logs
      WHERE ${conditions.join(' AND ')}
      ORDER BY timestamp DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

        params.push(limit, offset);

        const result = await query(selectQuery, params);

        return result.rows;
    } catch (error) {
        logger.error('Failed to get user audit logs:', error);
        throw error;
    }
};

/**
 * Get audit logs for an entity
 * @param {String} entityType - Entity type
 * @param {String} entityId - Entity ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Audit logs
 */
const getEntityAuditLogs = async (entityType, entityId, options = {}) => {
    try {
        const { limit = 50, offset = 0 } = options;

        const selectQuery = `
      SELECT 
        id, user_id, action, entity_type, entity_id,
        purpose, ip_address, timestamp, status_code, metadata
      FROM audit_logs
      WHERE entity_type = $1 AND entity_id = $2
      ORDER BY timestamp DESC
      LIMIT $3 OFFSET $4
    `;

        const result = await query(selectQuery, [entityType, entityId, limit, offset]);

        return result.rows;
    } catch (error) {
        logger.error('Failed to get entity audit logs:', error);
        throw error;
    }
};

/**
 * Get all audit logs (admin only)
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Audit logs with pagination info
 */
const getAllAuditLogs = async (options = {}) => {
    try {
        const {
            limit = 50,
            offset = 0,
            action,
            userId,
            startDate,
            endDate,
            endBefore,
            search,
        } = options;

        let conditions = [];
        let params = [];
        let paramIndex = 1;

        if (options.organizationId) {
            conditions.push(`(a.metadata->>'organizationId' = $${paramIndex}::text
                OR (a.entity_type='organization' AND a.entity_id=$${paramIndex}::uuid)
                OR (a.entity_type='visit' AND EXISTS (SELECT 1 FROM visits scoped_visit WHERE scoped_visit.id=a.entity_id AND scoped_visit.organization_id=$${paramIndex}::uuid)))`);
            params.push(options.organizationId);
            paramIndex++;
        }

        if (action) {
            conditions.push(`a.action = $${paramIndex}`);
            params.push(action);
            paramIndex++;
        }

        if (userId) {
            conditions.push(`a.user_id = $${paramIndex}`);
            params.push(userId);
            paramIndex++;
        }

        if (startDate) {
            conditions.push(`a.timestamp >= $${paramIndex}`);
            params.push(startDate);
            paramIndex++;
        }

        if (endBefore) {
            conditions.push(`a.timestamp < $${paramIndex}`);
            params.push(endBefore);
            paramIndex++;
        } else if (endDate) {
            conditions.push(typeof endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(endDate)
                ? `a.timestamp < ($${paramIndex}::date + 1)`
                : `a.timestamp <= $${paramIndex}`);
            params.push(endDate);
            paramIndex++;
        }

        const pattern = searchPattern(search);
        if (pattern) {
            const parameter = `$${paramIndex++}`;
            conditions.push(`(u.email ILIKE ${parameter} OR a.action ILIKE ${parameter} OR a.purpose ILIKE ${parameter})`);
            params.push(pattern);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM audit_logs a LEFT JOIN users u ON a.user_id = u.id ${whereClause}`;
        const countResult = await measurePhase('audit_count', () => query(countQuery, params));
        const total = parseInt(countResult.rows[0].total);

        // Get logs
        const selectQuery = `
      SELECT 
        a.id, a.user_id, a.action, a.entity_type as resource, a.entity_id,
        a.purpose as details, a.ip_address, a.request_method, a.request_path, a.timestamp, a.status_code,
        u.email as user_email
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ${whereClause}
      ORDER BY a.timestamp DESC, a.id DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

        params.push(limit, offset);

        const result = await measurePhase('audit_page', () => query(selectQuery, params));

        return {
            logs: result.rows,
            pagination: {
                total,
                limit,
                offset,
                pages: Math.ceil(total / limit),
            },
        };
    } catch (error) {
        logger.error('Failed to get all audit logs:', error);
        throw error;
    }
};

/**
 * Verify audit log integrity (hash chain)
 * @returns {Promise<Object>} Verification result
 */
const verifyAuditLogIntegrity = async () => {
    try {
        const logsQuery = `
      SELECT a.id, a.hash_version, a.previous_hash, a.current_hash,
             a.hash_payload = audit_payload(a) AS payload_matches,
             encode(digest(COALESCE(a.previous_hash,'') || audit_payload(a),'sha256'),'hex') AS expected_hash
      FROM audit_logs a ORDER BY a.sequence ASC
    `;

        const result = await query(logsQuery);
        const logs = result.rows;

        let previousHash = '';
        let tamperedLogs = [];

        let legacyLogs = 0;
        for (const log of logs) {
            if (log.hash_version !== 1) legacyLogs++;
            else if (log.current_hash !== log.expected_hash || !log.payload_matches ||
                (log.previous_hash || '') !== (previousHash || '')) {
                tamperedLogs.push(log.id);
            }

            previousHash = log.current_hash;
        }

        const head = await query('SELECT last_hash FROM audit_chain_head WHERE singleton=1');
        if (head.rows.length !== 1 || (head.rows[0].last_hash || '') !== (previousHash || '')) {
            return { verified: false, message: 'Audit chain head does not match retained evidence', totalLogs: logs.length };
        }

        if (tamperedLogs.length > 0) {
            logger.warn('Audit log integrity check failed', { tamperedLogs });
            return {
                verified: false,
                message: 'Audit log tampering detected',
                tamperedLogs,
            };
        }

        return {
            verified: legacyLogs === 0,
            message: legacyLogs ? 'Historical entries predate the verified hash chain' : 'Audit log integrity verified',
            legacyLogs,
            totalLogs: logs.length,
        };
    } catch (error) {
        logger.error('Failed to verify audit log integrity:', error);
        throw error;
    }
};

/**
 * Get audit logs for patient record access
 * @param {String} patientId - Patient User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Audit logs with user details and pagination
 */
const getPatientRecordAccessLogs = async (patientId, options = {}) => {
    try {
        const { limit = 50, offset = 0, action, startDate, endDate } = options;

        let conditions = [`(a.user_id = $1 OR a.entity_id = $1 OR a.metadata->>'patientId' = $1::text OR a.metadata->'patientIds' ? $1::text)`];
        let params = [patientId];
        let paramIndex = 2;

        if (action) {
            conditions.push(`a.action = $${paramIndex}`);
            params.push(action);
            paramIndex++;
        }

        if (startDate) {
            conditions.push(`a.timestamp >= $${paramIndex}`);
            params.push(startDate);
            paramIndex++;
        }

        if (endDate) {
            conditions.push(`a.timestamp <= $${paramIndex}`);
            params.push(endDate);
            paramIndex++;
        }

        const whereClause = `WHERE ${conditions.join(' AND ')}`;

        const countQuery = `SELECT COUNT(*) as total FROM audit_logs a ${whereClause}`;
        const countResult = await query(countQuery, params);
        const total = parseInt(countResult.rows[0].total);

        const selectQuery = `
            SELECT 
                a.id, a.user_id as "userId", a.action, a.entity_type as "entityType",
                a.entity_id as "entityId", a.purpose, a.ip_address as "ipAddress",
                a.timestamp, a.metadata,
                u.first_name as "userFirstName", u.last_name as "userLastName",
                u.email as "userEmail", r.name as "userRole"
            FROM audit_logs a
            LEFT JOIN users u ON a.user_id = u.id
            LEFT JOIN roles r ON u.role_id = r.id
            ${whereClause}
            ORDER BY a.timestamp DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        params.push(limit, offset);
        const result = await query(selectQuery, params);

        return {
            logs: result.rows.map(row => {
                if (!row.metadata || typeof row.metadata !== 'object') return row;
                const metadata = { ...row.metadata };
                if (Array.isArray(metadata.patientIds)) metadata.patientIds = metadata.patientIds.filter(id => id === patientId);
                if (metadata.patientId && metadata.patientId !== patientId) delete metadata.patientId;
                return { ...row, metadata };
            }),
            pagination: { total, limit, offset, pages: Math.ceil(total / limit) }
        };
    } catch (error) {
        logger.error('Failed to get patient record access logs:', error);
        throw error;
    }
};

module.exports = {
    logAuditEvent,
    createAuditLog,
    getUserAuditLogs,
    getEntityAuditLogs,
    getAllAuditLogs,
    verifyAuditLogIntegrity,
    getPatientRecordAccessLogs,
};
