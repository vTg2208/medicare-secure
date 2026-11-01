const mockModule = (path, exports) => {
    const resolved = require.resolve(path);
    require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
};
const query = vi.fn();
mockModule('../../src/config/db', { query, transaction: callback => callback({ query }) });
const Prescription = require('../../src/models/prescription.model');
const MedicalRecord = require('../../src/models/medical_record.model');
const Validator = require('../../src/services/prescription.validator.service');
const EmrController = require('../../src/modules/emr/emr.controller');
const PharmacistController = require('../../src/modules/pharmacist/pharmacist.controller');
const FileUpload = require('../../src/services/file.upload.service');
const response = () => ({ status: vi.fn(function(code) { this.code = code; return this; }), json: vi.fn(function(body) { this.body = body; return this; }) });

describe('clinical workflow regressions', () => {
    beforeEach(() => { query.mockReset(); });

    it.each(['Three times daily', 'Four times daily', 'Before meals', 'After meals', 'At bedtime'])('accepts the prescription form frequency %s', frequency => {
        expect(Validator.validateFrequency(frequency)).toBe(true);
    });

    it('returns diagnoses from every record in a visit', async () => {
        query.mockImplementation(async (sql, values) => {
            if (/FROM medical_records mr/.test(sql)) return { rows: [{ id: 'new-note' }, { id: 'old-note' }] };
            if (/FROM diagnoses d/.test(sql)) return { rows: /mr\.visit_id/.test(sql) && values[0] === 'visit' ? [{ id: 'old-diagnosis' }, { id: 'new-diagnosis' }] : [] };
            throw new Error('Unexpected query');
        });
        const res = response();
        await EmrController.getDiagnoses({ params: { visitId: 'visit' } }, res);
        expect(res.body.data.map(item => item.id)).toEqual(['old-diagnosis', 'new-diagnosis']);
    });

    it('resolves the latest consultation only within the selected patient visit', async () => {
        query.mockResolvedValue({ rows: [{ id: 'consultation', visit_id: 'visit' }] });
        const records = await MedicalRecord.findByPatientId('patient', { type: 'consultation', visitId: 'visit', limit: 1 });
        expect(records).toEqual([{ id: 'consultation', visit_id: 'visit' }]);
        expect(query).toHaveBeenCalledWith(expect.stringMatching(/mr\.visit_id = \$3/), ['patient', 'consultation', 'visit', 1, 0]);
    });

    it.each(['cancelled', 'expired', 'completed'])('never dispenses a %s prescription or changes its dispenser', async status => {
        query.mockResolvedValue({ rows: [{ id: 'rx', status, dispensed_by: 'first-pharmacist' }] });
        await expect(Prescription.updateStatus('rx', 'completed', 'second-pharmacist')).rejects.toMatchObject({ statusCode: 409 });
    });

    it.each(['pending', 'active'])('dispenses a %s prescription and synchronizes its nursing order', async status => {
        let saved = { id: 'rx', status };
        let medicationStatus = 'ordered';
        query.mockImplementation(async (sql, values) => {
            if (/SELECT.*FROM prescriptions.*FOR UPDATE/s.test(sql)) return { rows: [saved] };
            if (/UPDATE prescriptions/.test(sql)) { saved = { ...saved, status: values[0], dispensed_by: values[1] }; return { rows: [saved] }; }
            if (/UPDATE medication_orders/.test(sql)) { medicationStatus = 'dispensed'; return { rows: [] }; }
            throw new Error('Unexpected query');
        });
        expect(await Prescription.updateStatus('rx', 'completed', 'pharmacist')).toMatchObject({ status: 'completed', dispensed_by: 'pharmacist' });
        expect(medicationStatus).toBe('dispensed');
    });

    it.each([['doctor', 'completed'], ['pharmacist', 'cancelled'], ['pharmacist', 'active']])('denies %s changing a prescription to %s', async (roleName, status) => {
        query.mockResolvedValue({ rows: [{ id: 'rx', status: 'active' }] });
        const res = response();
        await EmrController.updatePrescriptionStatus({ params: { prescriptionId: 'rx' }, body: { status }, user: { id: 'actor', roleName } }, res);
        expect(res.code).toBe(403);
    });

    it('returns a conflict when the pharmacy attempts to re-dispense a terminal prescription', async () => {
        query.mockResolvedValue({ rows: [{ id: 'rx', status: 'cancelled' }] });
        const res = response();
        await PharmacistController.dispensePrescription({ params: { id: 'rx' }, user: { id: 'pharmacist' } }, res);
        expect(res.code).toBe(409);
    });

    it('rejects terminal EMR imaging uploads and removes the encrypted file instead of publishing success', async () => {
        vi.spyOn(FileUpload, 'processUpload').mockResolvedValue({ filePath: '/fixture/report.enc', fileUrl: '/api/files/patient/imaging/report.pdf' });
        const remove = vi.spyOn(FileUpload, 'deleteFile').mockResolvedValue();
        query.mockImplementation(async sql => {
            if (/FROM imaging_orders/.test(sql)) return { rows: [{ id: 'order', visit_id: 'visit', patient_id: 'patient', status: 'cancelled' }] };
            throw new Error('A cancelled order must not publish any record');
        });
        const res = response();
        await EmrController.uploadImagingReport({ body: { orderId: 'order' }, user: { id: 'radiologist' }, clinicalContext: { patient_id: 'patient', visit_id: 'visit' }, file: { buffer: Buffer.from('%PDF-1.4') } }, res);
        expect(res.code).toBe(409);
        expect(remove).toHaveBeenCalledWith('/fixture/report.enc');
    });

    it('publishes an order-only EMR imaging upload with the original ordering physician', async () => {
        vi.spyOn(FileUpload, 'processUpload').mockResolvedValue({ filePath: '/fixture/report.enc', fileUrl: '/api/files/patient/imaging/report.pdf' });
        query.mockImplementation(async (sql, values) => {
            if (/FROM imaging_orders/.test(sql)) return { rows: [{ id: 'order', visit_id: 'visit', patient_id: 'patient', status: 'ordered', imaging_type: 'X-Ray', ordered_by: 'doctor' }] };
            if (/INSERT INTO medical_records/.test(sql)) return { rows: [{ id: 'record', patient_id: values[0], visit_id: values[1] }] };
            if (/INSERT INTO imaging_reports/.test(sql)) return { rows: [{ id: 'report', imaging_type: values[1], ordered_by: values[12] }] };
            if (/UPDATE imaging_orders/.test(sql)) return { rows: [] };
            throw new Error('Unexpected query');
        });
        const res = response();
        await EmrController.uploadImagingReport({ body: { orderId: 'order' }, user: { id: 'radiologist' }, clinicalContext: { patient_id: 'patient', visit_id: 'visit' }, file: { buffer: Buffer.from('%PDF-1.4') } }, res);
        expect(res.code).toBe(201);
        expect(res.body.data).toMatchObject({ id: 'report', imaging_type: 'x-ray', ordered_by: 'doctor' });
    });
});
