const express = require('express');
const request = require('supertest');
const mockModule = (name, exports) => {
    const id = require.resolve(name);
    require.cache[id] = { id, filename: id, loaded: true, exports };
};
const patientId = 'a0000000-0000-4000-8000-000000000001';
const visitId = 'a0000000-0000-4000-8000-000000000002';
const actorId = 'a0000000-0000-4000-8000-000000000003';
const query = vi.fn();
let consentAllowed;
let stored;
mockModule('../../src/config/db', { query });
mockModule('../../src/utils/logger', { info() {}, warn() {}, error() {}, debug() {} });
// Session/JWT and audit persistence are covered separately; retain the real
// role, clinical access, controller and model boundaries in this route test.
mockModule('../../src/middleware/auth.middleware', { authenticate(req, res, next) {
    if (!req.get('X-Test-Role')) return res.status(401).json({ success: false });
    req.user = { id: actorId, roleName: req.get('X-Test-Role') };
    next();
} });
mockModule('../../src/middleware/audit.middleware', { auditLog: () => (_req, _res, next) => next() });
mockModule('../../src/models/consent.model', { findMatchingConsent: async () => consentAllowed
    ? { id: 'consent', purpose: 'treatment', data_category: 'all', source: 'patient' } : null });
const app = express();
app.use(express.json({ limit: '1mb', strict: false }));
app.use('/emr', require('../../src/modules/emr/emr.routes'));
const valid = { patientId, visitId, type: 'consultation', title: 'SOAP Note', description: 'S: Mild pain\n\nP: Review in 2 weeks.' };
const post = (body, role = 'doctor') => {
    const req = request(app).post('/emr/medical-records');
    if (role) req.set('X-Test-Role', role);
    return req.send(body);
};

beforeEach(() => {
    consentAllowed = true;
    stored = [];
    query.mockReset().mockImplementation(async (sql, values) => {
        if (/INSERT INTO medical_records/.test(sql)) {
            const record = { patient_id: values[0], visit_id: values[1], type: values[2], title: values[3], description: values[4], created_by: values[5], immutable_flag: values[6] };
            stored.push(record);
            return { rows: [record] };
        }
        if (/FROM visits\s+WHERE id = \$1/.test(sql)) return { rows: [{ id: visitId, visit_id: visitId, patient_id: patientId, status: 'in_progress' }] };
        if (/FROM visits access_visit/.test(sql)) return { rows: [{ id: visitId }] };
        throw new Error('Unexpected database operation');
    });
});

describe('medical-record creation validation before clinical database access', () => {
    const invalid = [
        ['array body', []], ['null body', null], ['string body', 'note'], ['numeric body', 42],
        ['missing fields', {}], ['missing patient', { ...valid, patientId: undefined }],
        ['object patient', { ...valid, patientId: { id: patientId } }],
        ['bad patient UUID', { ...valid, patientId: 'patient' }],
        ['bad visit UUID', { ...valid, visitId: 'visit' }],
        ['array visit', { ...valid, visitId: [visitId] }],
        ['empty visit', { ...valid, visitId: '' }],
        ['missing type', { ...valid, type: undefined }],
        ['unknown type', { ...valid, type: 'clinical_notes' }],
        ['object type', { ...valid, type: { value: 'note' } }],
        ['array type', { ...valid, type: ['note'] }],
        ['missing title', { ...valid, title: undefined }],
        ['blank title', { ...valid, title: ' \n\t ' }],
        ['object title', { ...valid, title: { text: 'note' } }],
        ['numeric title', { ...valid, title: 1 }],
        ['oversize title', { ...valid, title: 'a'.repeat(256) }],
        ['object description', { ...valid, description: { text: 'clinical text' } }],
        ['array description', { ...valid, description: ['clinical text'] }],
        ['numeric description', { ...valid, description: 1 }],
        ['oversize description', { ...valid, description: 'a'.repeat(100001) }],
        ['NUL title', { ...valid, title: 'note\u0000' }],
        ['NUL description', { ...valid, description: 'finding\u0000' }],
        ...['createdBy', 'created_by', 'immutableFlag', 'immutable_flag', 'patient_id', 'organizationId', 'role', 'unexpected'].map(field => [`unknown field ${field}`, { ...valid, [field]: 'untrusted' }]),
    ];
    it.each(invalid)('rejects %s with 400 without authorization queries or record writes', async (_label, body) => {
        // Explicit JSON keeps primitive/null cases from being encoded as form data.
        const result = await request(app).post('/emr/medical-records').set('X-Test-Role', 'doctor')
            .set('Content-Type', 'application/json').send(JSON.stringify(body));
        expect(result.status).toBe(400);
        expect(result.body.success).toBe(false);
        expect(query).not.toHaveBeenCalled();
        expect(stored).toEqual([]);
    });

    it.each(['consultation', 'diagnosis', 'treatment', 'prescription', 'lab_result', 'imaging', 'procedure', 'vaccination', 'note', 'other'])(
        'accepts the supported %s record type through the real persistence boundary', async type => {
            const result = await post({ ...valid, type });
            expect(result.status).toBe(201);
            expect(stored).toEqual([{ patient_id: patientId, visit_id: visitId, type, title: 'SOAP Note', description: valid.description, created_by: actorId, immutable_flag: true }]);
        });

    it('preserves clinical prose, whitespace, Unicode and multiline formatting without stripping', async () => {
        const description = '  S: Patient says "<better>" & pain < 3/10.\r\n\tBP 120/80; Temp 37°C.\n\nP: Continue β-blocker.  ';
        const result = await post({ ...valid, title: '  Follow-up – review  ', description }, 'nurse');
        expect(result.status).toBe(201);
        expect(stored[0]).toMatchObject({ title: '  Follow-up – review  ', description });
    });

    it.each([undefined, null, ''])('allows optional description %s and a patient-only frontend payload', async description => {
        const result = await post({ ...valid, visitId: null, description });
        expect(result.status).toBe(201);
        expect(stored[0]).toMatchObject({ patient_id: patientId, visit_id: null });
        expect(stored[0].description).toBe(description);
    });

    it('allows maximum-size text without truncation', async () => {
        const title = 't'.repeat(255), description = 'd'.repeat(100000);
        expect((await post({ ...valid, title, description })).status).toBe(201);
        expect(stored[0]).toMatchObject({ title, description });
    });

    it('preserves authentication and role rejection before validation', async () => {
        expect((await post({}, null)).status).toBe(401);
        expect((await post({}, 'patient')).status).toBe(403);
        expect(query).not.toHaveBeenCalled();
        expect(stored).toEqual([]);
    });

    it('still denies a valid record when consent is absent', async () => {
        consentAllowed = false;
        expect((await post(valid)).status).toBe(403);
        expect(stored).toEqual([]);
    });

    it('still denies valid UUID links to a different patient', async () => {
        expect((await post({ ...valid, patientId: actorId })).status).toBe(400);
        expect(stored).toEqual([]);
    });
});
