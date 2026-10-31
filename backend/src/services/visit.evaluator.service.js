/**
 * Dynamic Visit Evaluator Service
 * Evaluates visit progress and suggests next actions
 */

const pool = require('../config/db');
const logger = require('../utils/logger');

class DynamicVisitEvaluatorService {
    /**
     * Evaluate visit progress
     * @param {String} visitId - Visit ID
     * @returns {Promise<Object>} Evaluation results
     */
    static async evaluateVisit(visitId) {
        try {
            const evaluation = {
                visitId,
                completeness: 0,
                pendingActions: [],
                suggestions: [],
                warnings: [],
                metrics: {}
            };

            // Get visit details
            const visit = await this.getVisitDetails(visitId);
            if (!visit) {
                throw new Error('Visit not found');
            }

            evaluation.visitState = visit.status;

            // Check care team
            const careTeamCheck = await this.checkCareTeam(visitId);
            evaluation.metrics.careTeam = careTeamCheck;
            if (!careTeamCheck.hasPrimaryDoctor) {
                evaluation.pendingActions.push('Assign primary doctor');
                evaluation.warnings.push('No primary doctor assigned');
            }

            // Check pending orders
            const ordersCheck = await this.checkPendingOrders(visitId);
            evaluation.metrics.orders = ordersCheck;
            if (ordersCheck.pendingLab > 0) {
                evaluation.pendingActions.push(`${ordersCheck.pendingLab} lab orders pending`);
            }
            if (ordersCheck.pendingImaging > 0) {
                evaluation.pendingActions.push(`${ordersCheck.pendingImaging} imaging orders pending`);
            }
            if (ordersCheck.pendingMedication > 0) {
                evaluation.pendingActions.push(`${ordersCheck.pendingMedication} medications to administer`);
            }

            // Check documentation
            const docsCheck = await this.checkDocumentation(visitId);
            evaluation.metrics.documentation = docsCheck;
            if (!docsCheck.hasMedicalRecord) {
                evaluation.pendingActions.push('Create medical record');
                evaluation.warnings.push('No medical record created');
            }

            // Check bed allocation for inpatient visits
            if (visit.visit_type === 'inpatient') {
                const bedCheck = await this.checkBedAllocation(visitId);
                evaluation.metrics.bedAllocation = bedCheck;
                if (!bedCheck.hasBed) {
                    evaluation.pendingActions.push('Allocate bed');
                    evaluation.warnings.push('No bed allocated for inpatient visit');
                }
            }

            // Calculate completeness score
            evaluation.completeness = this.calculateCompleteness(evaluation.metrics, visit);

            // Generate suggestions
            evaluation.suggestions = this.generateSuggestions(evaluation, visit);

            // Check for delays
            const delayCheck = this.checkForDelays(visit);
            if (delayCheck.isDelayed) {
                evaluation.warnings.push(delayCheck.message);
            }

            return evaluation;
        } catch (error) {
            logger.error('Failed to evaluate visit:', error);
            throw error;
        }
    }

    /**
     * Get visit details
     */
    static async getVisitDetails(visitId) {
        const query = 'SELECT * FROM visits WHERE id = $1';
        const result = await pool.query(query, [visitId]);
        return result.rows[0];
    }

    /**
     * Check care team composition
     */
    static async checkCareTeam(visitId) {
        const query = `
            SELECT 
                COUNT(*) as total_members,
                COUNT(*) FILTER (WHERE role IN ('primary', 'primary_doctor', 'doctor')) as primary_doctors,
                COUNT(*) FILTER (WHERE role = 'nurse') as nurses
            FROM care_team_assignments
            WHERE visit_id = $1 AND removed_at IS NULL
        `;

        const result = await pool.query(query, [visitId]);
        const data = result.rows[0];

        return {
            totalMembers: parseInt(data.total_members),
            hasPrimaryDoctor: parseInt(data.primary_doctors) > 0,
            hasNurse: parseInt(data.nurses) > 0
        };
    }

    /**
     * Check pending orders
     */
    static async checkPendingOrders(visitId) {
        const labQuery = `
            SELECT COUNT(*) as count
            FROM lab_orders
            WHERE visit_id = $1 AND status IN ('ordered', 'collected', 'in_progress')
        `;

        const imagingQuery = `
            SELECT COUNT(*) as count
            FROM imaging_orders
            WHERE visit_id = $1 AND status IN ('ordered', 'scheduled', 'in_progress')
        `;

        const medicationQuery = `
            SELECT COUNT(*) as count
            FROM medication_orders
            WHERE visit_id = $1 AND status IN ('ordered', 'dispensed')
        `;

        const [labResult, imagingResult, medicationResult] = await Promise.all([
            pool.query(labQuery, [visitId]),
            pool.query(imagingQuery, [visitId]),
            pool.query(medicationQuery, [visitId])
        ]);

        return {
            pendingLab: parseInt(labResult.rows[0].count),
            pendingImaging: parseInt(imagingResult.rows[0].count),
            pendingMedication: parseInt(medicationResult.rows[0].count)
        };
    }

