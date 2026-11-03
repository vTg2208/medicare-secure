const { verifyAccessToken } = require('../config/jwt');
const { findUserById } = require('../models/user.model');
const { createAuditLog } = require('../services/audit.service');
const { captureDeviceInfo, validateDevice, flagSuspiciousDevice } = require('../services/device.service');
const { detectSuspiciousPatterns } = require('../services/violation.service');
const { HTTP_STATUS, ERROR_MESSAGES, AUDIT_ACTIONS, SECURITY_EVENT_TYPES } = require('../utils/constants');
const logger = require('../utils/logger');
const { query } = require('../config/db');
const { createHash } = require('crypto');
const config = require('../config/env');
const { bindAuthenticatedActor } = require('../services/request-context');
const { measurePhase, outsideRequestTiming } = require('../services/request-timing');

/**
 * Authenticate JWT token
 * Extracts and verifies JWT token from Authorization header
 */
const authenticate = async (req, res, next) => {
    try {
        // Extract token from Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                message: ERROR_MESSAGES.TOKEN_REQUIRED,
            });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Verify token
        let decoded;
        try {
            decoded = verifyAccessToken(token);
        } catch (error) {
            logger.warn('Invalid token attempt:', { error: error.message });

            // Log security event
            await createAuditLog({
                action: AUDIT_ACTIONS.ACCESS_DENIED,
                purpose: 'Invalid token',
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                requestMethod: req.method,
                requestPath: req.path,
                statusCode: HTTP_STATUS.UNAUTHORIZED,
            });

            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                message: ERROR_MESSAGES.INVALID_TOKEN,
            });
        }

        const tokenHash = createHash('sha256').update(token).digest('hex');
        const idleMinutes = config.session.autoLogoutEnabled ? config.session.timeoutMinutes : null;
        // Update the matching active row atomically so a concurrent revocation wins
        // if it commits before this statement can update the session.
        const { rows: [session] } = await measurePhase('session_check', () => query(`
            UPDATE sessions
            SET (is_active, last_activity) = (
                SELECT valid, CASE WHEN valid THEN GREATEST(last_activity, checked_at) ELSE last_activity END
                FROM (VALUES (statement_timestamp()::timestamp)) AS check_time(checked_at)
                CROSS JOIN LATERAL (VALUES (
                    expires_at > checked_at AND (
                        $3::integer IS NULL OR last_activity IS NULL OR
                        last_activity > checked_at - $3 * INTERVAL '1 minute'
                    )
                )) AS session_status(valid)
            )
            WHERE user_id = $1 AND token_hash = $2 AND is_active = true
            RETURNING id, is_active
        `, [decoded.userId, tokenHash, idleMinutes]));

        if (!session) {
            logger.warn(`No active session found for user ${decoded.userId}`);
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                message: 'Session not found or expired',
            });
        }

        if (!session.is_active) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                message: 'Session has expired. Please login again',
            });
        }

        // Capture device information
        const deviceInfo = captureDeviceInfo(req);

        // Validate device
        const deviceValidation = await measurePhase('device_check', () => validateDevice(decoded.userId, deviceInfo));

        if (!deviceValidation.isTrusted) {
            await measurePhase('device_check', () => flagSuspiciousDevice(decoded.userId, deviceInfo, deviceValidation.reason));

            logger.warn('Suspicious device detected:', {
                userId: decoded.userId,
                deviceInfo,
                reason: deviceValidation.reason,
            });

            // Still allow access but flag for review
            // In production, you might want to require additional verification
        }

        // Periodically check for suspicious patterns (every 10th request to reduce overhead)
        if (Math.random() < 0.1) {
            outsideRequestTiming(() => detectSuspiciousPatterns(decoded.userId)).catch(err => {
                logger.error('Pattern detection failed:', err);
            });
        }

        // Get user details
        const user = await measurePhase('account_lookup', () => findUserById(decoded.userId));

        if (!user) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                message: ERROR_MESSAGES.USER_NOT_FOUND,
            });
        }

        // Check user status
        if (user.status !== 'active') {
            let message = ERROR_MESSAGES.ACCESS_DENIED;

            if (user.status === 'suspended') {
                message = ERROR_MESSAGES.ACCOUNT_SUSPENDED;
            } else if (user.status === 'pending') {
                message = ERROR_MESSAGES.ACCOUNT_NOT_VERIFIED;
            }

            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                message,
            });
        }

        // Phase 1: Check account_status field (if it exists - backward compatible)
        if (user.account_status && user.account_status !== 'active') {
            let message = ERROR_MESSAGES.ACCESS_DENIED;

            if (user.account_status === 'suspended') {
                message = user.suspension_reason
                    ? `Account suspended: ${user.suspension_reason}`
                    : ERROR_MESSAGES.ACCOUNT_SUSPENDED;
            } else if (user.account_status === 'pending_verification') {
                message = 'Account pending verification. Please wait for admin approval.';
            }

            // Log suspension access attempt
            await createAuditLog({
                userId: user.id,
                action: AUDIT_ACTIONS.ACCESS_DENIED,
                purpose: 'Suspended account login attempt',
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                requestMethod: req.method,
                requestPath: req.path,
                statusCode: HTTP_STATUS.FORBIDDEN,
            });

            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                message,
            });
        }


        // Attach user and session to request object
        req.user = {
            id: user.id,
            email: user.email,
            phone: user.phone,
            roleId: user.role_id,
            roleName: user.role_name,
            firstName: user.first_name,
            lastName: user.last_name,
            isVerified: user.is_verified,
            status: user.status,
        };

        req.session = {
            id: session.id,
            deviceInfo,
        };

        bindAuthenticatedActor(user.id);

        next();
    } catch (error) {
        logger.error('Authentication middleware error:', error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: ERROR_MESSAGES.INTERNAL_ERROR,
        });
    }
};

/**
 * Optional authentication
 * Authenticates if token is present, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
    }

    // If token is present, authenticate
    return authenticate(req, res, next);
};

/**
 * Role authorization middleware
 * @param {Array|String} roles - Allowed roles
 */
const authorize = (roles = []) => {
    if (typeof roles === 'string') {
        roles = [roles];
    }

    return (req, res, next) => {
        if (!req.user) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                message: ERROR_MESSAGES.UNAUTHORIZED,
            });
        }

        if (roles.length && !roles.includes(req.user.roleName)) {
            logger.warn(`Access denied for user ${req.user.id} with role ${req.user.roleName}. Required: ${roles.join(', ')}`);

            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                message: ERROR_MESSAGES.ACCESS_DENIED,
            });
        }

        next();
    };
};

module.exports = {
    authenticate,
    optionalAuth,
    authorize,
};
