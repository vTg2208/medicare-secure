const {
    createConsent,
    revokeConsent: revokeConsentModel,
    getActiveConsents: getActiveConsentsModel,
    getConsentHistory: getConsentHistoryModel,
    findConsentById
} = require('../../models/consent.model');
const { query } = require('../../config/db'); // Kept for user check
const { createAuditLog } = require('../../services/audit.service');
const { HTTP_STATUS, SUCCESS_MESSAGES, ERROR_MESSAGES, AUDIT_ACTIONS } = require('../../utils/constants');
const { validateRequiredFields } = require('../../utils/validators');
const logger = require('../../utils/logger');
const scopeSnapshot = consent => ({
    dataCategory: consent.data_category, purpose: consent.purpose, accessLevel: consent.access_level,
    startTime: consent.start_time ? new Date(consent.start_time).toISOString() : null,
    endTime: consent.end_time ? new Date(consent.end_time).toISOString() : null,
    source: consent.source, visitId: consent.visit_id,
});

/**
 * Get active consents for current patient
 * GET /api/consent/active
 */
const getActiveConsents = async (req, res) => {
    try {
        const userId = req.user.id;
        const consents = await getActiveConsentsModel(userId);
        logger.info(`Fetched ${consents.length} active consents for user ${userId}`);

        // Audit log
        // Audit log removed to reduce clutter on dashboard load

        // Return array directly for frontend compatibility
        res.status(HTTP_STATUS.OK).json(consents);
    } catch (error) {
        logger.error('Get active consents failed:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: ERROR_MESSAGES.INTERNAL_ERROR,
        });
    }
};

/**
 * Get consent history for current patient
 * GET /api/consent/history
 */
const getConsentHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const consents = await getConsentHistoryModel(userId);

        // Audit log
        // Audit log removed to reduce clutter on dashboard load

        // Return array directly for frontend compatibility
        res.status(HTTP_STATUS.OK).json(consents);
    } catch (error) {
        logger.error('Get consent history failed:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: ERROR_MESSAGES.INTERNAL_ERROR,
        });
    }
};

/**
 * Grant new consent
 * POST /api/consent/grant
 */
