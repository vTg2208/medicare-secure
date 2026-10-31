// Validate before opening sockets or accepting traffic. Never include values in errors.
const validateEnvironment = (env) => {
    const errors = [];
    const production = env.NODE_ENV === 'production';
    const demo = env.DEMO_MODE === 'true';
    if (env.DEMO_MODE !== undefined && !['true', 'false'].includes(env.DEMO_MODE)) errors.push('DEMO_MODE must be true or false');
    if (demo && env.AI_ENABLED === 'true') errors.push('AI_ENABLED must be false in demo mode');
    const required = ['DB_PASSWORD', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
    if (production) required.push('ENCRYPTION_KEY', 'CORS_ORIGIN', 'FRONTEND_URL', 'WEBAUTHN_RP_ID', 'WEBAUTHN_ORIGIN');
    if (production && !demo) required.push('EMAIL_HOST', 'EMAIL_FROM');
    for (const key of required) if (!env[key]) errors.push(`${key} is required`);
    for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
        if (env[key] && (env[key].length < 32 || /your_|change.this|example|placeholder/i.test(env[key]))) {
            errors.push(`${key} must be a unique random secret of at least 32 characters`);
        }
    }
    if (env.JWT_SECRET && env.JWT_SECRET === env.JWT_REFRESH_SECRET) errors.push('JWT secrets must be different');
    if (env.ENCRYPTION_KEY && !/^[a-f\d]{64}$/i.test(env.ENCRYPTION_KEY)) errors.push('ENCRYPTION_KEY must be 64 hexadecimal characters (32 bytes)');
    if (env.ENCRYPTION_ALGORITHM && env.ENCRYPTION_ALGORITHM !== 'aes-256-gcm') errors.push('ENCRYPTION_ALGORITHM must be aes-256-gcm');
    for (const key of ['DB_SSL', 'EMAIL_SECURE', 'AUTO_LOGOUT_ENABLED', 'AI_ENABLED']) {
        if (env[key] && !['true', 'false'].includes(env[key])) errors.push(`${key} must be true or false`);
    }
    for (const key of ['PORT', 'DB_PORT', 'EMAIL_PORT', 'OTP_EXPIRY_MINUTES', 'OTP_MAX_ATTEMPTS', 'SESSION_TIMEOUT_MINUTES', 'RATE_LIMIT_MAX_REQUESTS', 'MAX_FILE_SIZE_MB']) {
        if (env[key] && (!/^\d+$/.test(env[key]) || Number(env[key]) < 1 || (key.endsWith('PORT') && Number(env[key]) > 65535))) errors.push(`${key} must be a positive valid integer`);
    }
    if (env.BCRYPT_ROUNDS && (!/^\d+$/.test(env.BCRYPT_ROUNDS) || +env.BCRYPT_ROUNDS < 10 || +env.BCRYPT_ROUNDS > 16)) errors.push('BCRYPT_ROUNDS must be between 10 and 16');
    if (env.OTP_LENGTH && !/^[6-8]$/.test(env.OTP_LENGTH)) errors.push('OTP_LENGTH must be between 6 and 8');
    if (production) {
        for (const key of ['FRONTEND_URL', 'WEBAUTHN_ORIGIN']) {
            if (env[key]) {
                try { if (new URL(env[key]).protocol !== 'https:') errors.push(`${key} must use HTTPS`); }
                catch { errors.push(`${key} must be an absolute HTTPS URL`); }
            }
        }
        for (const origin of (env.CORS_ORIGIN || '').split(',')) {
            try { const url = new URL(origin.trim()); if (url.protocol !== 'https:' || url.origin !== origin.trim()) errors.push('CORS_ORIGIN must contain HTTPS origins'); }
            catch { errors.push('CORS_ORIGIN must contain explicit HTTPS origins'); }
        }
        if (env.AI_ENABLED === 'true' && (!env.AI_SERVICE_TOKEN || env.AI_SERVICE_TOKEN.length < 32)) errors.push('AI_SERVICE_TOKEN must contain at least 32 characters when AI is enabled');
    }
    return errors;
};
module.exports = { validateEnvironment };
