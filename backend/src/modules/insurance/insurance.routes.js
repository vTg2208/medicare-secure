const express = require('express');
const router = express.Router();
const insuranceController = require('./insurance.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

// Protect all routes and restrict to 'insurance_provider' role
router.use(authenticate);
router.use(authorize(['insurance', 'insurance_provider']));

// Dashboard Stats
router.get('/dashboard', insuranceController.getDashboardStats);

// Claims Management
router.route('/claims')
    .get(insuranceController.getClaims);

router.route('/claims/:id')
    .put(insuranceController.updateClaim);

// Coverage Verification
router.get('/coverage/verify', insuranceController.verifyCoverage);

// Policyholders
router.get('/policyholders', insuranceController.getPolicyholders);

// Profile Management
router.route('/profile')
    .get(insuranceController.getProfile)
    .put(insuranceController.updateProfile, insuranceController.getProfile);

module.exports = router;
