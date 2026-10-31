const AccountAction = require('../models/account_action.model');
const db = require('../config/db');
const logger = require('../utils/logger');

/**
 * Account Management Service
 * Handles account suspension, activation, and status management
 */
class AccountManagementService {
    /**
     * Suspend a user account
     */
    static async suspendAccount(userId, suspendedBy, reason) {
        try {
            if (!reason) {
                throw new Error('Suspension reason is required');
            }

            // Check if user exists
            const userCheck = await db.query('SELECT id, account_status FROM users WHERE id = $1', [userId]);
            if (userCheck.rows.length === 0) {
                throw new Error('User not found');
            }

            if (userCheck.rows[0].account_status === 'suspended') {
                throw new Error('Account is already suspended');
            }

            // Suspend the account
            const query = `
                UPDATE users
                SET account_status = 'suspended',
                    suspended_at = CURRENT_TIMESTAMP,
                    suspended_by = $2,
                    suspension_reason = $3
                WHERE id = $1
                RETURNING id, email, first_name, last_name, account_status;
            `;

            const result = await db.query(query, [userId, suspendedBy, reason]);

            // Log the action
            await AccountAction.log({
                userId,
                actionType: 'suspend',
                actionBy: suspendedBy,
                reason,
                notes: 'Account suspended'
            });

            await db.query('UPDATE sessions SET is_active = false WHERE user_id = $1', [userId]);

            logger.info(`Account ${userId} suspended by ${suspendedBy}`);
            return result.rows[0];
        } catch (error) {
            logger.error('Error suspending account:', error);
            throw error;
        }
    }

    /**
     * Activate a suspended account
     */
    static async activateAccount(userId, activatedBy, notes = null) {
        try {
            // Check if user exists
            const userCheck = await db.query('SELECT id, account_status FROM users WHERE id = $1', [userId]);
            if (userCheck.rows.length === 0) {
                throw new Error('User not found');
            }

            if (userCheck.rows[0].account_status !== 'suspended') {
                throw new Error('Account is not suspended');
            }

            // Activate the account
            const query = `
                UPDATE users
                SET account_status = 'active',
                    suspended_at = NULL,
                    suspended_by = NULL,
                    suspension_reason = NULL
                WHERE id = $1
                RETURNING id, email, first_name, last_name, account_status;
            `;

            const result = await db.query(query, [userId]);

            // Log the action
            await AccountAction.log({
                userId,
                actionType: 'activate',
                actionBy: activatedBy,
                notes: notes || 'Account activated',
                metadata: { previousStatus: 'suspended' }
            });

            logger.info(`Account ${userId} activated by ${activatedBy}`);
            return result.rows[0];
        } catch (error) {
            logger.error('Error activating account:', error);
            throw error;
        }
    }

    /**
     * Get all suspended accounts
     */
    static async getSuspendedAccounts(organizationId = null) {
        try {
            const query = `
                SELECT u.id, u.email, u.first_name, u.last_name, r.name AS role,
                       u.suspended_at, u.suspension_reason,
                       su.first_name || ' ' || su.last_name as suspended_by_name
                FROM users u JOIN roles r ON r.id=u.role_id
                LEFT JOIN users su ON u.suspended_by = su.id
                WHERE u.account_status = 'suspended' AND ($1::uuid IS NULL OR EXISTS (SELECT 1 FROM staff_org_mapping som WHERE som.user_id=u.id AND som.organization_id=$1))
                ORDER BY u.suspended_at DESC;
            `;

            const result = await db.query(query, [organizationId]);
            return result.rows;
        } catch (error) {
            logger.error('Error getting suspended accounts:', error);
            throw error;
        }
    }

    /**
     * Get account status and details
     */
    static async getAccountStatus(userId) {
        try {
            const query = `
                SELECT u.id, u.email, u.first_name, u.last_name, r.name as role,
                       u.status, u.is_verified, u.created_at
                FROM users u
                JOIN roles r ON u.role_id = r.id
                WHERE u.id = $1;
            `;

            const result = await db.query(query, [userId]);

            if (result.rows.length === 0) {
                throw new Error('User not found');
            }

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting account status:', error);
            throw error;
        }
    }

    /**
     * Check if account is active and can login
     */
    static async canLogin(userId) {
        try {
            const query = `
                SELECT account_status, verification_status
                FROM users
                WHERE id = $1;
            `;

            const result = await db.query(query, [userId]);

            if (result.rows.length === 0) {
                return { canLogin: false, reason: 'User not found' };
            }

            const user = result.rows[0];

            if (user.account_status === 'suspended') {
                return { canLogin: false, reason: 'Account is suspended' };
            }

            if (user.account_status === 'pending_verification') {
                return { canLogin: false, reason: 'Account pending verification' };
            }

            return { canLogin: true };
        } catch (error) {
            logger.error('Error checking login permission:', error);
            throw error;
        }
    }

    /**
     * Get account statistics (for admin dashboard)
     */
    static async getStats(organizationId = null) {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_accounts,
                    COUNT(*) FILTER (WHERE account_status = 'active') as active,
                    COUNT(*) FILTER (WHERE account_status = 'suspended') as suspended,
                    COUNT(*) FILTER (WHERE account_status = 'pending_verification') as pending_verification,
                    COUNT(*) FILTER (WHERE verification_status = 'verified') as verified,
                    COUNT(*) FILTER (WHERE verification_status = 'pending') as verification_pending
                FROM users u WHERE ($1::uuid IS NULL OR EXISTS (SELECT 1 FROM staff_org_mapping som WHERE som.user_id=u.id AND som.organization_id=$1));
            `;

            const result = await db.query(query, [organizationId]);
            return result.rows[0];
        } catch (error) {
            logger.error('Error getting account stats:', error);
            throw error;
        }
    }

    /**
     * Get recent account actions (for audit)
     */
    static async getRecentActions(limit = 50, organizationId = null) {
        try {
            return await AccountAction.getRecent(limit, organizationId);
        } catch (error) {
            logger.error('Error getting recent actions:', error);
            throw error;
        }
    }

    /**
     * Get account action history for a specific user
     */
    static async getAccountHistory(userId, limit = 50) {
        try {
            return await AccountAction.getByUserId(userId, limit);
        } catch (error) {
            logger.error('Error getting account history:', error);
            throw error;
        }
    }
}

module.exports = AccountManagementService;
