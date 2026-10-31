const crypto = require('crypto');
const { query } = require('../config/db');
const logger = require('../utils/logger');

/**
 * Device Validation Service
 * Handles device fingerprinting, tracking, and validation
 */

/**
 * Extract device information from request
 * @param {Object} req - Express request object
 * @returns {Object} Device information
 */
const captureDeviceInfo = (req) => {
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const ipAddress = req.ip || req.connection.remoteAddress;
    const acceptLanguage = req.headers['accept-language'] || '';
    const acceptEncoding = req.headers['accept-encoding'] || '';

    // Create device fingerprint
    const fingerprintData = `${userAgent}|${acceptLanguage}|${acceptEncoding}`;
    const deviceFingerprint = crypto
        .createHash('sha256')
        .update(fingerprintData)
        .digest('hex');

    return {
        userAgent,
        ipAddress,
        deviceFingerprint,
        acceptLanguage,
        acceptEncoding,
        platform: extractPlatform(userAgent),
        browser: extractBrowser(userAgent),
        os: extractOS(userAgent),
    };
};

/**
 * Extract platform from user agent
 */
const extractPlatform = (userAgent) => {
    if (/mobile/i.test(userAgent)) return 'mobile';
    if (/tablet/i.test(userAgent)) return 'tablet';
    return 'desktop';
};

/**
 * Extract browser from user agent
 */
const extractBrowser = (userAgent) => {
    if (/chrome/i.test(userAgent)) return 'Chrome';
    if (/firefox/i.test(userAgent)) return 'Firefox';
    if (/safari/i.test(userAgent)) return 'Safari';
    if (/edge/i.test(userAgent)) return 'Edge';
    if (/opera/i.test(userAgent)) return 'Opera';
    return 'Unknown';
};

/**
 * Extract OS from user agent
 */
const extractOS = (userAgent) => {
    if (/windows/i.test(userAgent)) return 'Windows';
    if (/mac/i.test(userAgent)) return 'MacOS';
    if (/linux/i.test(userAgent)) return 'Linux';
    if (/android/i.test(userAgent)) return 'Android';
    if (/ios|iphone|ipad/i.test(userAgent)) return 'iOS';
    return 'Unknown';
};

/**
 * Validate if device is authorized for user
 * @param {String} userId - User ID
 * @param {Object} deviceInfo - Device information
 * @returns {Object} Validation result
 */
const validateDevice = async (userId, deviceInfo) => {
    try {
        // Check if device has been used before
        const deviceQuery = `
            SELECT id, user_id, device_info, created_at, last_activity
            FROM sessions
            WHERE user_id = $1 
                AND device_info->>'deviceFingerprint' = $2
                AND is_active = true
            ORDER BY last_activity DESC
            LIMIT 1
        `;

        const result = await query(deviceQuery, [userId, deviceInfo.deviceFingerprint]);

        if (result.rows.length > 0) {
            // Known device
            return {
                isKnown: true,
                isTrusted: true,
                requiresVerification: false,
                lastSeen: result.rows[0].last_activity,
            };
        }

        // Check for suspicious patterns
        const suspiciousPatterns = await detectSuspiciousDevice(userId, deviceInfo);

        if (suspiciousPatterns.isSuspicious) {
            return {
                isKnown: false,
                isTrusted: false,
                requiresVerification: true,
                reason: suspiciousPatterns.reason,
            };
        }

        // New but not suspicious device
        return {
            isKnown: false,
            isTrusted: true,
            requiresVerification: false,
            isNewDevice: true,
        };
    } catch (error) {
        logger.error('Device validation failed:', error);
        // Fail open for availability, but log the error
        return {
            isKnown: false,
            isTrusted: true,
            requiresVerification: false,
            error: error.message,
        };
    }
};

/**
 * Detect suspicious device patterns
 */
const detectSuspiciousDevice = async (userId, deviceInfo) => {
    try {
        // Check for rapid location changes (different IPs in short time)
        const recentSessionsQuery = `
            SELECT ip_address, created_at
            FROM sessions
            WHERE user_id = $1
                AND created_at > NOW() - INTERVAL '1 hour'
            ORDER BY created_at DESC
            LIMIT 5
        `;

        const recentSessions = await query(recentSessionsQuery, [userId]);

        // Check for IP address changes
        const uniqueIPs = new Set(recentSessions.rows.map(s => s.ip_address));
        if (uniqueIPs.size > 3) {
            return {
                isSuspicious: true,
                reason: 'Multiple IP addresses detected in short time',
            };
        }

        // Check for unusual user agent patterns
        if (deviceInfo.userAgent.includes('bot') ||
            deviceInfo.userAgent.includes('crawler') ||
            deviceInfo.userAgent.includes('scraper')) {
            return {
                isSuspicious: true,
                reason: 'Suspicious user agent detected',
            };
        }

        return { isSuspicious: false };
    } catch (error) {
        logger.error('Suspicious device detection failed:', error);
        return { isSuspicious: false };
    }
};

/**
 * Flag suspicious device access
 */
const flagSuspiciousDevice = async (userId, deviceInfo, reason) => {
    try {
        const securityEventQuery = `
            INSERT INTO security_events (
                user_id, event_type, severity, description, ip_address, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        `;

        await query(securityEventQuery, [
            userId,
            'suspicious_activity',
            'high',
            `Suspicious device access: ${reason}`,
            deviceInfo.ipAddress,
            JSON.stringify(deviceInfo),
        ]);

        logger.warn('Suspicious device flagged:', {
            userId,
            reason,
            deviceInfo,
        });
    } catch (error) {
        logger.error('Failed to flag suspicious device:', error);
    }
};

/**
 * Get device access history for user
 */
const getDeviceHistory = async (userId, limit = 10) => {
    try {
        const historyQuery = `
            SELECT 
                device_info,
                ip_address,
                created_at,
                last_activity,
                is_active
            FROM sessions
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2
        `;

        const result = await query(historyQuery, [userId, limit]);

        return result.rows.map(row => ({
            device: row.device_info,
            ipAddress: row.ip_address,
            firstSeen: row.created_at,
            lastSeen: row.last_activity,
            isActive: row.is_active,
        }));
    } catch (error) {
        logger.error('Failed to get device history:', error);
        return [];
    }
};

/**
 * Validate location based on IP address
 */
const validateLocation = async (userId, ipAddress) => {
    try {
        // Get recent login locations
        const recentLocationsQuery = `
            SELECT DISTINCT ip_address
            FROM sessions
            WHERE user_id = $1
                AND created_at > NOW() - INTERVAL '30 days'
            LIMIT 10
        `;

        const result = await query(recentLocationsQuery, [userId]);
        const knownIPs = result.rows.map(row => row.ip_address);

        // Check if IP is known
        if (knownIPs.includes(ipAddress)) {
            return {
                isKnownLocation: true,
                requiresVerification: false,
            };
        }

        // New location
        return {
            isKnownLocation: false,
            requiresVerification: false, // Can be set to true for stricter security
            isNewLocation: true,
        };
    } catch (error) {
        logger.error('Location validation failed:', error);
        return {
            isKnownLocation: false,
            requiresVerification: false,
            error: error.message,
        };
    }
};

module.exports = {
    captureDeviceInfo,
    validateDevice,
    flagSuspiciousDevice,
    getDeviceHistory,
    validateLocation,
    detectSuspiciousDevice,
};
