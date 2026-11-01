const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { auditActions } = require('../../middleware/audit.middleware');
const { loginLimiter, otpLimiter, registrationLimiter } = require('../../middleware/rateLimit.middleware');
const { asyncHandler } = require('../../middleware/error.middleware');
const { assertEmailAvailable } = require('../../config/mail');

// Verification needs a working delivery configuration before creating an
// account or accepting credentials. Existing-account login stays independent.
const requireEmailDelivery = (req, res, next) => {
    try { assertEmailAvailable(); next(); } catch (error) { next(error); }
};

/**
 * @route   POST /api/auth/register/patient
 * @desc    Register a new patient
 * @access  Public
 */
const upload = require('../../middleware/upload.middleware');

/**
 * @route   POST /api/auth/register/patient
 * @desc    Register a new patient
 * @access  Public
 */
router.post(
    '/register/patient',
    registrationLimiter,
    requireEmailDelivery,
    asyncHandler(authController.registerPatient)
);

/**
 * @route   POST /api/auth/register/doctor
 * @desc    Register a new doctor
 * @access  Public
 */
router.post(
    '/register/doctor',
    registrationLimiter,
    requireEmailDelivery,
    upload.fields([
        { name: 'degreeCertificate', maxCount: 1 },
        { name: 'medicalRegCertificate', maxCount: 1 }
    ]),
    asyncHandler(authController.registerDoctor)
);

/**
 * @route   POST /api/auth/register/organization
 * @desc    Register a new organization (hospital/clinic/pharmacy)
 * @access  Public
 */
router.post(
    '/register/organization',
    registrationLimiter,
    requireEmailDelivery,
    upload.single('licenseDocument'),
    asyncHandler(authController.registerOrganization)
);

/**
 * @route   POST /api/auth/verify-otp
 * @desc    Verify OTP code
 * @access  Public
 */
router.post(
    '/verify-otp',
    otpLimiter,
    asyncHandler(authController.verifyOTPController)
);

/**
 * @route   POST /api/auth/otp/verify
 * @desc    Verify OTP code (frontend compatibility endpoint)
 * @access  Public
 */
router.post(
    '/otp/verify',
    otpLimiter,
    asyncHandler(authController.verifyOTPController)
);

/**
 * @route   POST /api/auth/resend-otp
 * @desc    Resend OTP code
 * @access  Public
 */
router.post(
    '/resend-otp',
    otpLimiter,
    requireEmailDelivery,
    asyncHandler(authController.resendOTP)
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user (with frontend compatibility)
 * @access  Public
 */
router.post(
    '/login',
    loginLimiter,
    asyncHandler(async (req, res) => {
        // Intercept the response to ensure frontend compatibility tokens are there
        const originalJson = res.json.bind(res);
        res.json = function (data) {
            // Transform response for frontend compatibility
            if (data.success && data.data && data.data.accessToken) {
                const transformed = {
                    ...data,
                    token: data.data.accessToken, // Add 'token' field for frontend
                };
                return originalJson(transformed);
            }
            return originalJson(data);
        };

        return authController.login(req, res);
    })
);

/**
 * @route   GET /api/auth/verify
 * @desc    Verify JWT token and return user info
 * @access  Private
 */
router.get(
    '/verify',
    authenticate,
    asyncHandler(async (req, res) => {
        res.json({
            success: true,
            message: 'Token is valid',
            user: {
                id: req.user.id,
                email: req.user.email,
                firstName: req.user.firstName,
                lastName: req.user.lastName,
                role: req.user.roleName // Use roleName to populate 'role' for frontend
            }
        });
    })
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post(
    '/logout',
    authenticate,
    asyncHandler(authController.logout)
);

// ---- Passkey (WebAuthn) Routes ----
const passkeyRoutes = require('./passkey.routes');
router.use('/passkey', passkeyRoutes);

module.exports = router;
