const pool = require('../config/db');
const crypto = require('crypto');
const logger = require('../utils/logger');
const VisitConsentService = require('../services/visit-consent.service');
const { organizationSql, assignmentSql } = require('../middleware/clinical-access.middleware');

class VisitModel {
    /**
     * Create a new visit
     * @param {Object} visitData 
     * @returns {Promise<Object>} Created visit
     */
    static async create(visitData) {
        const {
            patientId,
            organizationId,
            reason,
            symptoms,
            type,
            priority,
            doctorId,
            scheduledTime
        } = visitData;

        // Generate a random 8-character alphanumeric visit code
        const visitCode = 'V-' + crypto.randomBytes(8).toString('hex').toUpperCase();

        const query = `
            INSERT INTO visits (
                patient_id, organization_id, chief_complaint, symptoms, type, priority, status, assigned_doctor_id, visit_code, scheduled_time
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, $9)
            RETURNING *
        `;

        const values = [
            patientId,
            organizationId,
            reason || null,
            symptoms || null,
            type || 'walk_in',
            priority || 'normal',
            doctorId || null,
            visitCode,
            scheduledTime || null
        ];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    /**
     * Get visit by ID
     * @param {string} visitId 
     * @returns {Promise<Object>}
     */
    static async findById(visitId) {
        const query = `
            SELECT v.*, 
                   u.first_name as patient_first_name, 
                   u.last_name as patient_last_name,
                   u.email as patient_email,
                   p.date_of_birth,
                   p.gender
            FROM visits v
            JOIN users u ON v.patient_id = u.id
            LEFT JOIN patient_profiles p ON u.id = p.user_id
            WHERE v.id = $1
        `;
        const result = await pool.query(query, [visitId]);
        return result.rows[0];
    }

    /**
     * Get visits for an organization
     * @param {string} organizationId 
     * @param {Object} filters { status, limit, offset }
     * @returns {Promise<Array>}
     */
    static async findByOrganization(organizationId, filters = {}) {
        const { status, limit = 50, offset = 0 } = filters;

        let query = `
            SELECT v.*, 
                   u.first_name as patient_first_name, 
                   u.last_name as patient_last_name,
                   d.first_name as doctor_first_name,
                   d.last_name as doctor_last_name
            FROM visits v
            JOIN users u ON v.patient_id = u.id
            LEFT JOIN users d ON v.assigned_doctor_id = d.id
            WHERE v.organization_id = $1
        `;

        const values = [organizationId];

        if (status) {
            query += ` AND v.status = $${values.length + 1}`;
            values.push(status);
        }

        query += ` ORDER BY v.created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
        values.push(limit, offset);

        const result = await pool.query(query, values);
        return result.rows;
    }

    /**
     * Get active visit for a patient (to prevent duplicates)
     * @param {string} patientId 
     * @returns {Promise<Object>}
     */
    static async findActiveByPatient(patientId) {
        const query = `
            SELECT * FROM visits 
            WHERE patient_id = $1 
            AND status IN ('pending', 'approved', 'in_progress')
            LIMIT 1
        `;
        const result = await pool.query(query, [patientId]);
        return result.rows[0];
    }

    /**
     * Update visit status and assignments
     * @param {string} visitId 
     * @param {Object} updateData 
     * @returns {Promise<Object>}
     */
    static async update(visitId, updateData) {
        const { status, assignedDoctorId, assignedNurseId, otpVerified, accessLevel, scheduledTime } = updateData;

        // Build dynamic query
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (status) {
            updates.push(`status = $${paramCount++}`);
            values.push(status);

            if (status === 'completed' || status === 'cancelled') {
                updates.push(`check_out_time = CURRENT_TIMESTAMP`);
            }
        }

        if (assignedDoctorId !== undefined) {
            updates.push(`assigned_doctor_id = $${paramCount++}`);
            values.push(assignedDoctorId);
        }

        if (assignedNurseId !== undefined) {
            updates.push(`assigned_nurse_id = $${paramCount++}`);
            values.push(assignedNurseId);
        }

        if (otpVerified !== undefined) {
            updates.push(`otp_verified = $${paramCount++}`);
            values.push(otpVerified);
        }

        if (accessLevel) {
            updates.push(`access_level = $${paramCount++}`);
            values.push(accessLevel);
        }

        if (scheduledTime !== undefined) {
            updates.push(`scheduled_time = $${paramCount++}`);
            values.push(scheduledTime);
        }

        if (updates.length === 0) return null;

        values.push(visitId);
        const query = `
            UPDATE visits 
            SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $${paramCount}
            RETURNING *
        `;

        return pool.transaction(async client => {
            const current = (await client.query('SELECT assigned_doctor_id,assigned_nurse_id FROM visits WHERE id=$1 FOR UPDATE',[visitId])).rows[0];
            if (!current) return null;
            const result = await client.query(query, values);
            let changed = false;
            for (const [field,replacement,role] of [['assigned_doctor_id',assignedDoctorId,'doctor'],['assigned_nurse_id',assignedNurseId,'nurse']]) {
                if (replacement === undefined || replacement === current[field]) continue;
                changed = true;
                const prior = current[field];
                if (prior) {
                    await client.query("UPDATE visit_staff_assignments SET revoked_at=NOW(),access_level='revoked' WHERE visit_id=$1 AND staff_user_id=$2",[visitId,prior]);
                    await client.query("UPDATE care_team_assignments SET removed_at=NOW() WHERE visit_id=$1 AND staff_user_id=$2 AND removed_at IS NULL",[visitId,prior]);
                    await client.query("UPDATE consents SET status='revoked',revoked_at=NOW(),updated_at=NOW() WHERE visit_id=$1 AND recipient_user_id=$2 AND source='visit' AND status='active'",[visitId,prior]);
                }
                if (replacement) await client.query(`INSERT INTO visit_staff_assignments(visit_id,staff_user_id,role,access_level) VALUES($1,$2,$3,'read_only')
                    ON CONFLICT(visit_id,staff_user_id) DO UPDATE SET role=EXCLUDED.role,revoked_at=NULL,access_level='read_only'`,[visitId,replacement,role]);
            }
            if (changed) return (await client.query("UPDATE visits SET otp_verified=false,access_level='read',otp_code=$2,otp_expires_at=NOW()+INTERVAL '15 minutes' WHERE id=$1 RETURNING *",[visitId,String(crypto.randomInt(100000,1000000))])).rows[0];
            return result.rows[0];
        });
    }

    /**
     * Approve visit and generate OTP
     * @param {string} visitId 
     * @param {string} doctorId 
     * @param {string} nurseId 
     * @returns {Promise<Object>} Visit with OTP
     */
    static async approveVisit(visitId, doctorId, nurseId) {
        const otp = String(crypto.randomInt(100000, 1000000));
        return pool.transaction(async client => {
            const result = await client.query(`UPDATE visits SET status='approved', assigned_doctor_id=$1, assigned_nurse_id=$2,
                otp_code=$3, otp_expires_at=NOW()+INTERVAL '24 hours', otp_verified=false, updated_at=NOW()
                WHERE id=$4 AND status IN ('pending','scheduled','approved') RETURNING *`, [doctorId, nurseId, otp, visitId]);
            const visit = result.rows[0];
            if (!visit) throw Object.assign(new Error('Visit cannot be approved in its current state'), { statusCode: 409 });
            for (const [id,role] of [[doctorId,'doctor'],[nurseId,'nurse']]) {
                if (id) await client.query(`INSERT INTO visit_staff_assignments(visit_id,staff_user_id,role)
                    VALUES($1,$2,$3) ON CONFLICT(visit_id,staff_user_id) DO UPDATE SET role=EXCLUDED.role,revoked_at=NULL,access_level='read_only'`, [visitId,id,role]);
            }
            // Patient approval is the only operation that creates a visit consent.
            return visit;
        });
    }

    /**
     * Verify OTP and set access level
     * @param {string} visitId 
     * @param {string} otp 
     * @param {string} accessLevel - 'read' or 'write'
     * @returns {Promise<Object>} Updated visit
     */
    static async verifyOTP(visitId, otp, accessLevel, patientId) {
        return pool.transaction(async client => {
            const result = await client.query(`UPDATE visits SET otp_verified=true, access_level=$1, status='in_progress', started_at=COALESCE(started_at,NOW()),updated_at=NOW()
                WHERE id=$2 AND patient_id=$3 AND otp_code=$4 AND otp_expires_at>NOW() AND otp_verified=false
                AND status IN ('approved','checked_in','in_progress') RETURNING *`, [accessLevel,visitId,patientId,String(otp)]);
            const visit = result.rows[0];
            if (!visit) throw new Error('Invalid or expired OTP');
            await VisitConsentService.createConsentForVisit(visit, accessLevel, client);
            return visit;
        });
    }

    /**
     * Generate access code (OTP) for patient
     * @param {string} visitId
     * @returns {Promise<Object>} Updated visit with OTP
     */
    static async generateAccessCode(visitId) {
        // Generate 6-digit OTP
        const otp = String(crypto.randomInt(100000, 1000000));
        // Set expiration to 15 minutes
        const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

        const query = `
            UPDATE visits
            SET
                otp_code = $1,
                otp_expires_at = $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3 AND (status IN ('approved','checked_in') OR (status='in_progress' AND otp_verified=false))
            RETURNING otp_code, otp_expires_at
        `;

        const result = await pool.query(query, [otp, otpExpiresAt, visitId]);
        return result.rows[0];
    }

    /**
     * Get visit with full details including patient and doctor info
     * @param {string} visitId 
     * @returns {Promise<Object>}
     */
    static async getFullDetails(visitId) {
        const query = `
            SELECT 
                v.*,
                u_p.first_name as patient_first_name,
                u_p.last_name as patient_last_name,
                u_p.email as patient_email,
                p.unique_health_id,
                u_s.first_name as doctor_first_name,
                u_s.last_name as doctor_last_name,
                o.name as organization_name
            FROM visits v
            LEFT JOIN patient_profiles p ON v.patient_id = p.user_id
            JOIN users u_p ON p.user_id = u_p.id
            LEFT JOIN doctor_profiles s ON v.assigned_doctor_id = s.user_id
            LEFT JOIN users u_s ON s.user_id = u_s.id
            LEFT JOIN organizations o ON v.organization_id = o.id
            WHERE v.id = $1;
        `;

        const result = await pool.query(query, [visitId]);
        return result.rows[0];
    }
    /**
     * Find visit by visit code
     * @param {string} visitCode 
     * @returns {Promise<Object>}
     */
    static async findByCode(visitCode) {
        const query = `
            SELECT v.*, 
                   u.first_name as patient_first_name, 
                   u.last_name as patient_last_name,
                   u.email as patient_email,
                   o.name as hospital_name
            FROM visits v
            JOIN users u ON v.patient_id = u.id
            JOIN organizations o ON v.organization_id = o.id
            WHERE v.otp_code = $1
        `;
        const result = await pool.query(query, [visitCode]);
        return result.rows[0];
    }

    /**
     * Update visit status with validation
     * @param {string} visitId 
     * @param {string} newStatus 
     * @param {string} userId - User making the change
     * @returns {Promise<Object>}
     */
    static async updateStatus(visitId, newStatus, userId) {
        const validStatuses = ['pending', 'approved', 'checked_in', 'in_progress', 'completed', 'cancelled'];

        if (!validStatuses.includes(newStatus)) {
            throw new Error(`Invalid status: ${newStatus}`);
        }

        const query = `
            UPDATE visits
            SET status = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
        `;

        const result = await pool.query(query, [newStatus, visitId]);
        return result.rows[0];
    }

    /**
     * Find visits by patient ID
     * @param {string} patientId 
     * @returns {Promise<Array>}
     */
    static async findByPatientId(patientId) {
        const query = `
            SELECT v.*,
            u.first_name as doctor_first_name,
            u.last_name as doctor_last_name,
            dp.specialization as specialization,
            o.name as hospital_name
            FROM visits v
            LEFT JOIN users u ON v.assigned_doctor_id = u.id
            LEFT JOIN doctor_profiles dp ON v.assigned_doctor_id = dp.user_id
            LEFT JOIN organizations o ON v.organization_id = o.id
            WHERE v.patient_id = $1
            ORDER BY v.created_at DESC
            `;
        const result = await pool.query(query, [patientId]);
        return result.rows;
    }

    /**
     * Find visits assigned to a staff member
     * @param {string} staffId 
     * @param {string} role - 'doctor' or 'nurse'
     * @returns {Promise<Array>}
     */
    static async findByAssignedStaff(staffId, role) {
        let roleColumn = '';
        if (role === 'doctor') {
            roleColumn = 'assigned_doctor_id';
        } else if (role === 'nurse') {
            roleColumn = 'assigned_nurse_id';
        } else {
            throw new Error('Invalid role for visit assignment');
        }

        const query = `
            SELECT v.*,
            p.first_name as patient_first_name,
            p.last_name as patient_last_name,
            pp.date_of_birth,
            pp.gender
            FROM visits v
            LEFT JOIN users p ON v.patient_id = p.id
            LEFT JOIN patient_profiles pp ON v.patient_id = pp.user_id
            WHERE v.${roleColumn} = $1 AND ${organizationSql('v.organization_id','$1')} AND ${assignmentSql('v','$1')}
            AND v.status IN ('pending', 'approved', 'checked_in', 'in_progress')
            ORDER BY v.status DESC, v.created_at ASC
            `;
        const result = await pool.query(query, [staffId]);
        return result.rows;
    }

    /**
     * Close visit (complete or cancel)
     * @param {string} visitId 
     * @param {string} userId - User closing the visit
     * @param {string} status - 'completed' or 'cancelled'
     * @returns {Promise<Object>} Updated visit
     */
    static async closeVisit(visitId, userId, status) {
        return pool.transaction(async client => {
            const allowed = status === 'completed' ? ['in_progress'] : ['pending','approved','scheduled','checked_in','in_progress'];
            const result = await client.query(`UPDATE visits SET status=$1, check_out_time=NOW(),updated_at=NOW()
                WHERE id=$2 AND status=ANY($3::text[]) RETURNING *`, [status,visitId,allowed]);
            if (!result.rows.length) throw Object.assign(new Error('Visit cannot be closed in its current state'), { statusCode: 409 });
            await VisitConsentService.revokeConsentForVisit(visitId,client);
            await client.query('UPDATE visit_staff_assignments SET revoked_at=NOW() WHERE visit_id=$1 AND revoked_at IS NULL',[visitId]);
            await client.query('UPDATE care_team_assignments SET removed_at=NOW(),removed_by=$2 WHERE visit_id=$1 AND removed_at IS NULL',[visitId,userId]);
            return result.rows[0];
        });
    }

    /**
     * Get all staff assigned to a visit
     * @param {string} visitId 
     * @returns {Promise<Array>}
     */
    static async getAssignedStaff(visitId) {
        const query = `
        SELECT
        vsa.id,
            vsa.role,
            vsa.access_level,
            vsa.assigned_at,
            vsa.revoked_at,
            u.id as user_id,
            u.first_name,
            u.last_name,
            u.email,
            r.name as user_role
            FROM visit_staff_assignments vsa
            JOIN users u ON vsa.staff_user_id = u.id
            JOIN roles r ON r.id = u.role_id
            WHERE vsa.visit_id = $1
            ORDER BY vsa.assigned_at DESC
            `;

        const result = await pool.query(query, [visitId]);
        return result.rows;
    }

    /**
     * Get the queue position for a specific visit belonging to a doctor
     * @param {string} visitId 
     * @param {string} doctorId 
     * @returns {Promise<Object>} Object containing queue position and ETA
     */
    static async getQueuePosition(visitId, doctorId) {
        try {
            // Verify that this visit belongs to the requested doctor.
            const visitResult = await pool.query(
                'SELECT status FROM visits WHERE id = $1 AND assigned_doctor_id = $2',
                [visitId, doctorId]
            );

            if (visitResult.rows.length === 0) {
                return null;
            }

            const visit = visitResult.rows[0];

            if (['completed', 'cancelled', 'closed'].includes(visit.status)) {
                return { position: 0, total: 0, status: visit.status };
            }

            // Include this visit in its position. Compare timestamps inside
            // Postgres: JavaScript Date truncates their microsecond precision.
            const aheadResult = await pool.query(`
                SELECT COUNT(*) as count 
                FROM visits 
                WHERE assigned_doctor_id = $1 
                AND status IN ('pending', 'approved', 'checked_in', 'in_progress')
                AND created_at <= (SELECT created_at FROM visits WHERE id = $2)
            `, [doctorId, visitId]);

            // Count total active/pending visits for the doctor to give "X of Y"
            const totalResult = await pool.query(`
                SELECT COUNT(*) as count 
                FROM visits 
                WHERE assigned_doctor_id = $1 
                AND status IN ('pending', 'approved', 'checked_in', 'in_progress')
            `, [doctorId]);

            const position = parseInt(aheadResult.rows[0].count, 10);
            const total = parseInt(totalResult.rows[0].count, 10);

            return {
                position,
                total,
                status: visit.status,
                // Simple ETA: 15 mins per patient ahead
                eta_minutes: Math.max(0, position - 1) * 15
            };
        } catch (error) {
            // Assuming 'logger' is defined elsewhere or will be handled by a global error handler
            // If not, this would cause a ReferenceError.
            // For this task, I'm inserting the code as provided.
            logger.error('Error calculating queue position', error);
            throw error;
        }
    }

    /**
     * Assign staff to a visit
     * @param {string} visitId 
     * @param {string} staffUserId 
     * @param {string} role - 'doctor', 'nurse', 'specialist', etc.
     * @returns {Promise<Object>}
     */
    static async assignStaff(visitId, staffUserId, role) {
        const query = `
            INSERT INTO visit_staff_assignments(visit_id, staff_user_id, role)
        VALUES($1, $2, $3)
            ON CONFLICT(visit_id, staff_user_id) 
            DO UPDATE SET
        role = EXCLUDED.role
        RETURNING *
            `;

        const result = await pool.query(query, [visitId, staffUserId, role]);
        return result.rows[0];
    }

    /**
     * Revoke staff access to a visit
     * @param {string} visitId 
     * @param {string} staffUserId - Optional, if not provided revokes all staff
     * @param {string} revokedBy - User ID revoking access
     * @returns {Promise<number>} Number of records updated
     */
    static async revokeStaffAccess(visitId, staffUserId = null, revokedBy = null) {
        let query, values;

        if (staffUserId) {
            query = `
                UPDATE visit_staff_assignments
        SET
        access_level = 'revoked',
            revoked_at = CURRENT_TIMESTAMP,
            revoked_by = $3
                WHERE visit_id = $1 AND staff_user_id = $2 AND revoked_at IS NULL
            `;
            values = [visitId, staffUserId, revokedBy];
        } else {
            query = `
                UPDATE visit_staff_assignments
        SET
        access_level = 'revoked',
            revoked_at = CURRENT_TIMESTAMP,
            revoked_by = $2
                WHERE visit_id = $1 AND revoked_at IS NULL
            `;
            values = [visitId, revokedBy];
        }

        const result = await pool.query(query, values);
        return result.rowCount;
    }

    /**
     * Check if user has access to visit
     * @param {string} visitId 
     * @param {string} userId 
     * @returns {Promise<Object>} Access info or null
     */
    static async checkUserAccess(visitId, userId) {
        const query = `
        SELECT
        vsa.access_level,
            vsa.role,
            vsa.revoked_at,
            v.status as visit_status
            FROM visit_staff_assignments vsa
            JOIN visits v ON vsa.visit_id = v.id
            WHERE vsa.visit_id = $1 
              AND vsa.staff_user_id = $2
            `;

        const result = await pool.query(query, [visitId, userId]);
        return result.rows[0];
    }
}

module.exports = VisitModel;
