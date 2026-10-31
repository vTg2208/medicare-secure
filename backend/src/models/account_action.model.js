const db = require('../config/db');

/**
 * Account Action Model
 * Audit trail for all account management actions
 */
class AccountAction {
    /**
     * Log an account action
     */
    static async log({ userId, actionType, actionBy, reason = null, notes = null, metadata = null }) {
        const query = `
            INSERT INTO account_actions (
                user_id, action_type, action_by, reason, notes, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *;
        `;

        const values = [userId, actionType, actionBy, reason, notes, metadata ? JSON.stringify(metadata) : null];
        const result = await db.query(query, values);
        return result.rows[0];
    }

    /**
     * Get all actions for a user
     */
    static async getByUserId(userId, limit = 50) {
        const query = `
            SELECT aa.*, 
                   u.first_name || ' ' || u.last_name as performed_by_name,
                   u.email as performed_by_email
            FROM account_actions aa
            JOIN users u ON aa.action_by = u.id
            WHERE aa.user_id = $1
            ORDER BY aa.created_at DESC
            LIMIT $2;
        `;

        const result = await db.query(query, [userId, limit]);
        return result.rows;
    }

    /**
     * Get all actions of a specific type
     */
    static async getByType(actionType, limit = 100) {
        const query = `
            SELECT aa.*, 
                   u.first_name || ' ' || u.last_name as user_name,
                   au.first_name || ' ' || au.last_name as performed_by_name
            FROM account_actions aa
            JOIN users u ON aa.user_id = u.id
            JOIN users au ON aa.action_by = au.id
            WHERE aa.action_type = $1
            ORDER BY aa.created_at DESC
            LIMIT $2;
        `;

        const result = await db.query(query, [actionType, limit]);
        return result.rows;
    }

    /**
     * Get recent actions (for admin dashboard)
     */
    static async getRecent(limit = 50, organizationId = null) {
        const query = `
            SELECT aa.*, 
                   u.first_name || ' ' || u.last_name as user_name,
                   u.email as user_email,
                   au.first_name || ' ' || au.last_name as performed_by_name
            FROM account_actions aa
            JOIN users u ON aa.user_id = u.id
            JOIN users au ON aa.action_by = au.id
            WHERE ($2::uuid IS NULL OR EXISTS (SELECT 1 FROM staff_org_mapping som WHERE som.user_id=aa.user_id AND som.organization_id=$2))
            ORDER BY aa.created_at DESC
            LIMIT $1;
        `;

        const result = await db.query(query, [limit, organizationId]);
        return result.rows;
    }

    /**
     * Get action statistics
     */
    static async getStats(startDate = null, endDate = null) {
        let query = `
            SELECT 
                action_type,
                COUNT(*) as count
            FROM account_actions
            WHERE 1=1
        `;

        const values = [];
        let paramCount = 1;

        if (startDate) {
            query += ` AND created_at >= $${paramCount}`;
            values.push(startDate);
            paramCount++;
        }

        if (endDate) {
            query += ` AND created_at <= $${paramCount}`;
            values.push(endDate);
            paramCount++;
        }

        query += ` GROUP BY action_type ORDER BY count DESC;`;

        const result = await db.query(query, values);
        return result.rows;
    }
}

module.exports = AccountAction;
