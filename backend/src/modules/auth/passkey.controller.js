const { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions,
    verifyAuthenticationResponse } = require('@simplewebauthn/server');
const { transaction } = require('../../config/db');
const { issueFullSession, auditAuthentication } = require('../../services/auth-session.service');
const { sendAuthenticated } = require('../../services/auth-transport');
const mfa = require('../../services/mfa.service');
const config = require('../../config/env');
const logger = require('../../utils/logger');

const handle = operation => async (req, res) => {
    try {
        const result = await operation(req);
        return result.session ? sendAuthenticated(req, res, result) : res.json({ success: true, data: result });
    } catch (error) {
        const status = [400, 401, 403, 429].includes(error.status) ? error.status : 503;
        if (status === 503) logger.error('Passkey operation unavailable', { code: error.code });
        return res.status(status).json({ success: false, message: status === 503 ? 'Passkey verification is temporarily unavailable' : error.message });
    }
};
const activeSession = async (client, userId, sessionId) => !!(await client.query(`SELECT id FROM sessions
    WHERE id=$1 AND user_id=$2 AND is_active=true AND expires_at>NOW()
    AND mfa_method IS NOT NULL AND mfa_verified_at IS NOT NULL FOR UPDATE`, [sessionId, userId])).rows[0];
const sameSession = async (client, req, user, challenge) => req.user?.id === user.id
    && challenge.payload.sessionId === req.session?.id && await activeSession(client, user.id, req.session.id);
const credentials = async (client, userId) => (await client.query(
    'SELECT credential_id,public_key,counter,transports FROM passkey_credentials WHERE user_id=$1', [userId])).rows;

const registerOptions = handle(req => mfa.withTicket(req.headers['x-mfa-step-up'], req, async (client, user, challenge) => {
    if (!await sameSession(client, req, user, challenge) || challenge.payload.operation !== 'passkey_register') return mfa.failure(403, 'Fresh factor verification is required');
    const existing = await credentials(client, user.id);
    const options = await generateRegistrationOptions({
        rpName: config.webauthn.rpName, rpID: config.webauthn.rpID,
        userName: user.email || user.phone, userID: new TextEncoder().encode(user.id),
        userDisplayName: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
        attestationType: 'none', excludeCredentials: existing.map(item => ({ id: item.credential_id, transports: item.transports || [] })),
        authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
    });
    await client.query('DELETE FROM auth_challenges WHERE id=$1', [challenge.id]);
    const challengeId = await mfa.createChallenge(client, user, 'passkey_register', { sessionId: req.session.id, webauthnChallenge: options.challenge }, challenge.expires_at);
    await auditAuthentication(client, user.id, 'passkey_registration_started', req);
    return { ...options, challengeId };
}, 'stepup').catch(error => {
    if (error.status === 401) throw Object.assign(new Error('Fresh factor verification is required'), { status: 403 });
    throw error;
}));

