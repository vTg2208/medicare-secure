const { query } = require('../../config/db');
const logger = require('../../utils/logger');

/**
 * Get staff by role (doctors, nurses, etc.)
 */
const getStaffByRole = async (req, res) => {
    try {
        const { role } = req.params;
        const userId = req.user.id;

        // First, get the requesting user's organization
        const userOrgQuery = `
            SELECT organization_id 
            FROM staff_org_mapping 
            WHERE user_id = $1 AND status = 'active'
            LIMIT 1
        `;
        const userOrgResult = await query(userOrgQuery, [userId]);

        if (userOrgResult.rows.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'You are not linked to any active organization'
            });
        }

        const organizationId = userOrgResult.rows[0].organization_id;

        // Get staff by role filtered by organization
        const staffQuery = `
            SELECT 
                u.id,
                u.first_name,
                u.last_name,
                u.email,
                r.name as role_name
            FROM users u
            JOIN roles r ON u.role_id = r.id
            JOIN staff_org_mapping som ON u.id = som.user_id
            WHERE r.name = $1
            AND u.status = 'active'
            AND u.is_verified = true
            AND som.organization_id = $2
            AND som.status = 'active'
            ORDER BY u.first_name, u.last_name
        `;

        const result = await query(staffQuery, [role, organizationId]);

        res.json({
            success: true,
            data: result.rows.map(staff => ({
                id: staff.id,
                name: `${staff.first_name} ${staff.last_name}`,
                email: staff.email,
                role: staff.role_name
            }))
        });

    } catch (error) {
        logger.error('Get staff by role failed:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch staff'
        });
    }
};

module.exports = {
    getStaffByRole
};
