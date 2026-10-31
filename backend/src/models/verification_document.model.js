const db = require('../config/db');

/**
 * Verification Document Model
 * Handles doctor license and qualification document uploads for verification
 */
class VerificationDocument {
    /**
     * Create a new verification document record
     */
    static async create({ userId, documentType, filePath, fileName, fileSize, mimeType, expiresAt = null }, client = null) {
        const query = `
            INSERT INTO verification_documents (
                user_id, document_type, file_path, file_name, file_size, mime_type, expires_at, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
            RETURNING *;
        `;

        const values = [userId, documentType, filePath, fileName, fileSize, mimeType, expiresAt];
        const result = await (client || db).query(query, values);
        return result.rows[0];
    }

    /**
     * Get all documents for a user
     */
    static async getByUserId(userId) {
        const query = `
            SELECT vd.*, 
                   u.first_name || ' ' || u.last_name as reviewer_name
            FROM verification_documents vd
            LEFT JOIN users u ON vd.reviewed_by = u.id
            WHERE vd.user_id = $1
            ORDER BY vd.created_at DESC;
        `;

        const result = await db.query(query, [userId]);
        return result.rows;
    }

    /**
     * Get a specific document by ID
     */
    static async getById(id) {
        const query = `
            SELECT vd.*, 
                   u.first_name || ' ' || u.last_name as reviewer_name
            FROM verification_documents vd
            LEFT JOIN users u ON vd.reviewed_by = u.id
            WHERE vd.id = $1;
        `;

        const result = await db.query(query, [id]);
        return result.rows[0];
    }

    /**
     * Get all pending verification documents (for admin)
     */
    static async getPending() {
        const query = `
            SELECT vd.*, 
                   u.first_name || ' ' || u.last_name as user_name,
                   u.email as user_email,
                   r.name as user_role
            FROM verification_documents vd
            JOIN users u ON vd.user_id = u.id
            JOIN roles r ON u.role_id = r.id
            WHERE vd.status = 'pending'
            ORDER BY vd.created_at ASC;
        `;

        const result = await db.query(query);
        return result.rows;
    }

    /**
     * Approve a verification document
     */
    static async approve(id, reviewedBy, reviewNotes = null) {
        const query = `
            UPDATE verification_documents
            SET status = 'approved',
                reviewed_by = $2,
                reviewed_at = CURRENT_TIMESTAMP,
                review_notes = $3
            WHERE id = $1
            RETURNING *;
        `;

        const result = await db.query(query, [id, reviewedBy, reviewNotes]);
        return result.rows[0];
    }

    /**
     * Reject a verification document
     */
    static async reject(id, reviewedBy, rejectionReason) {
        const query = `
            UPDATE verification_documents
            SET status = 'rejected',
                reviewed_by = $2,
                reviewed_at = CURRENT_TIMESTAMP,
                rejection_reason = $3
            WHERE id = $1
            RETURNING *;
        `;

        const result = await db.query(query, [id, reviewedBy, rejectionReason]);
        return result.rows[0];
    }

    /**
     * Check if user has approved documents of a specific type
     */
    static async hasApprovedDocument(userId, documentType) {
        const query = `
            SELECT COUNT(*) as count
            FROM verification_documents
            WHERE user_id = $1 
            AND document_type = $2 
            AND status = 'approved';
        `;

        const result = await db.query(query, [userId, documentType]);
        return parseInt(result.rows[0].count) > 0;
    }

    /**
     * Delete a document (soft delete by updating status)
     */
    static async delete(id) {
        const query = `
            DELETE FROM verification_documents
            WHERE id = $1
            RETURNING *;
        `;

        const result = await db.query(query, [id]);
        return result.rows[0];
    }

    /**
     * Get document statistics for a user
     */
    static async getStats(userId) {
        const query = `
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'pending') as pending,
                COUNT(*) FILTER (WHERE status = 'approved') as approved,
                COUNT(*) FILTER (WHERE status = 'rejected') as rejected
            FROM verification_documents
            WHERE user_id = $1;
        `;

        const result = await db.query(query, [userId]);
        return result.rows[0];
    }
}

module.exports = VerificationDocument;
