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

const query = vi.fn();
const createAuditLog = vi.fn().mockResolvedValue({ id: 'log1' });

mockModule('../../src/config/db', { query });
mockModule('../../src/services/audit.service', { createAuditLog });

const middlewarePath = require.resolve('../../src/middleware/abac.middleware');
delete require.cache[middlewarePath];

const {
    requireVisitContext,
    requireActiveShift,
    requireTaskAssignment,
    hasActiveVisitContext,
    isWithinTimeBounds,
} = require('../../src/middleware/abac.middleware');
const { HTTP_STATUS } = require('../../src/utils/constants');

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

describe('abac.middleware', () => {
    beforeEach(() => {
        query.mockReset();
        createAuditLog.mockClear();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('hasActiveVisitContext returns true when a visit exists', async () => {
        query.mockResolvedValue({ rows: [{ id: 'v1' }] });

        const result = await hasActiveVisitContext('u1', 'p1');

        expect(result).toBe(true);
    });

    it('requireVisitContext denies when patientId is missing', async () => {
        const req = { user: { id: 'u1' }, params: {}, body: {}, ip: '1.1.1.1', headers: {} };
        const res = createRes();
        const next = vi.fn();

        await requireVisitContext(req, res, next);

        expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST);
        expect(res.payload.message).toBe('Patient ID is required');
        expect(next).not.toHaveBeenCalled();
    });

    it('requireVisitContext denies and audits when no active visit', async () => {
        query.mockResolvedValue({ rows: [] });

        const req = {
            user: { id: 'u1' },
            params: { patientId: 'p1' },
            body: {},
            ip: '1.1.1.1',
            headers: { 'user-agent': 'vitest' },
            method: 'GET',
            path: '/api/emr/patient/p1',
        };
        const res = createRes();
        const next = vi.fn();

        await requireVisitContext(req, res, next);

        expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN);
        expect(res.payload.message).toContain('No active visit context');
        expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'u1',
            action: 'access_denied',
            entityId: 'p1',
            statusCode: HTTP_STATUS.FORBIDDEN,
        }));
        expect(next).not.toHaveBeenCalled();
    });

    it('requireActiveShift skips non shift-based roles', async () => {
        const req = { user: { id: 'u1', roleName: 'doctor' } };
        const res = createRes();
        const next = vi.fn();

        await requireActiveShift(req, res, next);

        expect(next).toHaveBeenCalled();
    });

    it('requireActiveShift denies when outside shift and audits', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2024, 0, 1, 12, 0, 0));

        query.mockResolvedValue({ rows: [{ shift_start: '00:00:00', shift_end: '00:00:01' }] });

        const req = {
            user: { id: 'u1', roleName: 'nurse' },
            ip: '1.1.1.1',
            headers: { 'user-agent': 'vitest' },
            method: 'GET',
            path: '/api/emr/patient/p1',
        };
        const res = createRes();
        const next = vi.fn();

        await requireActiveShift(req, res, next);

        expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN);
        expect(res.payload.message).toBe('Access denied: Outside shift hours');
        expect(createAuditLog).toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
    });

    it('requireTaskAssignment denies when taskId is missing', async () => {
        const middleware = requireTaskAssignment('lab_test');
        const req = { user: { id: 'u1' }, params: {}, body: {} };
        const res = createRes();
        const next = vi.fn();

        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST);
        expect(res.payload.message).toBe('Task ID is required');
        expect(next).not.toHaveBeenCalled();
    });

    it('requireTaskAssignment denies when no assignment exists', async () => {
        const middleware = requireTaskAssignment('lab_test');
        query.mockResolvedValue({ rows: [] });

        const req = {
            user: { id: 'u1' },
            params: { id: 'r1' },
            ip: '1.1.1.1',
            headers: { 'user-agent': 'vitest' },
            method: 'GET',
            path: '/api/emr/lab/r1',
        };
        const res = createRes();
        const next = vi.fn();

        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN);
        expect(res.payload.message).toBe('Access denied: No task assignment');
        expect(createAuditLog).toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
    });

    it('requireTaskAssignment allows when assignment exists', async () => {
        const middleware = requireTaskAssignment('lab_test');
        query.mockResolvedValue({ rows: [{ id: 'r1' }] });

        const req = { user: { id: 'u1' }, params: { id: 'r1' }, ip: '1.1.1.1', headers: {}, method: 'GET', path: '/api/emr/lab/r1' };
        const res = createRes();
        const next = vi.fn();

        await middleware(req, res, next);

        expect(next).toHaveBeenCalled();
    });

    it('isWithinTimeBounds respects start and end dates', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));

        expect(isWithinTimeBounds('2024-01-01T10:00:00Z', '2024-01-01T13:00:00Z')).toBe(true);
        expect(isWithinTimeBounds('2024-01-01T13:00:00Z', '2024-01-01T14:00:00Z')).toBe(false);
        expect(isWithinTimeBounds('2024-01-01T11:00:00Z', '2024-01-01T11:30:00Z')).toBe(false);
    });
});
