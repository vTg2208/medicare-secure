const mockModule = (name, exports) => {
    const id = require.resolve(name);
    require.cache[id] = { id, filename: id, loaded: true, exports };
};
const model = { findById: vi.fn(), approveVisit: vi.fn(), getFullDetails: vi.fn() };
const sendApproval = vi.fn();
mockModule('../../src/models/visit.model', model);
mockModule('../../src/services/visit-consent.service', {});
mockModule('../../src/config/db', {});
mockModule('../../src/utils/logger', { info() {}, error() {} });
mockModule('../../src/config/mail', { sendVisitApprovalEmail: sendApproval });
const controller = require('../../src/modules/visit/visit.controller');

it.each([true, false])('reports visit approval email delivery accurately when sent=%s', async (sent) => {
    model.findById.mockResolvedValue({ assigned_doctor_id: 'doctor-fixture' });
    model.approveVisit.mockResolvedValue({ id: 'visit-fixture', otp_code: '123456' });
    model.getFullDetails.mockResolvedValue({ patient_email: 'fixture@example.test' });
    if (sent) sendApproval.mockResolvedValue({});
    else sendApproval.mockRejectedValue(Object.assign(new Error('Email unavailable'), { statusCode: 503 }));
    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };
    await controller.approveVisit({ params: { id: 'visit-fixture' }, body: {} }, res);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0]).toMatchObject({ success: true, data: { id: 'visit-fixture', otp: '123456', emailDelivery: sent ? 'sent' : 'failed' } });
    const message = res.json.mock.calls[0][0].message;
    if (sent) expect(message).toContain('Approval email sent');
    else { expect(message).toContain('Email delivery is unavailable'); expect(message).not.toContain('email sent'); }
});
