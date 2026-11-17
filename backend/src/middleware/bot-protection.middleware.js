const { createHash } = require('node:crypto');

const ACTION = 'public_auth';
const TOKEN_TTL = 300000;
const STAFF_ROLES = new Set(['receptionist', 'nurse', 'staff', 'hospital_admin', 'system_admin']);

async function verifyTurnstile(token, settings, fetchImpl = global.fetch) {
    const response = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: settings.secretKey, response: token }),
        signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error('Challenge verifier unavailable');
    const result = await response.json();
    const timestamp = Date.parse(result.challenge_ts);
    const age = Date.now() - timestamp;
    return result.success === true && result.action === ACTION
        && settings.hostnames.includes(result.hostname) && Number.isFinite(timestamp)
        && age >= -60000 && age <= TOKEN_TTL;
}

function createBotProtection({ settings, allowStaff = false, verifyToken = verifyTurnstile, authenticateRequest, consumedTokens = new Map() } = {}) {
    const consumed = consumedTokens;
    const respond = (res, status, message) => res.status(status).json({
        success: false,
        code: status === 428 ? 'BOT_CHALLENGE_REQUIRED' : 'BOT_CHALLENGE_FAILED',
        message,
        challenge: { siteKey: settings.siteKey, action: ACTION },
    });
    const verifyPublic = async (req, res, next) => {
        const token = req.get('X-Bot-Token');
        if (typeof token !== 'string' || !token.trim()) return respond(res, 428, 'Complete the security check and try again.');
        if (token.length > 2048) return respond(res, 400, 'The security check is invalid. Please try again.');
        if (!settings.secretKey || !settings.siteKey || !settings.hostnames?.length) {
            return respond(res, 503, 'The security check is unavailable. Please try again shortly.');
        }
        const now = Date.now();
        for (const [key, expires] of consumed) if (expires <= now) consumed.delete(key);
        const digest = createHash('sha256').update(token).digest('hex');
        if (consumed.has(digest)) return respond(res, 400, 'This security check has expired or was already used. Please try again.');
        if (consumed.size >= 5000) return respond(res, 503, 'The security check is busy. Please try again shortly.');
        // Reserve before the network call so concurrent submissions cannot redeem
        // the same token during the provider's replication/convergence window.
        consumed.set(digest, now + TOKEN_TTL);
        try {
            if (!await verifyToken(token, settings)) {
                consumed.delete(digest);
                return respond(res, 400, 'The security check failed or expired. Please try again.');
            }
        } catch {
            consumed.delete(digest);
            return respond(res, 503, 'The security check is unavailable. Please try again shortly.');
        }
        return next();
    };
    return (req, res, next) => {
        if (!settings?.enabled) return next();
        let hasAuthentication = false;
        // Selecting the public path never grants an exemption: it always
        // requires bot verification, even if a revoked cookie remains present.
        if (allowStaff && req.get('X-Registration-Context') !== 'public') {
            try { hasAuthentication = !!require('../services/auth-transport').readAuthentication(req).token; }
            catch { return res.status(403).json({ success: false, message: 'Invalid authentication credentials' }); }
        }
        if (allowStaff && hasAuthentication) {
            const authenticate = authenticateRequest || require('./auth.middleware').authenticate;
            return authenticate(req, res, () => {
                const role = (req.user?.roleName || req.user?.role || '').toLowerCase();
                return STAFF_ROLES.has(role) ? next() : verifyPublic(req, res, next);
            });
        }
        return verifyPublic(req, res, next);
    };
}

module.exports = { createBotProtection, verifyTurnstile };
