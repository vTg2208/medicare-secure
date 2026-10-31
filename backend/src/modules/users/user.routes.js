const express = require('express');
const router = express.Router();
const userController = require('./user.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireAdmin, requireSystemAdmin, requireRole } = require('../../middleware/rbac.middleware');
const { auditLog } = require('../../middleware/audit.middleware');
const { asyncHandler } = require('../../middleware/error.middleware');
const { managedUser, managedMapping, adminContext } = require('../../middleware/clinical-access.middleware');

router.get('/consent-recipients', authenticate, requireRole('patient'), asyncHandler(async (req, res) => {
    const result = await require('../../config/db').query(`SELECT u.id, u.first_name AS "firstName",u.last_name AS "lastName",r.name AS role,
        COALESCE(d.specialization,r.name) AS specialization,
        COALESCE(string_agg(DISTINCT o.name,', '),'Independent recipient') AS organization
        FROM users u JOIN roles r ON r.id=u.role_id LEFT JOIN doctor_profiles d ON d.user_id=u.id
        LEFT JOIN staff_org_mapping s ON s.user_id=u.id AND s.status='active'
        LEFT JOIN organizations o ON o.id=s.organization_id AND o.status='active'
        WHERE u.status='active' AND u.is_verified=true AND COALESCE(u.account_status,'active')='active'
        AND r.name IN ('doctor','nurse','lab_technician','radiologist','pharmacist','insurance_provider','researcher')
        GROUP BY u.id,r.name,d.specialization ORDER BY u.first_name,u.last_name,u.id LIMIT 500`);
    res.json({ success: true, data: result.rows });
}));

/**
 * @route   GET /api/users/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get(
    '/profile',
    authenticate,
    asyncHandler(userController.getUserProfile)
);

/**
 * @route   PUT /api/users/profile
 * @desc    Update current user profile
 * @access  Private
 */
router.put(
    '/profile',
    authenticate,
    asyncHandler(userController.updateUserProfile)
);

/**
 * @route   GET /api/users/doctors
 * @desc    Get all active doctors (for consent management)
 * @access  Private
 */
router.get(
    '/doctors',
    authenticate,
    asyncHandler(userController.getDoctors)
);

/**
 * @route   GET /api/users/nurses
 * @desc    Get all active nurses
 * @access  Private
 */
router.get(
    '/nurses',
    authenticate,
    asyncHandler(userController.getNurses)
);

/**
 * @route   POST /api/users/staff/onboard
 * @desc    Onboard new staff member
 * @access  Private (Admin only)
 */
router.post(
    '/staff/onboard',
    authenticate,
    requireAdmin,
    auditLog('staff_onboard', 'user'),
    asyncHandler(userController.onboardStaff)
);

/**
 * @route   PUT /api/users/staff/deactivate
 * @desc    Deactivate staff member
 * @access  Private (Admin only)
 */
router.put(
    '/staff/deactivate',
    authenticate,
    requireAdmin,
    managedUser(req => req.body.userId),
    auditLog('staff_deactivate', 'user'),
    asyncHandler(userController.deactivateStaff)
);

/**
 * @route   PUT /api/users/staff/verify-license
 * @desc    Verify staff professional license
 * @access  Private (Admin only)
 */
router.put(
    '/staff/verify-license',
    authenticate,
    requireAdmin,
    managedMapping,
    auditLog('license_verify', 'staff_mapping'),
    asyncHandler(userController.verifyLicense)
);

/**
 * @route   GET /api/users
 * @desc    Get all users
 * @access  Private (System Admin only)
 */
router.get(
    '/',
    authenticate,
    requireAdmin,
    adminContext,
    asyncHandler(userController.getUsers)
);

module.exports = router;
