const crypto = require('node:crypto');
let transport = {};
try { transport = require('../../src/services/auth-transport'); }
catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
const csrf = 'x'.repeat(43);
const req = (headers = {}, method = 'POST') => ({ headers, method });

test('browser authentication requires the exact allowed Origin and cannot negotiate bearer responses', () => {
    expect(transport.assertAuthenticationOrigin).toBeTypeOf('function');
    expect(() => transport.assertAuthenticationOrigin(req({ origin: 'http://localhost:3000' }))).not.toThrow();
    for (const origin of ['http://localhost:3000.attacker.test', 'null', 'https://attacker.test']) {
        expect(() => transport.assertAuthenticationOrigin(req({ origin, 'x-auth-transport': 'bearer' }))).toThrow();
    }
    expect(() => transport.assertAuthenticationOrigin(req({}))).toThrow();
    expect(() => transport.assertAuthenticationOrigin(req({ 'x-auth-transport': 'bearer' }))).not.toThrow();
    expect(transport.isBearerClient(req({ origin: 'http://localhost:3000', 'x-auth-transport': 'bearer' }))).toBe(false);
});
test('rejects duplicate and mixed authentication credentials', () => {
    expect(transport.readAuthentication).toBeTypeOf('function');
    const { session: name } = transport.cookieNames();
    expect(transport.readAuthentication(req({ cookie: `${name}=session-token` })).transport).toBe('cookie');
    expect(() => transport.readAuthentication(req({ cookie: `${name}=one; ${name}=two` }))).toThrow();
    expect(() => transport.readAuthentication(req({ cookie: `${name}=one`, authorization: 'Bearer two' }))).toThrow();
    expect(() => transport.readAuthentication(req({ origin: 'http://localhost:3000', authorization: 'Bearer two' }))).toThrow();
});

test('public authentication rejects ambiguous credentials without requiring an existing session', () => {
    const names=transport.cookieNames();
    const origin='http://localhost:3000';
    for(const headers of [
        {cookie:`${names.session}=one; ${names.session}=two`},
        {cookie:`${names.csrf}=one; ${names.csrf}=two`},
        {cookie:`${names.session}=one`,authorization:'Bearer two'},
    ]) expect(()=>transport.assertAuthenticationOrigin(req({origin,...headers}))).toThrow();
    expect(()=>transport.assertAuthenticationOrigin(req({origin}))).not.toThrow();
    expect(()=>transport.assertAuthenticationOrigin(req({origin,cookie:`${names.session}=expired-token`}))).not.toThrow();
});
test('unsafe cookie requests require session-bound CSRF, while safe requests and explicit bearer APIs work', () => {
    expect(transport.assertSessionRequest).toBeTypeOf('function');
    const { csrf: name } = transport.cookieNames();
    const session = { csrf_hash: crypto.createHash('sha256').update(csrf).digest('hex') };
    const headers = { origin: 'http://localhost:3000', cookie: `${name}=${csrf}`, 'x-csrf-token': csrf };
    expect(() => transport.assertSessionRequest(req(headers), session, 'cookie')).not.toThrow();
    expect(() => transport.assertSessionRequest(req({}), session, 'cookie')).toThrow();
    expect(() => transport.assertSessionRequest(req({ ...headers, 'x-csrf-token': 'wrong' }), session, 'cookie')).toThrow();
    expect(() => transport.assertSessionRequest(req(headers), { csrf_hash: '0'.repeat(64) }, 'cookie')).toThrow();
    expect(() => transport.assertSessionRequest(req({ ...headers, 'sec-fetch-site': 'cross-site' }, 'GET'), session, 'cookie')).toThrow();
    expect(() => transport.assertSessionRequest(req({}, 'GET'), session, 'cookie')).not.toThrow();
    expect(() => transport.assertSessionRequest(req({}), session, 'bearer')).not.toThrow();
});
test('production cookies are host-only, Secure and HttpOnly, with a readable matching CSRF cookie', () => {
    expect(transport.sendAuthenticated).toBeTypeOf('function');
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
        const saved = [];
        let body;
        const res = { cookie: (name, value, options) => saved.push({ name, value, options }), json: value => { body = value; } };
        transport.sendAuthenticated(req({ origin: 'https://app.example.test' }), res,
            { session: { token: 'private-token', refreshToken: 'private-refresh', csrfToken: csrf, expiresAt: new Date(Date.now() + 60000), user: { id: 'fixture' } } });
        expect(saved[0].name).toBe('__Host-medicare_session');
        expect(saved[0].options).toMatchObject({ secure: true, httpOnly: true, sameSite: 'lax', path: '/' });
        expect(saved[0].options.domain).toBeUndefined();
        expect(saved[1].options.httpOnly).toBe(false);
        expect(JSON.stringify(body)).not.toContain('private-token');
        expect(JSON.stringify(body)).not.toContain('private-refresh');
    } finally { process.env.NODE_ENV = previous; }
});
