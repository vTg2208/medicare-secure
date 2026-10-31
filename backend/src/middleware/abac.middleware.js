const { query } = require('../config/db');
const { HTTP_STATUS, ERROR_MESSAGES } = require('../utils/constants');
const logger = require('../utils/logger');
const { createAuditLog } = require('../services/audit.service');

/**
 * Attribute-Based Access Control (ABAC) Middleware
 * Enforces context-aware access control based on:
 * - Visit context
 * - Time constraints
 * - Staff shifts
 * - Task assignments
 * - Location
 */

/**
 * Check if user has active visit context for patient
 * @param {String} userId - User ID (doctor, nurse, etc.)
 * @param {String} patientId - Patient ID
 * @returns {Boolean} Has active visit context
 */
const hasActiveVisitContext = async (userId, patientId) => {
    try {
        const visitQuery = `
            SELECT v.id, v.status, v.start_time, v.end_time
            FROM visits v
            INNER JOIN visit_staff_assignments vsa ON v.id = vsa.visit_id
            WHERE vsa.staff_user_id = $1
                AND v.patient_id = $2
                AND v.status = 'active'
                AND v.start_time <= NOW()
                AND (v.end_time IS NULL OR v.end_time >= NOW())
            LIMIT 1
        `;

        const result = await query(visitQuery, [userId, patientId]);
        return result.rows.length > 0;
    } catch (error) {
        logger.error('Visit context check failed:', error);
        return false;
    }
};

/**
 * Middleware: Require active visit context
 * Use this for endpoints that require an active visit
 */
const requireVisitContext = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const patientId = req.params.patientId || req.body.patientId;

        if (!patientId) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: 'Patient ID is required',
            });
        }

        // Check for active visit
        const hasVisit = await hasActiveVisitContext(userId, patientId);

        if (!hasVisit) {
            // Log access denial
            await createAuditLog({
                userId,
                action: 'access_denied',
                entityType: 'patient',
                entityId: patientId,
                purpose: 'No active visit context',
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                requestMethod: req.method,
                requestPath: req.path,
                statusCode: HTTP_STATUS.FORBIDDEN,
            });

            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                message: 'Access denied: No active visit context for this patient',
            });
        }

        next();
    } catch (error) {
        logger.error('Visit context middleware error:', error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: ERROR_MESSAGES.INTERNAL_ERROR,
        });
    }
};

/**
 * Check if staff member is within their shift time
 */
