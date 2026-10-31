const express = require('express');
const router = express.Router();
const AdminController = require('./admin.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireAdmin, requireSystemAdmin } = require('../../middleware/rbac.middleware');
const { ROLES } = require('../../utils/constants');

/**
 * Admin Routes
 * Base path: /api/admin
 */

// Organizations Verification
router.get(
    '/organizations/pending',
    authenticate,
    requireSystemAdmin,
    AdminController.getPendingOrganizations
);

router.post(
    '/organizations/:orgId/approve',
    authenticate,
    requireSystemAdmin,
    AdminController.approveOrganization
);

router.post(
    '/organizations/:orgId/reject',
    authenticate,
    requireSystemAdmin,
    AdminController.rejectOrganization
);

// Hospital Dashboard Stats
router.get(
    '/hospital/stats',
    authenticate,
    requireAdmin,
    AdminController.getHospitalStats
);

module.exports = router;
