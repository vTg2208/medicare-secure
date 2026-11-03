const crypto = require('crypto');
const { createUser, findUserByEmailOrPhone, userExists, updateUserVerification, updateLastLogin, incrementFailedLoginAttempts, isAccountLocked } = require('../../models/user.model');
const { measurePhase } = require('../../services/request-timing');
const { createPatientProfile, findPatientByUserId } = require('../../models/patient.model');
const { createOrganization } = require('../../models/organization.model');
const { getRoleByName } = require('../../models/role.model');
const { generateAndSendOTP, verifyOTP } = require('../../services/otp.service');
const { comparePassword, hashPassword, hashGovtId } = require('../../services/encryption.service');
const { generateAccessToken, generateRefreshToken } = require('../../config/jwt');
const { hashToken } = require('../../services/encryption.service');
const { createAuditLog } = require('../../services/audit.service');
const { captureDeviceInfo } = require('../../services/device.service');
const { query, transaction } = require('../../config/db');
const { HTTP_STATUS, SUCCESS_MESSAGES, ERROR_MESSAGES, ROLES, OTP_PURPOSE, AUDIT_ACTIONS } = require('../../utils/constants');
const { isValidEmail, isValidPhone, validatePassword, validateRequiredFields } = require('../../utils/validators');
const logger = require('../../utils/logger');
const config = require('../../config/env');
const { validateGovernmentIdFormat } = require('../../services/credential-validation.service');
const { sendDoctorRegistrationNotification } = require('../../config/mail');
const DoctorVerificationService = require('../../services/doctor.verification.service');

/**
 * Register patient
 * POST /api/auth/register/patient
 */