const isWithinShift = async (userId) => {
    try {
        const shiftQuery = `
            SELECT shift_start, shift_end
            FROM staff_org_mapping
            WHERE user_id = $1 AND status = 'active'
            LIMIT 1
        `;

        const result = await query(shiftQuery, [userId]);

        if (result.rows.length === 0) {
            // No shift defined, allow access
            return true;
        }

        const { shift_start, shift_end } = result.rows[0];

        if (!shift_start || !shift_end) {
            // Shift times not set, allow access
            return true;
        }

        // Get current time in HH:MM format
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:00`;

        // Check if current time is within shift
        return currentTime >= shift_start && currentTime <= shift_end;
    } catch (error) {
        logger.error('Shift check failed:', error);
        // Fail open for availability
        return true;
    }
};

/**
 * Middleware: Require staff to be within shift
 * Use for nurse and other shift-based roles
 */
const requireActiveShift = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const roleName = req.user.roleName;

        // Only enforce for shift-based roles
        const shiftBasedRoles = ['nurse', 'lab_technician', 'radiologist', 'pharmacist'];

        if (!shiftBasedRoles.includes(roleName)) {
            return next();
        }

        const withinShift = await isWithinShift(userId);

        if (!withinShift) {
            await createAuditLog({
                userId,
                action: 'access_denied',
                purpose: 'Access attempted outside shift hours',
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                requestMethod: req.method,
                requestPath: req.path,
                statusCode: HTTP_STATUS.FORBIDDEN,
            });

            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                message: 'Access denied: Outside shift hours',
            });
        }

        next();
    } catch (error) {
        logger.error('Shift middleware error:', error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: ERROR_MESSAGES.INTERNAL_ERROR,
        });
    }
};

/**
 * Check if user has specific task assignment
 */
const hasTaskAssignment = async (userId, taskType, taskId) => {
    try {
        // For lab results
        if (taskType === 'lab_test') {
            const labQuery = `
                SELECT id FROM medical_records
                WHERE id = $1
                    AND type = 'lab_test'
                    AND created_by = $2
            `;
            const result = await query(labQuery, [taskId, userId]);
            return result.rows.length > 0;
        }

        // For imaging
        if (taskType === 'imaging') {
            const imagingQuery = `
                SELECT id FROM medical_records
                WHERE id = $1
                    AND type = 'imaging'
                    AND created_by = $2
            `;
            const result = await query(imagingQuery, [taskId, userId]);
            return result.rows.length > 0;
        }

        return false;
    } catch (error) {
        logger.error('Task assignment check failed:', error);
        return false;
    }
};

/**
 * Middleware: Require task assignment
 * Use for lab technicians and radiologists
 */
const requireTaskAssignment = (taskType) => {
    return async (req, res, next) => {
        try {
            const userId = req.user.id;
            const taskId = req.params.recordId || req.params.id;

            if (!taskId) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    message: 'Task ID is required',
                });
            }

            const hasTask = await hasTaskAssignment(userId, taskType, taskId);

            if (!hasTask) {
                await createAuditLog({
                    userId,
                    action: 'access_denied',
                    entityType: taskType,
                    entityId: taskId,
                    purpose: 'No task assignment',
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent'],
                    requestMethod: req.method,
                    requestPath: req.path,
                    statusCode: HTTP_STATUS.FORBIDDEN,
                });

                return res.status(HTTP_STATUS.FORBIDDEN).json({
                    success: false,
                    message: 'Access denied: No task assignment',
                });
            }

            next();
        } catch (error) {
            logger.error('Task assignment middleware error:', error);
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: ERROR_MESSAGES.INTERNAL_ERROR,
            });
        }
    };
};

/**
 * Check if access is within time bounds
 */
const isWithinTimeBounds = (startTime, endTime) => {
    const now = new Date();
    const start = startTime ? new Date(startTime) : null;
    const end = endTime ? new Date(endTime) : null;

    if (start && now < start) return false;
    if (end && now > end) return false;

    return true;
};

/**
 * Middleware: Enforce time-bound access
 * Use for temporary permissions
 */
const requireTimeBounds = async (req, res, next) => {
    try {
        // This would typically check against a permissions table
        // For now, we'll use it as a placeholder for future implementation
        next();
    } catch (error) {
        logger.error('Time bounds middleware error:', error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: ERROR_MESSAGES.INTERNAL_ERROR,
        });
    }
};

/**
 * Combine multiple ABAC checks
 * Usage: requireABAC(['visit', 'shift', 'task'])
 */
const requireABAC = (checks = []) => {
    return async (req, res, next) => {
        try {
            for (const check of checks) {
                switch (check) {
                    case 'visit':
                        await requireVisitContext(req, res, () => { });
                        break;
                    case 'shift':
                        await requireActiveShift(req, res, () => { });
                        break;
                    case 'time':
                        await requireTimeBounds(req, res, () => { });
                        break;
                    default:
                        logger.warn(`Unknown ABAC check: ${check}`);
                }
            }
            next();
        } catch (error) {
            logger.error('ABAC middleware error:', error);
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: ERROR_MESSAGES.INTERNAL_ERROR,
            });
        }
    };
};

module.exports = {
    requireVisitContext,
    requireActiveShift,
    requireTaskAssignment,
    requireTimeBounds,
    requireABAC,
    hasActiveVisitContext,
    isWithinShift,
    hasTaskAssignment,
    isWithinTimeBounds,
};
