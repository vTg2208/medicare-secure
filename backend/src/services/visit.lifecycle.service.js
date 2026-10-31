/**
 * Visit Lifecycle State Machine Service
 * Manages visit state transitions with validation and business rules
 */

const pool = require('../config/db');
const logger = require('../utils/logger');

// Define valid states and transitions
const VISIT_STATES = {
    PENDING: 'pending',
    APPROVED: 'approved',
    SCHEDULED: 'scheduled',
    CHECKED_IN: 'checked_in',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    NO_SHOW: 'no_show'
};

// Define valid state transitions
const VALID_TRANSITIONS = {
    pending: ['approved', 'cancelled'],
    approved: ['checked_in', 'cancelled', 'no_show'],
    [VISIT_STATES.SCHEDULED]: [VISIT_STATES.CHECKED_IN, VISIT_STATES.CANCELLED, VISIT_STATES.NO_SHOW],
    [VISIT_STATES.CHECKED_IN]: [VISIT_STATES.IN_PROGRESS, VISIT_STATES.CANCELLED],
    [VISIT_STATES.IN_PROGRESS]: [VISIT_STATES.COMPLETED, VISIT_STATES.CANCELLED],
    [VISIT_STATES.COMPLETED]: [], // Terminal state
    [VISIT_STATES.CANCELLED]: [], // Terminal state
    [VISIT_STATES.NO_SHOW]: [] // Terminal state
};

class VisitLifecycleService {
    /**
     * Transition visit to a new state
     * @param {String} visitId - Visit ID
     * @param {String} newState - Target state
     * @param {String} userId - User performing the transition
     * @param {String} reason - Optional reason for transition
     * @returns {Promise<Object>} Updated visit
     */
    static async transitionState(visitId, newState, userId, reason = null) {
        return pool.transaction(async client => {
            const current = await client.query('SELECT id,status,patient_id,otp_verified FROM visits WHERE id=$1 FOR UPDATE',[visitId]);
            const visit = current.rows[0];
            if (!visit) throw Object.assign(new Error('Visit not found'), { statusCode: 404 });
            if (!this.isValidTransition(visit.status,newState)) throw Object.assign(new Error(`Invalid state transition from ${visit.status} to ${newState}`), { statusCode: 409 });
            if (newState === 'approved') throw Object.assign(new Error('Use the visit approval workflow to assign staff and generate a patient code'), { statusCode: 400 });
            if (newState === 'in_progress' && !visit.otp_verified) throw Object.assign(new Error('Patient data-access approval is required before clinical care starts'), { statusCode: 403 });
            const timestampColumns = { checked_in:'checked_in_at',in_progress:'started_at',completed:'completed_at',cancelled:'cancelled_at',no_show:'no_show_at' };
            const column = timestampColumns[newState];
            const updated = await client.query(`UPDATE visits SET status=$1,updated_at=NOW()${column ? `,${column}=NOW()` : ''}${['completed','cancelled','no_show'].includes(newState) ? ',check_out_time=NOW()' : ''} WHERE id=$2 RETURNING *`,[newState,visitId]);
            await client.query(`INSERT INTO workflow_logs(visit_id,user_id,action,entity_type,entity_id,old_state,new_state,metadata)
                VALUES($1,$2,'visit_state_transition','visit',$1,$3,$4,$5)`,[visitId,userId,JSON.stringify({state:visit.status}),JSON.stringify({state:newState}),JSON.stringify({reason})]);
            if (['completed','cancelled','no_show'].includes(newState)) {
                await require('./visit-consent.service').revokeConsentForVisit(visitId,client);
                await client.query('UPDATE visit_staff_assignments SET revoked_at=NOW() WHERE visit_id=$1 AND revoked_at IS NULL',[visitId]);
                await client.query('UPDATE care_team_assignments SET removed_at=NOW(),removed_by=$2 WHERE visit_id=$1 AND removed_at IS NULL',[visitId,userId]);
            }
            return updated.rows[0];
        });
    }

    /**
     * Check if a state transition is valid
     * @param {String} currentState - Current state
     * @param {String} newState - Target state
     * @returns {Boolean} True if transition is valid
     */
    static isValidTransition(currentState, newState) {
        if (!VALID_TRANSITIONS[currentState]) {
            return false;
        }
        return VALID_TRANSITIONS[currentState].includes(newState);
    }

