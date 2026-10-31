const { query } = require('../config/db');
const { createAuditLog } = require('./audit.service');
const logger = require('../utils/logger');

/**
 * Access Violation Detection Service
 * Monitors and reports policy violations and suspicious access patterns
 */

/**
 * Violation types
 */
const VIOLATION_TYPES = {
    UNAUTHORIZED_ACCESS: 'unauthorized_access',
    CONSENT_VIOLATION: 'consent_violation',
    SHIFT_VIOLATION: 'shift_violation',
    VISIT_VIOLATION: 'visit_violation',
    TASK_VIOLATION: 'task_violation',
    RATE_LIMIT_VIOLATION: 'rate_limit_violation',
    SUSPICIOUS_PATTERN: 'suspicious_pattern',
    EMERGENCY_MISUSE: 'emergency_misuse',
};

/**
 * Violation severity levels
 */
const VIOLATION_SEVERITY = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical',
};

/**
 * Record an access violation
 */
const recordViolation = async ({
    userId,
    violationType,
    severity,
    description,
    entityType,
    entityId,
    ipAddress,
    metadata = {},
}) => {
    try {
        // Insert into security_events table
        const violationQuery = `
            INSERT INTO security_events (
                user_id,
                event_type,
                severity,
                description,
                ip_address,
                metadata
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        `;

        const result = await query(violationQuery, [
            userId,
            violationType,
            severity,
            description,
            ipAddress,
            JSON.stringify(metadata),
        ]);

        const violationId = result.rows[0].id;

        // Also create audit log
        await createAuditLog({
            userId,
            action: 'policy_violation',
            entityType,
            entityId,
            purpose: description,
            ipAddress,
            metadata: {
                violationType,
                severity,
                violationId,
                ...metadata,
            },
        });

        logger.warn('Access violation recorded:', {
            violationId,
            userId,
            violationType,
            severity,
            description,
        });

        // Trigger alerts for high/critical violations
        if (severity === VIOLATION_SEVERITY.HIGH || severity === VIOLATION_SEVERITY.CRITICAL) {
            await triggerViolationAlert(violationId, userId, violationType, severity, description);
        }

        return {
            success: true,
            violationId,
        };
    } catch (error) {
        logger.error('Failed to record violation:', error);
        return {
            success: false,
            error: error.message,
        };
    }
};

/**
 * Detect repeated violations by user
 */
const detectRepeatedViolations = async (userId, timeWindowHours = 24) => {
    try {
        const violationsQuery = `
            SELECT 
                event_type,
                COUNT(*) as count,
                MAX(created_at) as last_occurrence
            FROM security_events
            WHERE user_id = $1
                AND created_at > NOW() - INTERVAL '${timeWindowHours} hours'
                AND resolved = false
            GROUP BY event_type
            HAVING COUNT(*) >= 3
        `;

        const result = await query(violationsQuery, [userId]);

        if (result.rows.length > 0) {
            // User has repeated violations
            const violations = result.rows.map(row => ({
                type: row.event_type,
                count: parseInt(row.count),
                lastOccurrence: row.last_occurrence,
            }));

            logger.warn('Repeated violations detected:', {
                userId,
                violations,
            });

            // Record as suspicious pattern
            await recordViolation({
                userId,
                violationType: VIOLATION_TYPES.SUSPICIOUS_PATTERN,
                severity: VIOLATION_SEVERITY.HIGH,
                description: `Repeated policy violations detected (${violations.length} types)`,
                metadata: { violations, timeWindowHours },
            });

            return {
                hasRepeatedViolations: true,
                violations,
            };
        }

        return {
            hasRepeatedViolations: false,
        };
    } catch (error) {
        logger.error('Failed to detect repeated violations:', error);
        return {
            hasRepeatedViolations: false,
            error: error.message,
        };
    }
};

/**
 * Detect suspicious access patterns
 */
const detectSuspiciousPatterns = async (userId) => {
    try {
        const patterns = [];

        // Pattern 1: Excessive failed access attempts
        const failedAccessQuery = `
            SELECT COUNT(*) as count
            FROM audit_logs
            WHERE user_id = $1
                AND action = 'access_denied'
                AND timestamp > NOW() - INTERVAL '1 hour'
        `;

        const failedResult = await query(failedAccessQuery, [userId]);
        const failedCount = parseInt(failedResult.rows[0].count);

        if (failedCount > 10) {
            patterns.push({
                type: 'excessive_failed_access',
                count: failedCount,
                severity: VIOLATION_SEVERITY.MEDIUM,
            });
        }

        // Pattern 2: Access to many different patients in short time
        const patientAccessQuery = `
            SELECT COUNT(DISTINCT entity_id) as patient_count
            FROM audit_logs
            WHERE user_id = $1
                AND entity_type = 'patient'
                AND action = 'data_access'
                AND timestamp > NOW() - INTERVAL '1 hour'
        `;

        const patientResult = await query(patientAccessQuery, [userId]);
        const patientCount = parseInt(patientResult.rows[0].patient_count);

        if (patientCount > 20) {
            patterns.push({
                type: 'excessive_patient_access',
                count: patientCount,
                severity: VIOLATION_SEVERITY.HIGH,
            });
        }

        // Pattern 3: After-hours access
        const now = new Date();
        const hour = now.getHours();
        const isAfterHours = hour < 6 || hour > 22;

        if (isAfterHours) {
            const afterHoursQuery = `
                SELECT COUNT(*) as count
                FROM audit_logs
                WHERE user_id = $1
                    AND timestamp > NOW() - INTERVAL '1 hour'
            `;

            const afterHoursResult = await query(afterHoursQuery, [userId]);
            const afterHoursCount = parseInt(afterHoursResult.rows[0].count);

            if (afterHoursCount > 5) {
                patterns.push({
                    type: 'after_hours_access',
                    count: afterHoursCount,
                    severity: VIOLATION_SEVERITY.MEDIUM,
                });
            }
        }

        // If suspicious patterns found, record them
        if (patterns.length > 0) {
            await recordViolation({
                userId,
                violationType: VIOLATION_TYPES.SUSPICIOUS_PATTERN,
                severity: VIOLATION_SEVERITY.HIGH,
                description: `Suspicious access patterns detected: ${patterns.map(p => p.type).join(', ')}`,
                metadata: { patterns },
            });

            return {
                hasSuspiciousPatterns: true,
                patterns,
            };
        }

        return {
            hasSuspiciousPatterns: false,
        };
    } catch (error) {
        logger.error('Failed to detect suspicious patterns:', error);
        return {
            hasSuspiciousPatterns: false,
            error: error.message,
        };
    }
};

