const { createAuditLog } = require('../services/audit.service');
const logger = require('../utils/logger');
const { redactSensitive } = require('../utils/redact');

/**
 * Audit logging middleware
 * Automatically logs all requests to protected routes
 */
const auditLog = (action, entityType = null) => {
    return async (req, res, next) => {
        // Store original res.json to intercept response
        const originalJson = res.json.bind(res);

        res.json = function (data) {
            // Log after response is sent
            setImmediate(async () => {
                try {
                    const logData = {
                        userId: req.user ? req.user.id : null,
                        action: action || `${req.method}_${req.path}`,
                        entityType: entityType,
                        entityId: req.params.id || req.params.recordId || req.params.patientId || req.params.visitId || req.params.userId || req.body?.id || null,
                        purpose: req.body.purpose || req.query.purpose || null,
                        ipAddress: req.ip || req.connection.remoteAddress,
                        userAgent: req.headers['user-agent'],
                        requestMethod: req.method,
                        requestPath: req.path,
                        statusCode: res.statusCode,
                        metadata: {
                            emergencyGrantId: req.emergencyGrantId || null,
                            patientId: req.clinicalContext?.patient_id || req.visitContext?.patient_id || null,
                            organizationId: req.organizationId || req.clinicalContext?.organization_id || req.visitContext?.organization_id || null,
                            query: redactSensitive(req.query),
                            params: redactSensitive(req.params),
                            // Don't log sensitive data like passwords
                            body: sanitizeBody(req.body),
                        },
                    };

                    await createAuditLog(logData);
                } catch (error) {
                    logger.error('Audit logging failed:', error);
                    // Don't throw error - audit logging should not break the main flow
                }
            });

            // Call original res.json
            return originalJson(data);
        };

        next();
    };
};

/**
 * Sanitize request body to remove sensitive data
 * @param {Object} body - Request body
 * @returns {Object} Sanitized body
 */
const sanitizeBody = (body) => {
    if (!body || typeof body !== 'object') {
        return body;
    }

    return redactSensitive(body);
};

/**
 * Audit middleware for specific actions
 */
const auditActions = {
    login: auditLog('user_login', 'user'),
    logout: auditLog('user_logout', 'user'),
    register: auditLog('user_register', 'user'),
    dataAccess: auditLog('data_access'),
    dataModify: auditLog('data_modify'),
    consentGrant: auditLog('consent_grant', 'consent'),
    consentRevoke: auditLog('consent_revoke', 'consent'),
    emergencyAccess: auditLog('emergency_access', 'emergency'),
    // EMR-specific actions
    medicalRecordCreate: auditLog('medical_record_create', 'medical_record'),
    medicalRecordView: auditLog('medical_record_view', 'medical_record'),
    diagnosisCreate: auditLog('diagnosis_create', 'diagnosis'),
    diagnosisAddendum: auditLog('diagnosis_addendum', 'diagnosis'),
    prescriptionCreate: auditLog('prescription_create', 'prescription'),
    prescriptionUpdate: auditLog('prescription_update', 'prescription'),
    labResultUpload: auditLog('lab_result_upload', 'lab_result'),
    imagingReportUpload: auditLog('imaging_report_upload', 'imaging_report'),
};

module.exports = {
    auditLog,
    auditActions,
};
