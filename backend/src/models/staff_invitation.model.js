const db = require('../config/db');
const crypto = require('crypto');

/**
 * Staff Invitation Model
 * Manages email-based staff invitation workflow
 */
class StaffInvitation {
    /**
     * Create a new staff invitation
     */
    static async create({ email, role, organizationId, invitedBy, invitationMessage = null, expiresInDays = 7 }) {
        // Generate unique invitation token
        const token = crypto.randomBytes(32).toString('hex');

        // Calculate expiration date
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);

        const query = `
            INSERT INTO staff_invitations (
                email, role, organization_id, token, invited_by, invitation_message, expires_at, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
            RETURNING *;
        `;

        const values = [email, role, organizationId, token, invitedBy, invitationMessage, expiresAt];
        const result = await db.query(query, values);
        return result.rows[0];
    }

    /**
     * Get invitation by token
     */
    static async getByToken(token) {
        const query = `
            SELECT si.*, 
                   u.first_name || ' ' || u.last_name as inviter_name,
                   u.email as inviter_email
            FROM staff_invitations si
            JOIN users u ON si.invited_by = u.id
            WHERE si.token = $1;
        `;

        const result = await db.query(query, [token]);
        return result.rows[0];
    }

    /**
     * Get invitation by ID
     */
    static async getById(id) {
        const query = `
            SELECT si.*, 
                   u.first_name || ' ' || u.last_name as inviter_name
            FROM staff_invitations si
            JOIN users u ON si.invited_by = u.id
            WHERE si.id = $1;
        `;

        const result = await db.query(query, [id]);
        return result.rows[0];
    }

    /**
     * Get all invitations (with optional filters)
     */
    static async getAll({ status = null, invitedBy = null, organizationId = null, limit = 50, offset = 0 } = {}) {
        let query = `
            SELECT si.*, 
                   u.first_name || ' ' || u.last_name as inviter_name,
                   CASE 
                       WHEN si.accepted_by IS NOT NULL THEN au.first_name || ' ' || au.last_name
                       ELSE NULL
                   END as accepted_by_name
            FROM staff_invitations si
            JOIN users u ON si.invited_by = u.id
            LEFT JOIN users au ON si.accepted_by = au.id
            WHERE 1=1
        `;

        const values = [];
        let paramCount = 1;

        if (status) {
            query += ` AND si.status = $${paramCount}`;
            values.push(status);
            paramCount++;
        }

        if (invitedBy) {
            query += ` AND si.invited_by = $${paramCount}`;
            values.push(invitedBy);
            paramCount++;
        }

        if (organizationId) {
            query += ` AND si.organization_id = $${paramCount}`;
            values.push(organizationId);
            paramCount++;
        }

        query += ` ORDER BY si.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1};`;
        values.push(limit, offset);

        const result = await db.query(query, values);

        // Logically adjust status to EXPIRED if past due
        return result.rows.map(invitation => {
            if (invitation.status === 'pending' && new Date(invitation.expires_at) < new Date()) {
                return { ...invitation, status: 'EXPIRED' };
            }
            return invitation;
        });
    }

    /**
     * Validate invitation token
     */
    static async validate(token) {
        const invitation = await this.getByToken(token);

        if (!invitation) {
            return { valid: false, reason: 'Invalid token' };
        }

        if (invitation.status !== 'pending') {
            return { valid: false, reason: `Invitation already ${invitation.status}` };
        }

        if (new Date(invitation.expires_at) < new Date()) {
            // Mark as expired
            await this.markExpired(invitation.id);
            return { valid: false, reason: 'Invitation expired' };
        }

        return { valid: true, invitation };
    }

    /**
     * Accept invitation
     */
    static async accept(token, acceptedBy) {
        const query = `
            UPDATE staff_invitations
            SET status = 'accepted',
                accepted_by = $2,
                accepted_at = CURRENT_TIMESTAMP
            WHERE token = $1 AND status = 'pending'
            RETURNING *;
        `;

        const result = await db.query(query, [token, acceptedBy]);
        return result.rows[0];
    }

    /**
     * Cancel invitation
     */
    static async cancel(id, cancelledBy, cancellationReason = null) {
        const query = `
            UPDATE staff_invitations
            SET status = 'cancelled',
                cancelled_by = $2,
                cancelled_at = CURRENT_TIMESTAMP,
                cancellation_reason = $3
            WHERE id = $1 AND status = 'pending'
            RETURNING *;
        `;

        const result = await db.query(query, [id, cancelledBy, cancellationReason]);
        return result.rows[0];
    }

    /**
     * Mark invitation as expired
     */
    static async markExpired(id) {
        const query = `
            UPDATE staff_invitations
            SET status = 'expired'
            WHERE id = $1
            RETURNING *;
        `;

        const result = await db.query(query, [id]);
        return result.rows[0];
    }

    /**
     * Reset invitation for resend (new token, pending status, fresh expiry)
     */
    static async resetForResend(id, expiresInDays = 7) {
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);

        const query = `
            UPDATE staff_invitations
            SET token = $2,
                status = 'pending',
                expires_at = $3,
                cancelled_at = NULL,
                cancelled_by = NULL,
                cancellation_reason = NULL
            WHERE id = $1 AND status IN ('pending','expired') AND accepted_at IS NULL
            RETURNING *;
        `;

        const result = await db.query(query, [id, token, expiresAt]);
        return result.rows[0];
    }

    /**
     * Check if email already has pending invitation
     */
    static async hasPendingInvitation(email) {
        const query = `
            SELECT COUNT(*) as count
            FROM staff_invitations
            WHERE email = $1 
            AND status = 'pending'
            AND expires_at > CURRENT_TIMESTAMP;
        `;

        const result = await db.query(query, [email]);
        return parseInt(result.rows[0].count) > 0;
    }

    /**
     * Get invitation statistics
     */
    static async getStats(filters = {}) {
        const { invitedBy, organizationId } = filters;

        let query = `
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'pending' AND expires_at > CURRENT_TIMESTAMP) as pending,
                COUNT(*) FILTER (WHERE status = 'accepted') as accepted,
                COUNT(*) FILTER (WHERE status = 'expired' OR (status = 'pending' AND expires_at <= CURRENT_TIMESTAMP)) as expired,
                COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
            FROM staff_invitations
            WHERE 1=1
        `;

        const values = [];
        let paramCount = 1;

        if (invitedBy) {
            query += ` AND invited_by = $${paramCount}`;
            values.push(invitedBy);
            paramCount++;
        }

        if (organizationId) {
            query += ` AND organization_id = $${paramCount}`;
            values.push(organizationId);
            paramCount++;
        }

        const result = await db.query(query, values);
        return result.rows[0];
    }

    /**
     * Clean up expired invitations (mark as expired)
     */
    static async cleanupExpired() {
        const query = `
            UPDATE staff_invitations
            SET status = 'expired'
            WHERE status = 'pending' 
            AND expires_at < CURRENT_TIMESTAMP
            RETURNING id;
        `;

        const result = await db.query(query);
        return result.rows.length;
    }
}

module.exports = StaffInvitation;
