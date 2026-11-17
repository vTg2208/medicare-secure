const crypto = require('node:crypto');
const { transaction } = require('../config/db');
const { hashToken, encryptSecret, decryptSecret } = require('./encryption.service');
const { generateSecret, verifyTotp, provisioningUri } = require('./totp.service');
const { issueFullSession, auditAuthentication } = require('./auth-session.service');

const failure = (status = 401, message = 'Authentication challenge expired or invalid') => ({ failure: { status, message } });
const unwrap = result => {
    if (result.failure) throw Object.assign(new Error(result.failure.message), result.failure);
    return result;
};
const opaque = () => crypto.randomBytes(32).toString('base64url');
const validTicket = ticket => typeof ticket === 'string' && /^[A-Za-z0-9_-]{43}$/.test(ticket);
const secretContext = id => `mfa/${id}`;
const accountActive = user => user && user.is_verified && user.status === 'active'
    && (!user.account_status || user.account_status === 'active');

const lockAccount = async (client, id) => {
    const user = (await client.query(`SELECT u.*,r.name AS role_name FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=$1 FOR UPDATE OF u`, [id])).rows[0];
    if (!accountActive(user)) return null;
    await client.query('INSERT INTO user_mfa(user_id) VALUES($1) ON CONFLICT DO NOTHING', [id]);
    user.mfa = (await client.query('SELECT * FROM user_mfa WHERE user_id=$1 FOR UPDATE', [id])).rows[0];
    return user;
};

const throttleRows = async (client, userId, req, { publicPasskey = false, consume = false } = {}) => {
    const rows = [];
    const scopes = publicPasskey ? [[`passkey-public/account/${userId}`,20],[`passkey-public/ip/${req.ip || 'unknown'}`,100]]
        : [[`account/${userId}`, 5], [`ip/${req.ip || 'unknown'}`, 20]];
    for (const [scope, limit] of scopes) {
        const scopeHash = hashToken(scope);
        const row = (await client.query(`INSERT INTO auth_mfa_throttles(scope_hash) VALUES($1)
            ON CONFLICT(scope_hash) DO UPDATE SET
            failures=CASE WHEN auth_mfa_throttles.expires_at<=NOW() THEN 0 ELSE auth_mfa_throttles.failures END,
            expires_at=CASE WHEN auth_mfa_throttles.expires_at<=NOW() THEN NOW()+INTERVAL '15 minutes' ELSE auth_mfa_throttles.expires_at END
            RETURNING *`, [scopeHash])).rows[0];
        rows.push({ ...row, limit });
    }
    if (consume && !blocked(rows)) for (const row of rows) await client.query('UPDATE auth_mfa_throttles SET failures=failures+1 WHERE scope_hash=$1', [row.scope_hash]);
    return rows;
};
const blocked = rows => rows.some(row => row.failures >= row.limit);
const failedAttempt = async (client, user, challenge, req, rows) => {
    if (challenge) await client.query('UPDATE auth_challenges SET attempts=LEAST(attempts+1,5) WHERE id=$1', [challenge.id]);
    for (const row of rows) await client.query('UPDATE auth_mfa_throttles SET failures=failures+1 WHERE scope_hash=$1', [row.scope_hash]);
    await auditAuthentication(client, user.id, 'mfa_verification_failed', req, {}, 401);
    return failure(401, 'The verification code is invalid or has already been used');
};
const publicChallenge = challenge => challenge.purpose === 'passkey_login' && !challenge.payload.stepUpSessionId;
const createChallenge = async (client, user, purpose, payload = {}, proofDeadline = null) => {
    const ticket = opaque();
    await client.query('DELETE FROM auth_challenges WHERE user_id=$1 AND expires_at<=NOW()', [user.id]);
    const existing = (await client.query('SELECT id,purpose,payload FROM auth_challenges WHERE user_id=$1 ORDER BY created_at,id', [user.id])).rows;
    if (existing.length >= 4) {
        const replace = existing.find(publicChallenge) || (!publicChallenge({ purpose, payload }) && existing[0]);
        if (!replace) throw Object.assign(new Error('Finish the current verification or try again after it expires'), { status: 429 });
        await client.query('DELETE FROM auth_challenges WHERE id=$1', [replace.id]);
    }
    await client.query(`INSERT INTO auth_challenges(user_id,token_hash,purpose,payload,factor_version,expires_at)
        VALUES($1,$2,$3,$4,$5,LEAST(NOW()+INTERVAL '5 minutes',COALESCE($6::timestamptz,NOW()+INTERVAL '5 minutes')))`,
    [user.id, hashToken(ticket), purpose, JSON.stringify(payload), user.mfa.factor_version, proofDeadline]);
    return ticket;
};

