/**
 * Notification Service
 * Multi-channel notification system for clinical events
 */

const pool = require('../config/db');
const logger = require('../utils/logger');

class NotificationService {
    /**
     * Send a notification
     * @param {Object} notificationData - Notification data
     * @returns {Promise<Object>} Created notification
     */
    static async sendNotification(notificationData) {
        try {
            const {
                userId,
                type,
                title,
                message,
                priority = 'normal',
                channels = ['in_app'],
                relatedEntityType,
                relatedEntityId,
                metadata = {}
            } = notificationData;

            // Store notification in database
            const query = `
                INSERT INTO notifications (
                    user_id, type, title, message, priority, channels,
                    related_entity_type, related_entity_id, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `;

            const result = await pool.query(query, [
                userId,
                type,
                title,
                message,
                priority,
                JSON.stringify(channels),
                relatedEntityType,
                relatedEntityId,
                JSON.stringify(metadata)
            ]);

            const notification = result.rows[0];

            // Send through requested channels
            await this.deliverToChannels(notification, channels);

            logger.info('Notification sent', {
                notificationId: notification.id,
                userId,
                type,
                channels
            });

            return notification;
        } catch (error) {
            logger.error('Failed to send notification:', error);
            throw error;
        }
    }

    /**
     * Deliver notification to specified channels
     * @param {Object} notification - Notification object
     * @param {Array} channels - Delivery channels
     */
    static async deliverToChannels(notification, channels) {
        const promises = [];

        if (channels.includes('email')) {
            promises.push(this.sendEmail(notification));
        }

        if (channels.includes('sms')) {
            promises.push(this.sendSMS(notification));
        }

        // in_app is already stored in database, no additional delivery needed

        await Promise.allSettled(promises);
    }

    /**
     * Send email notification
     * @param {Object} notification - Notification object
     */
    static async sendEmail(notification) {
        try {
            // Get user email
            const userQuery = 'SELECT email FROM users WHERE id = $1';
            const userResult = await pool.query(userQuery, [notification.user_id]);

            if (userResult.rows.length === 0) {
                throw new Error('User not found');
            }

            const userEmail = userResult.rows[0].email;

            const { sendEmail } = require('../config/mail');

            // Send email
            await sendEmail({
                to: userEmail,
                subject: notification.title,
                text: notification.message,
                html: this.getEmailTemplate(notification)
            });

            logger.info('Email notification sent', {
                notificationId: notification.id,
                email: userEmail
            });
        } catch (error) {
            logger.error('Failed to send email notification:', error);
            // Don't throw - notification is already stored
        }
    }

    /**
     * Send SMS notification
     * @param {Object} notification - Notification object
     */
    static async sendSMS(notification) {
        try {
            // Get user phone
            const userQuery = 'SELECT phone FROM users WHERE id = $1';
            const userResult = await pool.query(userQuery, [notification.user_id]);

            if (userResult.rows.length === 0 || !userResult.rows[0].phone) {
                throw new Error('User phone number not found');
            }

            const phoneNumber = userResult.rows[0].phone;

            // TODO: Integrate with SMS provider (Twilio, etc.)
            logger.info('SMS notification would be sent', {
                notificationId: notification.id,
                phoneNumber,
                message: notification.message
            });

            // Placeholder for SMS integration
            // await twilioClient.messages.create({
            //     body: notification.message,
            //     to: phoneNumber,
            //     from: process.env.TWILIO_PHONE_NUMBER
            // });
        } catch (error) {
            logger.error('Failed to send SMS notification:', error);
            // Don't throw - notification is already stored
        }
    }

    /**
     * Get email HTML template
     * @param {Object} notification - Notification object
     * @returns {String} HTML template
     */
    static getEmailTemplate(notification) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #007bff; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background: #f9f9f9; }
                    .footer { padding: 10px; text-align: center; font-size: 12px; color: #666; }
                    .priority-high { border-left: 4px solid #dc3545; }
                    .priority-urgent { border-left: 4px solid #ff0000; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>${notification.title}</h2>
                    </div>
                    <div class="content priority-${notification.priority}">
                        <p>${notification.message}</p>
                    </div>
                    <div class="footer">
                        <p>This is an automated notification from Healthcare Management System</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * Get user notifications
     * @param {String} userId - User ID
     * @param {Boolean} unreadOnly - Only return unread notifications
     * @returns {Promise<Array>} Notifications
     */
    static async getUserNotifications(userId, unreadOnly = false) {
        try {
            let query = `
                SELECT *
                FROM notifications
                WHERE user_id = $1
            `;

            if (unreadOnly) {
                query += ' AND read = FALSE';
            }

            query += ' ORDER BY created_at DESC LIMIT 50';

            const result = await pool.query(query, [userId]);
            return result.rows;
        } catch (error) {
            logger.error('Failed to get user notifications:', error);
            throw error;
        }
    }

    /**
     * Mark notification as read
     * @param {String} notificationId - Notification ID
     * @returns {Promise<Object>} Updated notification
     */
    static async markAsRead(notificationId, userId) {
        try {
            const query = `
                UPDATE notifications
                SET read = TRUE, read_at = NOW()
                WHERE id = $1 AND user_id = $2 AND read = FALSE
                RETURNING *
            `;

            const result = await pool.query(query, [notificationId, userId]);
            return result.rows[0];
        } catch (error) {
            logger.error('Failed to mark notification as read:', error);
            throw error;
        }
    }

    /**
     * Mark all user notifications as read
     * @param {String} userId - User ID
     * @returns {Promise<Number>} Number of notifications marked as read
     */
    static async markAllAsRead(userId) {
        try {
            const query = `
                UPDATE notifications
                SET read = TRUE, read_at = NOW()
                WHERE user_id = $1 AND read = FALSE
                RETURNING id
            `;

            const result = await pool.query(query, [userId]);
            return result.rows.length;
        } catch (error) {
            logger.error('Failed to mark all notifications as read:', error);
            throw error;
        }
    }

    /**
     * Send lab result notification
     * @param {String} userId - Doctor user ID
     * @param {String} labOrderId - Lab order ID
     * @param {String} testName - Test name
     */
    static async notifyLabResultAvailable(userId, labOrderId, testName) {
        return this.sendNotification({
            userId,
            type: 'lab_result',
            title: 'Lab Result Available',
            message: `Lab result for ${testName} is now available for review.`,
            priority: 'high',
            channels: ['in_app', 'email'],
            relatedEntityType: 'lab_order',
            relatedEntityId: labOrderId
        });
    }

    /**
     * Send imaging report notification
     * @param {String} userId - Doctor user ID
     * @param {String} imagingOrderId - Imaging order ID
     * @param {String} imagingType - Imaging type
     */
    static async notifyImagingReportAvailable(userId, imagingOrderId, imagingType) {
        return this.sendNotification({
            userId,
            type: 'imaging_report',
            title: 'Imaging Report Available',
            message: `${imagingType} report is now available for review.`,
            priority: 'high',
            channels: ['in_app', 'email'],
            relatedEntityType: 'imaging_order',
            relatedEntityId: imagingOrderId
        });
    }

    /**
     * Send visit state change notification
     * @param {String} userId - User ID
     * @param {String} visitId - Visit ID
     * @param {String} newState - New visit state
     */
    static async notifyVisitStateChange(userId, visitId, newState) {
        return this.sendNotification({
            userId,
            type: 'visit_update',
            title: 'Visit Status Updated',
            message: `Visit status changed to: ${newState}`,
            priority: 'normal',
            channels: ['in_app'],
            relatedEntityType: 'visit',
            relatedEntityId: visitId
        });
    }
}

module.exports = NotificationService;