    /**
     * Check documentation
     */
    static async checkDocumentation(visitId) {
        const query = `
            SELECT 
                COUNT(*) FILTER (WHERE mr.id IS NOT NULL) as medical_records,
                COUNT(*) FILTER (WHERE d.id IS NOT NULL) as diagnoses,
                COUNT(*) FILTER (WHERE p.id IS NOT NULL) as prescriptions
            FROM visits v
            LEFT JOIN medical_records mr ON v.id = mr.visit_id
            LEFT JOIN diagnoses d ON mr.id = d.record_id
            LEFT JOIN prescriptions p ON mr.id = p.record_id
            WHERE v.id = $1
        `;

        const result = await pool.query(query, [visitId]);
        const data = result.rows[0];

        return {
            hasMedicalRecord: parseInt(data.medical_records) > 0,
            hasDiagnosis: parseInt(data.diagnoses) > 0,
            hasPrescription: parseInt(data.prescriptions) > 0
        };
    }

    /**
     * Check bed allocation
     */
    static async checkBedAllocation(visitId) {
        const query = `
            SELECT id
            FROM bed_allocations
            WHERE visit_id = $1 AND status = 'occupied'
        `;

        const result = await pool.query(query, [visitId]);

        return {
            hasBed: result.rows.length > 0
        };
    }

    /**
     * Calculate completeness score (0-100)
     */
    static calculateCompleteness(metrics, visit) {
        let score = 0;
        let maxScore = 0;

        // Care team (30 points)
        maxScore += 30;
        if (metrics.careTeam.hasPrimaryDoctor) score += 20;
        if (metrics.careTeam.hasNurse) score += 10;

        // Documentation (40 points)
        maxScore += 40;
        if (metrics.documentation.hasMedicalRecord) score += 20;
        if (metrics.documentation.hasDiagnosis) score += 10;
        if (metrics.documentation.hasPrescription) score += 10;

        // Orders completion (20 points)
        maxScore += 20;
        const totalPending = metrics.orders.pendingLab +
            metrics.orders.pendingImaging +
            metrics.orders.pendingMedication;
        if (totalPending === 0) score += 20;
        else if (totalPending <= 2) score += 10;

        // Bed allocation for inpatient (10 points)
        if (visit.visit_type === 'inpatient') {
            maxScore += 10;
            if (metrics.bedAllocation?.hasBed) score += 10;
        }

        return Math.round((score / maxScore) * 100);
    }

    /**
     * Generate suggestions based on evaluation
     */
    static generateSuggestions(evaluation, visit) {
        const suggestions = [];

        if (evaluation.completeness < 50) {
            suggestions.push('Visit is incomplete. Review pending actions.');
        }

        if (visit.status === 'checked_in' && evaluation.metrics.careTeam.hasPrimaryDoctor) {
            suggestions.push('Consider transitioning visit to "in_progress" state.');
        }

        if (visit.status === 'in_progress' && evaluation.completeness > 80) {
            suggestions.push('Visit appears ready for completion. Review and complete if appropriate.');
        }

        if (evaluation.metrics.orders.pendingLab > 0 || evaluation.metrics.orders.pendingImaging > 0) {
            suggestions.push('Follow up on pending diagnostic orders.');
        }

        return suggestions;
    }

    /**
     * Check for delays
     */
    static checkForDelays(visit) {
        const now = new Date();
        const visitDate = new Date(visit.scheduled_time);
        const hoursSinceScheduled = (now - visitDate) / (1000 * 60 * 60);

        if (visit.status === 'scheduled' && hoursSinceScheduled > 1) {
            return {
                isDelayed: true,
                message: `Visit scheduled ${Math.round(hoursSinceScheduled)} hours ago but not checked in`
            };
        }

        if (visit.status === 'checked_in' && visit.checked_in_at) {
            const checkedInDate = new Date(visit.checked_in_at);
            const hoursSinceCheckIn = (now - checkedInDate) / (1000 * 60 * 60);
            if (hoursSinceCheckIn > 2) {
                return {
                    isDelayed: true,
                    message: `Patient checked in ${Math.round(hoursSinceCheckIn)} hours ago but visit not started`
                };
            }
        }

        return { isDelayed: false };
    }
}

module.exports = DynamicVisitEvaluatorService;