const registerVerify = handle(req => mfa.withTicket(req.body.challengeId, req, async (client, user, challenge, rows) => {
    if (!await sameSession(client, req, user, challenge)) return mfa.failure(403, 'Registration session does not match');
    let verification;
    try {
        verification = await verifyRegistrationResponse({ response: req.body.credential,
            expectedChallenge: challenge.payload.webauthnChallenge, expectedOrigin: config.webauthn.origin,
            expectedRPID: config.webauthn.rpID, requireUserVerification: true });
    } catch { return mfa.failedAttempt(client, user, challenge, req, rows); }
    if (!verification.verified || !verification.registrationInfo?.userVerified) return mfa.failedAttempt(client, user, challenge, req, rows);
    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    const name = req.body.credentialName || 'My Passkey';
    if (typeof name !== 'string' || name.length > 255) return mfa.failure(400, 'Invalid passkey name');
    await client.query(`INSERT INTO passkey_credentials(user_id,credential_id,public_key,counter,device_type,backed_up,transports,credential_name)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [user.id, credential.id, Buffer.from(credential.publicKey), credential.counter,
        credentialDeviceType, credentialBackedUp, req.body.credential.response?.transports || [], name]);
    await client.query('DELETE FROM auth_challenges WHERE id=$1', [challenge.id]);
    await auditAuthentication(client, user.id, 'passkey_registered', req);
    return { registered: true };
}, 'passkey_register'));

const loginOptions = handle(async req => mfa.unwrap(await transaction(async client => {
    const identifier = req.body.email;
    if (!req.user && (typeof identifier !== 'string' || !identifier.trim() || identifier.length > 254)) return mfa.failure(400, 'Email or phone is required');
    const found = req.user ? { id: req.user.id } : (await client.query('SELECT id FROM users WHERE LOWER(email)=LOWER($1) OR phone=$1', [identifier.trim()])).rows[0];
    const user = found && await mfa.lockAccount(client, found.id);
    if (!user) return mfa.failure(401, 'No usable passkey found for this account');
    if (req.user && !await activeSession(client, user.id, req.session?.id)) return mfa.failure(403, 'An active verified session is required');
    const rows = await mfa.throttleRows(client, user.id, req, { publicPasskey: !req.user, consume: !req.user });
    if (mfa.blocked(rows)) return mfa.failure(429, 'Too many verification attempts. Try again in fifteen minutes');
    const stored = await credentials(client, user.id);
    if (!stored.length) return mfa.failure(400, 'No passkey found for this account. Sign in with your password and authenticator.');
    const options = await generateAuthenticationOptions({ rpID: config.webauthn.rpID,
        allowCredentials: stored.map(item => ({ id: item.credential_id, transports: item.transports || [] })), userVerification: 'required' });
    const challengeId = await mfa.createChallenge(client, user, 'passkey_login', { webauthnChallenge: options.challenge,
        ...(req.user ? { stepUpSessionId: req.session.id } : {}) });
    await auditAuthentication(client, user.id, 'passkey_challenge_started', req);
    return { ...options, challengeId };
})));

const loginVerify = handle(req => mfa.withTicket(req.body.challengeId, req, async (client, user, challenge, rows) => {
    if (challenge.payload.stepUpSessionId && (req.user?.id !== user.id || req.session?.id !== challenge.payload.stepUpSessionId
        || !await activeSession(client, user.id, req.session.id))) return mfa.failure(403);
    if (!challenge.payload.stepUpSessionId && (typeof req.body.email !== 'string'
        || ![user.email?.toLowerCase(), user.phone].includes(req.body.email.trim().toLowerCase()))) return mfa.failure();
    const id = req.body.credential?.id;
    if (typeof id !== 'string' || id.length > 2048) return mfa.failedAttempt(client, user, challenge, req, rows);
    const stored = (await client.query('SELECT * FROM passkey_credentials WHERE user_id=$1 AND credential_id=$2 FOR UPDATE', [user.id, id])).rows[0];
    if (!stored) return mfa.failedAttempt(client, user, challenge, req, rows);
    let verification;
    try {
        verification = await verifyAuthenticationResponse({ response: req.body.credential,
            expectedChallenge: challenge.payload.webauthnChallenge, expectedOrigin: config.webauthn.origin,
            expectedRPID: config.webauthn.rpID, requireUserVerification: true,
            credential: { id: stored.credential_id, publicKey: stored.public_key, counter: Number(stored.counter), transports: stored.transports || [] } });
    } catch { return mfa.failedAttempt(client, user, challenge, req, rows); }
    if (!verification.verified || !verification.authenticationInfo?.userVerified) return mfa.failedAttempt(client, user, challenge, req, rows);
    await client.query('UPDATE passkey_credentials SET counter=$2,last_used_at=NOW() WHERE credential_id=$1', [id, verification.authenticationInfo.newCounter]);
    await client.query('DELETE FROM auth_challenges WHERE id=$1', [challenge.id]);
    let session;
    if (!challenge.payload.stepUpSessionId) session = await issueFullSession(client, user, 'passkey', req);
    const stepUpTicket = await mfa.createChallenge(client, user, 'stepup', { operation: 'passkey_register', sessionId: session?.id || req.session.id });
    if (!session) await auditAuthentication(client, user.id, 'mfa_stepup_verified', req, { method: 'passkey' });
    return session ? { session, stepUpTicket } : { stepUpTicket };
}, 'passkey_login'));

module.exports = { registerOptions, registerVerify, loginOptions, loginVerify };
