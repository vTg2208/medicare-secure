const DoctorVerificationService = require('../../services/doctor.verification.service');
const VerificationDocument = require('../../models/verification_document.model');
const asyncHandler = require('../../utils/asyncHandler');

/**
 * Doctor Verification Controller
 * Handles HTTP requests for doctor verification workflow
 */
class DoctorVerificationController {
    /**
     * Upload license document
     * POST /api/doctors/verification/upload-license
     */
    static uploadLicense = asyncHandler(async (req, res) => {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const document = await DoctorVerificationService.uploadLicenseDocument(
            req.user.id,
            {
                documentType: req.body.documentType || 'medical_license',
                path: req.file.path,
                buffer: req.file.buffer,
                originalname: req.file.originalname,
                filename: req.file.filename,
                size: req.file.size,
                mimetype: req.file.mimetype,
                expiresAt: req.body.expiresAt || null
            }
        );

        res.status(201).json({
            success: true,
            message: 'License document uploaded successfully',
            data: document
        });
    });

    /**
     * Submit for verification
     * POST /api/doctors/verification/submit
     */
    static submitForVerification = asyncHandler(async (req, res) => {
        const user = await DoctorVerificationService.submitForVerification(
            req.user.id,
            req.user.id
        );

        res.json({
            success: true,
            message: 'Submitted for verification successfully',
            data: user
        });
    });

    /**
     * Get own verification status
     * GET /api/doctors/verification/status
     */
    static getStatus = asyncHandler(async (req, res) => {
        const status = await DoctorVerificationService.getVerificationStatus(req.user.id);

        res.json({
            success: true,
            data: status
        });
    });

    /**
     * Get all pending verifications (admin only)
     * GET /api/doctors/verification/pending
     */
    static getPending = asyncHandler(async (req, res) => {
        const pending = await DoctorVerificationService.getPendingVerifications();

        res.json({
            success: true,
            count: pending.length,
            data: pending
        });
    });

    /**
     * Approve doctor verification (admin only)
     * POST /api/doctors/verification/:userId/approve
     */
    static approve = asyncHandler(async (req, res) => {
        const { userId } = req.params;
        const { notes } = req.body;

        const user = await DoctorVerificationService.approveDoctor(
            userId,
            req.user.id,
            notes
        );

        res.json({
            success: true,
            message: 'Doctor approved successfully',
            data: user
        });
    });

    /**
     * Reject doctor verification (admin only)
     * POST /api/doctors/verification/:userId/reject
     */
    static reject = asyncHandler(async (req, res) => {
        const { userId } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({
                success: false,
                message: 'Rejection reason is required'
            });
        }

        const user = await DoctorVerificationService.rejectDoctor(
            userId,
            req.user.id,
            reason
        );

        res.json({
            success: true,
            message: 'Doctor rejected',
            data: user
        });
    });

    /**
     * Get verification statistics (admin only)
     * GET /api/doctors/verification/stats
     */
    static getStats = asyncHandler(async (req, res) => {
        const stats = await DoctorVerificationService.getStats();

        res.json({
            success: true,
            data: stats
        });
    });

    /**
     * Get user's documents
     * GET /api/doctors/verification/documents
     */
    static getDocuments = asyncHandler(async (req, res) => {
        const documents = await VerificationDocument.getByUserId(req.user.id);

        res.json({
            success: true,
            count: documents.length,
            data: documents
        });
    });
}

module.exports = DoctorVerificationController;
