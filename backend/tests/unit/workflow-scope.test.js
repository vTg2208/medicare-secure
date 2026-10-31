const mockModule = (path, exports) => {
    const resolved = require.resolve(path);
    require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
};
const query = vi.fn();
const generateToken = vi.fn().mockResolvedValue({ token: 'dummy' });
mockModule('../../src/config/db', { query });
mockModule('../../src/utils/oneTimeToken.service', { generateToken });
const controller = require('../../src/modules/workflow/workflow.controller');
const response = () => ({ status: vi.fn(function(code) { this.code = code; return this; }), json: vi.fn(function(body) { this.body = body; return this; }) });
const patient = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
describe('temporary access grants', () => {
    beforeEach(() => { query.mockReset(); generateToken.mockClear(); });
    it('does not let patients mint a grant for another principal', async () => {
        const res = response();
        await controller.generateToken({ user: { id: patient, roleName: 'patient' }, body: { userId: other, scope: { resourceType: 'visit', resourceId: other, permissions: ['read'] } } }, res);
        expect(res.code).toBe(403); expect(generateToken).not.toHaveBeenCalled();
    });
    it('does not let patients grant access to another patient record', async () => {
        query.mockResolvedValue({ rows: [{ patient_id: other }] });
        const res = response();
        await controller.generateToken({ user: { id: patient, roleName: 'patient' }, body: { userId: patient, scope: { resourceType: 'medical_record', resourceId: other, permissions: ['read'] } } }, res);
        expect(res.code).toBe(403); expect(generateToken).not.toHaveBeenCalled();
    });
    it('requires a bounded expiry and read-only grant', async () => {
        query.mockResolvedValue({ rows: [{ patient_id: patient }] });
        const res = response();
        await controller.generateToken({ user: { id: patient, roleName: 'patient' }, body: { scope: { resourceType: 'visit', resourceId: other, permissions: ['write'] }, expiresInMinutes: 100000 } }, res);
        expect(res.code).toBe(400); expect(generateToken).not.toHaveBeenCalled();
    });
});
