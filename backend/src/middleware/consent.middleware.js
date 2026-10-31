const { checkConsent } = require('../models/consent.model');
const { HTTP_STATUS, ERROR_MESSAGES, ROLES } = require('../utils/constants');
const logger = require('../utils/logger');
const { query } = require('../config/db');
const { isOnShift } = require('../services/shift.service');

/**
 * Middleware to verify consent for accessing patient data
 * @param {String} dataCategory - Category of data being accessed (e.g., 'clinical_notes', 'lab_results')
 * @param {String} accessLevel - Level of access required ('read' or 'write')
 */
const verifyConsent = (dataCategory, accessLevel = 'read') => {
    return async (req, res, next) => {
        try {
            const userId = req.user.id;
            const userRole = req.user.roleName || req.user.role_name;

            // If user is accessing their own data (Patient)
            // We assume route parameters like :patientId or :id refer to the patient
            // But usually this middleware is used when a doctor accesses a patient's data.
            // Let's assume the patient ID is passed in params or body.
            const patientId = req.params.patientId || req.params.id || req.body.patientId;

            if (!patientId) {
                logger.warn('verifyConsent middleware used on route without patientId');
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    message: 'Patient ID is required',
                });
            }

            // PATIENT Accessing their own data
            if (userRole === ROLES.PATIENT) {
                if (userId === patientId) {
                    return next();
                } else {
                    return res.status(HTTP_STATUS.FORBIDDEN).json({
                        success: false,
                        message: ERROR_MESSAGES.ACCESS_DENIED,
                    });
                }
            }

            // DOCTOR/STAFF Accessing patient data
            // First, verify the user is a healthcare provider
            const healthcareRoles = [ROLES.DOCTOR, ROLES.NURSE, ROLES.LAB_TECHNICIAN, ROLES.RADIOLOGIST, ROLES.PHARMACIST];

            if (!healthcareRoles.includes(userRole)) {
                logger.warn(`Non-healthcare role ${userRole} attempting to access patient data`);
                return res.status(HTTP_STATUS.FORBIDDEN).json({
                    success: false,
                    message: 'Only healthcare providers can access patient data',
                });
            }

            // Check if staff member is on shift (with emergency override option)
            const onShift = await isOnShift(userId);
            if (!onShift && !req.emergencyAccess) {
                logger.warn(`Staff member ${userId} not on shift, attempting data access`);
                // Allow access but log the off-shift access
                req.offShiftAccess = true;
            }

            // Check for valid consent
            const hasConsent = await checkConsent(patientId, userId, dataCategory, accessLevel);

            if (hasConsent) {
                // Attach consent info to request for audit logging if needed
                req.consentVerified = true;
                return next();
            }

            // If no consent, check if emergency override is applicable (Future Scope)
            // For now, deny access

            logger.warn(`Consent check failed for user ${userId} accessing patient ${patientId}`);
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                message: 'No active consent found for this action',
            });

        } catch (error) {
            logger.error('Consent verification failed:', error);
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: ERROR_MESSAGES.INTERNAL_ERROR,
            });
        }
    };
};

module.exports = {
    verifyConsent,
};
