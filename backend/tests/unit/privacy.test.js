const { redactSensitive } = require('../../src/utils/redact');
it('redacts nested credentials and clinical text without mutating the request', () => {
    const body = { metadata: { password: 'secret', access_token: 'token' }, records: [{ diagnosis: 'private' }], count: 2 };
    const result = redactSensitive(body);
    expect(result.metadata.password).toBe('[REDACTED]');
    expect(result.metadata.access_token).toBe('[REDACTED]');
    expect(result.records[0].diagnosis).toBe('[REDACTED]');
    expect(result.count).toBe(2);
    expect(body.metadata.password).toBe('secret');
});