const registerPatient = async (req, res) => {
    try {
        let {
            email, phone, password, govtId, aadhaarId, dateOfBirth, firstName, lastName, name,
            gender, bloodGroup, emergencyContactName, emergencyContactPhone,
            emergencyContactRelation, address, city, state, country, postalCode,
            insuranceProvider, insurancePolicyNumber
        } = req.body;

        // Support aliases from new UI
        if (!govtId && aadhaarId) govtId = aadhaarId;
        if (govtId) govtId = String(govtId).trim();
        if (aadhaarId) aadhaarId = String(aadhaarId).trim();

        if (!firstName && name) {
            const parts = name.trim().split(/\s+/);
            firstName = parts[0];
            lastName = parts.slice(1).join(' ') || null;
        }

        // Validate required fields
        const validation = validateRequiredFields(req.body, ['password']);
        if (!validation.isValid) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.REQUIRED_FIELDS_MISSING,
                missing: validation.missing,
            });
        }

        // Validate email or phone
        if (!email) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: 'An email address is required for verification',
            });
        }

        if (email && !isValidEmail(email)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.INVALID_EMAIL,
            });
        }

        if (phone && !isValidPhone(phone)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.INVALID_PHONE,
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

        // Check if user already exists (email)
        if (email) {
            const existingUserByEmail = await findUserByEmailOrPhone(email);
            if (existingUserByEmail && existingUserByEmail.status !== 'pending') {
                return res.status(HTTP_STATUS.CONFLICT).json({
                    success: false,
                    message: 'User with this email already exists',
                });
            }
        }

        // Check if user already exists (phone)
        if (phone) {
            const existingUserByPhone = await findUserByEmailOrPhone(phone);
            if (existingUserByPhone && existingUserByPhone.status !== 'pending') {
                return res.status(HTTP_STATUS.CONFLICT).json({
                    success: false,
                    message: 'User with this phone number already exists',
                });
            }
        }

        // Determine if we are re-registering a pending user
        const existingUser = await findUserByEmailOrPhone(email || phone);
        if (existingUser) {
            return res.status(409).json({ success: false, message: 'An account already exists. Sign in or resend your verification email.' });
        }
        if (existingUser && existingUser.role_name !== ROLES.PATIENT) {
            return res.status(409).json({ success: false, message: ERROR_MESSAGES.USER_ALREADY_EXISTS });
        }
        const isReRegistering = existingUser && existingUser.status === 'pending';
        const userId = isReRegistering ? existingUser.id : null;

        // Validate the supplied identity reference format
        if (govtId) { // check if govtId is provided first, though usually required for patients
            try {
                // Ownership requires authorized review; format validation does not establish identity
                await validateGovernmentIdFormat(govtId);
            } catch (error) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    message: error.message || 'Aadhaar verification failed',
                });
            }
        }

        // Check if government ID already exists (excluding the existing user if re-registering)
        if (govtId) {
            const govtIdHash = hashGovtId(govtId);
            const govtIdCheckQuery = isReRegistering
                ? 'SELECT id FROM patient_profiles WHERE govt_id_hash = $1 AND user_id != $2'
                : 'SELECT id FROM patient_profiles WHERE govt_id_hash = $1';

            const govtIdParams = isReRegistering ? [govtIdHash, userId] : [govtIdHash];
            const govtIdResult = await query(govtIdCheckQuery, govtIdParams);

            if (govtIdResult.rows.length > 0) {
                return res.status(HTTP_STATUS.CONFLICT).json({
                    success: false,
                    message: 'Patient with this Government ID already exists',
                });
            }
        }

        // Get patient role
        const patientRole = await getRoleByName(ROLES.PATIENT);
        if (!patientRole) {
            throw new Error('Patient role not found in database');
        }

        // Hash password with bcrypt before transaction
        const passwordHash = await hashPassword(password);

        // Create/Update user and patient profile in transaction
        const result = await transaction(async (client) => {
            let user;
            if (isReRegistering) {
                // Update existing pending user
                const updateQuery = `
                    UPDATE users 
                    SET password_hash = $1, first_name = $2, last_name = $3, updated_at = NOW()
                    WHERE id = $4
                    RETURNING id, email, phone, role_id, status, created_at
                `;
                const updateResult = await client.query(updateQuery, [passwordHash, firstName || null, lastName || null, userId]);
                user = updateResult.rows[0];
            } else {
                // Create user
                const userQuery = `
                    INSERT INTO users (email, phone, password_hash, role_id, first_name, last_name, status)
                    VALUES ($1, $2, $3, $4, $5, $6, 'pending')
                    RETURNING id, email, phone, role_id, status, created_at
                `;
                const userResult = await client.query(userQuery, [
                    email || null,
                    phone || null,
                    passwordHash,
                    patientRole.id,
                    firstName || null,
                    lastName || null,
                ]);
                user = userResult.rows[0];
            }

            // Create or Update patient profile
            let profile;
            if (isReRegistering) {
                // Generate a health ID if they somehow don't have one, but they should if they were partially registered
                // For safety, we'll use a new one if it's missing
                const existingProfileQuery = 'SELECT unique_health_id FROM patient_profiles WHERE user_id = $1';
                const existingProfileRes = await client.query(existingProfileQuery, [userId]);
                const healthId = existingProfileRes.rows[0]?.unique_health_id || null; // We'll let createPatientProfile handle it below if missing or just do it here

                // Better: Just use a similar logic to createPatientProfile but for upsert
                // To keep it simple, we'll just delete and recreate the profile if it exists, or update it.
                // Actually, let's just use the existing helper if possible, but it doesn't handle updates well.

                const profileUpdateQuery = `
                    INSERT INTO patient_profiles (
                        user_id, unique_health_id, govt_id_hash, date_of_birth,
                        gender, blood_group, emergency_contact_name, emergency_contact_phone,
                        emergency_contact_relation, address, city, state, country, postal_code,
                        insurance_provider, insurance_policy_number
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                    ON CONFLICT (user_id) DO UPDATE SET
                        govt_id_hash = EXCLUDED.govt_id_hash,
                        date_of_birth = EXCLUDED.date_of_birth,
                        gender = EXCLUDED.gender,
                        blood_group = EXCLUDED.blood_group,
                        emergency_contact_name = EXCLUDED.emergency_contact_name,
                        emergency_contact_phone = EXCLUDED.emergency_contact_phone,
                        emergency_contact_relation = EXCLUDED.emergency_contact_relation,
                        address = EXCLUDED.address,
                        city = EXCLUDED.city,
                        state = EXCLUDED.state,
                        country = EXCLUDED.country,
                        postal_code = EXCLUDED.postal_code,
                        insurance_provider = EXCLUDED.insurance_provider,
                        insurance_policy_number = EXCLUDED.insurance_policy_number,
                        updated_at = NOW()
                    RETURNING *
                `;

                const profileRes = await client.query(profileUpdateQuery, [
                    user.id,
                    healthId || require('../../utils/idGenerator').generateHealthID(),
                    govtId ? hashGovtId(govtId) : null,
                    dateOfBirth || null,
                    gender || null,
                    bloodGroup || null,
                    emergencyContactName || null,
                    emergencyContactPhone || null,
                    emergencyContactRelation || null,
                    address || null,
                    city || null,
                    state || null,
                    country || null,
                    postalCode || null,
                    insuranceProvider || req.body.insuranceProvider || null,
                    insurancePolicyNumber || req.body.insurancePolicyNumber || null,
                ]);
                profile = profileRes.rows[0];
            } else {
                profile = await createPatientProfile({
                    userId: user.id,
                    govtId: govtId || null,
                    dateOfBirth: dateOfBirth || null,
                    gender: gender || null,
                    bloodGroup: bloodGroup || null,
                    emergencyContactName: emergencyContactName || null,
                    emergencyContactPhone: emergencyContactPhone || null,
                    emergencyContactRelation: emergencyContactRelation || null,
                    address: address || null,
                    city: city || null,
                    state: state || null,
                    country: country || null,
                    postalCode: postalCode || null,
                    insuranceProvider: insuranceProvider || req.body.insuranceProvider || null,
                    insurancePolicyNumber: insurancePolicyNumber || req.body.insurancePolicyNumber || null,
                }, client);
            }

            return { user, profile };
        });

        // Generate and send OTP
        await generateAndSendOTP({
            email: email || null,
            phone: phone || null,
            userId: result.user.id,
            purpose: OTP_PURPOSE.REGISTRATION,
        });

        // Audit log
        await createAuditLog({
            userId: result.user.id,
            action: AUDIT_ACTIONS.USER_REGISTER,
            entityType: 'user',
            entityId: result.user.id,
            purpose: 'Patient registration',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            requestMethod: req.method,
            requestPath: req.path,
            statusCode: HTTP_STATUS.CREATED,
        });

        logger.info('Patient registered successfully');

        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            message: SUCCESS_MESSAGES.USER_REGISTERED + '. Please verify your OTP.',
            data: {
                userId: result.user.id,
                uniqueHealthId: result.profile.unique_health_id,
                email: result.user.email,
                phone: result.user.phone,
            },
        });
    } catch (error) {
        logger.error('Patient registration failed:', {
            message: error.message,
            code: error.code,
            detail: error.detail,
            stack: error.stack
        });

        // Handle database unique constraint violations
        if (error.code === '23505') {
            let message = 'User with this information already exists';
            if (error.constraint === 'users_email_key') message = 'User with this email already exists';
            if (error.constraint === 'users_phone_key') message = 'User with this phone number already exists';
            if (error.constraint === 'patient_profiles_govt_id_hash_key') message = 'Patient with this Government ID already exists';

            return res.status(HTTP_STATUS.CONFLICT).json({
                success: false,
                message,
            });
        }

        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: ERROR_MESSAGES.INTERNAL_ERROR,
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
};

