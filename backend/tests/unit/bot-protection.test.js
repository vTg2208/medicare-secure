const express = require('express');
const request = require('supertest');
const { createBotProtection, verifyTurnstile } = require('../../src/middleware/bot-protection.middleware');

const settings = { enabled: true, siteKey: 'public-fixture-key', secretKey: 'private-fixture-key', hostnames: ['health.example.test'] };
const build = (options = {}) => {
    const handle = vi.fn((req, res) => res.json({ success: true }));
    const app = express();
    app.use(express.json());
    app.post('/submit', createBotProtection({ settings, ...options }), handle);
    return { app, handle };
};

test('requires a challenge before processing credentials and exposes only its public configuration', async () => {
    const verifyToken = vi.fn();
    const { app, handle } = build({ verifyToken });
    const response = await request(app).post('/submit').send({ email: 'patient@example.test', password: 'fixture-password' });
    expect(response.status).toBe(428);
    expect(response.body.challenge).toEqual({ siteKey: settings.siteKey, action: 'public_auth' });
    expect(JSON.stringify(response.body)).not.toContain(settings.secretKey);
    expect(verifyToken).not.toHaveBeenCalled();
    expect(handle).not.toHaveBeenCalled();
});

test.each([' ', 'x'.repeat(2049)])('rejects missing or oversized tokens before contacting the provider', async token => {
    const verifyToken = vi.fn();
    const { app, handle } = build({ verifyToken });
    const response = await request(app).post('/submit').set('X-Bot-Token', token).send({});
    expect([400, 428]).toContain(response.status);
    expect(verifyToken).not.toHaveBeenCalled();
    expect(handle).not.toHaveBeenCalled();
});

test('processes a verified request once and rejects an immediate replay', async () => {
    const verifyToken = vi.fn().mockResolvedValue(true);
    const { app, handle } = build({ verifyToken });
    expect((await request(app).post('/submit').set('X-Bot-Token', 'fixture-token').send({})).status).toBe(200);
    expect((await request(app).post('/submit').set('X-Bot-Token', 'fixture-token').send({})).status).toBe(400);
    expect(verifyToken).toHaveBeenCalledOnce();
    expect(handle).toHaveBeenCalledOnce();
});

test.each([false, 'unavailable'])('fails closed for a failed challenge or verifier outage (%s)', async result => {
    const verifyToken = result === false ? vi.fn().mockResolvedValue(false) : vi.fn().mockRejectedValue(new Error('private-provider-detail'));
    const { app, handle } = build({ verifyToken });
    const response = await request(app).post('/submit').set('X-Bot-Token', 'fixture-token').send({});
    expect(response.status).toBe(result === false ? 400 : 503);
    expect(response.body.challenge.siteKey).toBe(settings.siteKey);
    expect(JSON.stringify(response.body)).not.toContain('private-provider-detail');
    expect(handle).not.toHaveBeenCalled();
});

test('never treats an unverified authorization header as a staff exemption', async () => {
    const authenticateRequest = vi.fn((req, res) => res.status(401).json({ success: false }));
    const verifyToken = vi.fn();
    const { app, handle } = build({ allowStaff: true, authenticateRequest, verifyToken });
    expect((await request(app).post('/submit').set('Authorization', 'Bearer forged').send({})).status).toBe(401);
    expect(authenticateRequest).toHaveBeenCalledOnce();
    expect(verifyToken).not.toHaveBeenCalled();
    expect(handle).not.toHaveBeenCalled();
});

test.each(['receptionist', 'nurse', 'staff', 'hospital_admin', 'system_admin'])('preserves authenticated %s patient registration', async roleName => {
    const authenticateRequest = vi.fn((req, res, next) => { req.user = { id: 'fixture-staff', roleName }; return next(); });
    const verifyToken = vi.fn();
    const { app, handle } = build({ allowStaff: true, authenticateRequest, verifyToken });
    expect((await request(app).post('/submit').set('Authorization', 'Bearer verified-fixture').send({})).status).toBe(200);
    expect(verifyToken).not.toHaveBeenCalled();
    expect(handle).toHaveBeenCalledOnce();
});

