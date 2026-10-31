const { findMedication, getInteractionRule, getAllergyInfo } = require('../utils/drug.database');
const PrescriptionModel = require('../models/prescription.model');

class DrugInteractionService {
    /**
     * Check for drug-drug interactions
     * @param {string} newMedication - New medication to check
     * @param {Array} currentMedications - List of current medications
     * @returns {Object} Interaction results
     */
    static async checkDrugInteractions(newMedication, currentMedications) {
        const newMed = findMedication(newMedication);

        if (!newMed) {
            return {
                found: false,
                message: 'Medication not found in database',
                interactions: []
            };
        }

        const interactions = [];

        for (const currentMed of currentMedications) {
            const med = findMedication(currentMed);
            if (!med) continue;

            // Check for interaction rule
            const rule = getInteractionRule(newMed.genericName, med.genericName);

            if (rule) {
                interactions.push({
                    medication1: newMed.name,
                    medication2: med.name,
                    severity: rule.severity,
                    description: rule.description,
                    recommendation: rule.recommendation
                });
            }
        }

        return {
            found: interactions.length > 0,
            medication: newMed.name,
            interactionCount: interactions.length,
            interactions: interactions.sort((a, b) => {
                // Sort by severity: high > moderate > low
                const severityOrder = { high: 3, moderate: 2, low: 1 };
                return severityOrder[b.severity] - severityOrder[a.severity];
            })
        };
    }

    /**
     * Check for drug interactions for a patient
     * @param {string} patientId - Patient user ID
     * @param {string} newMedication - New medication to prescribe
     * @returns {Promise<Object>} Interaction results
     */
    static async checkPatientDrugInteractions(patientId, newMedication) {
        // Get patient's active prescriptions
        const activePrescriptions = await PrescriptionModel.getActiveByPatientId(patientId);

        const currentMedications = activePrescriptions.map(p => p.medication);

        return this.checkDrugInteractions(newMedication, currentMedications);
    }

    /**
     * Check for allergy contraindications
     * @param {string} medication - Medication name
     * @param {Array} patientAllergies - Patient's known allergies
     * @returns {Object} Allergy check results
     */
    static checkAllergyContraindications(medication, patientAllergies) {
        const med = findMedication(medication);

        if (!med) {
            return {
                found: false,
                message: 'Medication not found in database',
                contraindications: []
            };
        }

        const contraindications = [];

        for (const allergy of patientAllergies) {
            const allergyInfo = getAllergyInfo(allergy);

            if (!allergyInfo) continue;

            // Check if medication is in cross-sensitivities
            if (allergyInfo.crossSensitivities.includes(med.genericName) ||
                allergyInfo.crossSensitivities.includes(med.name.toLowerCase())) {
                contraindications.push({
                    allergy: allergy,
                    medication: med.name,
                    severity: 'high',
                    description: `Patient has known allergy to ${allergy}. ${med.name} may cause cross-sensitivity.`,
                    alternatives: allergyInfo.alternatives
                });
            }
        }

        return {
            found: contraindications.length > 0,
            medication: med.name,
            contraindications
        };
    }

    /**
     * Comprehensive medication safety check
     * @param {string} patientId - Patient user ID
     * @param {string} medication - Medication to check
     * @param {Array} patientAllergies - Patient allergies
     * @returns {Promise<Object>} Complete safety check results
     */
    static async comprehensiveSafetyCheck(patientId, medication, patientAllergies = []) {
        // Check drug interactions
        const interactionResults = await this.checkPatientDrugInteractions(patientId, medication);

        // Check allergy contraindications
        const allergyResults = this.checkAllergyContraindications(medication, patientAllergies);

        const hasIssues = interactionResults.found || allergyResults.found;
        const highSeverityIssues = [
            ...interactionResults.interactions.filter(i => i.severity === 'high'),
            ...allergyResults.contraindications.filter(c => c.severity === 'high')
        ];

        return {
            safe: !hasIssues,
            medication,
            severity: highSeverityIssues.length > 0 ? 'high' :
                (interactionResults.found || allergyResults.found) ? 'moderate' : 'low',
            drugInteractions: interactionResults,
            allergyContraindications: allergyResults,
            recommendation: this.generateRecommendation(interactionResults, allergyResults)
        };
    }

    /**
     * Generate recommendation based on check results
     * @param {Object} interactionResults - Drug interaction results
     * @param {Object} allergyResults - Allergy check results
     * @returns {string} Recommendation
     */
    static generateRecommendation(interactionResults, allergyResults) {
        if (!interactionResults.found && !allergyResults.found) {
            return 'No significant interactions or contraindications found. Medication appears safe to prescribe.';
        }

        const recommendations = [];

        if (allergyResults.found) {
            recommendations.push('CONTRAINDICATED: Patient has allergies that may cause adverse reactions. Consider alternatives.');
        }

        const highInteractions = interactionResults.interactions.filter(i => i.severity === 'high');
        if (highInteractions.length > 0) {
            recommendations.push('HIGH RISK: Significant drug interactions detected. Review interactions carefully before prescribing.');
        }

        const moderateInteractions = interactionResults.interactions.filter(i => i.severity === 'moderate');
        if (moderateInteractions.length > 0) {
            recommendations.push('CAUTION: Moderate drug interactions detected. Monitor patient closely if prescribed.');
        }

        return recommendations.join(' ');
    }

    /**
     * Get alternative medications
     * @param {string} medication - Original medication
     * @param {string} category - Medication category
     * @returns {Array} Alternative medications
     */
    static getAlternatives(medication, category = null) {
        const med = findMedication(medication);

        if (!med) {
            return [];
        }

        const { getMedicationsByCategory } = require('../utils/drug.database');
        const categoryMeds = getMedicationsByCategory(category || med.category);

        // Return medications in same category except the original
        return categoryMeds
            .filter(m => m.genericName !== med.genericName)
            .map(m => ({
                name: m.name,
                genericName: m.genericName,
                category: m.category
            }));
    }
}

module.exports = DrugInteractionService;
