// Format checks only. Credential ownership must be reviewed by an authorized administrator.
// No government or medical registry integration is configured in this application.
const validateGovernmentIdFormat = async (value) => {
    const normalized = String(value).replace(/[\s-]/g, '');
    if (!/^\d{12}$/.test(normalized)) throw new Error('Government ID must contain 12 digits');
    return { isValid: false, requiresReview: true };
};
const validateMedicalRegistrationFormat = async (value) => {
    if (typeof value !== 'string' || !/^[A-Z0-9/\s-]{3,100}$/i.test(value)) throw new Error('Enter a valid medical registration number');
    return { isValid: false, requiresReview: true };
};
module.exports = { validateGovernmentIdFormat, validateMedicalRegistrationFormat };
