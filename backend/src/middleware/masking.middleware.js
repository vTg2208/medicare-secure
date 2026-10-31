const logger = require('../utils/logger');
const { ROLES } = require('../utils/constants');

/**
 * Sensitive fields that should be masked based on access level
 */
const SENSITIVE_FIELDS = {
    // Patient PII
    patient: ['govt_id_hash', 'date_of_birth', 'address', 'postal_code', 'emergency_contact_phone'],

    // Clinical data
    clinical: ['diagnosis', 'prescription_details', 'lab_values'],

    // Financial
    financial: ['insurance_id', 'billing_amount', 'payment_details'],
};

/**
 * Mask a single field value
 * @param {String} value - Value to mask
 * @param {String} maskType - Type of masking (partial, full, hash)
 * @returns {String} Masked value
 */
const maskValue = (value, maskType = 'partial') => {
    if (!value) return value;

    const strValue = String(value);

    switch (maskType) {
        case 'full':
            return '***MASKED***';

        case 'hash':
            // Show only first 2 and last 2 characters
            if (strValue.length <= 4) return '****';
            return strValue.substring(0, 2) + '****' + strValue.substring(strValue.length - 2);

        case 'partial':
        default:
            // Show only first character
            return strValue.charAt(0) + '*'.repeat(Math.min(strValue.length - 1, 8));
    }
};

/**
 * Mask sensitive fields in an object
 * @param {Object} data - Data object to mask
 * @param {Array} fieldsToMask - Fields that should be masked
 * @param {String} maskType - Type of masking
 * @returns {Object} Data with masked fields
 */
const maskFields = (data, fieldsToMask, maskType = 'partial') => {
    if (!data || typeof data !== 'object') return data;

    const masked = { ...data };

    fieldsToMask.forEach(field => {
        if (masked[field] !== undefined) {
            masked[field] = maskValue(masked[field], maskType);
        }
    });

    return masked;
};

/**
 * Determine which fields should be masked based on user role and consent
 * @param {String} userRole - Role of the requesting user
 * @param {Boolean} hasConsent - Whether user has consent to access data
 * @param {String} dataCategory - Category of data being accessed
 * @returns {Array} Fields to mask
 */
const getFieldsToMask = (userRole, hasConsent, dataCategory = 'all') => {
    // System admins and compliance officers can see everything
    if ([ROLES.SYSTEM_ADMIN, ROLES.COMPLIANCE_OFFICER].includes(userRole)) {
        return [];
    }

    // If user has explicit consent, don't mask clinical data
    if (hasConsent && dataCategory === 'clinical_notes') {
        return SENSITIVE_FIELDS.patient; // Still mask PII
    }

    // Researchers only see anonymized data
    if (userRole === ROLES.RESEARCHER) {
        return [...SENSITIVE_FIELDS.patient, ...SENSITIVE_FIELDS.clinical];
    }

    // Insurance providers only see financial data
    if (userRole === ROLES.INSURANCE_PROVIDER) {
        return [...SENSITIVE_FIELDS.patient, ...SENSITIVE_FIELDS.clinical];
    }

    // Default: mask all sensitive fields
    return [...SENSITIVE_FIELDS.patient, ...SENSITIVE_FIELDS.clinical, ...SENSITIVE_FIELDS.financial];
};

/**
 * Middleware to mask sensitive data in responses
 * @param {String} dataCategory - Category of data being accessed
 */
const maskSensitiveData = (dataCategory = 'all') => {
    return (req, res, next) => {
        // Store original json method
        const originalJson = res.json;

        // Override json method to mask data before sending
        res.json = function (data) {
            try {
                const userRole = req.user?.roleName || req.user?.role_name;
                const hasConsent = req.consentVerified || false;

                if (data && data.data) {
                    const fieldsToMask = getFieldsToMask(userRole, hasConsent, dataCategory);

                    if (fieldsToMask.length > 0) {
                        // Mask array of objects
                        if (Array.isArray(data.data)) {
                            data.data = data.data.map(item =>
                                maskFields(item, fieldsToMask, 'partial')
                            );
                        }
                        // Mask single object
                        else if (typeof data.data === 'object') {
                            data.data = maskFields(data.data, fieldsToMask, 'partial');
                        }

                        logger.info(`Masked ${fieldsToMask.length} sensitive fields for role: ${userRole}`);
                    }
                }

                // Call original json method
                return originalJson.call(this, data);
            } catch (error) {
                logger.error('Data masking error:', error);
                // If masking fails, still send response (fail open for availability)
                return originalJson.call(this, data);
            }
        };

        next();
    };
};

module.exports = {
    maskSensitiveData,
    maskFields,
    maskValue,
    SENSITIVE_FIELDS,
};
