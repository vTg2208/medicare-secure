const express = require('express');
const router = express.Router();
const DoctorVerificationController = require('./doctor.verification.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole, requireSystemAdmin } = require('../../middleware/rbac.middleware');
const upload = require('../../middleware/upload.middleware');
const { asyncHandler } = require('../../middleware/error.middleware');
const VerificationDocument = require('../../models/verification_document.model');
const { readCredential } = require('../../services/credential-file.service');

router.get('/documents/:documentId/download', authenticate, asyncHandler(async (req, res) => {
    const document = await VerificationDocument.getById(req.params.documentId);
    if (!document || (req.user.id !== document.user_id && req.user.roleName !== 'system_admin')) {
        return res.status(404).json({ success: false, message: 'Document not found' });
    }
    const content = await readCredential(document.file_path);
    const event = await require('../../services/audit.service').createAuditLog({ userId: req.user.id, action: 'view_credential_document',
        entityType: 'verification_document', entityId: document.id, statusCode: 200 });
    if (!event) return res.status(503).json({ success: false, message: 'The document cannot be downloaded while auditing is unavailable' });
    res.attachment(document.file_name).type('application/octet-stream').send(content);
}));

/**
 * Doctor Verification Routes
 * Base path: /api/doctors/verification
 */

// Doctor endpoints (authenticated doctors only)
router.post(
    '/upload-license',
    authenticate,
    requireRole(['doctor']),
    upload.single('file'),
    DoctorVerificationController.uploadLicense
);

router.post(
    '/submit',
    authenticate,
    requireRole(['doctor']),
    DoctorVerificationController.submitForVerification
);

router.get(
    '/status',
    authenticate,
    requireRole(['doctor']),
    DoctorVerificationController.getStatus
);

router.get(
    '/documents',
    authenticate,
    requireRole(['doctor']),
    DoctorVerificationController.getDocuments
);

// Admin endpoints (admin only)
router.get(
    '/pending',
    authenticate,
    requireSystemAdmin,
    DoctorVerificationController.getPending
);

router.post(
    '/:userId/approve',
    authenticate,
    requireSystemAdmin,
    DoctorVerificationController.approve
);

router.post(
    '/:userId/reject',
    authenticate,
    requireSystemAdmin,
    DoctorVerificationController.reject
);

router.get(
    '/stats',
    authenticate,
    requireSystemAdmin,
    DoctorVerificationController.getStats
);

module.exports = router;
