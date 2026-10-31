const express = require('express');
const router = express.Router();
const PatientController = require('./patient.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/rbac.middleware');
const { asyncHandler } = require('../../middleware/error.middleware');

/**
 * @route   GET /api/v1/patient/profile
 * @desc    Get the logged-in patient's basic profile info
 * @access  Private (Patient only)
 */
router.get(
    '/profile',
    authenticate,
    requireRole('patient'),
    asyncHandler(PatientController.getProfile)
);

/**
 * @route   GET /api/v1/patient/health-facts
 * @desc    Get personalised health facts derived from recent records + wellness tips
 * @access  Private (Patient only)
 */
router.get(
    '/health-facts',
    authenticate,
    requireRole('patient'),
    asyncHandler(PatientController.getHealthFacts)
);

/**
 * @route   GET /api/v1/patient/activities
 * @desc    Get unified activity feed (visits + medical records) for the patient
 * @access  Private (Patient only)
 */
router.get(
    '/activities',
    authenticate,
    requireRole('patient'),
    asyncHandler(PatientController.getActivities)
);

module.exports = router;
