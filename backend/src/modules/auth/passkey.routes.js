const express = require('express');
const router = express.Router();
const passkeyController = require('./passkey.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { asyncHandler } = require('../../middleware/error.middleware');
const { loginLimiter } = require('../../middleware/rateLimit.middleware');

/**
 * @route   POST /api/auth/passkey/register/options
 * @desc    Generate passkey registration options (challenge)
 * @access  Private (must be logged in)
 */
router.post(
    '/register/options',
    authenticate,
    asyncHandler(passkeyController.registerOptions)
);

/**
 * @route   POST /api/auth/passkey/register/verify
 * @desc    Verify and store passkey credential
 * @access  Private (must be logged in)
 */
router.post(
    '/register/verify',
    authenticate,
    asyncHandler(passkeyController.registerVerify)
);

/**
 * @route   POST /api/auth/passkey/login/options
 * @desc    Generate passkey authentication options
 * @access  Public
 */
router.post(
    '/login/options',
    loginLimiter,
    asyncHandler(passkeyController.loginOptions)
);

/**
 * @route   POST /api/auth/passkey/login/verify
 * @desc    Verify passkey authentication and issue tokens
 * @access  Public
 */
router.post(
    '/login/verify',
    loginLimiter,
    asyncHandler(async (req, res) => {
        // Intercept response for frontend compatibility (same as password login)
        const originalJson = res.json.bind(res);
        res.json = function (data) {
            if (data.success && data.data && data.data.accessToken) {
                const transformed = {
                    ...data,
                    token: data.data.accessToken,
                };
                return originalJson(transformed);
            }
            return originalJson(data);
        };

        return passkeyController.loginVerify(req, res);
    })
);

module.exports = router;
