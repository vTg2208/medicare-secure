const crypto = require('node:crypto');
const { generateAccessToken, generateRefreshToken } = require('../config/jwt');
const { hashToken } = require('./encryption.service');
const { captureDeviceInfo } = require('./device.service');
const { logAuditEvent } = require('./audit.service');
const { measurePhase } = require('./request-timing');

const auditAuthentication = (client, userId, action, req, metadata = {}, statusCode = 200) => logAuditEvent({
    userId, action, entityType: 'authentication', entityId: userId,
    purpose: action, ipAddress: req.ip, userAgent: req.headers?.['user-agent'],
    requestMethod: req.method, requestPath: req.path, statusCode, metadata,
}, client);

const issueFullSession = async (client, account, method, req) => {
    if (!['totp', 'passkey'].includes(method)) throw new Error('Verified authentication factor is required');
    const profile = await client.query('SELECT unique_health_id FROM patient_profiles WHERE user_id=$1', [account.id]);
    const uniqueHealthId = profile.rows[0]?.unique_health_id || null;
    const user = { id: account.id, email: account.email, phone: account.phone, role: account.role_name,
        firstName: account.first_name, lastName: account.last_name, uniqueHealthId };
    const claims = { userId: user.id, email: user.email, phone: user.phone, roleId: account.role_id,
        roleName: user.role, firstName: user.firstName, lastName: user.lastName, uniqueHealthId };
    const token = generateAccessToken(claims), refreshToken = generateRefreshToken(claims);
    const csrfToken = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(require('jsonwebtoken').decode(token).exp * 1000);
    const inserted = await measurePhase('login_session', () => client.query(`INSERT INTO sessions(user_id,token_hash,refresh_token_hash,ip_address,user_agent,
        device_info,expires_at,mfa_method,mfa_verified_at,csrf_hash)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,NOW(),$9) RETURNING id`,
    [user.id, hashToken(token), hashToken(refreshToken), req.ip, req.headers?.['user-agent'], JSON.stringify(captureDeviceInfo(req)), expiresAt, method, hashToken(csrfToken)]));
    await measurePhase('login_last_login', () => client.query('UPDATE users SET last_login=NOW(),failed_login_attempts=0,account_locked_until=NULL WHERE id=$1', [user.id]));
    await measurePhase('login_audit', () => auditAuthentication(client, user.id, 'user_login', req, { method }));
    return { user, token, refreshToken, csrfToken, expiresAt, id: inserted.rows[0].id };
};

module.exports = { issueFullSession, auditAuthentication };
