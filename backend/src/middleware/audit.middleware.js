const { logAuditEvent } = require('../services/audit.service');
const logger = require('../utils/logger');

/**
 * Audit logging middleware
 * Automatically logs all requests to protected routes
 */
const auditLog = (action, entityType = null) => {
    return async (req, res, next) => {
        if (action) req.auditAction = { action, entityType };
        // A route-specific audit declares its action while the first wrapper
        // remains responsible for the single durable append and response.
        if (req.auditMiddlewareInstalled) return next();
        req.auditMiddlewareInstalled = true;
        // Store original res.json to intercept response
        const originalJson = res.json.bind(res);
        let sending = false;

        res.json = function (data) {
            if (sending) return res;
            sending = true;
            // Transactional handlers set this only after their transaction,
            // including logAuditEvent(..., client), has committed.
            if (req.auditEventRecorded === true) return originalJson(data);
            // Do not release clinical data until durable evidence is recorded.
            const statusCode = res.statusCode;
            (async () => {
                try {
                    const logData = {
                        userId: req.user ? req.user.id : null,
                        action: req.auditAction?.action || action || `${req.method}_${entityType || 'protected_resource'}`,
                        entityType: req.auditAction?.entityType || entityType,
                        entityId: auditEntityId(req, data),
                        purpose: req.consentContext?.purpose || null,
                        ipAddress: req.ip || req.connection?.remoteAddress,
                        userAgent: req.headers?.['user-agent'],
                        requestMethod: req.method,
                        requestPath: `${req.baseUrl || ''}${req.route?.path || ''}`,
                        statusCode,
                        metadata: {
                            emergencyGrantId: req.emergencyGrantId || null,
                            patientId: req.clinicalContext?.patient_id || req.visitContext?.patient_id || null,
                            organizationId: req.organizationId || req.clinicalContext?.organization_id || req.visitContext?.organization_id || null,
                            consentId: req.consentContext?.id || null,
                            consentPurpose: req.consentContext?.purpose || null,
                            consentCategory: req.consentContext?.dataCategory || req.clinicalCategory || null,
                            consentSource: req.consentContext?.source || null,
                            patientIds: collectPatientIds(data, req),
                            requestId: req.requestId || null,
                        },
                    };

                    await logAuditEvent(logData);
                    req.auditEventRecorded = true;
                    return originalJson(data);
                } catch (error) {
                    logger.error('Audit logging failed', { code: error.code });
                    if (res.headersSent) return;
                    if (statusCode >= 400) return originalJson(data);
                    res.status(503);
                    return originalJson({ success: false, message: 'Auditing is unavailable. Please try again later.' });
                }
            })();
            return res;
        };

        next();
    };
};

// Read only canonical patient identity fields from server response objects.
// Exceeding a bound fails closed instead of silently dropping affected patients.
const collectPatientIds = (response, req) => {
    const ids = new Set();
    const validId = value => typeof value === 'string' && /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(value);
    for (const id of [req.clinicalContext?.patient_id, req.visitContext?.patient_id]) if (validId(id)) ids.add(id);
    const pending = [{ value: response?.data, depth: 0 }];
    const seen = new WeakSet();
    let inspected = 0;
    while (pending.length) {
        const { value, depth } = pending.pop();
        if (!value || typeof value !== 'object' || seen.has(value)) continue;
        if (++inspected > 10000 || depth > 20) throw new Error('Response exceeds auditable patient scope');
        seen.add(value);
        for (const [key, item] of Object.entries(value)) {
            if (++inspected > 10000) throw new Error('Response exceeds auditable patient scope');
            if ((key === 'patientId' || key === 'patient_id') && validId(item)) ids.add(item);
            if (ids.size > 1000) throw new Error('Response exceeds auditable patient scope');
            if (item && typeof item === 'object') pending.push({ value: item, depth: depth + 1 });
        }
    }
    return [...ids];
};

const auditEntityId = (req, data) => {
    const candidate = req.params?.id || req.params?.recordId || req.params?.diagnosisId || req.params?.prescriptionId || req.params?.patientId || req.params?.visitId || req.params?.userId || data?.data?.id || req.body?.recordId || req.body?.visitId || null;
    return typeof candidate === 'string' && /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(candidate) ? candidate : null;
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
    collectPatientIds,
};
