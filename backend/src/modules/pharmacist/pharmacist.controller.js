const PrescriptionModel = require('../../models/prescription.model');
const UserModel = require('../../models/user.model');
const AuditService = require('../../services/audit.service');
const { HTTP_STATUS } = require('../../utils/constants');
const logger = require('../../utils/logger');
const pool = require('../../config/db');
const { clinicalScopeSql } = require('../../middleware/clinical-access.middleware');

/**
 * GET /api/pharmacist/stats
 * Dashboard statistics for the pharmacist portal
 */
const getStats = async (req, res) => {
    try {
        const pendingRes = await pool.query(
            `SELECT COUNT(*) FROM prescriptions p JOIN medical_records mr ON p.record_id=mr.id WHERE p.status IN ('pending','active') AND ${clinicalScopeSql('mr.patient_id','mr.visit_id','$1',req.user.roleName,'prescriptions')}`, [req.user.id]
        );
        const dispensedTodayRes = await pool.query(
            `SELECT COUNT(*) FROM prescriptions p JOIN medical_records mr ON p.record_id=mr.id WHERE p.status = 'completed' AND p.dispensed_at >= CURRENT_DATE AND ${clinicalScopeSql('mr.patient_id','mr.visit_id','$1',req.user.roleName,'prescriptions')}`, [req.user.id]
        );
        // Inventory low-stock count — gracefully returns 0 if table doesn't exist yet
        let lowStockAlerts = 0;
        try {
            const lowStockRes = await pool.query(
                "SELECT COUNT(*) FROM pharmacy_inventory WHERE stock_quantity <= reorder_level AND organization_id = $1", [req.organizationId]
            );
            lowStockAlerts = parseInt(lowStockRes.rows[0].count) || 0;
        } catch (_) { /* table might not be migrated yet */ }

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: {
                pendingPrescriptions: parseInt(pendingRes.rows[0].count),
                dispensedToday: parseInt(dispensedTodayRes.rows[0].count),
                lowStockAlerts,
                refillRequests: 0  // Placeholder until refill feature is built
            }
        });
    } catch (error) {
        logger.error('Pharmacist getStats error:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to fetch pharmacist statistics'
        });
    }
};

/**
 * GET /api/pharmacist/prescriptions?status=pending|dispensed|all
 * Return prescriptions with patient and prescriber name fields
 * suitable for the PrescriptionQueue page.
 */
const getPrescriptions = async (req, res) => {
    try {
        const { status, limit = 100, offset = 0 } = req.query;

        // Build query joining prescriptions → medical_records → visits → users
        let query = `
            SELECT
                p.id,
                p.medication,
                p.generic_name    AS "genericName",
                p.dosage,
                p.frequency,
                p.route,
                p.duration,
                p.quantity,
                p.instructions,
                p.status,
                p.prescribed_at   AS "prescribedAt",
                p.dispensed_at    AS "dispensedAt",
                mr.patient_id     AS "patientId",
                pat.first_name || ' ' || pat.last_name AS "patientName",
                dr.first_name  || ' ' || dr.last_name  AS "prescribedBy"
            FROM prescriptions p
            JOIN medical_records mr ON p.record_id = mr.id
            JOIN users pat ON mr.patient_id = pat.id
            JOIN users dr  ON p.prescribed_by = dr.id
            WHERE ${clinicalScopeSql('mr.patient_id', 'mr.visit_id', '$1', req.user.roleName, 'prescriptions')}
        `;

        const values = [req.user.id];

        if (status && status !== 'all') {
            // Map frontend 'dispensed' → DB 'completed'
            if (status === 'pending') query += " AND p.status IN ('pending','active')";
            else {
                const dbStatus = status === 'dispensed' ? 'completed' : status;
                query += ` AND p.status = $${values.length + 1}`;
                values.push(dbStatus);
            }
        }

        query += ` ORDER BY p.prescribed_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
        values.push(parseInt(limit), parseInt(offset));

        const result = await pool.query(query, values);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        logger.error('Pharmacist getPrescriptions error:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to fetch prescriptions'
        });
    }
};

/**
 * PUT /api/pharmacist/prescriptions/:id/dispense
 * Mark a prescription as completed (dispensed) by this pharmacist
 */
const dispensePrescription = async (req, res) => {
    try {
        const { id } = req.params;
        const pharmacistId = req.user.id;

        const prescription = await PrescriptionModel.updateStatus(id, 'completed', pharmacistId);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Prescription dispensed successfully',
            data: prescription
        });
    } catch (error) {
        logger.error('Pharmacist dispensePrescription error:', error);
        res.status(error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: error.message || 'Failed to dispense prescription'
        });
    }
};

/**
 * GET /api/pharmacist/inventory
 * Returns medication inventory.
 * Falls back to an empty list if the pharmacy_inventory table hasn't been created yet.
 */
const getInventory = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id,
                name,
                generic_name       AS "genericName",
                category,
                location,
                stock_quantity     AS stock,
                reorder_level,
                CASE
                    WHEN stock_quantity = 0         THEN 'Out of Stock'
                    WHEN stock_quantity <= reorder_level THEN 'Low Stock'
                    ELSE 'In Stock'
                END AS status
            FROM pharmacy_inventory WHERE organization_id = $1
            ORDER BY
                CASE WHEN stock_quantity = 0 THEN 0
                     WHEN stock_quantity <= reorder_level THEN 1
                     ELSE 2 END,
                name
        `, [req.organizationId]);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        // If the table doesn't exist yet return an empty list rather than a 500
        if (error.code === '42P01') {
            return res.status(HTTP_STATUS.OK).json({ success: true, data: [] });
        }
        logger.error('Pharmacist getInventory error:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to fetch inventory'
        });
    }
};