test('authenticated patients still need a public-form challenge', async () => {
    const authenticateRequest = (req, res, next) => { req.user = { roleName: 'patient' }; return next(); };
    const { app, handle } = build({ allowStaff: true, authenticateRequest });
    expect((await request(app).post('/submit').set('Authorization', 'Bearer patient-fixture').send({})).status).toBe(428);
    expect(handle).not.toHaveBeenCalled();
});

test('staff registration recognizes a verified cookie session and rejects a forged cookie', async () => {
    const authenticateRequest = (req, res, next) => {
        if (req.get('Cookie') !== 'medicare_session=verified-fixture') return res.status(401).json({ success: false });
        req.user = { id: 'synthetic-staff', roleName: 'nurse' }; return next();
    };
    const { app } = build({ allowStaff: true, authenticateRequest });
    expect((await request(app).post('/submit').set('Cookie', 'medicare_session=verified-fixture').send({})).status).toBe(200);
    expect((await request(app).post('/submit').set('Cookie', 'medicare_session=forged-fixture').send({})).status).toBe(401);
});

test('public patient registration ignores stale cookies while still requiring a verified bot challenge', async () => {
    const authenticateRequest=vi.fn((req,res)=>res.status(401).json({success:false}));
    const verifyToken=vi.fn().mockResolvedValue(true);
    const {app,handle}=build({allowStaff:true,authenticateRequest,verifyToken});
    const post=()=>request(app).post('/submit').set('Cookie','medicare_session=expired-fixture').set('X-Registration-Context','public');
    expect((await post().set('X-Bot-Token','valid-public-fixture').send({})).status).toBe(200);
    expect((await post().send({})).status).toBe(428);
    expect(authenticateRequest).not.toHaveBeenCalled();expect(handle).toHaveBeenCalledOnce();
});

test('leaves explicitly unconfigured development flows unchanged', async () => {
    const { app, handle } = build({ settings: { enabled: false } });
    expect((await request(app).post('/submit').send({})).status).toBe(200);
    expect(handle).toHaveBeenCalledOnce();
});

test('shares replay protection between registration and login guards', async () => {
    const consumedTokens = new Map();
    const verifyToken = vi.fn().mockResolvedValue(true);
    const registration = build({ consumedTokens, verifyToken });
    const login = build({ consumedTokens, verifyToken });
    expect((await request(registration.app).post('/submit').set('X-Bot-Token', 'cross-route-token')).status).toBe(200);
    expect((await request(login.app).post('/submit').set('X-Bot-Token', 'cross-route-token')).status).toBe(400);
    expect(login.handle).not.toHaveBeenCalled();
    expect(verifyToken).toHaveBeenCalledOnce();
});

const goodResult = () => ({ success: true, hostname: settings.hostnames[0], action: 'public_auth', challenge_ts: new Date().toISOString() });
test('verifies through the fixed HTTPS endpoint with a bounded request and private secret', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => goodResult() });
    expect(await verifyTurnstile('fixture-token', settings, fetchImpl)).toBe(true);
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    expect(JSON.parse(options.body)).toEqual({ secret: settings.secretKey, response: 'fixture-token' });
    expect(options.signal).toBeInstanceOf(AbortSignal);
});

test.each([
    { hostname: 'attacker.example.test' }, { action: 'other_flow' }, { success: false },
    { challenge_ts: 'invalid' }, { challenge_ts: new Date(Date.now() - 301000).toISOString() },
    { challenge_ts: new Date(Date.now() + 120000).toISOString() },
])('rejects a mismatched or expired provider response %j', async invalid => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...goodResult(), ...invalid }) });
    expect(await verifyTurnstile('fixture-token', settings, fetchImpl)).toBe(false);
});