/**
 * Get violation report for user
 */
const getUserViolationReport = async (userId, limit = 50) => {
    try {
        const reportQuery = `
            SELECT 
                id,
                event_type,
                severity,
                description,
                ip_address,
                metadata,
                resolved,
                created_at
            FROM security_events
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2
        `;

        const result = await query(reportQuery, [userId, limit]);

        return {
            success: true,
            violations: result.rows,
            totalCount: result.rows.length,
        };
    } catch (error) {
        logger.error('Failed to get violation report:', error);
        return {
            success: false,
            error: error.message,
        };
    }
};

/**
 * Get system-wide violation report
 */
const getSystemViolationReport = async (filters = {}) => {
    try {
        const { severity, eventType, resolved, limit = 100 } = filters;

        let whereClause = 'WHERE 1=1';
        const params = [];
        let paramCount = 1;

        if (severity) {
            whereClause += ` AND severity = $${paramCount}`;
            params.push(severity);
            paramCount++;
        }

        if (eventType) {
            whereClause += ` AND event_type = $${paramCount}`;
            params.push(eventType);
            paramCount++;
        }

        if (resolved !== undefined) {
            whereClause += ` AND resolved = $${paramCount}`;
            params.push(resolved);
            paramCount++;
        }

        const reportQuery = `
            SELECT 
                se.id,
                se.user_id,
                u.email,
                r.name as role,
                se.event_type,
                se.severity,
                se.description,
                se.ip_address,
                se.resolved,
                se.created_at
            FROM security_events se
            LEFT JOIN users u ON se.user_id = u.id
            LEFT JOIN roles r ON u.role_id = r.id
            ${whereClause}
            ORDER BY se.created_at DESC
            LIMIT $${paramCount}
        `;

        params.push(limit);

        const result = await query(reportQuery, params);

        // Get summary statistics
        const statsQuery = `
            SELECT 
                severity,
                COUNT(*) as count
            FROM security_events
            ${whereClause.replace(`LIMIT $${paramCount}`, '')}
            GROUP BY severity
        `;

        const statsResult = await query(statsQuery, params.slice(0, -1));

        return {
            success: true,
            violations: result.rows,
            statistics: statsResult.rows,
            totalCount: result.rows.length,
        };
    } catch (error) {
        logger.error('Failed to get system violation report:', error);
        return {
            success: false,
            error: error.message,
        };
    }
};

/**
 * Trigger alert for violation
 */
const triggerViolationAlert = async (violationId, userId, violationType, severity, description) => {
    try {
        logger.warn('VIOLATION ALERT:', {
            violationId,
            userId,
            violationType,
            severity,
            description,
        });

        // TODO: Implement actual alerting (email, SMS, dashboard notification)
        // For now, just log it

        return { success: true };
    } catch (error) {
        logger.error('Failed to trigger violation alert:', error);
        return { success: false };
    }
};

/**
 * Resolve a violation
 */
const resolveViolation = async (violationId, resolvedBy, notes) => {
    try {
        const resolveQuery = `
            UPDATE security_events
            SET resolved = true,
                resolved_at = NOW(),
                resolved_by = $1,
                metadata = jsonb_set(
                    COALESCE(metadata, '{}'::jsonb),
                    '{resolution_notes}',
                    to_jsonb($2::text)
                )
            WHERE id = $3
            RETURNING id
        `;

        await query(resolveQuery, [resolvedBy, notes, violationId]);

        logger.info('Violation resolved:', {
            violationId,
            resolvedBy,
        });

        return { success: true };
    } catch (error) {
        logger.error('Failed to resolve violation:', error);
        return {
            success: false,
            error: error.message,
        };
    }
};

module.exports = {
    VIOLATION_TYPES,
    VIOLATION_SEVERITY,
    recordViolation,
    detectRepeatedViolations,
    detectSuspiciousPatterns,
    getUserViolationReport,
    getSystemViolationReport,
    resolveViolation,
};
