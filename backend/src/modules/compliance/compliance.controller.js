const pool = require('../../config/db');
const auditService = require('../../services/audit.service');
const logger = require('../../utils/logger');

const getDashboardStats = async (req, res, next) => {
    try {
        // 1. Auth Anomalies (Failed logins/Access denied in last 24h)
        const anomalyStats = await pool.query(`
            SELECT COUNT(*) as count 
            FROM audit_logs 
            WHERE LOWER(action) IN ('user_login_failed', 'failed_login', 'access_denied')
            AND timestamp > NOW() - INTERVAL '24 hours'
        `);

        // 2. Active Overrides (Emergency consents)
        const overrideStats = await pool.query(`
            SELECT COUNT(*) as count 
            FROM emergency_access_grants
            WHERE status = 'active' AND expires_at > NOW()
        `);

        // 3. Open Incidents (From security_events table)
        const incidentStats = await pool.query(`
            SELECT COUNT(*) as count 
            FROM security_events 
            WHERE status != 'Resolved'
        `);

        const openIncidentsCount = parseInt(incidentStats.rows[0].count);

        res.json({
            success: true,
            data: {
                authAnomalies: parseInt(anomalyStats.rows[0].count),
                openIncidents: openIncidentsCount,
                activeOverrides: parseInt(overrideStats.rows[0].count),
                pendingReviews: openIncidentsCount,
                complianceScore: null,
            }
        });
    } catch (err) {
        next(err);
    }
};

const getGlobalAudits = async (req, res, next) => {
    try {
        const options = {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 100,
            sortBy: 'timestamp',
            sortOrder: 'desc'
        };

        const result = await auditService.getAllAuditLogs(options);

        // Map to format expected by GlobalAuditLogs.jsx
        const formattedLogs = result.logs.map(log => ({
            id: log.id,
            timestamp: log.timestamp,
            user: `${log.user_email || 'System'} (${log.metadata?.userRole || 'SERVICE'})`,
            action: log.action.toUpperCase(),
            details: `${log.request_method || 'GET'} ${log.request_path || '/'} - ${log.details || 'No details'}`,
            status: log.status_code < 300 ? 'Success' : log.status_code < 500 ? 'Warning' : 'Failed'
        }));

        res.json({
            success: true,
            data: formattedLogs,
            pagination: result.pagination
        });
    } catch (err) {
        next(err);
    }
};

const getIncidents = async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT * FROM security_events 
            ORDER BY created_at DESC
        `);

        // Map to frontend format
        const incidents = result.rows.map(row => ({
            id: row.id,
            type: row.event_type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            severity: row.severity.charAt(0).toUpperCase() + row.severity.slice(1),
            status: row.status || (row.resolved ? 'Resolved' : 'Open'),
            reporter: row.metadata?.reporter || 'System',
            date: row.created_at,
            description: row.description
        }));

        res.json({
            success: true,
            data: incidents
        });
    } catch (err) {
        next(err);
    }
};

const updateIncidentStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const resolved = status === 'Resolved';
        const resolvedAt = resolved ? new Date() : null;
        const resolvedBy = resolved ? req.user.id : null;

        await pool.query(`
            UPDATE security_events 
            SET status = $1, resolved = $2, resolved_at = $3, resolved_by = $4 
            WHERE id = $5
        `, [status, resolved, resolvedAt, resolvedBy, id]);

        logger.info(`Compliance incident ${id} status updated to ${status}`);

        res.json({
            success: true,
            message: `Incident ${id} updated to ${status}`
        });
    } catch (err) {
        next(err);
    }
};

const getConsentOverrides = async (req, res, next) => {
    try {
        // Fetch from consent table where emergency override was used
        const result = await pool.query(`
            SELECT c.*, u.first_name || ' ' || u.last_name as doctor_name
            FROM emergency_access_grants c
            JOIN users u ON c.user_id = u.id
            WHERE c.status = 'active' AND c.expires_at > NOW()
        `);

        res.json({
            success: true,
            data: result.rows.map(r => ({
                id: r.id,
                doctor: r.doctor_name,
                patientId: r.patient_id,
                timestamp: r.created_at,
                justification: r.justification,
                expiresAt: r.expires_at,
            }))
        });
    } catch (err) {
        next(err);
    }
};

const getProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(`
            SELECT u.*, r.name as role_name
            FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.id = $1
        `, [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const user = result.rows[0];
        res.json({
            success: true,
            data: {
                firstName: user.first_name,
                lastName: user.last_name,
                email: user.email,
                phone: user.phone || '+1 (555) 000-0000',
                address: user.address || 'No address provided',
                status: user.status.charAt(0).toUpperCase() + user.status.slice(1),
                department: 'Information Governance',
                company: 'MediCare Health System',
                employeeId: 'CMP-' + user.id.substring(0, 8).toUpperCase(),
                role: 'Ethics & Compliance Officer',
                joinedDate: user.created_at
            }
        });
    } catch (err) {
        next(err);
    }
};

const updateProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { phone, address } = req.body;

        const result = await pool.query(`
            UPDATE users 
            SET phone = $1, address = $2, updated_at = NOW()
            WHERE id = $3
            RETURNING *
        `, [phone, address, userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const user = result.rows[0];

        // Return updated profile
        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                firstName: user.first_name,
                lastName: user.last_name,
                email: user.email,
                phone: user.phone,
                address: user.address,
                status: user.status.charAt(0).toUpperCase() + user.status.slice(1),
                department: 'Information Governance',
                company: 'MediCare Health System',
                employeeId: 'CMP-' + user.id.substring(0, 8).toUpperCase(),
                role: 'Ethics & Compliance Officer',
                joinedDate: user.created_at
            }
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getDashboardStats,
    getGlobalAudits,
    getIncidents,
    updateIncidentStatus,
    getConsentOverrides,
    getProfile,
    updateProfile
};
