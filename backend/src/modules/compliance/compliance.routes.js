const express = require('express');
const router = express.Router();
const complianceController = require('./compliance.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const breach = require('./breach.service');
const { asyncHandler } = require('../../middleware/error.middleware');

// Protect all routes
router.use(authenticate);
router.use(authorize(['compliance_officer', 'system_admin']));

router.get('/dashboard', complianceController.getDashboardStats);
router.get('/global-audits', complianceController.getGlobalAudits);
router.get('/incidents', complianceController.getIncidents);
router.put('/incidents/:id', asyncHandler(async (req,res) => res.json({success:true,data:await breach.updateIncidentStatus(req)})));
// Restricted narratives and notification evidence are governance casework,
// not a blanket clinical-data privilege for system administrators.
const officer = authorize(['compliance_officer']);
router.get('/breaches', officer, asyncHandler(async (req,res) => res.json({success:true,data:await breach.listBreaches(req)})));
router.post('/breaches', officer, asyncHandler(async (req,res) => res.status(201).json({success:true,data:await breach.createBreach(req)})));
router.get('/breaches/:id', officer, asyncHandler(async (req,res) => res.json({success:true,data:await breach.getBreach(req)})));
router.put('/breaches/:id', officer, asyncHandler(async (req,res) => res.json({success:true,data:await breach.updateAssessment(req)})));
router.post('/breaches/:id/notifications', officer, asyncHandler(async (req,res) => res.status(201).json({success:true,data:await breach.recordNotification(req)})));
router.get('/consent-overrides', complianceController.getConsentOverrides);
router.get('/profile', complianceController.getProfile);
router.put('/profile', complianceController.updateProfile);

module.exports = router;
