/**
 * Care Team Model
 * Manages care team assignments for visits
 */

const pool = require('../config/db');
const logger = require('../utils/logger');

class CareTeamModel {
    /**
     * Assign staff to a visit care team
     * @param {Object} assignment - Assignment data
     * @returns {Promise<Object>} Created assignment
     */
    static async assignStaff({ visitId, staffUserId, role, assignedBy, notes }) {
        try {
            // Check if assignment already exists and is active
            const checkQuery = `
                SELECT id FROM care_team_assignments
                WHERE visit_id = $1 AND staff_user_id = $2 AND role = $3 AND removed_at IS NULL
            `;
            const existing = await pool.query(checkQuery, [visitId, staffUserId, role]);

            if (existing.rows.length > 0) {
                throw new Error('Staff member is already assigned to this role for this visit');
            }

            const query = `
                INSERT INTO care_team_assignments (
                    visit_id, staff_user_id, role, assigned_by, notes
                ) VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `;

            const result = await pool.query(query, [
                visitId,
                staffUserId,
                role,
                assignedBy,
                notes
            ]);

            logger.info('Staff assigned to care team', {
                visitId,
                staffUserId,
                role
            });

            return result.rows[0];
        } catch (error) {
            logger.error('Failed to assign staff to care team:', error);
            throw error;
        }
    }

    /**
     * Remove staff from care team
     * @param {String} assignmentId - Assignment ID
     * @param {String} removedBy - User ID removing the assignment
     * @returns {Promise<Object>} Updated assignment
     */
    static async removeStaff(assignmentId, removedBy) {
        try {
            const query = `
                UPDATE care_team_assignments
                SET removed_at = NOW(), removed_by = $1, updated_at = NOW()
                WHERE id = $2 AND removed_at IS NULL
                RETURNING *
            `;

            const result = await pool.query(query, [removedBy, assignmentId]);

            if (result.rows.length === 0) {
                throw new Error('Assignment not found or already removed');
            }

            logger.info('Staff removed from care team', {
                assignmentId,
                removedBy
            });

            return result.rows[0];
        } catch (error) {
            logger.error('Failed to remove staff from care team:', error);
            throw error;
        }
    }

    /**
     * Get active care team for a visit
     * @param {String} visitId - Visit ID
     * @returns {Promise<Array>} Care team members
     */
    static async getVisitCareTeam(visitId) {
        try {
            const query = `
                SELECT 
                    cta.id,
                    cta.visit_id,
                    cta.staff_user_id,
                    cta.role,
                    cta.assigned_at,
                    cta.notes,
                    u.first_name,
                    u.last_name,
                    u.email,
                    r.name as user_role
                FROM care_team_assignments cta
                INNER JOIN users u ON cta.staff_user_id = u.id
                INNER JOIN roles r ON u.role_id = r.id
                WHERE cta.visit_id = $1 AND cta.removed_at IS NULL
                ORDER BY cta.assigned_at ASC
            `;

            const result = await pool.query(query, [visitId]);
            return result.rows;
        } catch (error) {
            logger.error('Failed to get visit care team:', error);
            throw error;
        }
    }

    /**
     * Get all visits for a staff member
     * @param {String} staffUserId - Staff user ID
     * @param {Boolean} activeOnly - Only return active assignments
     * @returns {Promise<Array>} Assigned visits
     */
    static async getStaffAssignments(staffUserId, activeOnly = true) {
        try {
            let query = `
                SELECT 
                    cta.id as assignment_id,
                    cta.role,
                    cta.assigned_at,
                    v.id as visit_id,
                    v.scheduled_time AS visit_date,
                    v.visit_type,
                    v.status AS state,
                    v.patient_id,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name
                FROM care_team_assignments cta
                INNER JOIN visits v ON cta.visit_id = v.id
                INNER JOIN users p ON v.patient_id = p.id
                WHERE cta.staff_user_id = $1
            `;

            if (activeOnly) {
                query += ' AND cta.removed_at IS NULL';
            }

            query += ' ORDER BY v.scheduled_time DESC';

            const result = await pool.query(query, [staffUserId]);
            return result.rows;
        } catch (error) {
            logger.error('Failed to get staff assignments:', error);
            throw error;
        }
    }

    /**
     * Get care team composition summary
     * @param {String} visitId - Visit ID
     * @returns {Promise<Object>} Team composition
     */
    static async getTeamComposition(visitId) {
        try {
            const query = `
                SELECT 
                    role,
                    COUNT(*) as count,
                    json_agg(
                        json_build_object(
                            'userId', staff_user_id,
                            'assignedAt', assigned_at
                        )
                    ) as members
                FROM care_team_assignments
                WHERE visit_id = $1 AND removed_at IS NULL
                GROUP BY role
            `;

            const result = await pool.query(query, [visitId]);
            return result.rows;
        } catch (error) {
            logger.error('Failed to get team composition:', error);
            throw error;
        }
    }

    /**
     * Transfer primary doctor
     * @param {String} visitId - Visit ID
     * @param {String} newDoctorId - New primary doctor user ID
     * @param {String} transferredBy - User performing the transfer
     * @returns {Promise<Object>} New assignment
     */
    static async transferPrimaryDoctor(visitId, newDoctorId, transferredBy) {
        try {
            // Remove current primary doctor
            const removeQuery = `
                UPDATE care_team_assignments
                SET removed_at = NOW(), removed_by = $1, updated_at = NOW()
                WHERE visit_id = $2 AND role = 'primary_doctor' AND removed_at IS NULL
            `;

            await pool.query(removeQuery, [transferredBy, visitId]);

            // Assign new primary doctor
            const newAssignment = await this.assignStaff({
                visitId,
                staffUserId: newDoctorId,
                role: 'primary_doctor',
                assignedBy: transferredBy,
                notes: 'Transferred from previous primary doctor'
            });

            logger.info('Primary doctor transferred', {
                visitId,
                newDoctorId,
                transferredBy
            });

            return newAssignment;
        } catch (error) {
            logger.error('Failed to transfer primary doctor:', error);
            throw error;
        }
    }
}

module.exports = CareTeamModel;
