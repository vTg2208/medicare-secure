const load = () => {
    try { return require('../../src/services/totp.service'); }
    catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; return {}; }
};
const totp = load();
const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('authenticator interoperability and replay boundary', () => {
    test.each([
        [59, '94287082'], [1111111109, '07081804'], [1111111111, '14050471'],
        [1234567890, '89005924'], [2000000000, '69279037'], [20000000000, '65353130'],
    ])('matches RFC 6238 at %s seconds', (seconds, expected) => {
        expect(totp.generateTotp).toBeTypeOf('function');
        expect(totp.generateTotp(secret, seconds * 1000, { digits: 8 })).toBe(expected);
    });
    test('accepts at most one neighboring step and rejects previously accepted steps', () => {
        expect(totp.verifyTotp).toBeTypeOf('function');
        const now = 1234567890000;
        const code = totp.generateTotp(secret, now);
        expect(totp.verifyTotp(secret, code, { now })).toBe(Math.floor(now / 30000));
        expect(totp.verifyTotp(secret, code, { now: now + 30000 })).toBe(Math.floor(now / 30000));
        expect(totp.verifyTotp(secret, code, { now: now + 60000 })).toBeNull();
        expect(totp.verifyTotp(secret, code, { now, lastStep: Math.floor(now / 30000) })).toBeNull();
        for (const malformed of [123456, '12345', '1234567', ' 123456', 'abcdef', null]) {
            expect(totp.verifyTotp(secret, malformed, { now })).toBeNull();
        }
    });
    test('generates local interoperable provisioning data with strong random seeds', () => {
        expect(totp.generateSecret).toBeTypeOf('function');
        const seed = totp.generateSecret();
        expect(seed).toMatch(/^[A-Z2-7]{32}$/);
        expect(seed).not.toBe(totp.generateSecret());
        const uri = new URL(totp.provisioningUri(seed, 'person+one@example.test'));
        expect(uri.protocol).toBe('otpauth:');
        expect(uri.hostname).toBe('totp');
        expect(uri.searchParams.get('secret')).toBe(seed);
        expect(uri.searchParams.get('issuer')).toBe('Medicare');
        expect(uri.searchParams.get('digits')).toBe('6');
    });
});
