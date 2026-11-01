const mockModule = (modulePath, exports) => {
    const resolved = require.resolve(modulePath);
    delete require.cache[resolved];
    require.cache[resolved] = {
        id: resolved,
        filename: resolved,
        loaded: true,
        exports,
    };
};

const createAuditLog = vi.fn().mockResolvedValue({ id: 'log1' });
mockModule('../../src/services/audit.service', { createAuditLog, logAuditEvent: createAuditLog });

const middlewarePath = require.resolve('../../src/middleware/audit.middleware');
delete require.cache[middlewarePath];
const { auditLog } = require('../../src/middleware/audit.middleware');

const createRes = () => {
    const res = {
        statusCode: 200,
        status: vi.fn(function (code) {
            this.statusCode = code;
            return this;
        }),
        json: vi.fn(function (payload) {
            this.payload = payload;
            return this;
        }),
    };

    return res;
};

describe('audit.middleware', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('redacts sensitive fields before logging', async () => {
        vi.useFakeTimers();

        const middleware = auditLog('data_access', 'medical_record');
        const req = {
            user: { id: 'u1' },
            params: { id: 'r1' },
            query: { purpose: 'treatment' },
            body: { password: 'secret', otp: '123456', token: 'tok' },
            ip: '1.1.1.1',
            headers: { 'user-agent': 'vitest' },
            method: 'GET',
            path: '/api/emr/record/r1',
            connection: { remoteAddress: '1.1.1.1' },
        };
        const res = createRes();
        const next = vi.fn();

        await middleware(req, res, next);

        res.json({ success: true });
        vi.runAllTimers();

        expect(createAuditLog).toHaveBeenCalled();
        const logPayload = createAuditLog.mock.calls[0][0];
        expect(logPayload.metadata.body).toBeUndefined();
        expect(JSON.stringify(logPayload)).not.toContain('secret');
    });

    it('withholds a successful clinical response until the audit write completes', async () => {
        let release;
        createAuditLog.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
        const req = { user: { id: 'u1' }, params: {}, query: {}, body: {}, headers: {}, method: 'GET', path: '/records', connection: {} };
        const res = createRes();
        await auditLog('view_medical_record')(req, res, vi.fn());
        res.json({ success: true, data: 'clinical data' });
        expect(res.payload).toBeUndefined();
        release({ id: 'audit-event' });
        await Promise.resolve();
        expect(res.payload.data).toBe('clinical data');
    });

    it('returns a generic unavailable response without clinical data when the audit write fails', async () => {
        createAuditLog.mockRejectedValueOnce(new Error('database unavailable'));
        const req = { user: { id: 'u1' }, params: {}, query: {}, body: {}, headers: {}, method: 'GET', path: '/records', connection: {} };
        const res = createRes();
        await auditLog('view_medical_record')(req, res, vi.fn());
        res.json({ success: true, data: 'clinical data' });
        await Promise.resolve();
        await Promise.resolve();
        expect(res.statusCode).toBe(503);
        expect(res.payload).toEqual({ success: false, message: 'Auditing is unavailable. Please try again later.' });
    });

    it('uses the route action with one append when global and route audits overlap', async () => {
        createAuditLog.mockClear();
        const req = { user: { id: 'u1' }, params: {}, query: {}, body: {}, headers: {}, method: 'GET', path: '/records', connection: {} };
        const res = createRes();
        await auditLog(null, 'emr')(req, res, vi.fn());
        await auditLog('view_medical_record', 'medical_record')(req, res, vi.fn());
        res.json({ success: true });
        await Promise.resolve();
        expect(createAuditLog).toHaveBeenCalledTimes(1);
        expect(createAuditLog.mock.calls[0][0].action).toBe('view_medical_record');
    });

    it('does not append again after the handler commits a transactional audit', async () => {
        createAuditLog.mockClear();
        const req = { auditEventRecorded: true };
        const res = createRes();
        await auditLog('privacy_request')(req, res, vi.fn());
        res.json({ success: true });
        expect(createAuditLog).not.toHaveBeenCalled();
        expect(res.payload.success).toBe(true);
    });
});
