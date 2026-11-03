const {
    findUserById,
    getAllUsers,
    countAllUsers,
    updateUserStatus,
    createUser,
    userExists,
    updateUserProfile: updateUserProfileModel
} = require('../../models/user.model');
const { createStaffMapping, deactivateStaffMapping, verifyStaffLicense, getUserStaffMappings } = require('../../models/staffOrgMapping.model');
const { findOrganizationById } = require('../../models/organization.model');
const { getRoleByName } = require('../../models/role.model');
const { generateAndSendOTP } = require('../../services/otp.service');
const { createAuditLog } = require('../../services/audit.service');
const { HTTP_STATUS, SUCCESS_MESSAGES, ERROR_MESSAGES, AUDIT_ACTIONS, OTP_PURPOSE, STAFF_STATUS } = require('../../utils/constants');
const { isValidEmail, validatePassword, validateRequiredFields } = require('../../utils/validators');
const logger = require('../../utils/logger');
const { query } = require('../../config/db');
const { staffRoleAllowed, canManageOrganization } = require('../../middleware/clinical-access.middleware');
const { pagination } = require('../../utils/pagination');

/**
 * Onboard staff member
 * POST /api/users/staff/onboard
 */
const onboardStaff = async (req, res, next) => {
    req.body.role = req.body.role || req.body.roleName;
    return require('../staff/staff.controller').inviteStaff(req,res,next);
};

/**
 * Deactivate staff member
 * PUT /api/users/staff/deactivate
 */
const deactivateStaff = async (req, res) => {
    try {
        const { userId, organizationId } = req.body;

        if (!userId || !organizationId) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: 'User ID and Organization ID are required',
            });
        }

        if (!await canManageOrganization(req.user, organizationId)) return res.status(403).json({ success: false, message: 'Organization access denied' });
        // Deactivate staff mapping
        const result = await deactivateStaffMapping(userId, organizationId);

        if (!result) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                message: 'Staff mapping not found',
            });
        }

        // Audit log
        await createAuditLog({
            userId: req.user.id,
            action: AUDIT_ACTIONS.STAFF_DEACTIVATE,
            entityType: 'user',
            entityId: userId,
            purpose: 'Staff deactivation',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            requestMethod: req.method,
            requestPath: req.path,
            statusCode: HTTP_STATUS.OK,
            metadata: { organizationId },
        });

        logger.info('Staff member deactivated:', { userId, organizationId });

        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: SUCCESS_MESSAGES.STAFF_DEACTIVATED,
        });
    } catch (error) {
        logger.error('Staff deactivation failed:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: ERROR_MESSAGES.INTERNAL_ERROR,
        });
    }
};

/**
 * Verify staff professional license
 * PUT /api/users/staff/verify-license
 */
const verifyLicense = async (req, res) => {
    try {
        const { mappingId } = req.body;

        if (!mappingId) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: 'Mapping ID is required',
            });
        }

        const result = await verifyStaffLicense(mappingId);

        if (!result) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                message: 'Staff mapping not found',
            });
        }

        logger.info('Staff license verified:', { mappingId });

        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Professional license verified successfully',
            data: result,
        });
    } catch (error) {
        logger.error('License verification failed:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: ERROR_MESSAGES.INTERNAL_ERROR,
        });
    }
};

/**
 * Get user profile
 * GET /api/users/profile
 */
const getUserProfile = async (req, res) => {
    try {
        const userId = req.user.id;

        const user = await findUserById(userId);

        if (!user) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                message: ERROR_MESSAGES.USER_NOT_FOUND,
            });
        }

        // Get staff mappings if applicable - safely
        let staffMappings = [];
        try {
            staffMappings = await getUserStaffMappings(userId);
        } catch (err) {
            logger.warn(`Failed to fetch staff mappings for user ${userId}:`, err);
        }

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    phone: user.phone,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    role: user.role_name,
                    isVerified: user.is_verified,
                    status: user.status,
                    createdAt: user.created_at,
                },
                staffMappings,
            },
        });
    } catch (error) {
        logger.error('Get user profile failed:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: ERROR_MESSAGES.INTERNAL_ERROR,
        });
    }
};

