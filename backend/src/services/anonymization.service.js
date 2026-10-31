const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Anonymization Service
 * Provides methods to anonymize healthcare data for research and analytics
 */

/**
 * Hash a value using SHA-256
 * @param {String} value - Value to hash
 * @param {String} salt - Optional salt
 * @returns {String} Hashed value
 */
const hashValue = (value, salt = '') => {
    if (!value) return null;
    return crypto
        .createHash('sha256')
        .update(value + salt)
        .digest('hex');
};

/**
 * Generate a pseudonymous ID for a patient
 * @param {String} patientId - Original patient ID
 * @param {String} studyId - Study/research ID for consistent pseudonyms within a study
 * @returns {String} Pseudonymous ID
 */
const generatePseudonym = (patientId, studyId = 'default') => {
    return hashValue(patientId, studyId).substring(0, 16);
};

/**
 * Generalize age into age ranges for k-anonymity
 * @param {Number} age - Exact age
 * @returns {String} Age range
 */
const generalizeAge = (age) => {
    if (age < 18) return '0-17';
    if (age < 30) return '18-29';
    if (age < 40) return '30-39';
    if (age < 50) return '40-49';
    if (age < 60) return '50-59';
    if (age < 70) return '60-69';
    return '70+';
};

/**
 * Generalize date to year only
 * @param {Date|String} date - Date to generalize
 * @returns {String} Year only
 */
const generalizeDate = (date) => {
    if (!date) return null;
    const dateObj = new Date(date);
    return dateObj.getFullYear().toString();
};

/**
 * Generalize location to city/state only (remove street address)
 * @param {Object} location - Location object with address, city, state
 * @returns {Object} Generalized location
 */
const generalizeLocation = (location) => {
    if (!location) return null;

    return {
        city: location.city || null,
        state: location.state || null,
        country: location.country || null,
        // Remove: address, postal_code
    };
};

/**
 * Remove direct identifiers from patient data
 * @param {Object} patientData - Patient data object
 * @returns {Object} Anonymized patient data
 */
const removeDirectIdentifiers = (patientData) => {
    const anonymized = { ...patientData };

    // Remove direct identifiers
    const directIdentifiers = [
        'id',
        'user_id',
        'email',
        'phone',
        'first_name',
        'last_name',
        'govt_id_hash',
        'unique_health_id',
        'emergency_contact_name',
        'emergency_contact_phone',
        'address',
        'postal_code',
    ];

    directIdentifiers.forEach(field => {
        delete anonymized[field];
    });

    return anonymized;
};

/**
 * Anonymize patient data for research
 * @param {Object} patientData - Patient data object
 * @param {String} studyId - Study ID for consistent pseudonyms
 * @param {Number} kValue - K-anonymity value (minimum group size)
 * @returns {Object} Anonymized data
 */
const anonymizePatientData = (patientData, studyId = 'default', kValue = 5) => {
    try {
        // Generate pseudonymous ID
        const pseudonymId = generatePseudonym(patientData.id || patientData.user_id, studyId);

        // Remove direct identifiers
        let anonymized = removeDirectIdentifiers(patientData);

        // Add pseudonymous ID
        anonymized.pseudonym_id = pseudonymId;

        // Generalize quasi-identifiers
        if (anonymized.date_of_birth) {
            const age = new Date().getFullYear() - new Date(anonymized.date_of_birth).getFullYear();
            anonymized.age_range = generalizeAge(age);
            delete anonymized.date_of_birth;
        }

        // Generalize location
        if (anonymized.city || anonymized.state) {
            anonymized.location = generalizeLocation({
                city: anonymized.city,
                state: anonymized.state,
                country: anonymized.country,
            });
            delete anonymized.city;
            delete anonymized.state;
            delete anonymized.country;
        }

        // Generalize dates to year only
        if (anonymized.created_at) {
            anonymized.registration_year = generalizeDate(anonymized.created_at);
            delete anonymized.created_at;
        }

        if (anonymized.updated_at) {
            delete anonymized.updated_at;
        }

        logger.info(`Anonymized patient data for study ${studyId}`);
        return anonymized;

    } catch (error) {
        logger.error('Anonymization error:', error);
        throw new Error('Failed to anonymize patient data');
    }
};

/**
 * Anonymize a dataset (array of records) with k-anonymity
 * @param {Array} dataset - Array of patient records
 * @param {String} studyId - Study ID
 * @param {Number} kValue - Minimum group size for k-anonymity
 * @returns {Array} Anonymized dataset
 */
const anonymizeDataset = (dataset, studyId = 'default', kValue = 5) => {
    if (!Array.isArray(dataset) || dataset.length === 0) {
        return [];
    }

    // Anonymize each record
    const anonymized = dataset.map(record =>
        anonymizePatientData(record, studyId, kValue)
    );

    // TODO: Implement k-anonymity verification
    // For now, just return anonymized data
    // In production, you would verify that each combination of quasi-identifiers
    // appears at least k times in the dataset

    logger.info(`Anonymized dataset with ${anonymized.length} records for study ${studyId}`);
    return anonymized;
};

/**
 * Aggregate data for statistical analysis
 * @param {Array} dataset - Dataset to aggregate
 * @param {String} groupBy - Field to group by
 * @returns {Object} Aggregated statistics
 */
const aggregateData = (dataset, groupBy = 'age_range') => {
    if (!Array.isArray(dataset) || dataset.length === 0) {
        return {};
    }

    const groups = {};

    dataset.forEach(record => {
        const key = record[groupBy] || 'unknown';

        if (!groups[key]) {
            groups[key] = {
                count: 0,
                records: [],
            };
        }

        groups[key].count++;
        groups[key].records.push(record);
    });

    // Remove individual records, keep only counts
    Object.keys(groups).forEach(key => {
        delete groups[key].records;
    });

    return groups;
};

module.exports = {
    anonymizePatientData,
    anonymizeDataset,
    aggregateData,
    generatePseudonym,
    generalizeAge,
    generalizeDate,
    generalizeLocation,
    hashValue,
};
