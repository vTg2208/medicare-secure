/**
 * Consent Purpose Validator
 * Defines allowed purposes for consent grants and validates them
 */

// Allowed consent purposes for healthcare data access
const ALLOWED_PURPOSES = {
    // Clinical purposes
    TREATMENT: 'treatment',
    DIAGNOSIS: 'diagnosis',
    CONSULTATION: 'consultation',
    SECOND_OPINION: 'second_opinion',
    EMERGENCY_CARE: 'emergency_care',
    FOLLOW_UP: 'follow_up',

    // Administrative purposes
    BILLING: 'billing',
    INSURANCE_CLAIM: 'insurance_claim',
    REFERRAL: 'referral',

    // Research purposes
    CLINICAL_RESEARCH: 'clinical_research',
    MEDICAL_STUDY: 'medical_study',

    // Other
    LEGAL_REQUIREMENT: 'legal_requirement',
    PATIENT_REQUEST: 'patient_request',
};

// Data categories that can be consented
const DATA_CATEGORIES = {
    CLINICAL_NOTES: 'clinical_notes',
    LAB_RESULTS: 'lab_results',
    IMAGING: 'imaging',
    PRESCRIPTIONS: 'prescriptions',
    VITAL_SIGNS: 'vital_signs',
    ALLERGIES: 'allergies',
    IMMUNIZATIONS: 'immunizations',
    PROCEDURES: 'procedures',
    DIAGNOSES: 'diagnoses',
    ALL_MEDICAL_DATA: 'all_medical_data',
    INSURANCE_CLAIM: 'insurance_claim',
};

// Access levels
const ACCESS_LEVELS = {
    READ: 'read',
    WRITE: 'write',
};

/**
 * Validate consent purpose
 * @param {String} purpose - Purpose to validate
 * @returns {Object} Validation result
 */
const validatePurpose = (purpose) => {
    if (!purpose) {
        return {
            isValid: false,
            error: 'Purpose is required',
        };
    }

    const allowedValues = Object.values(ALLOWED_PURPOSES);

    if (!allowedValues.includes(purpose)) {
        return {
            isValid: false,
            error: `Invalid purpose. Allowed values: ${allowedValues.join(', ')}`,
        };
    }

    return {
        isValid: true,
    };
};

/**
 * Validate data category
 * @param {String} category - Data category to validate
 * @returns {Object} Validation result
 */
const validateDataCategory = (category) => {
    if (!category) {
        return {
            isValid: false,
            error: 'Data category is required',
        };
    }

    const allowedValues = Object.values(DATA_CATEGORIES);

    if (!allowedValues.includes(category)) {
        return {
            isValid: false,
            error: `Invalid data category. Allowed values: ${allowedValues.join(', ')}`,
        };
    }

    return {
        isValid: true,
    };
};

/**
 * Validate access level
 * @param {String} accessLevel - Access level to validate
 * @returns {Object} Validation result
 */
const validateAccessLevel = (accessLevel) => {
    if (!accessLevel) {
        return {
            isValid: false,
            error: 'Access level is required',
        };
    }

    const allowedValues = Object.values(ACCESS_LEVELS);

    if (!allowedValues.includes(accessLevel)) {
        return {
            isValid: false,
            error: `Invalid access level. Allowed values: ${allowedValues.join(', ')}`,
        };
    }

    return {
        isValid: true,
    };
};

/**
 * Validate complete consent data
 * @param {Object} consentData - Consent data to validate
 * @returns {Object} Validation result
 */
const validateConsentData = (consentData) => {
    const errors = [];

    // Validate purpose
    const purposeValidation = validatePurpose(consentData.purpose);
    if (!purposeValidation.isValid) {
        errors.push(purposeValidation.error);
    }

    // Validate data category
    const categoryValidation = validateDataCategory(consentData.dataCategory);
    if (!categoryValidation.isValid) {
        errors.push(categoryValidation.error);
    }

    // Validate access level
    const accessLevelValidation = validateAccessLevel(consentData.accessLevel);
    if (!accessLevelValidation.isValid) {
        errors.push(accessLevelValidation.error);
    }

    // Validate time constraints if provided and not empty
    if (consentData.endTime && consentData.endTime !== '') {
        const endTime = new Date(consentData.endTime);
        const startTime = consentData.startTime ? new Date(consentData.startTime) : new Date();

        if (endTime <= startTime) {
            errors.push('End time must be after start time');
        }

        if (endTime <= new Date()) {
            errors.push('End time must be in the future');
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
};

module.exports = {
    ALLOWED_PURPOSES,
    DATA_CATEGORIES,
    ACCESS_LEVELS,
    validatePurpose,
    validateDataCategory,
    validateAccessLevel,
    validateConsentData,
};