/**
 * Get all users (admin only)
 * GET /api/users
 */
const getUsers = async (req, res) => {
    try {
        const { role, status, search } = req.query;
        const { limit, offset } = pagination(req.query);
        let organizationId = null;

        // If not system admin, restrict to own organization
        if (req.user.roleName !== 'system_admin') organizationId = req.organizationId;

        const options = { limit, offset, role, status, search, organizationId };
        const [result, total] = await Promise.all([getAllUsers(options), countAllUsers(options)]);

        // Map users to match frontend expectations
        const mappedUsers = result.map(user => ({
            ...user,
            role: user.role_name,
            is_active: user.status === 'active'
        }));

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: mappedUsers,
            pagination: { total, limit, offset },
        });
    } catch (error) {
        logger.error('Get users failed:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: ERROR_MESSAGES.INTERNAL_ERROR,
        });
    }
};

/**
 * Get all doctors (for consent management)
 * GET /api/users/doctors
 */
const getDoctors = async (req, res) => {
    try {
        const { limit, offset } = req.query;

        const doctorsQuery = `
      SELECT u.id, u.email, u.phone, u.created_at,
             u.first_name as "firstName",
             u.last_name as "lastName",
             COALESCE(dp.specialization, 'General Practice') as specialization,
             som.professional_license, som.organization_id, o.name as organization_name
      FROM users u
      INNER JOIN roles r ON u.role_id = r.id
      LEFT JOIN staff_org_mapping som ON u.id = som.user_id AND som.status = 'active'
      LEFT JOIN organizations o ON som.organization_id = o.id
      LEFT JOIN doctor_profiles dp ON u.id = dp.user_id
      WHERE r.name = 'doctor' AND u.status = 'active' AND u.is_verified = true
      ORDER BY u.created_at DESC
      LIMIT $1 OFFSET $2
    `;

        const result = await query(doctorsQuery, [
            parseInt(limit) || 50,
            parseInt(offset) || 0,
        ]);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: result.rows,
        });
    } catch (error) {
        logger.error('Get doctors failed:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: ERROR_MESSAGES.INTERNAL_ERROR,
        });
    }
};

/**
 * Get all nurses (for visit management)
 * GET /api/users/nurses
 */
const getNurses = async (req, res) => {
    try {
        const { limit, offset } = req.query;

        const nursesQuery = `
      SELECT u.id, u.email, u.phone, u.created_at,
             u.first_name as "firstName",
             u.last_name as "lastName",
             som.professional_license, som.organization_id, o.name as organization_name
      FROM users u
      INNER JOIN roles r ON u.role_id = r.id
      LEFT JOIN staff_org_mapping som ON u.id = som.user_id AND som.status = 'active'
      LEFT JOIN organizations o ON som.organization_id = o.id
      WHERE r.name = 'nurse' AND u.status = 'active' AND u.is_verified = true
      ORDER BY u.created_at DESC
      LIMIT $1 OFFSET $2
    `;

        const result = await query(nursesQuery, [
            parseInt(limit) || 50,
            parseInt(offset) || 0,
        ]);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: result.rows,
        });
    } catch (error) {
        logger.error('Get nurses failed:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: ERROR_MESSAGES.INTERNAL_ERROR,
        });
    }
};

/**
 * Update user profile
 * PUT /api/users/profile
 */
const updateUserProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { firstName, lastName, phone } = req.body;

        // Simple validation
        if (!firstName && !lastName && !phone) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: 'At least one field (First Name, Last Name, or Phone) must be provided for update',
            });
        }

        const updatedUser = await updateUserProfileModel(userId, { firstName, lastName, phone });

        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Profile updated successfully',
            data: updatedUser,
        });
    } catch (error) {
        logger.error('Update user profile failed:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: ERROR_MESSAGES.INTERNAL_ERROR,
        });
    }
};

module.exports = {
    onboardStaff,
    deactivateStaff,
    verifyLicense,
    getUserProfile,
    getUsers,
    getDoctors,
    getNurses,
    updateUserProfile,
};
