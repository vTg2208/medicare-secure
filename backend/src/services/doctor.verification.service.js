const VerificationDocument = require('../models/verification_document.model');
const AccountAction = require('../models/account_action.model');
const db = require('../config/db');
const { sendDoctorAcceptanceEmail } = require('../config/mail');
const logger = require('../utils/logger');

/**
 * Doctor Verification Service
 * Handles doctor license verification workflow
 */
class DoctorVerificationService {
    /**
     * Upload license document for a doctor
     */
    static async uploadLicenseDocument(userId, fileData) {
        try {
            await require('./credential-file.service').secureCredential({ path: fileData.path, mimetype: fileData.mimetype });
            const document = await VerificationDocument.create({
                userId,
                documentType: fileData.documentType || 'medical_license',
                filePath: fileData.path,
                fileName: fileData.filename,
                fileSize: fileData.size,
                mimeType: fileData.mimetype,
                expiresAt: fileData.expiresAt || null
            });

            logger.info(`License document uploaded for user ${userId}`, { documentId: document.id });
            return document;
        } catch (error) {
            logger.error('Error uploading license document:', error);
            throw error;
        }
    }

    /**
     * Submit doctor profile for verification
     */
    static async submitForVerification(userId, submittedBy) {
        try {
            // Check if user has uploaded required documents
            const documents = await VerificationDocument.getByUserId(userId);
            const hasLicense = documents.some(doc => doc.document_type === 'medical_license');

            if (!hasLicense) {
                throw new Error('Medical license document is required for verification');
            }

            // Update user verification status to pending
            const query = `
                UPDATE users
                SET verification_status = 'pending',
                    account_status = 'pending_verification'
                WHERE id = $1
                RETURNING *;
            `;

            const result = await db.query(query, [userId]);

            // Log the action
            await AccountAction.log({
                userId,
                actionType: 'verify',
                actionBy: submittedBy,
                notes: 'Submitted for verification'
            });

            logger.info(`Doctor ${userId} submitted for verification`);
            return result.rows[0];
        } catch (error) {
            logger.error('Error submitting for verification:', error);
            throw error;
        }
    }

    /**
     * Get all pending doctor verifications (for admin)
     */
    static async getPendingVerifications() {
        try {
            const query = `
                SELECT u.id, u.email, u.first_name, u.last_name, r.name as role,
                       u.verification_status, u.created_at,
                       COUNT(vd.id) as document_count,
                       COALESCE(jsonb_agg(jsonb_build_object('id',vd.id,'file_name',vd.file_name,'document_type',vd.document_type)) FILTER (WHERE vd.id IS NOT NULL), '[]'::jsonb) AS documents
                FROM users u
                JOIN roles r ON u.role_id = r.id
                LEFT JOIN verification_documents vd ON u.id = vd.user_id
                WHERE u.verification_status = 'pending'
                AND r.name = 'doctor'
                GROUP BY u.id, u.email, u.first_name, u.last_name, r.name, u.verification_status, u.created_at
                ORDER BY u.created_at ASC;
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error getting pending verifications:', error);
            throw error;
        }
    }

    /**
     * Approve a doctor's verification
     */
    static async approveDoctor(userId, approvedBy, notes = null) {
        try {
            // Update user status
            const userQuery = `
                UPDATE users
                SET verification_status = 'verified',
                    is_verified = true,
                    account_status = 'active',
                    status = 'active',
                    verified_at = CURRENT_TIMESTAMP,
                    verified_by = $2,
                    verification_notes = $3
                WHERE id = $1
                RETURNING *;
            `;

            const userResult = await db.query(userQuery, [userId, approvedBy, notes]);

            // Approve all pending documents
            const docsQuery = `
                UPDATE verification_documents
                SET status = 'approved',
                    reviewed_by = $2,
                    reviewed_at = CURRENT_TIMESTAMP,
                    review_notes = $3
                WHERE user_id = $1 AND status = 'pending';
            `;

            await db.query(docsQuery, [userId, approvedBy, notes]);

            // Send acceptance email
            await sendDoctorAcceptanceEmail(userResult.rows[0].email, {
                firstName: userResult.rows[0].first_name,
                lastName: userResult.rows[0].last_name
            }).catch(() => logger.error('Doctor approval notification delivery failed'));

            // Log the action
            await AccountAction.log({
                userId,
                actionType: 'verify',
                actionBy: approvedBy,
                notes: notes || 'Doctor verification approved',
                metadata: { action: 'approve' }
            });

            logger.info(`Doctor ${userId} approved by ${approvedBy}`);
            return userResult.rows[0];
        } catch (error) {
            logger.error('Error approving doctor:', error);
            throw error;
        }
    }

    /**
     * Reject a doctor's verification
     */
    static async rejectDoctor(userId, rejectedBy, reason) {
        try {
            if (!reason) {
                throw new Error('Rejection reason is required');
            }

            // Update user status
            const userQuery = `
                UPDATE users
                SET verification_status = 'rejected',
                    account_status = 'suspended',
                    verified_at = CURRENT_TIMESTAMP,
                    verified_by = $2,
                    verification_notes = $3
                WHERE id = $1
                RETURNING *;
            `;

            const userResult = await db.query(userQuery, [userId, rejectedBy, reason]);

            // Reject all pending documents
            const docsQuery = `
                UPDATE verification_documents
                SET status = 'rejected',
                    reviewed_by = $2,
                    reviewed_at = CURRENT_TIMESTAMP,
                    rejection_reason = $3
                WHERE user_id = $1 AND status = 'pending';
            `;

            await db.query(docsQuery, [userId, rejectedBy, reason]);

            // Log the action
            await AccountAction.log({
                userId,
                actionType: 'reject',
                actionBy: rejectedBy,
                reason,
                metadata: { action: 'reject' }
            });

            logger.info(`Doctor ${userId} rejected by ${rejectedBy}`);
            return userResult.rows[0];
        } catch (error) {
            logger.error('Error rejecting doctor:', error);
            throw error;
        }
    }

    /**
     * Get verification status for a doctor
     */
    static async getVerificationStatus(userId) {
        try {
            const query = `
                SELECT u.id, u.email, u.first_name, u.last_name,
                       u.verification_status, u.account_status,
                       u.verified_at, u.verification_notes,
                       vu.first_name || ' ' || vu.last_name as verified_by_name
                FROM users u
                LEFT JOIN users vu ON u.verified_by = vu.id
                WHERE u.id = $1;
            `;

            const result = await db.query(query, [userId]);
            const user = result.rows[0];

            if (!user) {
                throw new Error('User not found');
            }

            // Get documents
            const documents = await VerificationDocument.getByUserId(userId);

            return {
                ...user,
                documents
            };
        } catch (error) {
            logger.error('Error getting verification status:', error);
            throw error;
        }
    }

    /**
     * Get verification statistics (for admin dashboard)
     */
    static async getStats() {
        try {
            const query = `
                SELECT 
                    COUNT(*) FILTER (WHERE verification_status = 'pending') as pending,
                    COUNT(*) FILTER (WHERE verification_status = 'verified') as verified,
                    COUNT(*) FILTER (WHERE verification_status = 'rejected') as rejected,
                    COUNT(*) FILTER (WHERE verification_status = 'unverified') as unverified
                FROM users u
                JOIN roles r ON u.role_id = r.id
                WHERE r.name = 'doctor';
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error getting verification stats:', error);
            throw error;
        }
    }
}

module.exports = DoctorVerificationService;
