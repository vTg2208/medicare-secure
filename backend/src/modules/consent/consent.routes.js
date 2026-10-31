const express = require('express');
const router = express.Router();
const consentController = require('./consent.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/rbac.middleware');
const { auditLog } = require('../../middleware/audit.middleware');
const { asyncHandler } = require('../../middleware/error.middleware');

/**
 * @route   GET /api/consent/active
 * @desc    Get all active consents for current patient
 * @access  Private (Patient only)
 */
router.get(
    '/active',
    authenticate,
    requireRole('patient'),
    asyncHandler(consentController.getActiveConsents)
);

/**
 * @route   GET /api/consent/history
 * @desc    Get consent history for current patient
 * @access  Private (Patient only)
 */
router.get(
    '/history',
    authenticate,
    requireRole('patient'),
    asyncHandler(consentController.getConsentHistory)
);

/**
 * @route   POST /api/consent/grant
 * @desc    Grant new consent
 * @access  Private (Patient only)
 */
router.post(
    '/grant',
    authenticate,
    requireRole('patient'),
    auditLog('consent_grant', 'consent'),
    asyncHandler(consentController.grantConsent)
);

/**
 * @route   PUT /api/consent/revoke/:consentId
 * @desc    Revoke existing consent
 * @access  Private (Patient only)
 */
router.put(
    '/revoke/:consentId',
    authenticate,
    requireRole('patient'),
    auditLog('consent_revoke', 'consent'),
    asyncHandler(consentController.revokeConsent)
);

/**
 * @route   PUT /api/consent/:id
 * @desc    Update existing consent
 * @access  Private (Patient only)
 */
router.put(
    '/:id',
    authenticate,
    requireRole('patient'),
    auditLog('consent_update', 'consent'),
    asyncHandler(consentController.updateConsent)
);

/**
 * @route   GET /api/consent/doctor/patients
 * @desc    Get patients who have granted consent to the doctor
 * @access  Private (Doctor only)
 */
router.get(
    '/doctor/patients',
    authenticate,
    requireRole('doctor'),
    asyncHandler(consentController.getDoctorPatients)
);

module.exports = router;