/**
 * GET /api/pharmacist/profile
 */
const getProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(
            `SELECT u.id, u.email, u.first_name AS "firstName", u.last_name AS "lastName", u.phone, 
                    u.profile_photo AS "profilePhoto", r.name AS "role", som.employee_id AS "employeeId",
                    som.department, som.status, som.professional_license AS "licenseNumber",
                    som.assigned_wards AS "assignedWards", som.shift_preference AS "shiftPreference",
                    u.created_at AS "joinedDate"
             FROM users u
             LEFT JOIN roles r ON u.role_id = r.id
             LEFT JOIN staff_org_mapping som ON u.id = som.user_id
             WHERE u.id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: 'User not found' });
        }

        const profile = result.rows[0];
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: {
                ...profile,
                address: profile.address || "Add address in settings",
                emergencyContact: {
                    name: "Not Set",
                    relationship: "Not Set",
                    phone: "Not Set"
                },
                assignedWards: profile.assignedWards || ["Main Pharmacy"],
                shiftPreference: profile.shiftPreference || "Day Shift"
            }
        });
    } catch (error) {
        logger.error('Pharmacist getProfile error:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Failed to fetch profile' });
    }
};

/**
 * PUT /api/pharmacist/profile
 */
const updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { phone } = req.body;

        await pool.query(
            `UPDATE users
             SET phone = $1, updated_at = NOW()
             WHERE id = $2`,
            [phone, userId]
        );

        // Re-fetch the profile to return updated data
        const returnProfile = await pool.query(
            `SELECT u.id, u.email, u.first_name AS "firstName", u.last_name AS "lastName", u.phone, 
                    u.profile_photo AS "profilePhoto", r.name AS "role", som.employee_id AS "employeeId",
                    som.department, som.status, som.professional_license AS "licenseNumber",
                    som.assigned_wards AS "assignedWards", som.shift_preference AS "shiftPreference",
                    u.created_at AS "joinedDate"
             FROM users u
             LEFT JOIN roles r ON u.role_id = r.id
             LEFT JOIN staff_org_mapping som ON u.id = som.user_id
             WHERE u.id = $1`,
            [userId]
        );

        const profile = returnProfile.rows[0];

        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                ...profile,
                address: profile.address || "Add address in settings",
                emergencyContact: {
                    name: "Not Set",
                    relationship: "Not Set",
                    phone: "Not Set"
                },
                assignedWards: profile.assignedWards || ["Main Pharmacy"],
                shiftPreference: profile.shiftPreference || "Day Shift"
            }
        });
    } catch (error) {
        logger.error('Pharmacist updateProfile error:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Failed to update profile' });
    }
};

/**
 * GET /api/pharmacist/audit-logs
 */
const getAuditLogs = async (req, res) => {
    try {
        const userId = req.user.id;
        const logs = await AuditService.getUserAuditLogs(userId, { limit: 50 });

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: logs
        });
    } catch (error) {
        logger.error('Pharmacist getAuditLogs error:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Failed to fetch audit logs' });
    }
};

module.exports = {
    getStats,
    getPrescriptions,
    dispensePrescription,
    getInventory,
    getProfile,
    updateProfile,
    getAuditLogs
};
