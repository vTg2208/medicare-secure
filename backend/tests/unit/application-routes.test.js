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
const mail = require('../../src/config/mail');
const available = mail.assertEmailAvailable;
mail.assertEmailAvailable = vi.fn(available);
const authController = require('../../src/modules/auth/auth.controller');
authController.registerPatient = vi.fn(authController.registerPatient);
const app = require('../../src/app');

beforeEach(() => {
    query.mockReset().mockResolvedValue({ rows: [], rowCount: 0 });
    mail.assertEmailAvailable.mockReset().mockImplementation(available);
});

describe.each(['/api', '/api/v1'])('application routes at %s', prefix => {
    it('runs public registration validation and keeps verification validation available', async () => {
        for (const path of ['/auth/register/patient', '/auth/login', '/auth/verify-otp', '/auth/otp/verify']) {
            expect((await request(app).post(prefix + path).send({})).status).toBe(400);
        }
    });
    it.each([
        '/auth/passkey/register/options', '/auth/passkey/register/verify',
        '/staff/invite', '/users/staff/onboard',
    ])('retains authentication on %s', async path => {
        const result = await request(app).post(prefix + path).send({});
        expect(result.status).toBe(401);
        expect(query.mock.calls.every(([sql]) => /^\s*INSERT INTO audit_logs/.test(sql))).toBe(true);
    });
    it('rejects unauthenticated multipart requests before touching upload storage', async () => {
        const write = vi.spyOn(require('node:fs'), 'createWriteStream').mockImplementation(() => { throw new Error('Unexpected file write'); });
        const result = await request(app).post(prefix + '/lab/upload').attach('file', Buffer.from('fixture'), 'report.txt');
        expect(result.status).toBe(401);
        expect(write).not.toHaveBeenCalled();
    });
    it('retains durable evidence for denied clinical requests', async () => {
        const result = await request(app).post(prefix + '/emr/medical-records').send({});
        expect(result.status).toBe(401);
        expect(query).toHaveBeenCalledTimes(1);
        const [sql, values] = query.mock.calls[0];
        expect(sql).toMatch(/^\s*INSERT INTO audit_logs/);
        expect(values[0]).toBeNull();
        expect(values[9]).toBe(401);
    });
    it.each(['/auth/register/patient', '/auth/register/doctor', '/auth/register/organization', '/auth/resend-otp'])(
        'reports missing delivery before persistence or file staging at %s', async path => {
            mail.assertEmailAvailable.mockImplementation(() => { throw Object.assign(new Error('Email delivery is not configured'), { statusCode: 503 }); });
            const result = await request(app).post(prefix + path).send({});
            expect(result.status).toBe(503);
            expect(result.body.message).toBe('Email delivery is not configured');
            expect(query).not.toHaveBeenCalled();
        });
    it('does not expose a deployment-mode endpoint', async () => {
        expect((await request(app).get(prefix + '/public/deployment')).status).toBe(404);
    });
});
