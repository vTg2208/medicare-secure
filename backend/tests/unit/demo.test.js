const request = require('supertest');
const mockModule = (name, exports) => {
    const id = require.resolve(name);
    require.cache[id] = { id, filename: id, loaded: true, exports };
};
const query = vi.fn();
mockModule('../../src/config/db', { query });
mockModule('pg', { Pool: class { query(...args) { return query(...args); } } });
mockModule('../../src/utils/logger', { info() {}, warn() {}, error() {}, debug() {} });
const config = require('../../src/config/env');
config.rateLimit.otpMaxAttempts = 100;
const authController = require('../../src/modules/auth/auth.controller');
const registerPatient = vi.fn(authController.registerPatient);
authController.registerPatient = registerPatient;
const app = require('../../src/app');

beforeEach(() => { config.demo = true; query.mockReset(); });
afterAll(() => { config.demo = false; });

const disabledRoutes = [
    '/auth/register/patient', '/auth/register/doctor', '/auth/register/organization',
    '/auth/resend-otp', '/staff/invite', '/staff/invitations/123/resend',
    '/staff/invitations/token/accept', '/users/staff/onboard',
    '/auth/passkey/register/options', '/auth/passkey/register/verify',
];
describe.each(['/api', '/api/v1'])('demo guards at %s', (prefix) => {
    it.each(disabledRoutes)('rejects %s before account, email or credential side effects', async (path) => {
        const result = await request(app).post(prefix + path).send({});
        expect(result.status).toBe(503);
        expect(result.body).toMatchObject({ success: false, code: 'DEMO_FEATURE_DISABLED' });
        expect(query).not.toHaveBeenCalled();
    });
    it.each(['post', 'put', 'patch', 'delete'])('rejects multipart %s before upload middleware writes', async (method) => {
        const result = await request(app)[method](prefix + '/lab/upload').attach('file', Buffer.from('test'), 'fixture.txt');
        expect(result.status).toBe(503);
        expect(result.body.code).toBe('DEMO_FEATURE_DISABLED');
        expect(query).not.toHaveBeenCalled();
    });
    it('rejects public credential uploads before multer opens any output file', async () => {
        const write = vi.spyOn(require('node:fs'), 'createWriteStream').mockImplementation(() => {
            throw new Error('Demo must not open an uploaded file');
        });
        const result = await request(app).post(prefix + '/auth/register/doctor')
            .attach('degreeCertificate', Buffer.from('%PDF-fixture'), { filename: 'fixture.pdf', contentType: 'application/pdf' });
        expect(result.status).toBe(503);
        expect(write).not.toHaveBeenCalled();
    });
    it('does not bypass auth or disable JSON clinical workflows', async () => {
        const result = await request(app).post(prefix + '/emr/medical-records').send({});
        expect(result.status).toBe(401);
        expect(query).not.toHaveBeenCalled();
    });
    it('keeps password login and OTP verification validation available', async () => {
        for (const path of ['/auth/login', '/auth/verify-otp', '/auth/otp/verify']) {
            const result = await request(app).post(prefix + path).send({});
            expect(result.status).toBe(400);
        }
    });
    it('exposes only public deployment capabilities', async () => {
        const result = await request(app).get(prefix + '/public/deployment');
        expect(result.status).toBe(200);
        expect(result.body).toEqual({ success: true, data: {
            demo: true,
            disabledFeatures: ['registration', 'email', 'staffInvitations', 'staffOnboarding', 'passkeyRegistration', 'uploads', 'aiTriage'],
        } });
        expect(query).not.toHaveBeenCalled();
    });
});
it('matches Express case-insensitive and trailing-slash registration aliases', async () => {
    const result = await request(app).post('/api/v1/AUTH/REGISTER/PATIENT/').send({});
    expect(result.status).toBe(503);
    expect(query).not.toHaveBeenCalled();
});
it.each([
    '/api/auth//register/patient',
    '/api/v1/auth//register/patient',
    '/api/v1/AUTH//REGISTER/PATIENT/',
])('blocks the real registration handler through nested-router separator alias %s', async (path) => {
    const result = await request(app).post(path).send({});
    expect(result.status).toBe(503);
    expect(registerPatient).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
});
it.each(['/api', '/api/v1'])('blocks nested passkey aliases and encoded invitation parameters at %s', async (prefix) => {
    for (const path of [
        '/auth/passkey//register/options', '/auth/passkey//register/verify',
        '/staff//invite', '/staff//invitations/%2F%3F%23/resend',
        '/staff//invitations/%2f/accept', '/users//staff/onboard',
    ]) {
        const result = await request(app).post(prefix + path).send({});
        expect(result.status).toBe(503);
        expect(query).not.toHaveBeenCalled();
    }
});
it('preserves Express literal-segment encoding semantics without reaching registration', async () => {
    const result = await request(app).post('/api/auth/register/%70atient').send({});
    expect(result.status).toBe(404);
    expect(registerPatient).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
});
it('leaves production registration validation, auth, and upload handling enabled', async () => {
    config.demo = false;
    expect((await request(app).post('/api/auth/register/patient').send({})).status).toBe(400);
    expect((await request(app).post('/api/auth/passkey/register/options').send({})).status).toBe(401);
    expect((await request(app).post('/api/lab/upload').attach('file', Buffer.from('test'), 'fixture.txt')).status).toBe(401);
    expect((await request(app).get('/api/public/deployment')).body).toEqual({ success: true, data: { demo: false, disabledFeatures: [] } });
});
it('retains the existing Express registration separator alias outside demo mode', async () => {
    config.demo = false;
    const result = await request(app).post('/api/v1/auth//register/patient').send({});
    expect(result.status).toBe(400);
    expect(registerPatient).toHaveBeenCalledTimes(1);
    expect(query).not.toHaveBeenCalled();
});
