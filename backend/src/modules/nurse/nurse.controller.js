const { query, transaction } = require('../../config/db');
const asyncHandler = require('../../utils/asyncHandler');
const { clinicalScopeSql } = require('../../middleware/clinical-access.middleware');
const logger = require('../../utils/logger');

class NurseController {
    /**
     * Get nurse dashboard statistics
     * GET /api/nurse/stats
     */
    static getDashboardStats = asyncHandler(async (req, res) => {
        const userId = req.user.id;

        try {
            // 1. Assigned Patients (Active visits where this nurse is assigned in visit_staff_assignments)
            const patientCountQuery = `
                SELECT COUNT(DISTINCT v.patient_id) 
                FROM visits v
                JOIN visit_staff_assignments cta ON v.id = cta.visit_id
                WHERE cta.staff_user_id = $1 
                AND v.status NOT IN ('cancelled', 'completed')
            `;
            const patientCount = await query(patientCountQuery, [userId]);

            // 2. Vitals Recorded (Medical records of type 'note' representing vitals/observations)
            const vitalsCountQuery = `
                SELECT COUNT(*) 
                FROM medical_records 
                WHERE created_by = $1 
                AND type = 'note'
                AND created_at >= CURRENT_DATE
            `;
            const vitalsCount = await query(vitalsCountQuery, [userId]);

            // 3. Care Tasks (Pending medication orders)
            const tasksCountQuery = `
                SELECT COUNT(*) 
                FROM prescriptions p
                JOIN medical_records mr ON p.record_id = mr.id
                JOIN visits v ON mr.visit_id = v.id
                JOIN visit_staff_assignments cta ON v.id = cta.visit_id
                WHERE cta.staff_user_id = $1 
                AND p.status = 'pending'
            `;
            const tasksCount = await query(tasksCountQuery, [userId]);

            // 4. Observations (Medical records of type 'procedure' or 'other')
            const observationsCountQuery = `
                SELECT COUNT(*) 
                FROM medical_records 
                WHERE created_by = $1 
                AND type IN ('procedure', 'other')
                AND created_at >= CURRENT_DATE
            `;
            const observationsCount = await query(observationsCountQuery, [userId]);

            res.json({
                success: true,
                data: {
                    assignedPatients: parseInt(patientCount.rows[0].count) || 0,
                    vitalsRecorded: parseInt(vitalsCount.rows[0].count) || 0,
                    careTasks: parseInt(tasksCount.rows[0].count) || 0,
                    observations: parseInt(observationsCount.rows[0].count) || 0
                }
            });
        } catch (error) {
            logger.error('Error fetching nurse stats:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch dashboard statistics'
            });
        }
    });

    /**
     * Get nurse profile information
     */
    static getProfile = asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const sql = `
            SELECT u.id, u.first_name as "firstName", u.last_name as "lastName", u.email, u.phone, 
                   u.profile_photo as "profilePhoto", r.name as "role", som.employee_id as "employeeId", 
                   som.department, som.status, som.professional_license as "licenseNumber", 
                   som.assigned_wards as "assignedWards", som.shift_preference as "shiftPreference", 
                   u.created_at as "joinedDate", np.address, np.emergency_contact_name, 
                   np.emergency_contact_phone, np.emergency_contact_relation
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            LEFT JOIN staff_org_mapping som ON u.id = som.user_id
            LEFT JOIN nurse_profiles np ON u.id = np.user_id
            WHERE u.id = $1
        `;
        const result = await query(sql, [userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Profile not found' });
        }

        const profile = result.rows[0];
        res.json({
            success: true,
            data: {
                ...profile,
                address: profile.address || "Add address in settings",
                emergencyContact: {
                    name: profile.emergency_contact_name || "Not Set",
                    relationship: profile.emergency_contact_relation || "Not Set",
                    phone: profile.emergency_contact_phone || "Not Set"
                },
                assignedWards: profile.assignedWards || ["General Ward"],
                shiftPreference: profile.shiftPreference || "Day Shift"
            }
        });
    });

    /**
     * Update nurse profile
     */
    static updateProfile = asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const { phone, address } = req.body;

        try {
            await transaction(async (client) => {
                // Update phone in users table
                await client.query('UPDATE users SET phone = $1 WHERE id = $2', [phone, userId]);

                // Update address in nurse_profiles table (using UPSERT logic)
                const upsertSql = `
                    INSERT INTO nurse_profiles (user_id, address)
                    VALUES ($1, $2)
                    ON CONFLICT (user_id) 
                    DO UPDATE SET address = $2, updated_at = CURRENT_TIMESTAMP
                `;
                await client.query(upsertSql, [userId, address]);
            });

            // Re-fetch full profile
            const profileSql = `
                SELECT u.id, u.first_name as "firstName", u.last_name as "lastName", u.email, u.phone, 
                       u.profile_photo as "profilePhoto", r.name as "role", som.employee_id as "employeeId", 
                       som.department, som.status, np.address, np.emergency_contact_name, 
                       np.emergency_contact_phone, np.emergency_contact_relation
                FROM users u
                LEFT JOIN roles r ON u.role_id = r.id
                LEFT JOIN staff_org_mapping som ON u.id = som.user_id
                LEFT JOIN nurse_profiles np ON u.id = np.user_id
                WHERE u.id = $1
            `;
            const result = await query(profileSql, [userId]);

            res.json({
                success: true,
                message: "Profile updated successfully",
                data: {
                    ...result.rows[0],
                    emergencyContact: {
                        name: result.rows[0].emergency_contact_name || "Not Set",
                        relationship: result.rows[0].emergency_contact_relation || "Not Set",
                        phone: result.rows[0].emergency_contact_phone || "Not Set"
                    }
                }
            });
        } catch (error) {
            logger.error('Error updating nurse profile:', error);
            res.status(500).json({ success: false, message: 'Failed to update profile' });
        }
    });

    /**
     * Get assigned patients for current nurse
     */
    static getAssignedPatients = asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const sql = `
            SELECT DISTINCT v.patient_id as "id", v.patient_id as "patientId", v.id as "visitId", u.first_name as "firstName", u.last_name as "lastName",
                   v.chief_complaint as "admissionReason", v.status as "status", v.check_in_time as "nextCheck"
            FROM visits v
            JOIN users u ON v.patient_id = u.id
            JOIN visit_staff_assignments cta ON v.id = cta.visit_id
            WHERE cta.staff_user_id = $1 AND ${clinicalScopeSql('v.patient_id', 'v.id', '$1', 'nurse')}
            AND v.status NOT IN ('cancelled', 'completed')
        `;
        const result = await query(sql, [userId]);

        const patients = result.rows.map((p, index) => ({
            ...p,
            room: null,
            condition: p.admissionReason || "Observation",
            nextCheck: p.nextCheck,
            status: p.status
        }));

        res.json({
            success: true,
            data: patients
        });
    });

    /**
     * Get recent activities for current nurse
     */
    static getActivities = asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const sql = `
            SELECT mr.id, mr.type, mr.title, mr.created_at
            FROM medical_records mr
            WHERE mr.created_by = $1 AND ${clinicalScopeSql('mr.patient_id', 'mr.visit_id', '$1', 'nurse')}
            ORDER BY created_at DESC
            LIMIT 10
        `;
        const result = await query(sql, [userId]);

        const activities = result.rows.map(act => ({
            ...act,
            date: act.created_at,
            colorClass: act.type === 'note' ? 'bg-teal-500' : 'bg-indigo-500',
            borderColorClass: act.type === 'note' ? 'border-teal-500/30' : 'border-indigo-500/30'
        }));

        res.json({
            success: true,
            data: activities
        });
    });

    /**
     * Get patient vitals for assigned patients
     */
    static getVitals = asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const sql = `
            SELECT mr.id, mr.title, mr.description, mr.type, mr.created_at,
                   u.first_name as "patientFirstName", u.last_name as "patientLastName", u.id as "patientId"
            FROM medical_records mr
            JOIN users u ON mr.patient_id = u.id
            WHERE mr.created_by = $1 AND ${clinicalScopeSql('mr.patient_id', 'mr.visit_id', '$1', 'nurse', 'vitals')} AND mr.type IN ('note', 'procedure', 'other')
            ORDER BY mr.created_at DESC
        `;
        const result = await query(sql, [userId]);
        res.json({ success: true, data: result.rows });
    });

    /**
     * Get current shift schedule
     */
    static getSchedule = asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const sql = `
            SELECT som.shift_start, som.shift_end, som.assigned_wards as "assignedWards",
                   som.shift_preference as "shiftPreference", o.name as "organizationName"
            FROM staff_org_mapping som
            JOIN organizations o ON som.organization_id = o.id
            WHERE som.user_id = $1
        `;
        const result = await query(sql, [userId]);
        res.json({ success: true, data: result.rows[0] || {} });
    });

    /**
     * Get medications for assigned patients
     */
    static getMedications = asyncHandler(async (req,res) => {
        const result = await query(`SELECT mo.id,mo.medication AS "medicationName",mo.dosage,mo.route,
            CASE WHEN mo.status IN ('ordered','dispensed') THEN 'pending' ELSE mo.status END AS status,
            mo.ordered_at AS "scheduledTime",mo.administered_at AS "administeredAt",u.first_name AS "patientFirstName",u.last_name AS "patientLastName",
            u.first_name || ' ' || u.last_name AS "patientName",NULL AS room
            FROM medication_orders mo JOIN visits v ON v.id=mo.visit_id JOIN users u ON u.id=v.patient_id
            WHERE ${clinicalScopeSql('v.patient_id','v.id','$1','nurse','prescriptions')}
            ORDER BY mo.ordered_at DESC LIMIT 100`,[req.user.id]);
        res.json({success:true,data:result.rows});
    });

    static updateMedicationStatus = asyncHandler(async (req,res) => {
        const {status,reason} = req.body;
        if (!['administered','refused'].includes(status)) return res.status(400).json({success:false,message:'Medication status must be administered or refused'});
        if (reason !== undefined && (typeof reason !== 'string' || reason.length>2000)) return res.status(400).json({success:false,message:'Invalid refusal reason'});
        let result;
        if (status==='administered') {
            result = await query("UPDATE medication_orders SET status='administered',administered_by=$1,administered_at=NOW(),updated_at=NOW() WHERE id=$2 AND status IN ('ordered','dispensed') RETURNING *",[req.user.id,req.params.medicationId]);
        } else {
            result = await query("UPDATE medication_orders SET status='refused',refused_by=$1,refused_at=NOW(),refusal_reason=$3,updated_at=NOW() WHERE id=$2 AND status IN ('ordered','dispensed') RETURNING *",[req.user.id,req.params.medicationId,reason||null]);
        }
        if (!result.rows.length) return res.status(409).json({success:false,message:'Medication order is no longer pending'});
        res.json({success:true,data:result.rows[0],message:'Medication status recorded'});
    });

    /**
     * Get records for a specific patient
     */
    static getPatientRecords = asyncHandler(async (req, res) => {
        const { patientId } = req.params;
        const sql = `
            SELECT mr.id, mr.title, mr.description, mr.type, mr.created_at,
                   u.first_name || ' ' || u.last_name as "created_by_name",
                   r.name as "created_by_role"
            FROM medical_records mr
            JOIN users u ON mr.created_by = u.id
            JOIN roles r ON u.role_id = r.id
            WHERE mr.patient_id = $1
            ORDER BY mr.created_at DESC
        `;
        const result = await query(sql, [patientId]);
        res.json({ success: true, data: result.rows });
    });

    /**
     * Add a record for a patient
     */
    static addPatientRecord = asyncHandler(async (req, res) => {
        const { patientId } = req.params;
        const { type, title, description, visitId } = req.body;
        const userId = req.user.id;

        const sql = `
            INSERT INTO medical_records (patient_id, visit_id, type, title, description, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;
        const result = await query(sql, [patientId, visitId || null, type, title, description, userId]);

        res.status(201).json({ success: true, data: result.rows[0], message: 'Record added successfully' });
    });
}

module.exports = NurseController;