const beginPasswordAuthentication = async (verifiedUser, req) => unwrap(await transaction(async client => {
    const user = await lockAccount(client, verifiedUser.id);
    if (!user || user.password_hash !== verifiedUser.password_hash) return failure();
    const rows = await throttleRows(client, user.id, req);
    if (blocked(rows)) return failure(429, 'Too many verification attempts. Try again in fifteen minutes');
    const nextStep = user.mfa.enabled_at ? 'verify' : 'enroll';
    const ticket = await createChallenge(client, user, 'login', { phase: nextStep });
    await auditAuthentication(client, user.id, 'mfa_challenge_started', req);
    return { ticket, nextStep, expiresIn: 300 };
}));

const withTicket = async (ticket, req, operation, purpose = 'login') => {
    if (!validTicket(ticket)) return unwrap(failure());
    return unwrap(await transaction(async client => {
        const found = (await client.query('SELECT user_id FROM auth_challenges WHERE token_hash=$1', [hashToken(ticket)])).rows[0];
        if (!found) return failure();
        const user = await lockAccount(client, found.user_id);
        if (!user) return failure();
        const challenge = (await client.query(`SELECT * FROM auth_challenges WHERE token_hash=$1 AND purpose=$2
            AND expires_at>NOW() AND attempts<5 FOR UPDATE`, [hashToken(ticket), purpose])).rows[0];
        if (!challenge || challenge.factor_version !== user.mfa.factor_version) return failure();
        const rows = await throttleRows(client, user.id, req, { publicPasskey: publicChallenge(challenge) });
        if (blocked(rows)) return failure(429, 'Too many verification attempts. Try again in fifteen minutes');
        return operation(client, user, challenge, rows);
    }));
};
const savePayload = (client, challenge, payload) => client.query('UPDATE auth_challenges SET payload=$2 WHERE id=$1', [challenge.id, JSON.stringify(payload)]);

const startSetup = (ticket, req) => withTicket(ticket, req, async (client, user, challenge) => {
    if (!['enroll', 'recovery', 'setup', 'acknowledge'].includes(challenge.payload.phase)) return failure();
    if (user.mfa.enabled_at && !challenge.payload.recoveryAuthorized) return failure();
    const secret = generateSecret();
    await savePayload(client, challenge, { phase: 'setup', recoveryAuthorized: !!challenge.payload.recoveryAuthorized,
        secretCipher: encryptSecret(secret, secretContext(user.id)) });
    await auditAuthentication(client, user.id, 'mfa_setup_started', req);
    return { secret, provisioningUri: provisioningUri(secret, user.email || user.phone), nextStep: 'setup' };
});

const confirmSetup = (ticket, code, req) => withTicket(ticket, req, async (client, user, challenge, rows) => {
    if (challenge.payload.phase !== 'setup') return failure();
    const step = verifyTotp(decryptSecret(challenge.payload.secretCipher, secretContext(user.id)), code);
    if (step === null) return failedAttempt(client, user, challenge, req, rows);
    const recoveryCodes = Array.from({ length: 10 }, () => crypto.randomBytes(16).toString('hex').match(/.{8}/g).join('-'));
    const deadline = (await client.query("SELECT NOW()+INTERVAL '5 minutes' AS deadline")).rows[0].deadline;
    await savePayload(client, challenge, { ...challenge.payload, phase: 'acknowledge', acceptedStep: step, proofExpiresAt: deadline.toISOString(),
        recoveryHashes: recoveryCodes.map(value => hashToken(`recovery/${user.id}/${value}`)) });
    await auditAuthentication(client, user.id, 'mfa_setup_verified', req);
    return { nextStep: 'acknowledge', recoveryCodes };
});

