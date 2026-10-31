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

const checkConsent = vi.fn();
const isOnShift = vi.fn();

mockModule('../../src/models/consent.model', { checkConsent });
mockModule('../../src/services/shift.service', { isOnShift });

const middlewarePath = require.resolve('../../src/middleware/consent.middleware');
delete require.cache[middlewarePath];
const { verifyConsent } = require('../../src/middleware/consent.middleware');
const { HTTP_STATUS, ERROR_MESSAGES, ROLES } = require('../../src/utils/constants');

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

describe('consent.middleware', () => {
    beforeEach(() => {
        checkConsent.mockReset();
        isOnShift.mockReset();
    });

    it('denies when patientId is missing', async () => {
        const middleware = verifyConsent('lab_results');
        const req = { user: { id: 'u1', role_name: ROLES.DOCTOR }, params: {}, body: {} };
        const res = createRes();
        const next = vi.fn();

        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST);
        expect(res.payload.message).toBe('Patient ID is required');
        expect(next).not.toHaveBeenCalled();
    });

    it('allows patient to access own data', async () => {
        const middleware = verifyConsent('clinical_notes');
        const req = { user: { id: 'p1', role_name: ROLES.PATIENT }, params: { patientId: 'p1' }, body: {} };
        const res = createRes();
        const next = vi.fn();

        await middleware(req, res, next);

        expect(next).toHaveBeenCalled();
    });

    it('denies patient accessing other patient data', async () => {
        const middleware = verifyConsent('clinical_notes');
        const req = { user: { id: 'p1', role_name: ROLES.PATIENT }, params: { patientId: 'p2' }, body: {} };
        const res = createRes();
        const next = vi.fn();

        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN);
        expect(res.payload.message).toBe(ERROR_MESSAGES.ACCESS_DENIED);
        expect(next).not.toHaveBeenCalled();
    });

    it('denies non-healthcare roles', async () => {
        const middleware = verifyConsent('clinical_notes');
        const req = { user: { id: 'u1', role_name: ROLES.SYSTEM_ADMIN }, params: { patientId: 'p1' }, body: {} };
        const res = createRes();
        const next = vi.fn();

        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN);
        expect(res.payload.message).toBe('Only healthcare providers can access patient data');
        expect(next).not.toHaveBeenCalled();
    });

    it('sets offShiftAccess when staff is off shift and consent exists', async () => {
        isOnShift.mockResolvedValue(false);
        checkConsent.mockResolvedValue(true);

        const middleware = verifyConsent('lab_results', 'read');
        const req = { user: { id: 'u1', role_name: ROLES.NURSE }, params: { patientId: 'p1' }, body: {} };
        const res = createRes();
        const next = vi.fn();

        await middleware(req, res, next);

        expect(req.offShiftAccess).toBe(true);
        expect(next).toHaveBeenCalled();
    });

    it('denies when consent is missing', async () => {
        isOnShift.mockResolvedValue(true);
        checkConsent.mockResolvedValue(false);

        const middleware = verifyConsent('lab_results', 'read');
        const req = { user: { id: 'u1', role_name: ROLES.DOCTOR }, params: { patientId: 'p1' }, body: {} };
        const res = createRes();
        const next = vi.fn();

        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN);
        expect(res.payload.message).toBe('No active consent found for this action');
        expect(next).not.toHaveBeenCalled();
    });
});