/**
 * Register organization (hospital/clinic/pharmacy)
 * POST /api/auth/register/organization
 */
const registerOrganization = async (req, res) => {
    let committed = false;
    try {
        const {
            // Admin user details
            email,
            phone,
            password,
            // Organization details
            organizationName,
            organizationType,
            licenseNumber,
            address,
            city,
            state,
            country,
            postalCode,
            organizationPhone,
            organizationEmail,
        } = req.body;

        // Validate required fields
        const validation = validateRequiredFields(req.body, [
            'email',
            'password',
            'organizationName',
            'organizationType',
            'licenseNumber',
        ]);

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

        // Get hospital admin role
        const adminRole = await getRoleByName(ROLES.HOSPITAL_ADMIN);
        if (!adminRole) {
            throw new Error('Hospital admin role not found in database');
        }

        if (req.file) await require('../../services/credential-file.service').secureCredential(req.file);

        // Hash password before transaction
        const passwordHash = await hashPassword(password);

        // Create user and organization in transaction
        const result = await transaction(async (client) => {
            // Create admin user
            const userQuery = `
        INSERT INTO users (email, phone, password_hash, role_id, status, is_verified)
        VALUES ($1, $2, $3, $4, 'pending', false)
        RETURNING id, email, phone, role_id, status, created_at
      `;

            const userResult = await client.query(userQuery, [
                email,
                phone || null,
                passwordHash,
                adminRole.id,
            ]);

            const user = userResult.rows[0];

            // Create organization
            // Generate hospital code (e.g., H12345) - Must be max 6 chars
            const hospitalCode = `H${Math.floor(10000 + Math.random() * 90000)}`;

            const orgQuery = `
        INSERT INTO organizations (
          name, type, license_number, address, city, state, country,
          postal_code, phone, email, admin_user_id, status, hospital_code, license_document_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', $12, $13)
        RETURNING *
      `;

            const orgResult = await client.query(orgQuery, [
                organizationName,
                organizationType,
                licenseNumber,
                address || null,
                city || null,
                state || null,
                country || null,
                postalCode || null,
                organizationPhone || null,
                organizationEmail || null,
                user.id,
                hospitalCode,
                req.file?.path || null,
            ]);

            return { user, organization: orgResult.rows[0] };
        });
        committed = true;

        // Generate and send OTP
        await generateAndSendOTP({
            email,
            userId: result.user.id,
            purpose: OTP_PURPOSE.REGISTRATION,
        });

        // Audit log
        await createAuditLog({
            userId: result.user.id,
            action: AUDIT_ACTIONS.ORG_REGISTER,
            entityType: 'organization',
            entityId: result.organization.id,
            purpose: 'Organization registration',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            requestMethod: req.method,
            requestPath: req.path,
            statusCode: HTTP_STATUS.CREATED,
        });

        logger.info('Organization registered successfully:', {
            userId: result.user.id,
            organizationId: result.organization.id,
            organizationType,
        });

        res.status(HTTP_STATUS.CREATED).json({
            success: true,
                message: 'Organization registered. Verify your email, then wait for platform administrator approval.',
            data: {
                userId: result.user.id,
                organizationId: result.organization.id,
                organizationName: result.organization.name,
                email: result.user.email,
            },
        });
    } catch (error) {
        logger.error('Organization registration failed:', error);

        if (error.message.includes('already exists')) {
            return res.status(HTTP_STATUS.CONFLICT).json({
                success: false,
                message: error.message,
            });
        }

        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: ERROR_MESSAGES.INTERNAL_ERROR,
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    } finally {
        if (!committed && req.file?.path) await require('../../services/encrypted-file-store').removeEncrypted(req.file.path).catch(() => {});
    }
};

