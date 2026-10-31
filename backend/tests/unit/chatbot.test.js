const mockModule = (path, exports) => {
    const resolved = require.resolve(path);
    require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
};
const query = vi.fn(); const post = vi.fn(); const get = vi.fn(); const audit = vi.fn();
const config = { ai: { enabled: true, url: 'http://ai:8000', token: 'test-service-token' }, database: {} };
mockModule('../../src/config/db', { query });
mockModule('pg', { Pool: class { query(...args) { return query(...args); } } });
mockModule('axios', { post, get });
mockModule('../../src/config/env', config);
mockModule('../../src/services/audit.service', { createAuditLog: audit });
const controller = require('../../src/modules/chatbot/chatbot.controller');
const id = '11111111-1111-4111-8111-111111111111';
const patient = '22222222-2222-4222-8222-222222222222';
const response = () => ({ status: vi.fn(function(code) { this.code = code; return this; }), json: vi.fn(function(body) { this.body = body; return this; }) });
const request = (body = {}, roleName = 'patient') => ({ user: { id: patient, roleName }, body, params: { id }, headers: {}, query: {} });
const summary = { subjective: 'Pain', objective: 'Reported', assessment: 'Needs review', plan: 'Review', recommended_department: 'Cardiology', confidence_score: 0.2 };

describe('triage authorization and dependency failures', () => {
    beforeEach(() => {
        query.mockReset(); post.mockReset(); get.mockReset(); audit.mockReset();
        config.ai.enabled = true; config.ai.token = 'test-service-token';
    });
    it('rejects another patient session before sending PHI to AI', async () => {
        query.mockResolvedValue({ rows: [], rowCount: 0 }); post.mockResolvedValue({ data: { reply: 'question' } });
        const res = response(); await controller.sendMessage(request({ session_id: id, message: 'Pain' }), res);
        expect(res.code).toBe(404); expect(post).not.toHaveBeenCalled();
        expect(query.mock.calls[0][1]).toEqual([id, patient]);
    });
    it('rejects malformed ids and oversized messages before querying or calling AI', async () => {
        for (const body of [{ session_id: 'bad', message: 'Pain' }, { session_id: id, message: 'x'.repeat(4001) }]) {
            const res = response(); await controller.sendMessage(request(body), res); expect(res.code).toBe(400);
        }
        expect(query).not.toHaveBeenCalled(); expect(post).not.toHaveBeenCalled();
    });
    it('returns explicit 503 when disabled without creating a session', async () => {
        config.ai.enabled = false;
        const res = response(); await controller.startSession(request(), res);
        expect(res.code).toBe(503); expect(query).not.toHaveBeenCalled(); expect(post).not.toHaveBeenCalled();
    });
    it('does not save a successful medical reply when AI fails', async () => {
        query.mockResolvedValue({ rows: [{ id, patient_id: patient, status: 'in_progress' }], rowCount: 1 }); post.mockRejectedValue(new Error('timeout'));
        const res = response(); await controller.sendMessage(request({ session_id: id, message: 'Pain' }), res);
        expect(res.code).toBe(503); expect(res.body.reply).toBeUndefined(); expect(query.mock.calls).toHaveLength(1);
    });
    it('uses service authentication and bounded requests and audits successful messages', async () => {
        query.mockResolvedValue({ rows: [{ id, patient_id: patient, status: 'in_progress' }], rowCount: 1 }); post.mockResolvedValue({ data: { reply: 'How long?' } });
        const res = response(); await controller.sendMessage(request({ session_id: id, message: 'Pain' }), res);
        expect(res.code).toBe(200);
        expect(post.mock.calls[0][2]).toMatchObject({ timeout: 30000, headers: { Authorization: 'Bearer test-service-token' }, maxRedirects: 0 });
        expect(query.mock.calls[1][0]).toContain('patient_id = $3');
        expect(audit).toHaveBeenCalledWith(expect.objectContaining({ userId: patient, action: 'CHATBOT_MESSAGE_SENT' }));
    });
    it('does not downgrade priority based on model confidence or department', async () => {
        query.mockResolvedValue({ rows: [{ id, patient_id: patient, status: 'in_progress' }], rowCount: 1 }); get.mockResolvedValue({ data: { summary } });
        const res = response(); await controller.analyzeSession(request({ session_id: id }), res);
        expect(res.code).toBe(200);
        const update = query.mock.calls.find(([sql]) => sql.includes('UPDATE'));
        expect(update[0]).not.toContain('priority ='); expect(update[1]).not.toContain('low');
    });
    it('scopes doctor summaries and queues by consent and active care assignment', async () => {
        query.mockResolvedValue({ rows: [], rowCount: 0 });
        const res = response(); await controller.getSummary(request({}, 'doctor'), res); expect(res.code).toBe(404);
        expect(query.mock.calls[0][0]).toContain('consents'); expect(query.mock.calls[0][0]).toContain('assigned_doctor_id');
        query.mockClear(); await controller.getAllSessions(request({}, 'doctor'), response());
        expect(query.mock.calls[0][0]).toContain('consents'); expect(query.mock.calls[0][0]).toContain('access_visit.status'); expect(query.mock.calls[0][1][0]).toBe(patient);
    });
    it('forbids administrative roles from clinical sessions', async () => {
        const res = response(); await controller.getSummary(request({}, 'system_admin'), res);
        expect(res.code).toBe(403); expect(query).not.toHaveBeenCalled();
    });

it('rejects analysis for another patient before fetching a summary', async () => {
    query.mockResolvedValue({ rows: [], rowCount: 0 });
    const res = response(); await controller.analyzeSession(request({ session_id: id }), res);
    expect(res.code).toBe(404); expect(get).not.toHaveBeenCalled();
});
it('does not call AI for a completed session', async () => {
    query.mockResolvedValue({ rows: [{ id, patient_id: patient, status: 'completed' }], rowCount: 1 });
    const res = response(); await controller.sendMessage(request({ session_id: id, message: 'Pain' }), res);
    expect(res.code).toBe(409); expect(post).not.toHaveBeenCalled();
});
it('does not persist invalid model summaries', async () => {
    query.mockResolvedValue({ rows: [{ id, patient_id: patient, status: 'in_progress' }], rowCount: 1 });
    get.mockResolvedValue({ data: { summary: { recommended_department: 'General Physician', confidence_score: NaN } } });
    const res = response(); await controller.analyzeSession(request({ session_id: id }), res);
    expect(res.code).toBe(503); expect(query).toHaveBeenCalledTimes(1);
});
it('scopes patient summary reads to their own identity', async () => {
    query.mockResolvedValue({ rows: [{ id, patient_id: patient }], rowCount: 1 });
    const res = response(); await controller.getSummary(request(), res);
    expect(res.code).toBe(200);
    expect(query.mock.calls[0][0]).toContain('t.patient_id = $2');
    expect(query.mock.calls[0][1]).toEqual([id, patient]);
});
it('does not create a database session when upstream initialization fails', async () => {
    post.mockRejectedValue(new Error('offline'));
    const res = response(); await controller.startSession(request(), res);
    expect(res.code).toBe(503); expect(query).not.toHaveBeenCalled();
});
it('requires the integration token even when AI is enabled', async () => {
    config.ai.token = '';
    const res = response(); await controller.startSession(request(), res);
    expect(res.code).toBe(503); expect(post).not.toHaveBeenCalled(); expect(query).not.toHaveBeenCalled();
});

});
