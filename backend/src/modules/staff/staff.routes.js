const express = require('express');
const router = express.Router();
const StaffController = require('./staff.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireAdmin } = require('../../middleware/rbac.middleware');
const { registrationLimiter } = require('../../middleware/rateLimit.middleware');
const { adminContext, managedInvitation, managedUser } = require('../../middleware/clinical-access.middleware');

/**
 * Staff Management Routes
 * Base path: /api/staff
 */

// ============================================================================
// Invitation Management (Admin only)
// ============================================================================

router.post(
    '/invite',
    authenticate,
    requireAdmin,
    adminContext,
    StaffController.inviteStaff
);

router.get(
    '/check-email',
    authenticate,
    requireAdmin,
    adminContext,
    StaffController.checkEmail
);

router.get(
    '/invitations',
    authenticate,
    requireAdmin,
    adminContext,
    StaffController.getInvitations
);

router.post(
    '/invitations/:id/resend',
    authenticate,
    requireAdmin,
    adminContext,
    managedInvitation,
    StaffController.resendInvitation
);

router.delete(
    '/invitations/:id',
    authenticate,
    requireAdmin,
    adminContext,
    managedInvitation,
    StaffController.cancelInvitation
);

router.get(
    '/invitations/stats',
    authenticate,
    requireAdmin,
    adminContext,
    StaffController.getInvitationStats
);

// ============================================================================
// Public Invitation Endpoints (No authentication required)
// ============================================================================

router.get(
    '/invitations/:token/validate',
    StaffController.validateInvitation
);

router.post(
    '/invitations/:token/accept',
    registrationLimiter,
    StaffController.acceptInvitation
);

// ============================================================================
// Account Management (Admin only)
// ============================================================================

router.post(
    '/accounts/:userId/suspend',
    authenticate,
    requireAdmin,
    adminContext,
    managedUser(),
    StaffController.suspendAccount
);

router.post(
    '/accounts/:userId/activate',
    authenticate,
    requireAdmin,
    adminContext,
    managedUser(),
    StaffController.activateAccount
);

router.get(
    '/accounts/suspended',
    authenticate,
    requireAdmin,
    adminContext,
    StaffController.getSuspendedAccounts
);

router.get(
    '/accounts/:userId/status',
    authenticate,
    requireAdmin,
    adminContext,
    managedUser(),
    StaffController.getAccountStatus
);

router.get(
    '/accounts/stats',
    authenticate,
    requireAdmin,
    adminContext,
    StaffController.getAccountStats
);

router.get(
    '/accounts/:userId/history',
    authenticate,
    requireAdmin,
    adminContext,
    managedUser(),
    StaffController.getAccountHistory
);

// ============================================================================
// Audit Trail (Admin only)
// ============================================================================

router.get(
    '/actions/recent',
    authenticate,
    requireAdmin,
    adminContext,
    StaffController.getRecentActions
);

module.exports = router;
