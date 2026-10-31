const cron = require('node-cron');
const { query } = require('../config/db');
const { cleanupExpiredOTPs } = require('../services/otp.service');
const logger = require('../utils/logger');
const config = require('../config/env');

/**
 * Cleanup expired sessions
 * Runs every hour
 */
const cleanupExpiredSessions = async () => {
    try {
        const deleteQuery = `
      DELETE FROM sessions
      WHERE expires_at < NOW() OR (is_active = false AND last_activity < NOW() - INTERVAL '7 days')
    `;

        const result = await query(deleteQuery);
        logger.info(`Cleaned up ${result.rowCount} expired sessions`);
    } catch (error) {
        logger.error('Session cleanup failed:', error);
    }
};

/**
 * Cleanup expired OTPs
 * Runs every hour
 */
const cleanupOTPs = async () => {
    try {
        const count = await cleanupExpiredOTPs();
        logger.info(`OTP cleanup completed: ${count} records removed`);
    } catch (error) {
        logger.error('OTP cleanup failed:', error);
    }
};

/**
 * Auto-logout inactive sessions
 * Runs every 15 minutes
 */
const autoLogoutInactiveSessions = async () => {
    try {
        if (!config.session.autoLogoutEnabled) {
            return;
        }

        const timeoutMinutes = config.session.timeoutMinutes;

        const updateQuery = `
      UPDATE sessions
      SET is_active = false
      WHERE is_active = true 
        AND last_activity < NOW() - INTERVAL '${timeoutMinutes} minutes'
    `;

        const result = await query(updateQuery);

        if (result.rowCount > 0) {
            logger.info(`Auto-logged out ${result.rowCount} inactive sessions`);
        }
    } catch (error) {
        logger.error('Auto-logout failed:', error);
    }
};

/**
 * Initialize all scheduled jobs
 */
const initializeJobs = () => {
    const tasks = [];
    // Run session cleanup every hour
    tasks.push(cron.schedule('0 * * * *', () => {
        logger.info('Running scheduled session cleanup...');
        cleanupExpiredSessions();
    }));

    // Run OTP cleanup every hour
    tasks.push(cron.schedule('0 * * * *', () => {
        logger.info('Running scheduled OTP cleanup...');
        cleanupOTPs();
    }));

    // Run auto-logout check every 15 minutes
    tasks.push(cron.schedule('*/15 * * * *', () => {
        logger.debug('Running auto-logout check...');
        autoLogoutInactiveSessions();
    }));

    logger.info('Background jobs initialized');
    return tasks;
};

module.exports = {
    initializeJobs,
    cleanupExpiredSessions,
    cleanupOTPs,
    autoLogoutInactiveSessions,
};
