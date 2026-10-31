const { findMedication } = require('../utils/drug.database');
const DrugInteractionService = require('./drug.interaction.service');
const PrescriptionModel = require('../models/prescription.model');

class PrescriptionValidatorService {
    /**
     * Validate prescription before creation
     * @param {Object} prescriptionData - Prescription data
     * @param {string} patientId - Patient user ID
     * @param {Array} patientAllergies - Patient allergies
     * @returns {Promise<Object>} Validation results
     */
    static async validatePrescription(prescriptionData, patientId, patientAllergies = []) {
        const errors = [];
        const warnings = [];

        // Validate medication exists
        const medication = findMedication(prescriptionData.medication);
        if (!medication) {
            warnings.push({
                field: 'medication',
                message: 'Medication not found in drug database. Manual verification required.'
            });
        }

        // Validate dosage format
        if (!PrescriptionModel.validateDosage(prescriptionData.dosage)) {
            errors.push({
                field: 'dosage',
                message: 'Invalid dosage format. Use format like "500mg", "10ml", or "2 tablets".'
            });
        }

        // Validate frequency
        if (!this.validateFrequency(prescriptionData.frequency)) {
            errors.push({
                field: 'frequency',
                message: 'Invalid frequency format. Use format like "twice daily", "every 6 hours", or "as needed".'
            });
        }

        // Validate route
        const validRoutes = ['oral', 'intravenous', 'intramuscular', 'subcutaneous', 'topical', 'inhalation', 'other'];
        if (prescriptionData.route && !validRoutes.includes(prescriptionData.route)) {
            errors.push({
                field: 'route',
                message: `Invalid route. Must be one of: ${validRoutes.join(', ')}`
            });
        }

        // Validate quantity and refills
        if (prescriptionData.quantity && prescriptionData.quantity < 1) {
            errors.push({
                field: 'quantity',
                message: 'Quantity must be at least 1'
            });
        }

        if (prescriptionData.refills && prescriptionData.refills < 0) {
            errors.push({
                field: 'refills',
                message: 'Refills cannot be negative'
            });
        }

        // Check drug interactions if medication is in database
        let safetyCheck = null;
        if (medication) {
            safetyCheck = await DrugInteractionService.comprehensiveSafetyCheck(
                patientId,
                prescriptionData.medication,
                patientAllergies
            );

            // Add warnings for interactions
            if (safetyCheck.drugInteractions.found) {
                safetyCheck.drugInteractions.interactions.forEach(interaction => {
                    const level = interaction.severity === 'high' ? 'error' : 'warning';
                    const message = {
                        field: 'medication',
                        message: `${interaction.severity.toUpperCase()} interaction with ${interaction.medication2}: ${interaction.description}`,
                        recommendation: interaction.recommendation,
                        severity: interaction.severity
                    };

                    if (level === 'error' && interaction.severity === 'high') {
                        errors.push(message);
                    } else {
                        warnings.push(message);
                    }
                });
            }

            // Add errors for allergy contraindications
            if (safetyCheck.allergyContraindications.found) {
                safetyCheck.allergyContraindications.contraindications.forEach(contraindication => {
                    errors.push({
                        field: 'medication',
                        message: contraindication.description,
                        alternatives: contraindication.alternatives,
                        severity: 'high'
                    });
                });
            }
        }

        const isValid = errors.length === 0;

        return {
            valid: isValid,
            errors,
            warnings,
            safetyCheck,
            recommendation: isValid ?
                'Prescription passed validation checks.' :
                'Prescription has validation errors. Please review before proceeding.'
        };
    }

