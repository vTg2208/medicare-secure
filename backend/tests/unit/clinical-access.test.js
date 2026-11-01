const mockModule = (path, exports) => {
    const resolved = require.resolve(path);
    require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
};
const query = vi.fn();
const checkConsent = vi.fn();
mockModule('../../src/config/db', { query });
mockModule('../../src/models/consent.model', { checkConsent, findMatchingConsent: checkConsent });
const { clinicalAccess, visitAccess, staffRoleAllowed } = require('../../src/middleware/clinical-access.middleware');
const response = () => ({ status: vi.fn(function(code) { this.code = code; return this; }), json: vi.fn(function(body) { this.body = body; return this; }) });
const patient = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const visit = '33333333-3333-4333-8333-333333333333';
describe('clinical authorization boundaries', () => {
    beforeEach(() => { query.mockReset(); checkConsent.mockReset(); });
    it('allows patients to read their own resolved record', async () => {
        query.mockResolvedValue({ rows: [{ patient_id: patient, visit_id: visit }] });
        const next = vi.fn(); const res = response();
        await clinicalAccess({ resource: 'record', id: () => visit })({ user: { id: patient, roleName: 'patient' }, body: {}, params: {} }, res, next);
        expect(next).toHaveBeenCalled(); expect(checkConsent).not.toHaveBeenCalled();
    });
    it('denies another patient even when a record identifier is known', async () => {
        query.mockResolvedValue({ rows: [{ patient_id: patient, visit_id: visit }] });
        const next = vi.fn(); const res = response();
        await clinicalAccess({ resource: 'record', id: () => visit })({ user: { id: other, roleName: 'patient' }, body: {} }, res, next);
        expect(res.code).toBe(403); expect(next).not.toHaveBeenCalled();
    });
    it('denies patient writes and administrator PHI access', async () => {
        query.mockResolvedValue({ rows: [{ patient_id: patient, visit_id: visit }] });
        for (const roleName of ['patient', 'system_admin', 'hospital_admin']) {
            const next = vi.fn(); const res = response();
            await clinicalAccess({ resource: 'record', id: () => visit, access: 'write' })({ user: { id: patient, roleName }, body: {} }, res, next);
            expect(res.code).toBe(403); expect(next).not.toHaveBeenCalled();
        }
    });
    it('requires active care context as well as consent', async () => {
        query.mockResolvedValue({ rows: [] }).mockResolvedValueOnce({ rows: [{ patient_id: patient, visit_id: visit }] });
        checkConsent.mockResolvedValue(true);
        const next = vi.fn(); const res = response();
        await clinicalAccess({ resource: 'record', id: () => visit })({ user: { id: other, roleName: 'doctor' }, body: {} }, res, next);
        expect(res.code).toBe(403); expect(next).not.toHaveBeenCalled();
    });
    it('binds the matched server consent and category for audit evidence', async () => {
        query.mockResolvedValueOnce({ rows: [{ patient_id: patient, visit_id: visit }] }).mockResolvedValueOnce({ rows: [{ id: visit }] });
        checkConsent.mockResolvedValue({ id: other, purpose: 'treatment', data_category: 'vital_signs', source: 'manual' });
        const req = { user: { id: other, roleName: 'nurse' }, body: { purpose: 'clinical_research' } };
        const next = vi.fn();
        await clinicalAccess({ resource: 'record', id: () => visit, category: 'vital_signs' })(req, response(), next);
        expect(next).toHaveBeenCalled();
        expect(req.consentContext).toEqual({ id: other, purpose: 'treatment', dataCategory: 'vital_signs', source: 'manual', workflow: 'clinical' });
        expect(req.clinicalCategory).toBe('vitals');
    });
    it('rejects conflicting patient and visit identifiers', async () => {
        query.mockResolvedValue({ rows: [{ patient_id: patient, visit_id: visit }] });
        const next = vi.fn(); const res = response();
        await clinicalAccess({ resource: 'record', id: () => visit })({ user: { id: patient, roleName: 'patient' }, body: { patientId: other } }, res, next);
        expect(res.code).toBe(400); expect(next).not.toHaveBeenCalled();
    });
    it('denies cross-organization administrative visit changes', async () => {
        query.mockResolvedValueOnce({ rows: [{ id: visit, patient_id: patient, organization_id: other }] }).mockResolvedValueOnce({ rows: [] });
        const next = vi.fn(); const res = response();
        await visitAccess({ id: () => visit, administrative: true })({ user: { id: patient, roleName: 'hospital_admin' }, body: {} }, res, next);
        expect(res.code).toBe(403); expect(next).not.toHaveBeenCalled();
    });
    it('prevents hospital administrators from provisioning privileged roles', () => {
        expect(staffRoleAllowed('hospital_admin', 'system_admin')).toBe(false);
        expect(staffRoleAllowed('hospital_admin', 'compliance_officer')).toBe(false);
        expect(staffRoleAllowed('hospital_admin', 'doctor')).toBe(true);
        expect(staffRoleAllowed('system_admin', 'compliance_officer')).toBe(true);
    });
});
