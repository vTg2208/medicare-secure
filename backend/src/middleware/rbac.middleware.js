const { query } = require('../config/db');
const { HTTP_STATUS, ERROR_MESSAGES, ROLES } = require('../utils/constants');
const logger = require('../utils/logger');

/**
 * Role-Based Access Control Middleware
 * Checks if user has required role(s)
 * @param {Array|String} allowedRoles - Allowed role name(s)
 */
const requireRole = (allowedRoles) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                    success: false,
                    message: ERROR_MESSAGES.TOKEN_REQUIRED,
                });
            }

            const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

            if (!rolesArray.includes(req.user.roleName)) {
                logger.warn('Access denied - insufficient role:', {
                    userId: req.user.id,
                    userRole: req.user.roleName,
                    requiredRoles: rolesArray,
                    path: req.path,
                });

                return res.status(HTTP_STATUS.FORBIDDEN).json({
                    success: false,
                    message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
                });
            }

            next();
        } catch (error) {
            logger.error('RBAC middleware error:', error);
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: ERROR_MESSAGES.INTERNAL_ERROR,
            });
        }
    };
};

/**
 * Check if user has specific permission for a resource and action
 * @param {String} resource - Resource name
 * @param {String} action - Action (create, read, update, delete)
 */
const requirePermission = (resource, action) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                    success: false,
                    message: ERROR_MESSAGES.TOKEN_REQUIRED,
                });
            }

            // Check access policy
            const policyQuery = `
        SELECT is_allowed, conditions
        FROM access_policies
        WHERE role_id = $1 AND resource = $2 AND action = $3
      `;

            const result = await query(policyQuery, [req.user.roleId, resource, action]);

            if (result.rows.length === 0) {
                // No explicit policy - default DENY
                logger.warn('Access denied - no policy found:', {
                    userId: req.user.id,
                    roleId: req.user.roleId,
                    resource,
                    action,
                });

                return res.status(HTTP_STATUS.FORBIDDEN).json({
                    success: false,
                    message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
                });
            }

            const policy = result.rows[0];

            if (!policy.is_allowed) {
                logger.warn('Access denied - policy denies access:', {
                    userId: req.user.id,
                    resource,
                    action,
                });

                return res.status(HTTP_STATUS.FORBIDDEN).json({
                    success: false,
                    message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
                });
            }

            // TODO: Evaluate conditions if present (ABAC)
            // For now, just check if allowed

            next();
        } catch (error) {
            logger.error('Permission check middleware error:', error);
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: ERROR_MESSAGES.INTERNAL_ERROR,
            });
        }
    };
};

/**
 * Require patient role
 */
const requirePatient = requireRole(ROLES.PATIENT);

/**
 * Require doctor role
 */
const requireDoctor = requireRole(ROLES.DOCTOR);

/**
 * Require admin role (hospital or system)
 */
const requireAdmin = requireRole([ROLES.HOSPITAL_ADMIN, ROLES.SYSTEM_ADMIN]);

/**
 * Require system admin role only
 */
const requireSystemAdmin = requireRole(ROLES.SYSTEM_ADMIN);

/**
 * Require healthcare staff (doctor, nurse, lab tech, radiologist, pharmacist)
 */
const requireStaff = requireRole([
    ROLES.DOCTOR,
    ROLES.NURSE,
    ROLES.LAB_TECHNICIAN,
    ROLES.RADIOLOGIST,
    ROLES.PHARMACIST,
]);

/**
 * Check if user owns the resource
 * Compares req.user.id with req.params.userId or req.params.id
 */
const requireOwnership = (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                message: ERROR_MESSAGES.TOKEN_REQUIRED,
            });
        }

        const resourceUserId = req.params.userId || req.params.id;

        if (req.user.id !== resourceUserId) {
            // Allow admins to bypass ownership check
            if (req.user.roleName === ROLES.SYSTEM_ADMIN || req.user.roleName === ROLES.HOSPITAL_ADMIN) {
                return next();
            }

            logger.warn('Access denied - not resource owner:', {
                userId: req.user.id,
                resourceUserId,
                path: req.path,
            });

            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                message: ERROR_MESSAGES.ACCESS_DENIED,
            });
        }

        next();
    } catch (error) {
        logger.error('Ownership check middleware error:', error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: ERROR_MESSAGES.INTERNAL_ERROR,
        });
    }
};

module.exports = {
    requireRole,
    requirePermission,
    requirePatient,
    requireDoctor,
    requireAdmin,
    requireSystemAdmin,
    requireStaff,
    requireOwnership,
};
