const crypto = require('crypto');
const mockModule = (name, exports) => {
    const id = require.resolve(name);
    require.cache[id] = { id, filename: id, loaded: true, exports };
};
const query = vi.fn();
const token = 'revoked-access-token';
mockModule('../../src/config/db', { query });
mockModule('../../src/config/jwt', { verifyAccessToken: () => ({ userId: 'u1' }) });
mockModule('../../src/models/user.model', { findUserById: vi.fn() });
mockModule('../../src/services/audit.service', { createAuditLog: vi.fn() });
mockModule('../../src/services/device.service', {
    captureDeviceInfo: () => ({}), validateDevice: vi.fn(), flagSuspiciousDevice: vi.fn(),
});
mockModule('../../src/services/violation.service', { detectSuspiciousPatterns: vi.fn() });
const { authenticate } = require('../../src/middleware/auth.middleware');

it('looks up the presented token, so a different active session cannot revive a revoked token', async () => {
    query.mockResolvedValue({ rows: [] });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    await authenticate(req, res, next);
    expect(query.mock.calls[0][0]).toContain('token_hash = $2');
    expect(query.mock.calls[0][1].slice(0, 2)).toEqual(['u1', crypto.createHash('sha256').update(token).digest('hex')]);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
});
