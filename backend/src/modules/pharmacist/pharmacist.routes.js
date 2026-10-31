const express = require('express');
const router = express.Router();
const pharmacistController = require('./pharmacist.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/rbac.middleware');
const { clinicalAccess, orgContext } = require('../../middleware/clinical-access.middleware');
const { auditLog } = require('../../middleware/audit.middleware');

// All pharmacist routes require authentication + pharmacist role
router.use(authenticate);
router.use(requireRole(['pharmacist']), orgContext);

/**
 * @route   GET /api/pharmacist/stats
 * @desc    Get dashboard statistics (pending Rx, dispensed today, low stock)
 */
router.get('/stats', pharmacistController.getStats);

/**
 * @route   GET /api/pharmacist/prescriptions
 * @desc    Get prescription queue, optionally filtered by status
 * @query   status - 'pending' | 'dispensed' | 'all' (default: all)
 */
router.get('/prescriptions', pharmacistController.getPrescriptions);

/**
 * @route   PUT /api/pharmacist/prescriptions/:id/dispense
 * @desc    Mark a prescription as dispensed (completed)
 */
router.put(
    '/prescriptions/:id/dispense',
    clinicalAccess({ resource: 'prescription', id: req => req.params.id, access: 'write', category: 'prescriptions' }),
    auditLog('dispense_prescription', 'prescription'),
    pharmacistController.dispensePrescription
);

/**
 * @route   GET /api/pharmacist/inventory
 * @desc    Get medication inventory with stock level status
 */
router.get('/inventory', pharmacistController.getInventory);

/**
 * @route   GET  /api/pharmacist/profile
 * @route   PUT  /api/pharmacist/profile
 * @desc    Get / update pharmacist profile
 */
router.get('/profile', pharmacistController.getProfile);
router.put('/profile', auditLog('update_pharmacist_profile', 'user'), pharmacistController.updateProfile);

/**
 * @route   GET /api/pharmacist/audit-logs
 * @desc    Get pharmacist's own audit trail
 */
router.get('/audit-logs', pharmacistController.getAuditLogs);

module.exports = router;
