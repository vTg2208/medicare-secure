const mockModule = (modulePath, exports) => {
    const resolved = require.resolve(modulePath);
    require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
};
const query = vi.fn();
mockModule('../../src/config/db', { query });
mockModule('../../src/utils/logger', { debug: vi.fn(), error: vi.fn(), warn: vi.fn() });
delete require.cache[require.resolve('../../src/services/audit.service')];
const { logAuditEvent, createAuditLog } = require('../../src/services/audit.service');

it('uses the supplied transaction for a durable audit event and redacts clinical metadata', async () => {
    const rows = [];
    const client = { query: async (sql, params) => {
        expect(sql).toContain('INSERT INTO audit_logs');
        rows.push({ action: params[1], metadata: JSON.parse(params[10]) });
        return { rows: [{ id: 'durable-event' }] };
    } };
    const result = await logAuditEvent({ action: 'privacy_request', metadata: { notes: 'private clinical text', patientId: 'patient-id' } }, client);
    expect(result.id).toBe('durable-event');
    expect(rows).toEqual([{ action: 'privacy_request', metadata: { notes: '[REDACTED]', patientId: 'patient-id' } }]);
    expect(query).not.toHaveBeenCalled();
});

it('propagates strict audit failure while preserving the legacy return-null contract', async () => {
    query.mockRejectedValue(new Error('audit storage unavailable'));
    await expect(logAuditEvent({ action: 'view_medical_record' })).rejects.toThrow('audit storage unavailable');
    await expect(createAuditLog({ action: 'legacy_event' })).resolves.toBeNull();
});

it('fails closed if the insert does not return durable evidence', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await expect(logAuditEvent({ action: 'view_medical_record' })).rejects.toThrow('not stored');
});
