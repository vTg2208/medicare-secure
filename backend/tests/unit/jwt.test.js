const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'test-access-secret-with-at-least-32-characters';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-with-at-least-32-characters';
const tokens = require('../../src/config/jwt');

it('issues distinct tokens for concurrent logins by the same user', () => {
    expect(tokens.generateAccessToken({ userId: 'u1' })).not.toBe(tokens.generateAccessToken({ userId: 'u1' }));
});

it('accepts only the configured HMAC algorithm', () => {
    const forged = jwt.sign({ userId: 'u1' }, process.env.JWT_SECRET, {
        algorithm: 'HS384', issuer: 'healthcare-system', audience: 'healthcare-api',
    });
    expect(() => tokens.verifyAccessToken(forged)).toThrow();
});