    /**
     * Validate frequency format
     * @param {string} frequency - Frequency string
     * @returns {boolean} True if valid
     */
    static validateFrequency(frequency) {
        if (!frequency || typeof frequency !== 'string') return false;

        const validPatterns = [
            /^\d+\s*times?\s*(daily|per day|a day)$/i,
            /^(once|twice|thrice)\s*(daily|per day|a day)$/i,
            /^every\s+\d+\s*(hours?|hrs?)$/i,
            /^(morning|evening|night|bedtime)$/i,
            /^as\s+needed$/i,
            /^prn$/i,
            /^q\d+h$/i, // Medical abbreviation (e.g., q6h = every 6 hours)
            /^(qd|bid|tid|qid)$/i // Medical abbreviations
        ];

        return validPatterns.some(pattern => pattern.test(frequency.trim()));
    }

    /**
     * Validate dosage range for specific medication
     * @param {string} medication - Medication name
     * @param {string} dosage - Dosage string
     * @returns {Object} Validation result
     */
    static validateDosageRange(medication, dosage) {
        const med = findMedication(medication);

        if (!med) {
            return {
                valid: true,
                message: 'Medication not in database. Manual verification required.'
            };
        }

        // Extract numeric value from dosage
        const match = dosage.match(/^(\d+(\.\d+)?)/);
        if (!match) {
            return {
                valid: false,
                message: 'Cannot extract dosage value'
            };
        }

        const value = parseFloat(match[1]);

        // Simple range checking (can be enhanced with actual therapeutic ranges)
        // This is a simplified example
        const dosageRanges = {
            'warfarin': { min: 1, max: 10, unit: 'mg' },
            'metformin': { min: 500, max: 2000, unit: 'mg' },
            'lisinopril': { min: 2.5, max: 40, unit: 'mg' },
            'simvastatin': { min: 5, max: 40, unit: 'mg' }
        };

        const range = dosageRanges[med.genericName];

        if (!range) {
            return {
                valid: true,
                message: 'No dosage range defined for this medication'
            };
        }

        if (value < range.min || value > range.max) {
            return {
                valid: false,
                message: `Dosage outside typical range (${range.min}-${range.max}${range.unit}). Verify dosage.`,
                range: range
            };
        }

        return {
            valid: true,
            message: 'Dosage within normal range'
        };
    }

    /**
     * Check if prescriber has valid credentials
     * @param {string} prescriberId - Prescriber user ID
     * @returns {Promise<boolean>} True if valid
     */
    static async validatePrescriberCredentials(prescriberId) {
        const pool = require('../config/db');

        const query = `
            SELECT u.id, r.name as role, som.professional_license, som.license_verified
            FROM users u
            JOIN roles r ON u.role_id = r.id
            LEFT JOIN staff_org_mapping som ON u.id = som.user_id
            WHERE u.id = $1
        `;

        const result = await pool.query(query, [prescriberId]);

        if (result.rows.length === 0) {
            return false;
        }

        const user = result.rows[0];

        // Check if user is a doctor
        if (user.role !== 'doctor') {
            return false;
        }

        // Check if license is verified (if applicable)
        if (user.professional_license && !user.license_verified) {
            return false;
        }

        return true;
    }

    /**
     * Validate prescription update
     * @param {string} prescriptionId - Prescription ID
     * @param {string} newStatus - New status
     * @returns {Promise<Object>} Validation result
     */
    static async validateStatusUpdate(prescriptionId, newStatus) {
        const prescription = await PrescriptionModel.findById(prescriptionId);

        if (!prescription) {
            return {
                valid: false,
                message: 'Prescription not found'
            };
        }

        const validTransitions = {
            'pending': ['active', 'cancelled'],
            'active': ['completed', 'cancelled', 'expired'],
            'completed': [],
            'cancelled': [],
            'expired': []
        };

        const allowedStatuses = validTransitions[prescription.status] || [];

        if (!allowedStatuses.includes(newStatus)) {
            return {
                valid: false,
                message: `Cannot transition from ${prescription.status} to ${newStatus}`,
                allowedStatuses
            };
        }

        return {
            valid: true,
            message: 'Status transition is valid'
        };
    }
}

module.exports = PrescriptionValidatorService;
