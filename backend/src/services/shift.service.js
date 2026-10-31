const { query } = require('../config/db');
const logger = require('../utils/logger');

/**
 * Check if a staff member is currently on shift
 * @param {String} userId - User ID of staff member
 * @param {String} organizationId - Organization ID (optional)
 * @returns {Promise<Boolean>} True if on shift
 */
const isOnShift = async (userId, organizationId = null) => {
    try {
        const now = new Date();
        const currentTime = now.toTimeString().split(' ')[0]; // HH:MM:SS
        const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday

        let shiftQuery = `
            SELECT 
                shift_start,
                shift_end,
                status
            FROM staff_org_mapping
            WHERE user_id = $1
                AND status = 'active'
        `;

        const params = [userId];

        if (organizationId) {
            shiftQuery += ' AND organization_id = $2';
            params.push(organizationId);
        }

        const result = await query(shiftQuery, params);

        if (result.rows.length === 0) {
            logger.warn(`No active staff mapping found for user ${userId}`);
            return false;
        }

        const staffMapping = result.rows[0];

        // If no shift times defined, assume 24/7 access
        if (!staffMapping.shift_start || !staffMapping.shift_end) {
            return true;
        }

        const shiftStart = staffMapping.shift_start;
        const shiftEnd = staffMapping.shift_end;

        // Check if current time is within shift
        // Handle overnight shifts (e.g., 22:00 - 06:00)
        if (shiftStart <= shiftEnd) {
            // Normal shift (e.g., 09:00 - 17:00)
            return currentTime >= shiftStart && currentTime <= shiftEnd;
        } else {
            // Overnight shift
            return currentTime >= shiftStart || currentTime <= shiftEnd;
        }
    } catch (error) {
        logger.error('Shift verification error:', error);
        // Fail open - allow access if verification fails (for availability)
        return true;
    }
};

/**
 * Check if emergency override is active
 * @param {String} userId - User ID
 * @returns {Promise<Boolean>} True if emergency override is active
 */
const hasEmergencyOverride = async (userId) => {
    try {
        // Check for active emergency access grants
        const emergencyQuery = `
            SELECT id 
            FROM emergency_access_grants
            WHERE user_id = $1
                AND status = 'active'
                AND expires_at > NOW()
            LIMIT 1
        `;

        const result = await query(emergencyQuery, [userId]);
        return result.rows.length > 0;
    } catch (error) {
        logger.error('Emergency override check error:', error);
        return false;
    }
};

/**
 * Verify staff shift for data access
 * @param {Boolean} allowEmergencyOverride - Allow emergency access outside shift
 */
const verifyShift = (allowEmergencyOverride = true) => {
    return async (req, res, next) => {
        try {
            const userId = req.user?.id;
            const userRole = req.user?.roleName || req.user?.role_name;

            // Only apply shift verification to staff roles
            const staffRoles = ['doctor', 'nurse', 'lab_technician', 'radiologist', 'pharmacist'];

            if (!staffRoles.includes(userRole)) {
                // Not a staff member, skip shift verification
                return next();
            }

            // Check if on shift
            const onShift = await isOnShift(userId);

            if (onShift) {
                return next();
            }

            // Not on shift - check for emergency override
            if (allowEmergencyOverride) {
                const hasOverride = await hasEmergencyOverride(userId);

                if (hasOverride) {
                    logger.warn(`Emergency override used by user ${userId}`);
                    req.emergencyAccess = true;
                    return next();
                }
            }

            // Access denied - not on shift and no emergency override
            logger.warn(`Shift verification failed for user ${userId}`);

            return res.status(403).json({
                success: false,
                message: 'Access denied: You are not currently on shift',
                code: 'SHIFT_VERIFICATION_FAILED',
            });

        } catch (error) {
            logger.error('Shift verification middleware error:', error);
            // Fail open for availability
            next();
        }
    };
};

module.exports = {
    verifyShift,
    isOnShift,
    hasEmergencyOverride,
};
