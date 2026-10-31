const cron = require('node-cron');
const { query } = require('../config/db');
const { createAuditLog } = require('../services/audit.service');
const { SESSION_CONFIG } = require('../utils/constants');
const logger = require('../utils/logger');

/**
 * Auto-Logout Background Job
 * Automatically logs out inactive sessions after timeout period
 * Runs every 5 minutes
 */

const INACTIVITY_TIMEOUT_MINUTES = SESSION_CONFIG.TIMEOUT_MINUTES || 30;

/**
 * Find and deactivate inactive sessions
 */
const deactivateInactiveSessions = async () => {
    try {
        logger.info('Running auto-logout job...');

        // Find sessions that have been inactive for more than timeout period
        const inactiveSessionsQuery = `
            SELECT 
                s.id,
                s.user_id,
                s.ip_address,
                s.last_activity,
                u.email,
                r.name as role_name
            FROM sessions s
            INNER JOIN users u ON s.user_id = u.id
            INNER JOIN roles r ON u.role_id = r.id
            WHERE s.is_active = true
                AND s.last_activity < NOW() - INTERVAL '${INACTIVITY_TIMEOUT_MINUTES} minutes'
                AND s.expires_at > NOW()
        `;

        const result = await query(inactiveSessionsQuery);
        const inactiveSessions = result.rows;

        if (inactiveSessions.length === 0) {
            logger.info('No inactive sessions found');
            return {
                success: true,
                deactivatedCount: 0,
            };
        }

        logger.info(`Found ${inactiveSessions.length} inactive sessions`);

        // Deactivate each session
        for (const session of inactiveSessions) {
            await deactivateSession(session);
        }

        logger.info(`Auto-logout completed: ${inactiveSessions.length} sessions deactivated`);

        return {
            success: true,
            deactivatedCount: inactiveSessions.length,
        };
    } catch (error) {
        logger.error('Auto-logout job failed:', error);
        return {
            success: false,
            error: error.message,
        };
    }
};

/**
 * Deactivate a single session
 */
const deactivateSession = async (session) => {
    try {
        // Update session status
        const updateQuery = `
            UPDATE sessions
            SET is_active = false
            WHERE id = $1
        `;

        await query(updateQuery, [session.id]);

        // Create audit log
        await createAuditLog({
            userId: session.user_id,
            action: 'auto_logout',
            entityType: 'session',
            entityId: session.id,
            purpose: `Auto-logout due to inactivity (${INACTIVITY_TIMEOUT_MINUTES} minutes)`,
            ipAddress: session.ip_address,
            metadata: {
                lastActivity: session.last_activity,
                timeoutMinutes: INACTIVITY_TIMEOUT_MINUTES,
            },
        });

        logger.info('Session auto-logged out:', {
            sessionId: session.id,
            userId: session.user_id,
            email: session.email,
            lastActivity: session.last_activity,
        });

        // TODO: Send notification to user (optional)
        // await sendAutoLogoutNotification(session.user_id, session.email);
    } catch (error) {
        logger.error('Failed to deactivate session:', {
            sessionId: session.id,
            error: error.message,
        });
    }
};

/**
 * Clean up expired sessions (already expired by time)
 */
const cleanupExpiredSessions = async () => {
    try {
        logger.info('Cleaning up expired sessions...');

        const deleteQuery = `
            DELETE FROM sessions
            WHERE expires_at < NOW()
                AND is_active = false
        `;

        const result = await query(deleteQuery);

        logger.info(`Cleaned up ${result.rowCount} expired sessions`);

        return {
            success: true,
            deletedCount: result.rowCount,
        };
    } catch (error) {
        logger.error('Session cleanup failed:', error);
        return {
            success: false,
            error: error.message,
        };
    }
};

/**
 * Update session activity timestamp
 * Called by middleware on each authenticated request
 */
const updateSessionActivity = async (sessionId) => {
    try {
        const updateQuery = `
            UPDATE sessions
            SET last_activity = NOW()
            WHERE id = $1 AND is_active = true
        `;

        await query(updateQuery, [sessionId]);
    } catch (error) {
        logger.error('Failed to update session activity:', error);
    }
};

/**
 * Get session by token hash
 */
const getSessionByTokenHash = async (tokenHash) => {
    try {
        const sessionQuery = `
            SELECT id, user_id, last_activity, expires_at, is_active
            FROM sessions
            WHERE token_hash = $1
        `;

        const result = await query(sessionQuery, [tokenHash]);

        if (result.rows.length === 0) {
            return null;
        }

        return result.rows[0];
    } catch (error) {
        logger.error('Failed to get session:', error);
        return null;
    }
};

/**
 * Start the auto-logout cron job
 * Runs every 5 minutes
 */
const startAutoLogoutJob = () => {
    // Run every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
        await deactivateInactiveSessions();
    });

    logger.info(`Auto-logout job scheduled (runs every 5 minutes, timeout: ${INACTIVITY_TIMEOUT_MINUTES} minutes)`);
};

/**
 * Start the session cleanup job
 * Runs every hour
 */
const startSessionCleanupJob = () => {
    // Run every hour
    cron.schedule('0 * * * *', async () => {
        await cleanupExpiredSessions();
    });

    logger.info('Session cleanup job scheduled (runs every hour)');
};

/**
 * Initialize all session management jobs
 */
const initializeSessionJobs = () => {
    startAutoLogoutJob();
    startSessionCleanupJob();
    logger.info('Session management jobs initialized');
};

module.exports = {
    deactivateInactiveSessions,
    cleanupExpiredSessions,
    updateSessionActivity,
    getSessionByTokenHash,
    startAutoLogoutJob,
    startSessionCleanupJob,
    initializeSessionJobs,
};
