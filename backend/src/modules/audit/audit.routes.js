const express = require('express');
const router = express.Router();
const AuditController = require('./audit.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

/**
 * @route   GET /api/audit/logs
 * @desc    Get all audit logs
 * @access  Private (Admin)
 */
router.get(
    '/logs',
    authenticate,
    authorize(['hospital_admin', 'system_admin', 'compliance_officer']),
    AuditController.getAllAuditLogs
);

/**
 * @route   GET /api/audit/users/:userId/logs
 * @desc    Get audit logs for a specific user
 * @access  Private (Admin)
 */
router.get(
    '/users/:userId/logs',
    authenticate,
    authorize(['hospital_admin', 'system_admin', 'compliance_officer']),
    AuditController.getUserAuditLogs
);

/**
 * @route   GET /api/audit/my-trail
 * @desc    Get audit trail for the logged-in patient
 * @access  Private (Patient only)
 */
router.get(
    '/my-trail',
    authenticate,
    authorize(['PATIENT', 'patient']),
    AuditController.getPatientAuditTrail
);

module.exports = router;
