const crypto = require('node:crypto');
const denied = message => Object.assign(new Error(message), { status: 403 });
const cookieNames = () => process.env.NODE_ENV === 'production'
    ? { session: '__Host-medicare_session', csrf: '__Host-medicare_csrf' }
    : { session: 'medicare_session', csrf: 'medicare_csrf' };
const cookieOptions = httpOnly => ({ secure: process.env.NODE_ENV === 'production', httpOnly, sameSite: 'lax', path: '/' });
const readCookie = (req, name) => {
    const raw = req.headers?.cookie || '';
    if (typeof raw !== 'string' || raw.length > 16384) throw denied('Invalid authentication cookies');
    const values = raw.split(';').map(part => part.trim()).filter(part => part.slice(0, part.indexOf('=')) === name);
    if (values.length > 1) throw denied('Ambiguous authentication cookies');
    if (!values.length) return null;
    const value = values[0].slice(values[0].indexOf('=') + 1);
    if (!value || value.length > 8192 || !/^[A-Za-z0-9_.-]+$/.test(value)) throw denied('Invalid authentication cookie');
    return value;
};
const isBearerClient = req => req.headers?.['x-auth-transport'] === 'bearer'
    && !req.headers.origin && !req.headers['sec-fetch-site'] && !req.headers.cookie;
const allowedOrigins = () => new Set((process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',').map(value => value.trim()).filter(Boolean));
const assertAuthenticationOrigin = req => {
    // Public authentication does not require a live session, but it must not
    // accept a different credential interpretation than protected requests.
    readAuthentication(req);
    readCookie(req, cookieNames().csrf);
    if (isBearerClient(req)) return;
    const origin = req.headers?.origin;
    if (typeof origin !== 'string' || !allowedOrigins().has(origin) || req.headers['sec-fetch-site'] === 'cross-site') {
        throw denied('A trusted application Origin is required');
    }
};
const readAuthentication = req => {
    const token = readCookie(req, cookieNames().session);
    const authorization = req.headers?.authorization;
    if (token && authorization) throw denied('Mixed authentication credentials are not allowed');
    if (authorization) {
        if (typeof authorization !== 'string' || !/^Bearer [A-Za-z0-9_.-]{1,8192}$/.test(authorization)
            || req.headers.origin || req.headers['sec-fetch-site']) throw denied('Use the application session cookie');
        return { token: authorization.slice(7), transport: 'bearer' };
    }
    return { token, transport: 'cookie' };
};
const assertSessionRequest = (req, session, transport) => {
    if (transport === 'bearer') return;
    if (req.headers?.['sec-fetch-site'] === 'cross-site') throw denied('Cross-site session requests are not allowed');
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;
    // Bearer response negotiation cannot change an established cookie session's checks.
    if (!allowedOrigins().has(req.headers?.origin)) throw denied('A trusted application Origin is required');
    const csrf = readCookie(req, cookieNames().csrf), supplied = req.headers?.['x-csrf-token'];
    if (!csrf || typeof supplied !== 'string' || supplied !== csrf || !/^[a-f0-9]{64}$/.test(session.csrf_hash || '')) throw denied('Session CSRF verification failed');
    const hash = crypto.createHash('sha256').update(supplied).digest();
    if (!crypto.timingSafeEqual(hash, Buffer.from(session.csrf_hash, 'hex'))) throw denied('Session CSRF verification failed');
};
const sendAuthenticated = (req, res, { session, stepUpTicket }) => {
    const data = { user: session.user, ...(stepUpTicket ? { stepUpTicket } : {}) };
    if (isBearerClient(req)) {
        data.accessToken = session.token;
        data.refreshToken = session.refreshToken;
    } else {
        const names = cookieNames(), maxAge = Math.max(0, session.expiresAt.getTime() - Date.now());
        res.cookie(names.session, session.token, { ...cookieOptions(true), maxAge });
        res.cookie(names.csrf, session.csrfToken, { ...cookieOptions(false), maxAge });
    }
    return res.json({ success: true, data });
};
const clearSessionCookies = res => {
    const names = cookieNames();
    res.clearCookie(names.session, cookieOptions(true));
    res.clearCookie(names.csrf, cookieOptions(false));
};
const requireAuthenticationOrigin = (req, res, next) => {
    try { assertAuthenticationOrigin(req); next(); }
    catch (error) { res.status(error.status).json({ success: false, message: error.message }); }
};

module.exports = { cookieNames, isBearerClient, assertAuthenticationOrigin, readAuthentication,
    assertSessionRequest, sendAuthenticated, clearSessionCookies, requireAuthenticationOrigin };
