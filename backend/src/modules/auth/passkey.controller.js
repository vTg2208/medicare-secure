/**
 * Passkey (WebAuthn) Controller
 * Handles passkey registration and authentication
 */
const {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} = require('@simplewebauthn/server');

const { query } = require('../../config/db');
const { findUserByEmailOrPhone, findUserById, updateLastLogin } = require('../../models/user.model');
const { generateAccessToken, generateRefreshToken } = require('../../config/jwt');
const { hashToken } = require('../../services/encryption.service');
const { captureDeviceInfo } = require('../../services/device.service');
const { createAuditLog } = require('../../services/audit.service');
const { findPatientByUserId } = require('../../models/patient.model');
const logger = require('../../utils/logger');
const config = require('../../config/env');
const { HTTP_STATUS, AUDIT_ACTIONS, SUCCESS_MESSAGES, ROLES } = require('../../utils/constants');

// In-memory challenge store (per-user, TTL-based)
// In production, use Redis or database
const challengeStore = new Map();
const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function setChallenge(userId, challenge) {
    challengeStore.set(userId, {
        challenge,
        expiresAt: Date.now() + CHALLENGE_TTL_MS,
    });
}

function getChallenge(userId) {
    const entry = challengeStore.get(userId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        challengeStore.delete(userId);
        return null;
    }
    challengeStore.delete(userId); // one-time use
    return entry.challenge;
}

// Clean up expired challenges periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of challengeStore.entries()) {
        if (now > value.expiresAt) {
            challengeStore.delete(key);
        }
    }
}, 60 * 1000).unref();

// ============================================
// Helper: Get user's existing passkey credentials
// ============================================
async function getUserPasskeys(userId) {
    const result = await query(
        'SELECT credential_id, public_key, counter, transports FROM passkey_credentials WHERE user_id = $1',
        [userId]
    );
    return result.rows;
}

// ============================================
// 1. Registration: Generate Options
// POST /api/auth/passkey/register/options
// Requires: Authenticated user
// ============================================
const registerOptions = async (req, res) => {
    try {
        const userId = req.user.id || req.user.userId;
        const user = await findUserById(userId);

        if (!user) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                message: 'User not found',
            });
        }

        // Get existing credentials to exclude
        const existingPasskeys = await getUserPasskeys(userId);
        const excludeCredentials = existingPasskeys.map(pk => ({
            id: pk.credential_id,
            transports: pk.transports || [],
        }));

        const options = await generateRegistrationOptions({
            rpName: config.webauthn.rpName,
            rpID: config.webauthn.rpID,
            userName: user.email || user.phone,
            userDisplayName: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
            userID: new TextEncoder().encode(userId),
            attestationType: 'none',
            excludeCredentials,
            authenticatorSelection: {
                residentKey: 'preferred',
                userVerification: 'preferred',
                // No authenticatorAttachment restriction — allows fingerprint, face, PIN, pattern, security keys, etc.
            },
        });

        // Store challenge
        setChallenge(userId, options.challenge);

        logger.info('Passkey registration options generated', { userId });

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: options,
        });
    } catch (error) {
        logger.error('Failed to generate passkey registration options:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to generate registration options',
        });
    }
};