    /**
     * Get all valid next states for a visit
     * @param {String} visitId - Visit ID
     * @returns {Promise<Array>} Array of valid next states
     */
    static async getValidNextStates(visitId) {
        try {
            const query = 'SELECT status FROM visits WHERE id = $1';
            const result = await pool.query(query, [visitId]);

            if (result.rows.length === 0) {
                throw new Error('Visit not found');
            }

            const currentState = result.rows[0].status;
            return VALID_TRANSITIONS[currentState] || [];
        } catch (error) {
            logger.error('Failed to get valid next states:', error);
            throw error;
        }
    }

    /**
     * Get visit state history
     * @param {String} visitId - Visit ID
     * @returns {Promise<Array>} State transition history
     */
    static async getStateHistory(visitId) {
        try {
            const query = `
                SELECT 
                    old_state->>'state' as from_state,
                    new_state->>'state' as to_state,
                    user_id,
                    metadata->>'reason' as reason,
                    created_at
                FROM workflow_logs
                WHERE visit_id = $1 
                    AND action = 'visit_state_transition'
                ORDER BY created_at ASC
            `;

            const result = await pool.query(query, [visitId]);
            return result.rows;
        } catch (error) {
            logger.error('Failed to get state history:', error);
            throw error;
        }
    }

    /**
     * Log state transition to workflow_logs
     * @param {String} visitId - Visit ID
     * @param {String} oldState - Previous state
     * @param {String} newState - New state
     * @param {String} userId - User performing transition
     * @param {String} reason - Optional reason
     */
    static async logStateTransition(visitId, oldState, newState, userId, reason) {
        try {
            const query = `
                INSERT INTO workflow_logs (
                    visit_id, user_id, action, entity_type, entity_id,
                    old_state, new_state, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `;

            await pool.query(query, [
                visitId,
                userId,
                'visit_state_transition',
                'visit',
                visitId,
                JSON.stringify({ state: oldState }),
                JSON.stringify({ state: newState }),
                JSON.stringify({ reason })
            ]);
        } catch (error) {
            logger.error('Failed to log state transition:', error);
            // Don't throw - logging failure shouldn't break the transition
        }
    }

    /**
     * Bulk check-in visits (e.g., for scheduled appointments)
     * @param {Array} visitIds - Array of visit IDs
     * @param {String} userId - User performing check-in
     * @returns {Promise<Object>} Results summary
     */
    static async bulkCheckIn(visitIds, userId) {
        const results = {
            success: [],
            failed: []
        };

        for (const visitId of visitIds) {
            try {
                await this.transitionState(visitId, VISIT_STATES.CHECKED_IN, userId);
                results.success.push(visitId);
            } catch (error) {
                results.failed.push({ visitId, error: error.message });
            }
        }

        return results;
    }

    /**
     * Auto-transition no-show visits (scheduled visits that weren't checked in)
     * @param {Number} minutesAfterScheduled - Minutes after scheduled time to mark as no-show
     * @returns {Promise<Number>} Number of visits marked as no-show
     */
    static async autoMarkNoShows(minutesAfterScheduled = 30) {
        try {
            const query = `
                UPDATE visits
                SET status = $1, no_show_at = NOW(), updated_at = NOW()
                WHERE status = $2
                    AND scheduled_time < NOW() - ($3 * INTERVAL '1 minute')
                RETURNING id
            `;

            const result = await pool.query(query, [
                VISIT_STATES.NO_SHOW,
                VISIT_STATES.SCHEDULED,
                Math.max(1, Number(minutesAfterScheduled) || 30)
            ]);

            const count = result.rows.length;

            if (count > 0) {
                logger.info(`Auto-marked ${count} visits as no-show`);

                // Log each transition
                for (const row of result.rows) {
                    await this.logStateTransition(
                        row.id,
                        VISIT_STATES.SCHEDULED,
                        VISIT_STATES.NO_SHOW,
                        null, // System action
                        'Auto-marked as no-show after scheduled time'
                    );
                }
            }

            return count;
        } catch (error) {
            logger.error('Failed to auto-mark no-shows:', error);
            throw error;
        }
    }
}

// Export states for use in other modules
VisitLifecycleService.STATES = VISIT_STATES;
VisitLifecycleService.VALID_TRANSITIONS = VALID_TRANSITIONS;

module.exports = VisitLifecycleService;