const grantConsent = async (req, res) => {
    try {
        const patientId = req.user.id;
        const {
            recipientUserId,
            dataCategory,
            purpose,
            accessLevel,
            startTime,
            endTime,
        } = req.body;

        // Validate required fields
        const validation = validateRequiredFields(req.body, [
            'recipientUserId',
            'dataCategory',
            'purpose',
            'accessLevel',
        ]);

        if (!validation.isValid) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.REQUIRED_FIELDS_MISSING,
                missing: validation.missing,
            });
        }

        // Validate consent data (purpose, category, access level)
        const { validateConsentData } = require('../../utils/consent.validator');
        const consentValidation = validateConsentData(req.body);

        if (!consentValidation.isValid) {
            logger.warn('Consent validation failed:', {
                errors: consentValidation.errors,
                body: req.body
            });
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: 'Invalid consent data',
                errors: consentValidation.errors,
            });
        }

        // Check if recipient exists and is a doctor/staff
        // We still need a direct query here or a user model method for this specific check
        const recipientCheck = await query(
            `SELECT u.id, r.name as role_name 
             FROM users u 
             INNER JOIN roles r ON u.role_id = r.id 
             WHERE u.id = $1 AND u.status = 'active'`,
            [recipientUserId]
        );

        if (recipientCheck.rows.length === 0) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: 'Recipient user not found or inactive',
            });
        }

        const role = recipientCheck.rows[0].role_name;
        if (!['doctor','nurse','lab_technician','radiologist','pharmacist','insurance_provider','researcher'].includes(role)) {
            return res.status(400).json({ success: false, message: 'This account cannot receive patient-data consent' });
        }
        if (role === 'researcher' && (!['clinical_research','medical_study'].includes(purpose) || accessLevel !== 'read')) {
            return res.status(400).json({ success: false, message: 'Research access requires a research purpose and read-only permission' });
        }

        let finalEndTime = endTime;
        if (!finalEndTime && (req.body.durationHours || req.body.durationMinutes)) {
            const hours = Number(req.body.durationHours || 0);
            const minutes = Number(req.body.durationMinutes || 0);
            if (![hours, minutes].every(value => Number.isFinite(value) && Number.isInteger(value) && value >= 0)) {
                return res.status(400).json({ success: false, message: 'Duration must contain nonnegative whole hours and minutes' });
            }
            const totalMs = (hours * 60 * 60 * 1000) + (minutes * 60 * 1000);
            if (totalMs > 0) {
                const start = startTime ? new Date(startTime) : new Date();
                const end = new Date(start.getTime() + totalMs);
                if (!Number.isFinite(end.getTime())) return res.status(400).json({ success: false, message: 'Duration is outside the supported date range' });
                finalEndTime = end.toISOString();
            }
        }
        const finalValidation = validateConsentData({ ...req.body, endTime: finalEndTime });
        if (!finalValidation.isValid) return res.status(400).json({ success: false, message: 'Invalid consent data', errors: finalValidation.errors });

        const consent = await createConsent({
            patientId,
            recipientUserId,
            dataCategory,
            purpose,
            accessLevel,
            startTime,
            endTime: (finalEndTime === '' || !finalEndTime) ? null : finalEndTime
        });

        // Audit log
        await createAuditLog({
            userId: patientId,
            action: AUDIT_ACTIONS.CONSENT_GRANT,
            entityType: 'consent',
            entityId: consent.id,
            purpose: `Grant consent to user ${recipientUserId} for ${purpose}`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            requestMethod: req.method,
            requestPath: req.path,
            statusCode: HTTP_STATUS.CREATED,
            metadata: {
                patientId: patientId,
                recipientUserId: recipientUserId,
                dataCategory: dataCategory,
                accessLevel: accessLevel
            }
        });

        logger.info('Consent granted:', {
            consentId: consent.id,
            patientId,
            recipientUserId,
            dataCategory,
            purpose,
        });

        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            message: SUCCESS_MESSAGES.CONSENT_GRANTED,
            data: consent,
        });
    } catch (error) {
        logger.error('Grant consent failed:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: ERROR_MESSAGES.INTERNAL_ERROR,
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
};

/**
 * Revoke consent
 * PUT /api/consent/revoke/:consentId
 */
const revokeConsent = async (req, res) => {
    try {
        const patientId = req.user.id;
        const { consentId } = req.params;

        // Check if consent exists
        const consent = await findConsentById(consentId);

        if (!consent) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                message: 'Consent not found',
            });
        }

        if (consent.patient_id !== patientId) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                message: 'Consent not found or does not belong to you',
            });
        }

        if (consent.status === 'revoked') {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: 'Consent is already revoked',
            });
        }

        // Revoke consent
        const revokedConsent = await revokeConsentModel(consentId, patientId);

        // Audit log
        await createAuditLog({
            userId: patientId,
            action: AUDIT_ACTIONS.CONSENT_REVOKE,
            entityType: 'consent',
            entityId: consentId,
            purpose: `Revoke consent for ${consent.purpose}`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            requestMethod: req.method,
            requestPath: req.path,
            statusCode: HTTP_STATUS.OK,
            metadata: {
                patientId: patientId,
                recipientUserId: consent.recipient_user_id
            }
        });

        logger.info('Consent revoked:', {
            consentId,
            patientId,
            recipientUserId: consent.recipient_user_id,
        });

        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: SUCCESS_MESSAGES.CONSENT_REVOKED,
            data: revokedConsent,
        });
    } catch (error) {
        logger.error('Revoke consent failed:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: ERROR_MESSAGES.INTERNAL_ERROR,
        });
    }
};

/**
 * Update consent
 * PUT /api/consent/:id
 */
