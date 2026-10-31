const authController = require('./auth.controller');
const { createUser, userExists } = require('../../models/user.model');
const { getRoleByName } = require('../../models/role.model');
const { generateAndSendOTP } = require('../../services/otp.service');
const { createAuditLog } = require('../../services/audit.service');
const { HTTP_STATUS, SUCCESS_MESSAGES, ERROR_MESSAGES, ROLES, OTP_PURPOSE, AUDIT_ACTIONS } = require('../../utils/constants');
const { isValidEmail, validatePassword, validateRequiredFields } = require('../../utils/validators');
const logger = require('../../utils/logger');

/**
 * Wrapper for login to accept 'email' field and transform response (frontend compatibility)
 */
const loginCompat = async (req, res) => {
    // If frontend sends 'email', convert to 'emailOrPhone'
    if (req.body.email && !req.body.emailOrPhone) {
        req.body.emailOrPhone = req.body.email;
    }

    // Intercept the response
    const originalJson = res.json.bind(res);
    res.json = function (data) {
        // Transform response for frontend compatibility
        if (data.success && data.data) {
            const transformed = {
                success: data.success,
                message: data.message,
                user: {
                    ...data.data.user,
                    role: data.data.user.role.toUpperCase(), // Convert role to uppercase
                },
                token: data.data.accessToken, // Add 'token' field for frontend
                accessToken: data.data.accessToken,
                refreshToken: data.data.refreshToken,
            };
            return originalJson(transformed);
        }
        return originalJson(data);
    };

    // Call original login
    return authController.login(req, res);
};

/**
 * Wrapper for OTP verification to make purpose optional (frontend compatibility)
 */
const verifyOTPController = async (req, res) => {
    // If purpose is not provided, default to 'registration'
    if (!req.body.purpose) {
        req.body.purpose = OTP_PURPOSE.REGISTRATION;
    }

    // Call original verifyOTPController
    return authController.verifyOTPController(req, res);
};

/**
 * Register Doctor (frontend compatibility)
 * POST /api/auth/register/doctor
 */
const registerDoctor = async (req, res) => {
    try {
        const { email, phone, password, firstName, lastName } = req.body;

        // Validate required fields
        const validation = validateRequiredFields(req.body, ['email', 'password']);
        if (!validation.isValid) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.REQUIRED_FIELDS_MISSING,
                missing: validation.missing,
            });
        }

        // Validate email
        if (!isValidEmail(email)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.INVALID_EMAIL,
            });
        }

        // Validate password
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.WEAK_PASSWORD,
                errors: passwordValidation.errors,
            });
        }

        // Check if user already exists
        const exists = await userExists(email, phone);
        if (exists) {
            return res.status(HTTP_STATUS.CONFLICT).json({
                success: false,
                message: ERROR_MESSAGES.USER_ALREADY_EXISTS,
            });
        }

        // Get doctor role
        const doctorRole = await getRoleByName(ROLES.DOCTOR);
        if (!doctorRole) {
            throw new Error('Doctor role not found in database');
        }

        // Create user
        const user = await createUser({
            email,
            phone: phone || null,
            password,
            roleId: doctorRole.id,
            firstName,
            lastName,
        });

        // Generate and send OTP
        await generateAndSendOTP({
            email,
            userId: user.id,
            purpose: OTP_PURPOSE.REGISTRATION,
        });

        // Audit log
        await createAuditLog({
            userId: user.id,
            action: AUDIT_ACTIONS.USER_REGISTER,
            entityType: 'user',
            entityId: user.id,
            purpose: 'Doctor registration',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            requestMethod: req.method,
            requestPath: req.path,
            statusCode: HTTP_STATUS.CREATED,
        });

        logger.info('Doctor registered successfully:', { userId: user.id, email });

        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            message: SUCCESS_MESSAGES.USER_REGISTERED + '. Please verify your OTP.',
            data: {
                userId: user.id,
                email: user.email,
                phone: user.phone,
            },
        });
    } catch (error) {
        logger.error('Doctor registration failed:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: ERROR_MESSAGES.INTERNAL_ERROR,
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
};

module.exports = {
    ...authController,
    loginCompat,
    verifyOTPController,
    registerDoctor,
};
