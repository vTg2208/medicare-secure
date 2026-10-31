const StaffInvitationService = require('../../services/staff.invitation.service');
const AccountManagementService = require('../../services/account.management.service');
const asyncHandler = require('../../utils/asyncHandler');
const { staffRoleAllowed, canManageOrganization } = require('../../middleware/clinical-access.middleware');


/**
 * Staff Management Controller
 * Handles staff invitations and account management
 */
class StaffController {
    /**
     * Invite staff member
     * POST /api/staff/invite
     */
    static inviteStaff = asyncHandler(async (req, res) => {
        const { email, role, invitationMessage, organizationId } = req.body;

        if (!email || !role) {
            return res.status(400).json({
                success: false,
                message: 'Email and role are required'
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email address format'
            });
        }

        // Handle Organization ID
        let targetOrgId = organizationId;
        const db = require('../../config/db'); // Import db for query

        if (!targetOrgId) {
            // First, check if requester is an admin of an organization
            const adminOrg = await db.query(
                'SELECT id FROM organizations WHERE admin_user_id = $1 LIMIT 1',
                [req.user.id]
            );

            if (adminOrg.rows.length > 0) {
                targetOrgId = adminOrg.rows[0].id;
            } else {
                // Otherwise try to get from requester's staff mapping
                const requesterOrg = await db.query(
                    'SELECT organization_id FROM staff_org_mapping WHERE user_id = $1 AND status = \'active\' LIMIT 1',
                    [req.user.id]
                );

                if (requesterOrg.rows.length > 0) {
                    targetOrgId = requesterOrg.rows[0].organization_id;
                } else {
                    return res.status(400).json({
                        success: false,
                        message: 'Organization ID is required (could not be inferred from your account)'
                    });
                }
            }
        }

        const inviterName = `${req.user.firstName} ${req.user.lastName}`;

        // Map common role names to database roles
        const roleMap = {
            'ADMIN': 'hospital_admin',
            'HOSPITAL_ADMIN': 'hospital_admin',
            'DOCTOR': 'doctor',
            'NURSE': 'nurse',
            'LAB_TECHNICIAN': 'lab_technician',
            'RADIOLOGIST': 'radiologist',
            'PHARMACIST': 'pharmacist',
            'RECEPTIONIST': 'receptionist'
        };

        const targetRole = roleMap[String(role).toUpperCase()] || String(role).toLowerCase();
        if (!staffRoleAllowed(req.user.roleName, targetRole) || !await canManageOrganization(req.user, targetOrgId)) {
            return res.status(403).json({ success: false, message: 'Role or organization is outside your administrative scope' });
        }

        try {
            const invitation = await StaffInvitationService.inviteStaff({
                email,
                role: targetRole,
                organizationId: targetOrgId,
                invitedBy: req.user.id,
                actorRole: req.user.roleName,
                invitationMessage,
                inviterName
            });

            res.status(201).json({
                success: true,
                message: invitation.deliveryStatus === 'failed' ? 'Invitation created; email delivery failed. Use the invitation link or retry sending.' : 'Invitation sent successfully',
                data: invitation
            });
        } catch (error) {
            if (error.message.includes('already has a pending invitation') ||
                error.message.includes('A user with this email already exists')) {
                return res.status(409).json({
                    success: false,
                    message: error.message
                });
            }
            if (error.message.includes('Invalid role')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }
            throw error;
        }
    });

    /**
     * Check if email exists
     * GET /api/staff/check-email?email=test@example.com
     */
    static checkEmail = asyncHandler(async (req, res) => {
        const { email } = req.query;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.json({ success: true, exists: false, error: 'Invalid email format' });
        }

        const db = require('../../config/db');

        // Check users
        const userCheck = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length > 0) {
            return res.json({ success: true, exists: true, message: 'A user with this email already exists' });
        }

        // Check pending invitations
        const invCheck = await db.query(`
            SELECT id FROM staff_invitations 
            WHERE email = $1 AND status = 'pending' AND expires_at > CURRENT_TIMESTAMP
        `, [email]);

        if (invCheck.rows.length > 0) {
            return res.json({ success: true, exists: true, message: 'A pending invitation already exists for this email' });
        }

