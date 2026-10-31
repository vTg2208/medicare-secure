const express = require('express');
const router = express.Router();
const NurseController = require('./nurse.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/rbac.middleware');
const { clinicalAccess } = require('../../middleware/clinical-access.middleware');

/**
 * Nurse Routes
 * Base path: /api/nurse
 */

router.get(
    '/stats',
    authenticate,
    requireRole(['nurse', 'system_admin']),
    NurseController.getDashboardStats
);

router.get(
    '/profile',
    authenticate,
    requireRole(['nurse']),
    NurseController.getProfile
);

router.put(
    '/profile',
    authenticate,
    requireRole(['nurse']),
    NurseController.updateProfile
);

router.get(
    '/assigned-patients',
    authenticate,
    requireRole(['nurse']),
    NurseController.getAssignedPatients
);

router.get(
    '/activities',
    authenticate,
    requireRole(['nurse']),
    NurseController.getActivities
);

router.get(
    '/vitals',
    authenticate,
    requireRole(['nurse']),
    NurseController.getVitals
);

router.get(
    '/medications',
    authenticate,
    requireRole(['nurse']),
    NurseController.getMedications
);

router.put(
    '/medications/:medicationId/status',
    authenticate,
    requireRole(['nurse']),
    clinicalAccess({ resource: 'medicationOrder', id: req => req.params.medicationId, access: 'write', category: 'prescriptions' }), NurseController.updateMedicationStatus
);

router.get(
    '/patients/:patientId/records',
    authenticate,
    requireRole(['nurse']),
    clinicalAccess(), NurseController.getPatientRecords
);

router.post(
    '/patients/:patientId/records',
    authenticate,
    requireRole(['nurse']),
    clinicalAccess({ resource: req => req.body.visitId ? 'visit' : 'patient', id: req => req.body.visitId || req.params.patientId, access: 'write' }), NurseController.addPatientRecord
);

router.get(
    '/schedule',
    authenticate,
    requireRole(['nurse']),
    NurseController.getSchedule
);

module.exports = router;
