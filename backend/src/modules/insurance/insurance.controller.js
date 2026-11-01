const pool = require('../../config/db');
const { consentSql } = require('../../middleware/clinical-access.middleware');

const getDashboardStats = async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total_claims,
                COUNT(CASE WHEN status = 'Pending' THEN 1 END) as pending_claims,
                COUNT(CASE WHEN status = 'Approved' THEN 1 END) as approved_claims,
                COUNT(CASE WHEN status = 'Denied' THEN 1 END) as denied_claims,
                COALESCE(SUM(CASE WHEN status = 'Approved' THEN amount ELSE 0 END), 0) as total_payout
            FROM insurance_claims c WHERE ${consentSql('c.patient_id', '$1', 'insurance_claim')}
        `, [req.user.id]);

        const activePoliciesResult = await pool.query(`
            SELECT COUNT(*) as active_policies FROM insurance_policies p WHERE status = 'Active' AND ${consentSql('p.patient_id', '$1', 'insurance_claim')}
        `, [req.user.id]);

        const recentClaimsResult = await pool.query(`
            SELECT c.*, u.first_name || ' ' || u.last_name as patient_name 
            FROM insurance_claims c
            JOIN users u ON c.patient_id = u.id
            WHERE ${consentSql('c.patient_id', '$1', 'insurance_claim')}
            ORDER BY c.submitted_at DESC
            LIMIT 3
        `, [req.user.id]);

        res.json({
            success: true,
            data: {
                pendingClaims: parseInt(result.rows[0].pending_claims) || 0,
                approvedClaims: parseInt(result.rows[0].approved_claims) || 0,
                deniedClaims: parseInt(result.rows[0].denied_claims) || 0,
                totalPayout: parseFloat(result.rows[0].total_payout).toFixed(2),
                activePolicies: parseInt(activePoliciesResult.rows[0].active_policies) || 0,
                recentClaims: recentClaimsResult.rows.map(r => ({
                    id: r.id,
                    patientName: r.patient_name,
                    policyNumber: r.policy_id,
                    diagnosis: r.diagnosis,
                    amount: parseFloat(r.amount),
                    status: r.status,
                    submittedAt: r.submitted_at
                }))
            }
        });
    } catch (err) {
        next(err);
    }
};

const getClaims = async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT c.*, 
                   u.first_name || ' ' || u.last_name as patient_name,
                   p.member_name
            FROM insurance_claims c
            JOIN users u ON c.patient_id = u.id
            JOIN insurance_policies p ON c.policy_id = p.id
            WHERE ${consentSql('c.patient_id', '$1', 'insurance_claim')}
            ORDER BY c.submitted_at DESC LIMIT 100
        `, [req.user.id]);

        res.json({
            success: true,
            data: result.rows.map(r => ({
                id: r.id,
                patientName: r.patient_name,
                policyNumber: r.policy_id,
                diagnosis: r.diagnosis,
                amount: parseFloat(r.amount),
                status: r.status,
                submittedAt: r.submitted_at,
                notes: r.notes
            }))
        });
    } catch (err) {
        next(err);
    }
};

const updateClaim = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;
        if (!['Pending', 'Approved', 'Denied', 'Processing'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid claim status' });

        const result = await pool.query(
            `UPDATE insurance_claims SET status = $1, notes = COALESCE($2, notes), updated_at = NOW() WHERE id = $3 AND ${consentSql('insurance_claims.patient_id', '$4', 'insurance_claim', 'write')} RETURNING *`,
            [status, notes, id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Claim not found' });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        next(err);
    }
};

const verifyCoverage = async (req, res, next) => {
    try {
        const { memberId, policyNumber } = req.query;

        let query = `
            SELECT p.*, u.first_name || ' ' || u.last_name as patient_name
            FROM insurance_policies p
            JOIN users u ON p.patient_id = u.id
            WHERE ${consentSql('p.patient_id', '$1', 'insurance_claim')}
        `;
        const params = [req.user.id];

        if (policyNumber) {
            query += ` AND p.id = $2`;
            params.push(policyNumber);
        } else if (memberId) {
            query += ` AND p.patient_id = $2`;
            params.push(memberId);
        } else {
            return res.status(400).json({ success: false, message: 'Search parameter required' });
        }

        const result = await pool.query(query, params);

        if (result.rows.length > 0) {
            const holder = result.rows[0];
            const isCovered = holder.status === 'Active';

            res.json({
                success: true,
                data: {
                    covered: isCovered,
                    policyDetails: {
                        name: holder.patient_name,
                        policyNumber: holder.id,
                        type: holder.type,
                        status: holder.status,
                        coverageStart: holder.coverage_start,
                        coverageEnd: holder.coverage_end
                    },
                    copay: parseFloat(holder.copay).toFixed(2),
                    deductibleUsed: parseFloat(holder.deductible_used).toFixed(2),
                    deductibleTotal: parseFloat(holder.deductible_total).toFixed(2),
                    message: isCovered ? null : holder.status === 'Expired' ? 'Policy has expired' : 'Policy is not active'
                }
            });
        } else {
            res.json({
                success: true,
                data: { covered: false, policyDetails: null, message: "Policy not found or inactive" }
            });
        }
    } catch (err) {
        next(err);
    }
};

const getPolicyholders = async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT p.*, u.first_name || ' ' || u.last_name as patient_name, u.email
            FROM insurance_policies p
            JOIN users u ON p.patient_id = u.id
            WHERE ${consentSql('p.patient_id', '$1', 'insurance_claim')}
            ORDER BY p.created_at DESC LIMIT 100
        `, [req.user.id]);

        res.json({
            success: true,
            data: result.rows.map(r => ({
                id: r.patient_id,
                name: r.patient_name,
                policyNumber: r.id,
                type: r.type,
                status: r.status,
                coverageStart: r.coverage_start,
                coverageEnd: r.coverage_end,
                email: r.email
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
                department: 'Claims Processing', // Could be added to staff_org_mapping
                company: 'Medicare Verified Insurance',
                agentId: 'AGT-' + user.id.substring(0, 8).toUpperCase(),
                role: 'Senior Claims Agent'
            }
        });
    } catch (err) {
        next(err);
    }
};

const updateProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { phone } = req.body;
        // Updating only phone number for now matching normal profile updates

        const result = await pool.query(
            'UPDATE users SET phone = COALESCE($1, phone), updated_at = NOW() WHERE id = $2 RETURNING *',
            [phone, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        next(); // Re-fetch through getProfile
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getDashboardStats,
    getClaims,
    updateClaim,
    verifyCoverage,
    getPolicyholders,
    getProfile,
    updateProfile
};