/**
 * Verify OTP
 * POST /api/auth/verify-otp
 */
const verifyOTPController = async (req, res) => {
    try {
        // If purpose is not provided, default to 'registration'
        // If purpose is not provided, default to 'registration'
        if (!req.body.purpose) {
            req.body.purpose = OTP_PURPOSE.REGISTRATION;
        }

        const { email, phone, otp, purpose } = req.body;

        // Validate required fields
        if (!otp || !purpose) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: 'OTP and purpose are required',
            });
        }

        if (!email && !phone) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: 'Either email or phone is required',
            });
        }

        // Verify OTP
        const result = await verifyOTP({ email, phone, otp, purpose });

        if (!result.success) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json(result);
        }

        // Update user verification status
        if (result.userId && purpose === OTP_PURPOSE.REGISTRATION) {
            await updateUserVerification(result.userId, true);
        }

        // Audit log
        await createAuditLog({
            userId: result.userId,
            action: AUDIT_ACTIONS.OTP_VERIFY,
            purpose: `OTP verification for ${purpose}`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            requestMethod: req.method,
            requestPath: req.path,
            statusCode: HTTP_STATUS.OK,
        });

        logger.info('OTP verified successfully:', { userId: result.userId, purpose });

        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: SUCCESS_MESSAGES.OTP_VERIFIED,
            data: {
                userId: result.userId,
            },
        });
    } catch (error) {
        logger.error('OTP verification failed:', error);
        res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: error.message || ERROR_MESSAGES.INVALID_OTP,
        });
    }
};

/**
 * Login
 * POST /api/auth/login
 */
