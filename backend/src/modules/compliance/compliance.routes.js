const express = require('express');
const router = express.Router();
const complianceController = require('./compliance.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

// Protect all routes
router.use(authenticate);
router.use(authorize(['compliance_officer', 'system_admin']));

router.get('/dashboard', complianceController.getDashboardStats);
router.get('/global-audits', complianceController.getGlobalAudits);
router.get('/incidents', complianceController.getIncidents);
router.put('/incidents/:id', complianceController.updateIncidentStatus);
router.get('/consent-overrides', complianceController.getConsentOverrides);
router.get('/profile', complianceController.getProfile);
router.put('/profile', complianceController.updateProfile);

module.exports = router;
