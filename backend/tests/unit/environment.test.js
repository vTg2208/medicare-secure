const { validateEnvironment } = require('../../src/config/validate-env');
const safe = () => ({
    NODE_ENV: 'production', DB_PASSWORD: 'local-fixture-password',
    JWT_SECRET: 'a'.repeat(64), JWT_REFRESH_SECRET: 'b'.repeat(64),
    ENCRYPTION_KEY: 'cd'.repeat(32), CORS_ORIGIN: 'https://health.example.test',
    FRONTEND_URL: 'https://health.example.test',
    WEBAUTHN_RP_ID: 'health.example.test', WEBAUTHN_ORIGIN: 'https://health.example.test',
    EMAIL_HOST: 'smtp.example.test', EMAIL_FROM: 'no-reply@example.test',
});
it('accepts a complete production configuration', () => {
    expect(validateEnvironment(safe())).toEqual([]);
});
it('permits missing SMTP configuration only in explicit demo mode', () => {
    const env = { ...safe(), EMAIL_HOST: '', EMAIL_FROM: '' };
    expect(validateEnvironment({ ...env, DEMO_MODE: 'true', AI_ENABLED: 'false' })).toEqual([]);
    for (const demo of [undefined, 'false']) {
        expect(validateEnvironment({ ...env, DEMO_MODE: demo })).toEqual(expect.arrayContaining(['EMAIL_HOST is required', 'EMAIL_FROM is required']));
    }
});
it.each(['1', 'yes', 'TRUE', ''])('rejects nonboolean DEMO_MODE %s', (value) => {
    expect(validateEnvironment({ ...safe(), DEMO_MODE: value })).toContain('DEMO_MODE must be true or false');
});
it('rejects AI in demo mode even with a valid service token', () => {
    expect(validateEnvironment({ ...safe(), DEMO_MODE: 'true', AI_ENABLED: 'true', AI_SERVICE_TOKEN: 'a'.repeat(64) }))
        .toContain('AI_ENABLED must be false in demo mode');
});
it('keeps encryption and WebAuthn production requirements in demo mode', () => {
    expect(validateEnvironment({ ...safe(), DEMO_MODE: 'true', ENCRYPTION_KEY: '', WEBAUTHN_ORIGIN: '' }))
        .toEqual(expect.arrayContaining(['ENCRYPTION_KEY is required', 'WEBAUTHN_ORIGIN is required']));
});
it.each([
    ['JWT_SECRET', 'short'], ['JWT_REFRESH_SECRET', 'a'.repeat(64)],
    ['ENCRYPTION_KEY', 'not-a-key'], ['CORS_ORIGIN', '*'],
    ['FRONTEND_URL', 'http://health.example.test'], ['DB_SSL', 'maybe'],
    ['PORT', '-1'], ['ENCRYPTION_ALGORITHM', 'aes-256-cbc'],
])('rejects unsafe production setting %s', (name, value) => {
    expect(validateEnvironment({ ...safe(), [name]: value }).length).toBeGreaterThan(0);
});