// ============================================
// 2. Registration: Verify Response
// POST /api/auth/passkey/register/verify
// Requires: Authenticated user
// ============================================
const registerVerify = async (req, res) => {
    try {
        const userId = req.user.id || req.user.userId;
        const { credential, credentialName } = req.body;

        if (!credential) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: 'Credential response is required',
            });
        }

        const expectedChallenge = getChallenge(userId);
        if (!expectedChallenge) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: 'Challenge expired or not found. Please try again.',
            });
        }

        const verification = await verifyRegistrationResponse({
            response: credential,
            expectedChallenge,
            expectedOrigin: config.webauthn.origin,
            expectedRPID: config.webauthn.rpID,
        });

        if (!verification.verified || !verification.registrationInfo) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: 'Passkey verification failed',
            });
        }

        const { credential: registeredCredential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

        // Store the credential in database
        await query(
            `INSERT INTO passkey_credentials 
             (user_id, credential_id, public_key, counter, device_type, backed_up, transports, credential_name)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                userId,
                registeredCredential.id,
                Buffer.from(registeredCredential.publicKey),
                registeredCredential.counter,
                credentialDeviceType,
                credentialBackedUp,
                credential.response?.transports || [],
                credentialName || 'My Passkey',
            ]
        );

        // Audit log
        await createAuditLog({
            userId,
            action: 'passkey_registered',
            purpose: 'User registered a new passkey',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            requestMethod: req.method,
            requestPath: req.path,
            statusCode: HTTP_STATUS.OK,
        });

        logger.info('Passkey registered successfully', { userId, credentialId: registeredCredential.id });

        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Passkey registered successfully',
        });
    } catch (error) {
        logger.error('Failed to verify passkey registration:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to register passkey',
        });
    }
};

// ============================================
// 3. Authentication: Generate Options
// POST /api/auth/passkey/login/options
// Public endpoint
// ============================================
const loginOptions = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: 'Email is required',
            });
        }

        // Find user
        const user = await findUserByEmailOrPhone(email);

        if (!user) {
            // Don't reveal whether user exists — return generic options
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: 'No passkey found for this account',
            });
        }

        // Get user's passkey credentials
        const passkeys = await getUserPasskeys(user.id);

        if (passkeys.length === 0) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: 'No passkey found for this account. Please login with password first and register a passkey.',
            });
        }

        const allowCredentials = passkeys.map(pk => ({
            id: pk.credential_id,
            transports: pk.transports || [],
        }));

        const options = await generateAuthenticationOptions({
            rpID: config.webauthn.rpID,
            allowCredentials,
            userVerification: 'preferred',
        });

        // Store challenge with user ID
        setChallenge(user.id, options.challenge);

        // Also store user ID mapped to challenge for login verification
        setChallenge(`login_${email}`, user.id);

        logger.info('Passkey login options generated', { userId: user.id });

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: options,
        });
    } catch (error) {
        logger.error('Failed to generate passkey login options:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to generate login options',
        });
    }
};

// ============================================
// 4. Authentication: Verify Response
// POST /api/auth/passkey/login/verify
// Public endpoint
// ============================================
const loginVerify = async (req, res) => {
    try {
        const { email, credential } = req.body;

        if (!email || !credential) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: 'Email and credential response are required',
            });
        }

        // Find user
        const user = await findUserByEmailOrPhone(email);
        if (!user) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                message: 'Authentication failed',
            });
        }

        // Get stored challenge
        const expectedChallenge = getChallenge(user.id);
        if (!expectedChallenge) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: 'Challenge expired or not found. Please try again.',
            });
        }

        // Clean up the user ID mapping
        challengeStore.delete(`login_${email}`);

        // Find the credential in database
        const credResult = await query(
            'SELECT credential_id, public_key, counter, transports FROM passkey_credentials WHERE credential_id = $1 AND user_id = $2',
            [credential.id, user.id]
        );

        if (credResult.rows.length === 0) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                message: 'Authentication failed',
            });
        }

        const storedCredential = credResult.rows[0];

        const verification = await verifyAuthenticationResponse({
            response: credential,
            expectedChallenge,
            expectedOrigin: config.webauthn.origin,
            expectedRPID: config.webauthn.rpID,
            credential: {
                id: storedCredential.credential_id,
                publicKey: storedCredential.public_key,
                counter: Number(storedCredential.counter),
                transports: storedCredential.transports || [],
            },
        });

        if (!verification.verified) {
            await createAuditLog({
                userId: user.id,
                action: 'failed_passkey_login',
                purpose: 'Passkey authentication verification failed',
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                requestMethod: req.method,
                requestPath: req.path,
                statusCode: HTTP_STATUS.UNAUTHORIZED,
            });

            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                message: 'Authentication failed',
            });
        }

        // Update credential counter
        await query(
            'UPDATE passkey_credentials SET counter = $1, last_used_at = NOW() WHERE credential_id = $2',
            [verification.authenticationInfo.newCounter, credential.id]
        );

        // Check verification status
        if (!user.is_verified || user.status !== 'active' || (user.account_status && user.account_status !== 'active')) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                message: 'Account not verified',
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

        // Generate tokens (same flow as password login)
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

        // Store session
        const tokenHash = hashToken(accessToken);
        const refreshTokenHash = hashToken(refreshToken);
        const deviceInfo = captureDeviceInfo(req);

        await query(
            `INSERT INTO sessions (
                user_id, token_hash, refresh_token_hash, ip_address, user_agent,
                device_info, expires_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id`,
            [
                user.id,
                tokenHash,
                refreshTokenHash,
                req.ip,
                req.headers['user-agent'],
                JSON.stringify(deviceInfo),
                new Date(require('jsonwebtoken').decode(accessToken).exp * 1000),
            ]
        );

        // Update last login
        await updateLastLogin(user.id);

        // Audit log
        await createAuditLog({
            userId: user.id,
            action: AUDIT_ACTIONS.USER_LOGIN,
            purpose: 'User login via passkey',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            requestMethod: req.method,
            requestPath: req.path,
            statusCode: HTTP_STATUS.OK,
            metadata: { authMethod: 'passkey' },
        });

        logger.info('User logged in via passkey', { userId: user.id, role: user.role_name });

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
        logger.error('Passkey login failed:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Authentication failed',
        });
    }
};

module.exports = {
    registerOptions,
    registerVerify,
    loginOptions,
    loginVerify,
};