const acknowledgeSetup = (ticket, req) => withTicket(ticket, req, async (client, user, challenge) => {
    const pending = challenge.payload;
    if (pending.phase !== 'acknowledge' || !pending.secretCipher || pending.recoveryHashes?.length !== 10) return failure();
    if (user.mfa.enabled_at && !pending.recoveryAuthorized) return failure();
    await client.query(`UPDATE user_mfa SET secret_cipher=$2,enabled_at=NOW(),last_totp_step=$3,recovery_hashes=$4,
        factor_version=uuid_generate_v4() WHERE user_id=$1`, [user.id, JSON.stringify(pending.secretCipher), pending.acceptedStep, pending.recoveryHashes]);
    await client.query('UPDATE sessions SET is_active=false WHERE user_id=$1', [user.id]);
    await client.query('DELETE FROM auth_challenges WHERE user_id=$1', [user.id]);
    await auditAuthentication(client, user.id, pending.recoveryAuthorized ? 'mfa_replaced' : 'mfa_enrolled', req);
    const session = await issueFullSession(client, user, 'totp', req);
    // A factor proof obtained in this response may authorize one optional passkey setup.
    user.mfa = (await client.query('SELECT * FROM user_mfa WHERE user_id=$1', [user.id])).rows[0];
    const stepUpTicket = await createChallenge(client, user, 'stepup', { operation: 'passkey_register', sessionId: session.id }, pending.proofExpiresAt);
    return { session, stepUpTicket };
});

const verifyChallenge = (ticket, code, req) => withTicket(ticket, req, async (client, user, challenge, rows) => {
    if (challenge.payload.phase !== 'verify' || !user.mfa.enabled_at) return failure();
    const step = verifyTotp(decryptSecret(user.mfa.secret_cipher, secretContext(user.id)), code, { lastStep: user.mfa.last_totp_step });
    if (step === null) return failedAttempt(client, user, challenge, req, rows);
    await client.query('UPDATE user_mfa SET last_totp_step=$2 WHERE user_id=$1', [user.id, step]);
    await client.query("DELETE FROM auth_challenges WHERE user_id=$1 AND purpose='login'", [user.id]);
    return { session: await issueFullSession(client, user, 'totp', req) };
});

const recoverChallenge = (ticket, code, req) => withTicket(ticket, req, async (client, user, challenge, rows) => {
    if (challenge.payload.phase !== 'verify' || !user.mfa.enabled_at) return failure();
    const hash = typeof code === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{8}){3}$/.test(code)
        ? hashToken(`recovery/${user.id}/${code}`) : '';
    const matches = user.mfa.recovery_hashes.some(stored => hash && crypto.timingSafeEqual(Buffer.from(stored), Buffer.from(hash)));
    if (!matches) return failedAttempt(client, user, challenge, req, rows);
    await client.query('UPDATE user_mfa SET recovery_hashes=array_remove(recovery_hashes,$2) WHERE user_id=$1', [user.id, hash]);
    await savePayload(client, challenge, { phase: 'recovery', recoveryAuthorized: true });
    await auditAuthentication(client, user.id, 'mfa_recovery_authorized', req);
    return { nextStep: 'enroll' };
});

const authorizeStepUp = async (userId, sessionId, code, req) => unwrap(await transaction(async client => {
    const user = await lockAccount(client, userId);
    if (!user) return failure();
    const session = (await client.query(`SELECT id FROM sessions WHERE id=$1 AND user_id=$2 AND is_active=true
        AND expires_at>NOW() AND mfa_method IS NOT NULL AND mfa_verified_at IS NOT NULL FOR UPDATE`, [sessionId, user.id])).rows[0];
    if (!session) return failure(403, 'An active verified session is required');
    const rows = await throttleRows(client, user.id, req);
    if (blocked(rows)) return failure(429, 'Too many verification attempts. Try again in fifteen minutes');
    if (!user.mfa.enabled_at) return failure(403, 'Verify with an existing passkey instead');
    const step = verifyTotp(decryptSecret(user.mfa.secret_cipher, secretContext(user.id)), code, { lastStep: user.mfa.last_totp_step });
    if (step === null) return failedAttempt(client, user, null, req, rows);
    await client.query('UPDATE user_mfa SET last_totp_step=$2 WHERE user_id=$1', [user.id, step]);
    const stepUpTicket = await createChallenge(client, user, 'stepup', { operation: 'passkey_register', sessionId: session.id });
    await auditAuthentication(client, user.id, 'mfa_stepup_verified', req, { method: 'totp' });
    return { stepUpTicket };
}));

module.exports = { beginPasswordAuthentication, startSetup, confirmSetup, acknowledgeSetup, verifyChallenge,
    recoverChallenge, authorizeStepUp, withTicket, lockAccount, createChallenge, throttleRows, failedAttempt, blocked, failure, unwrap, accountActive };