const login = async (req, res) => {
    try {
        // If frontend sends 'email', convert to 'emailOrPhone'
        if (req.body.email && !req.body.emailOrPhone) {
            req.body.emailOrPhone = req.body.email;
        }

        const { emailOrPhone, password } = req.body;

        // Validate required fields
        if (typeof emailOrPhone !== 'string' || typeof password !== 'string' || !emailOrPhone || !password || Buffer.byteLength(password, 'utf8') > 72) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: 'Email/phone and password are required',
            });
        }

        // Find user
        const user = await measurePhase('login_lookup', () => findUserByEmailOrPhone(emailOrPhone));

        if (!user) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                message: ERROR_MESSAGES.INVALID_CREDENTIALS,
            });
        }

        // Check if account is locked
        const locked = await measurePhase('login_lock', () => isAccountLocked(user.id));
        if (locked) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                message: ERROR_MESSAGES.ACCOUNT_LOCKED,
            });
        }

        // Verify password
        const isValidPassword = await measurePhase('login_password', () => comparePassword(password, user.password_hash));

        if (!isValidPassword) {
            // Increment failed attempts
            await incrementFailedLoginAttempts(user.id);

            // Audit log
            await createAuditLog({
                userId: user.id,
                action: 'failed_login',
                purpose: 'Invalid password',
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                requestMethod: req.method,
                requestPath: req.path,
                statusCode: HTTP_STATUS.UNAUTHORIZED,
            });

            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                message: ERROR_MESSAGES.INVALID_CREDENTIALS,
            });
        }

        // Check if user is verified (for OTP flow like patients)
        if (!user.is_verified) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                message: ERROR_MESSAGES.ACCOUNT_NOT_VERIFIED,
                data: {
                    userId: user.id,
                    email: user.email,
                    phone: user.phone
                }
            });
        }

        // Check if account is active (for admin approval flow like doctors)
        if (user.status !== 'active' || (user.account_status && user.account_status !== 'active')) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                message: 'Your account is not active. Please contact an administrator.',
                data: { status: 'pending' }
            });
        }

        // Fetch additional role-specific data
        let uniqueHealthId = null;
        if (user.role_name === ROLES.PATIENT) {
            const patientProfile = await findPatientByUserId(user.id);
            if (patientProfile) {
                uniqueHealthId = patientProfile.unique_health_id;
            }
        }

        // Generate tokens
        const tokenPayload = {
            userId: user.id,
            email: user.email,
            phone: user.phone,
            roleId: user.role_id,
            roleName: user.role_name,
            firstName: user.first_name,
            lastName: user.last_name,
            uniqueHealthId,
        };

        const accessToken = generateAccessToken(tokenPayload);
        const refreshToken = generateRefreshToken(tokenPayload);

        // Store session with device information
        const tokenHash = hashToken(accessToken);
        const refreshTokenHash = hashToken(refreshToken);
        const deviceInfo = captureDeviceInfo(req);

        const sessionQuery = `
      INSERT INTO sessions (
        user_id, token_hash, refresh_token_hash, ip_address, user_agent,
        device_info, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;

        await measurePhase('login_session', () => query(sessionQuery, [
            user.id,
            tokenHash,
            refreshTokenHash,
            req.ip,
            req.headers['user-agent'],
            JSON.stringify(deviceInfo),
            new Date(require('jsonwebtoken').decode(accessToken).exp * 1000),
        ]));

        // Update last login
        await measurePhase('login_last_login', () => updateLastLogin(user.id));

        // Audit log
        await measurePhase('login_audit', () => createAuditLog({
            userId: user.id,
            action: AUDIT_ACTIONS.USER_LOGIN,
            purpose: 'User login',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            requestMethod: req.method,
            requestPath: req.path,
            statusCode: HTTP_STATUS.OK,
        }));

        logger.info('User logged in successfully:', { userId: user.id, role: user.role_name });

        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: SUCCESS_MESSAGES.LOGIN_SUCCESS,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    phone: user.phone,
                    role: user.role_name,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    uniqueHealthId,
                },
                accessToken,
                refreshToken,
            },
        });
    } catch (error) {
        logger.error('Login failed:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: ERROR_MESSAGES.INTERNAL_ERROR,
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
};

/**
 * Logout
 * POST /api/auth/logout
 */
const logout = async (req, res) => {
    try {
        const userId = req.user.id;

        // Deactivate all active sessions for user
        await query('UPDATE sessions SET is_active = false WHERE user_id = $1', [userId]);

        // Audit log
        await createAuditLog({
            userId,
            action: AUDIT_ACTIONS.USER_LOGOUT,
            purpose: 'User logout',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            requestMethod: req.method,
            requestPath: req.path,
            statusCode: HTTP_STATUS.OK,
        });

        logger.info('User logged out successfully:', { userId });

        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: SUCCESS_MESSAGES.LOGOUT_SUCCESS,
        });
    } catch (error) {
        logger.error('Logout failed:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: ERROR_MESSAGES.INTERNAL_ERROR,
        });
    }
};

/**
 * Resend OTP
 * POST /api/auth/resend-otp
 */
const resendOTP = async (req, res) => {
    try {
        const { email, phone, purpose } = req.body;

        if (!email && !phone) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: 'Either email or phone is required',
            });
        }

        // Generate and send OTP
        const result = await generateAndSendOTP({
            email: email || null,
            phone: phone || null,
            purpose: purpose || OTP_PURPOSE.REGISTRATION,
        });

        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: SUCCESS_MESSAGES.OTP_SENT,
            data: result,
        });
    } catch (error) {
        logger.error('Resend OTP failed:', error);
        res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: error.message || 'Failed to send OTP',
        });
    }
};

/**
 * Register Doctor
 * POST /api/auth/register/doctor
 */
const registerDoctor = require('./doctor.registration');

module.exports = {
    registerPatient,
    registerOrganization,
    registerDoctor,
    verifyOTPController,
    login,
    logout,
    resendOTP,
};
