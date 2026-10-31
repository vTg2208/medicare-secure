/**
 * Validate email format
 * @param {String} email - Email to validate
 * @returns {Boolean} Is valid email
 */
const isValidEmail = (email) => {
    if (typeof email !== 'string' || email.length > 254) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Validate phone number format
 * Accepts formats: +1234567890, 1234567890, (123) 456-7890
 * @param {String} phone - Phone number to validate
 * @returns {Boolean} Is valid phone
 */
const isValidPhone = (phone) => {
    if (typeof phone !== 'string' || phone.length > 20) return false;
    const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
    return phoneRegex.test(phone);
};

/**
 * Validate password strength
 * Requirements: At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
 * @param {String} password - Password to validate
 * @returns {Object} Validation result with isValid and errors
 */
const validatePassword = (password) => {
    const errors = [];

    if (typeof password !== 'string' || !password) {
        return { isValid: false, errors: ['Password is required'] };
    }

    if (Buffer.byteLength(password, 'utf8') > 72) {
        errors.push('Password must not exceed 72 UTF-8 bytes');
    }

    if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
};

/**
 * Validate license number format
 * @param {String} license - License number to validate
 * @returns {Boolean} Is valid license
 */
const isValidLicense = (license) => {
    if (!license) return false;
    // License should be alphanumeric and at least 5 characters
    return /^[A-Z0-9]{5,}$/i.test(license);
};

/**
 * Validate date format (YYYY-MM-DD)
 * @param {String} date - Date to validate
 * @returns {Boolean} Is valid date
 */
const isValidDate = (date) => {
    if (!date) return false;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) return false;

    const parsedDate = new Date(date);
    return parsedDate instanceof Date && !isNaN(parsedDate);
};

/**
 * Validate age (must be at least minAge years old)
 * @param {String} dateOfBirth - Date of birth (YYYY-MM-DD)
 * @param {Number} minAge - Minimum age required
 * @returns {Boolean} Is valid age
 */
const isValidAge = (dateOfBirth, minAge = 0) => {
    if (!isValidDate(dateOfBirth)) return false;

    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
    }

    return age >= minAge;
};

/**
 * Sanitize input string
 * @param {String} input - Input to sanitize
 * @returns {String} Sanitized input
 */
const sanitizeInput = (input) => {
    if (!input) return '';
    return input.trim().replace(/[<>]/g, '');
};

/**
 * Validate UUID format
 * @param {String} uuid - UUID to validate
 * @returns {Boolean} Is valid UUID
 */
const isValidUUID = (uuid) => {
    if (!uuid) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
};

/**
 * Validate required fields
 * @param {Object} data - Data object to validate
 * @param {Array} requiredFields - Array of required field names
 * @returns {Object} Validation result with isValid and missing fields
 */
const validateRequiredFields = (data, requiredFields) => {
    const missing = requiredFields.filter(field => !data[field]);

    return {
        isValid: missing.length === 0,
        missing,
    };
};

module.exports = {
    isValidEmail,
    isValidPhone,
    validatePassword,
    isValidLicense,
    isValidDate,
    isValidAge,
    sanitizeInput,
    isValidUUID,
    validateRequiredFields,
};