const updateConsent = async (req, res) => {
    try {
        const patientId = req.user.id;
        const { id: consentId } = req.params;
        const {
            dataCategory,
            purpose,
            accessLevel,
            endTime,
        } = req.body;

        // Check if consent exists
        const consent = await findConsentById(consentId);

        if (!consent) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                message: 'Consent not found',
            });
        }

        if (consent.patient_id !== patientId) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                message: 'Consent not found or does not belong to you',
            });
        }

        if (consent.status === 'revoked') {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: 'Cannot update revoked consent',
            });
        }

        // Validate the resulting scope, preserving omitted fields and provenance.
        const updates = {};
        for (const field of ['dataCategory', 'purpose', 'accessLevel', 'endTime']) {
            if (Object.prototype.hasOwnProperty.call(req.body, field)) updates[field] = req.body[field];
        }
        if (!Object.keys(updates).length) return res.status(400).json({ success: false, message: 'At least one consent field is required' });
        if (updates.endTime === '') updates.endTime = null;
        const merged = {
            dataCategory: consent.data_category,
            purpose: consent.purpose,
            accessLevel: consent.access_level,
            startTime: consent.start_time ? new Date(consent.start_time).toISOString() : undefined,
            endTime: consent.end_time ? new Date(consent.end_time).toISOString() : null,
            ...updates,
        };
        const generatedVisitPurpose = consent.source === 'visit' && consent.visit_id && consent.purpose === `Patient-approved care for visit ${consent.visit_id}`;
        const validation = require('../../utils/consent.validator').validateConsentData({
            ...merged,
            purpose: generatedVisitPurpose && !Object.prototype.hasOwnProperty.call(updates, 'purpose') ? 'treatment' : merged.purpose,
        });
        if (!validation.isValid) return res.status(400).json({ success: false, message: 'Invalid consent data', errors: validation.errors });
        const recipient = await query('SELECT r.name AS role_name FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=$1', [consent.recipient_user_id]);
        if (!recipient.rows.length || !['doctor','nurse','lab_technician','radiologist','pharmacist','insurance_provider','researcher'].includes(recipient.rows[0].role_name)) {
            return res.status(400).json({ success: false, message: 'This account cannot receive patient-data consent' });
        }
        if (recipient.rows[0].role_name === 'researcher' && (!['clinical_research','medical_study'].includes(merged.purpose) || merged.accessLevel !== 'read')) {
            return res.status(400).json({ success: false, message: 'Research access requires a research purpose and read-only permission' });
        }

        // Update consent
        const updatedConsent = await require('../../models/consent.model').updateConsent(consentId, patientId, updates);

        // Audit log
        await createAuditLog({
            userId: patientId,
            action: AUDIT_ACTIONS.CONSENT_UPDATE || 'CONSENT_UPDATE', // Fallback string if constant missing
            entityType: 'consent',
            entityId: consentId,
            purpose: `Update consent for ${updatedConsent.purpose}`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            requestMethod: req.method,
            requestPath: req.path,
            statusCode: HTTP_STATUS.OK,
            metadata: {
                patientId, recipientUserId: consent.recipient_user_id,
                previousConsent: scopeSnapshot(consent),
                updatedConsent: scopeSnapshot(updatedConsent),
            },
        });

        logger.info('Consent updated:', {
            consentId,
            patientId,
            updates: { dataCategory, purpose, accessLevel, endTime }
        });

        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Consent updated successfully',
            data: updatedConsent,
        });
    } catch (error) {
        logger.error('Update consent failed:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: ERROR_MESSAGES.INTERNAL_ERROR,
        });
    }
};

/**
 * Get patients for doctor
 * GET /api/consent/doctor/patients
 */
const getDoctorPatients = async (req, res) => {
    try {
        const doctorId = req.user.id;
        const patients = await require('../../models/consent.model').getPatientsWithActiveConsent(doctorId);

        // Audit log
        await createAuditLog({
            userId: doctorId,
            action: AUDIT_ACTIONS.CONSENT_VIEW,
            entityType: 'patient_list',
            purpose: 'View patients with active consent',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            requestMethod: req.method,
            requestPath: req.path,
            statusCode: HTTP_STATUS.OK,
        });

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: patients
        });
    } catch (error) {
        logger.error('Get doctor patients failed:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: ERROR_MESSAGES.INTERNAL_ERROR,
        });
    }
};

module.exports = {
    getActiveConsents,
    getConsentHistory,
    grantConsent,
    revokeConsent,
    updateConsent,
    getDoctorPatients,
};
