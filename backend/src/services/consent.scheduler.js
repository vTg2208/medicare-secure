const cron = require('node-cron');
const { query } = require('../config/db');
const logger = require('../utils/logger');
const { createAuditLog } = require('./audit.service');
const { AUDIT_ACTIONS } = require('../utils/constants');

/**
 * Expire consents that have passed their end_time
 * Runs every hour
 */
const expireConsents = async () => {
    try {
        logger.info('Running consent expiration check...');

        // Find and expire consents past their end_time
        const expireQuery = `
            UPDATE consents 
            SET status = 'expired', updated_at = NOW()
            WHERE status = 'active' 
                AND end_time IS NOT NULL 
                AND end_time < NOW()
            RETURNING id, patient_id, recipient_user_id, purpose, end_time
        `;

        const result = await query(expireQuery);
        const expiredConsents = result.rows;

        if (expiredConsents.length > 0) {
            logger.info(`Expired ${expiredConsents.length} consent(s)`);

            // Create audit logs for each expired consent
            for (const consent of expiredConsents) {
                await createAuditLog({
                    userId: consent.patient_id,
                    action: AUDIT_ACTIONS.CONSENT_EXPIRED,
                    entityType: 'consent',
                    entityId: consent.id,
                    purpose: `Auto-expired consent: ${consent.purpose}`,
                    metadata: {
                        recipientUserId: consent.recipient_user_id,
                        endTime: consent.end_time,
                        expiredAt: new Date(),
                    },
                });
            }
        } else {
            logger.info('No consents to expire');
        }

        return expiredConsents;
    } catch (error) {
        logger.error('Consent expiration check failed:', error);
        throw error;
    }
};

/**
 * Notify patients about consents expiring soon (within 7 days)
 */
const notifyExpiringConsents = async () => {
    try {
        logger.info('Checking for expiring consents...');

        const expiringQuery = `
            SELECT 
                c.id,
                c.patient_id,
                c.recipient_user_id,
                c.purpose,
                c.end_time,
                u.email as patient_email,
                r.email as recipient_email
            FROM consents c
            INNER JOIN users u ON c.patient_id = u.id
            INNER JOIN users r ON c.recipient_user_id = r.id
            WHERE c.status = 'active'
                AND c.end_time IS NOT NULL
                AND c.end_time > NOW()
                AND c.end_time < NOW() + INTERVAL '7 days'
        `;

        const result = await query(expiringQuery);
        const expiringConsents = result.rows;

        if (expiringConsents.length > 0) {
            logger.info(`Found ${expiringConsents.length} consent(s) expiring soon`);

            // TODO: Send email notifications to patients
            // For now, just log the notifications
            for (const consent of expiringConsents) {
                logger.info('Consent expiration notification queued');
            }
        }

        return expiringConsents;
    } catch (error) {
        logger.error('Expiring consent notification check failed:', error);
        throw error;
    }
};

/**
 * Start the consent scheduler
 */
const startConsentScheduler = () => {
    const tasks = [];
    // Run consent expiration check every minute (for responsiveness)
    tasks.push(cron.schedule('* * * * *', async () => {
        logger.info('Scheduled consent expiration check triggered');
        try {
            await expireConsents();
        } catch (error) {
            logger.error('Scheduled consent expiration failed:', error);
        }
    }));

    // Check for expiring consents daily at 9 AM
    tasks.push(cron.schedule('0 9 * * *', async () => {
        logger.info('Scheduled expiring consent notification check triggered');
        try {
            await notifyExpiringConsents();
        } catch (error) {
            logger.error('Scheduled expiring consent notification failed:', error);
        }
    }));

    logger.info('Consent scheduler started successfully');
    return tasks;
};

module.exports = {
    startConsentScheduler,
    expireConsents,
    notifyExpiringConsents,
};
