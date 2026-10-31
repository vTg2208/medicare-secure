const { HTTP_STATUS, ERROR_MESSAGES, ROLES } = require('../../src/utils/constants');
const { requireRole, requireOwnership } = require('../../src/middleware/rbac.middleware');

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

describe('rbac.middleware', () => {
    it('requireRole denies when user is missing', async () => {
        const middleware = requireRole(ROLES.DOCTOR);
        const req = { user: null, path: '/api/secure' };
        const res = createRes();
        const next = vi.fn();

        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.UNAUTHORIZED);
        expect(res.payload.message).toBe(ERROR_MESSAGES.TOKEN_REQUIRED);
        expect(next).not.toHaveBeenCalled();
    });

    it('requireRole denies when role is insufficient', async () => {
        const middleware = requireRole([ROLES.DOCTOR, ROLES.NURSE]);
        const req = { user: { id: 'u1', roleName: ROLES.PATIENT }, path: '/api/secure' };
        const res = createRes();
        const next = vi.fn();

        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN);
        expect(res.payload.message).toBe(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS);
        expect(next).not.toHaveBeenCalled();
    });

    it('requireRole allows when role matches', async () => {
        const middleware = requireRole(ROLES.DOCTOR);
        const req = { user: { id: 'u1', roleName: ROLES.DOCTOR }, path: '/api/secure' };
        const res = createRes();
        const next = vi.fn();

        await middleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('requireOwnership allows owner access', () => {
        const req = { user: { id: 'p1', roleName: ROLES.PATIENT }, params: { userId: 'p1' }, path: '/api/users/p1' };
        const res = createRes();
        const next = vi.fn();

        requireOwnership(req, res, next);

        expect(next).toHaveBeenCalled();
    });

    it('requireOwnership allows admin bypass', () => {
        const req = { user: { id: 'a1', roleName: ROLES.SYSTEM_ADMIN }, params: { id: 'p2' }, path: '/api/users/p2' };
        const res = createRes();
        const next = vi.fn();

        requireOwnership(req, res, next);

        expect(next).toHaveBeenCalled();
    });

    it('requireOwnership denies non-owner', () => {
        const req = { user: { id: 'u1', roleName: ROLES.DOCTOR }, params: { id: 'p2' }, path: '/api/users/p2' };
        const res = createRes();
        const next = vi.fn();

        requireOwnership(req, res, next);

        expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN);
        expect(res.payload.message).toBe(ERROR_MESSAGES.ACCESS_DENIED);
        expect(next).not.toHaveBeenCalled();
    });
});
