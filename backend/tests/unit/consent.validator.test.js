const { validateConsentData, validateDataCategory } = require('../../src/utils/consent.validator');

const grant = () => ({ purpose: 'treatment', dataCategory: 'lab_results', accessLevel: 'read' });

it.each(['not-a-date', {}, 123])('rejects malformed consent start times: %s', startTime => {
    expect(validateConsentData({ ...grant(), startTime }).isValid).toBe(false);
});
it.each(['not-a-date', {}, 123])('rejects malformed consent expiry times: %s', endTime => {
    expect(validateConsentData({ ...grant(), endTime }).isValid).toBe(false);
});
it('supports both existing vitals category spellings', () => {
    expect(validateDataCategory('vital_signs').isValid).toBe(true);
    expect(validateDataCategory('vitals').isValid).toBe(true);
});
it('accepts an explicit unlimited expiry and rejects an expiry before the start', () => {
    expect(validateConsentData({ ...grant(), endTime: null }).isValid).toBe(true);
    expect(validateConsentData({ ...grant(), startTime: '2099-02-01', endTime: '2099-01-01' }).isValid).toBe(false);
});
