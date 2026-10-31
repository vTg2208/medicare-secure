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
mockModule('../../src/services/audit.service', { createAuditLog });

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
        expect(logPayload.metadata.body.password).toBe('[REDACTED]');
        expect(logPayload.metadata.body.otp).toBe('[REDACTED]');
        expect(logPayload.metadata.body.token).toBe('[REDACTED]');
    });
});
