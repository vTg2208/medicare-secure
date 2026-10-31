const crypto = require('crypto');
const query = vi.fn();
const client = { query };
const id = require.resolve('../../src/config/db');
require.cache[id] = { id, filename: id, loaded: true, exports: { query, transaction: callback => callback(client) } };
const mailId = require.resolve('../../src/config/mail');
require.cache[mailId] = { id: mailId, filename: mailId, loaded: true, exports: { sendOTPEmail: vi.fn() } };
const { verifyOTP } = require('../../src/services/otp.service');
beforeEach(() => query.mockReset());
it('checks only the latest challenge and records a wrong attempt before returning failure', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'otp1', user_id: 'u1', attempts: 0,
        otp_hash: crypto.createHash('sha256').update('654321').digest('hex'), expires_at: new Date(Date.now() + 60000) }] })
        .mockResolvedValueOnce({ rows: [] });
    await expect(verifyOTP({ email: 'fixture@example.test', otp: '123456', purpose: 'registration' })).rejects.toThrow('Invalid OTP');
    expect(query.mock.calls[0][0]).toContain('FOR UPDATE');
    expect(query.mock.calls[0][0]).not.toContain('otp_hash = $2');
    expect(query.mock.calls[1][0]).toContain('attempts = attempts + 1');
});
it('rejects an exhausted challenge even when the code matches', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'otp1', user_id: 'u1', attempts: 3,
        otp_hash: crypto.createHash('sha256').update('654321').digest('hex'), expires_at: new Date(Date.now() + 60000) }] });
    await expect(verifyOTP({ email: 'fixture@example.test', otp: '654321', purpose: 'registration' })).rejects.toThrow('Maximum OTP');
    expect(query).toHaveBeenCalledTimes(1);
});