        return res.json({ success: true, exists: false });
    });

    /**
     * Get all invitations
     * GET /api/staff/invitations
     */
    static getInvitations = asyncHandler(async (req, res) => {
        const { status, limit = 50, offset = 0 } = req.query;
        const db = require('../../config/db');

        // Identify organization ID for the requester
        const orgQuery = `
            SELECT id FROM organizations WHERE admin_user_id = $1
            UNION
            SELECT organization_id as id FROM staff_org_mapping WHERE user_id = $1
            LIMIT 1
        `;
        const orgResult = await db.query(orgQuery, [req.user.id]);
        const organizationId = req.organizationId || null;

        const invitations = await StaffInvitationService.getInvitations({
            status,
            organizationId,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            count: invitations.length,
            data: invitations
        });
    });

    /**
     * Validate invitation token
     * GET /api/staff/invitations/:token/validate
     */
    static validateInvitation = asyncHandler(async (req, res) => {
        const { token } = req.params;

        const validation = await StaffInvitationService.validateInvitation(token);

        res.json({
            success: validation.valid,
            message: validation.valid ? 'Invitation is valid' : validation.reason,
            data: validation.invitation || null
        });
    });

    /**
     * Accept invitation
     * POST /api/staff/invitations/:token/accept
     */
    static acceptInvitation = asyncHandler(async (req, res) => {
        const { token } = req.params;
        const { firstName, lastName, password } = req.body;

        if (!firstName || !lastName || !password) {
            return res.status(400).json({
                success: false,
                message: 'First name, last name, and password are required'
            });
        }

        const validation = require('../../utils/validators').validatePassword(password);
        if (!validation.isValid) return res.status(400).json({ success: false, message: 'Password does not meet requirements', errors: validation.errors });
        // Pass plain password to service - it handles hashing internally
        const user = await StaffInvitationService.acceptInvitation(token, {
            firstName,
            lastName,
            password
        });

        // Remove password from response
        delete user.password;

        res.status(201).json({
            success: true,
            message: 'Invitation accepted successfully. You can now login.',
            data: user
        });
    });

    /**
     * Resend invitation
     * POST /api/staff/invitations/:id/resend
     */
    static resendInvitation = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const inviterName = `${req.user.firstName} ${req.user.lastName}`;

        const invitation = await StaffInvitationService.resendInvitation(id, inviterName);

        res.json({
            success: true,
            message: 'Invitation resent successfully',
            data: invitation
        });
    });

    /**
     * Cancel invitation
     * DELETE /api/staff/invitations/:id
     */
    static cancelInvitation = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { reason } = req.body;

        const invitation = await StaffInvitationService.cancelInvitation(
            id,
            req.user.id,
            reason
        );

        res.json({
            success: true,
            message: 'Invitation cancelled successfully',
            data: invitation
        });
    });

    /**
     * Get invitation statistics
     * GET /api/staff/invitations/stats
     */
    static getInvitationStats = asyncHandler(async (req, res) => {
        const db = require('../../config/db');

        // Identify organization ID for the requester
        const orgQuery = `
            SELECT id FROM organizations WHERE admin_user_id = $1
            UNION
            SELECT organization_id as id FROM staff_org_mapping WHERE user_id = $1
            LIMIT 1
        `;
        const orgResult = await db.query(orgQuery, [req.user.id]);
        const organizationId = req.organizationId || null;

        const stats = await StaffInvitationService.getStats({ organizationId });

        res.json({
            success: true,
            data: stats
        });
    });

    /**
     * Suspend user account
     * POST /api/staff/accounts/:userId/suspend
     */
    static suspendAccount = asyncHandler(async (req, res) => {
        const { userId } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({
                success: false,
                message: 'Suspension reason is required'
            });
        }

        const user = await AccountManagementService.suspendAccount(
            userId,
            req.user.id,
            reason
        );

        res.json({
            success: true,
            message: 'Account suspended successfully',
            data: user
        });
    });

    /**
     * Activate user account
     * POST /api/staff/accounts/:userId/activate
     */
    static activateAccount = asyncHandler(async (req, res) => {
        const { userId } = req.params;
        const { notes } = req.body;

        const user = await AccountManagementService.activateAccount(
            userId,
            req.user.id,
            notes
        );

        res.json({
            success: true,
            message: 'Account activated successfully',
            data: user
        });
    });

    /**
     * Get suspended accounts
     * GET /api/staff/accounts/suspended
     */
    static getSuspendedAccounts = asyncHandler(async (req, res) => {
        const accounts = await AccountManagementService.getSuspendedAccounts(req.organizationId);

        res.json({
            success: true,
            count: accounts.length,
            data: accounts
        });
    });

    /**
     * Get account status
     * GET /api/staff/accounts/:userId/status
     */
    static getAccountStatus = asyncHandler(async (req, res) => {
        const { userId } = req.params;

        const status = await AccountManagementService.getAccountStatus(userId);

        res.json({
            success: true,
            data: status
        });
    });

    /**
     * Get account statistics
     * GET /api/staff/accounts/stats
     */
    static getAccountStats = asyncHandler(async (req, res) => {
        const stats = await AccountManagementService.getStats(req.organizationId);

        res.json({
            success: true,
            data: stats
        });
    });

    /**
     * Get recent account actions
     * GET /api/staff/actions/recent
     */
    static getRecentActions = asyncHandler(async (req, res) => {
        const { limit = 50 } = req.query;

        const actions = await AccountManagementService.getRecentActions(parseInt(limit), req.organizationId);

        res.json({
            success: true,
            count: actions.length,
            data: actions
        });
    });

    /**
     * Get account history
     * GET /api/staff/accounts/:userId/history
     */
    static getAccountHistory = asyncHandler(async (req, res) => {
        const { userId } = req.params;
        const { limit = 50 } = req.query;

        const history = await AccountManagementService.getAccountHistory(
            userId,
            parseInt(limit)
        );

        res.json({
            success: true,
            count: history.length,
            data: history
        });
    });
}

module.exports = StaffController;
