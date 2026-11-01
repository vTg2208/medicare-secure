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
it('permits an unconfigured optional SMTP integration', () => {
    const env = { ...safe(), EMAIL_HOST: '', EMAIL_FROM: '' };
    expect(validateEnvironment(env)).toEqual([]);
});
it.each(['EMAIL_HOST', 'EMAIL_FROM'])('rejects incomplete SMTP configuration missing %s', key => {
    expect(validateEnvironment({ ...safe(), [key]: '' })).toContain(`${key} is required`);
});
it('enables AI independently when its service token is configured', () => {
    expect(validateEnvironment({ ...safe(), AI_ENABLED: 'true', AI_SERVICE_TOKEN: 'a'.repeat(64) })).toEqual([]);
});
it('keeps encryption and WebAuthn production requirements without SMTP', () => {
    expect(validateEnvironment({ ...safe(), EMAIL_HOST: '', EMAIL_FROM: '', ENCRYPTION_KEY: '', WEBAUTHN_ORIGIN: '' }))
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
