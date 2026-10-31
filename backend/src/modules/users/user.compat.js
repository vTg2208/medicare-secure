const { query } = require('../../config/db');
const userController = require('./user.controller');
const { HTTP_STATUS, ERROR_MESSAGES } = require('../../utils/constants');
const logger = require('../../utils/logger');

/**
 * Get all doctors (for consent management)
 * GET /api/users/doctors
 */
const getDoctors = async (req, res) => {
    try {
        const { limit, offset } = req.query;

        const doctorsQuery = `
      SELECT u.id, u.email, u.phone, u.created_at,
            u.first_name as "firstName",
            u.last_name as "lastName",
            COALESCE(dp.specialization, 'General Practice') as specialization,
            som.professional_license, som.organization_id, o.name as organization_name
      FROM users u
      INNER JOIN roles r ON u.role_id = r.id
      LEFT JOIN staff_org_mapping som ON u.id = som.user_id AND som.status = 'active'
      LEFT JOIN organizations o ON som.organization_id = o.id
      LEFT JOIN doctor_profiles dp ON u.id = dp.user_id
      WHERE r.name = 'doctor' AND u.status = 'active' AND u.is_verified = true
      ORDER BY u.created_at DESC
      LIMIT $1 OFFSET $2
            `;

        const result = await query(doctorsQuery, [
            parseInt(limit) || 50,
            parseInt(offset) || 0,
        ]);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: result.rows,
        });
    } catch (error) {
        logger.error('Get doctors failed:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: ERROR_MESSAGES.INTERNAL_ERROR,
        });
    }
};

module.exports = {
    ...userController,
    getDoctors,
};
