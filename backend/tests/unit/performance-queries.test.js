const mockModule = (path, exports) => {
    const resolved = require.resolve(path);
    require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
};
const query = vi.fn();
const unseal = vi.fn(value => JSON.parse(value));
mockModule('../../src/config/db', { query });
mockModule('../../src/services/audit.service', { logAuditEvent: vi.fn() });
mockModule('../../src/modules/privacy/privacy-crypto', { unseal, seal: JSON.stringify });
const { listBreaches } = require('../../src/modules/compliance/breach.service');
const assessment = { discoveredAt: '2026-01-01T00:00:00.000Z', regimes: ['gdpr'], gdprRole: 'controller', riskLevel: 'risk' };
const fixture = index => ({ incident_id: `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`,
    status: 'Open', severity: 'high', assessment_version: 2, assessment_ciphertext: JSON.stringify(assessment) });

function database(rows, notifications = []) {
    query.mockImplementation(async (sql, params) => {
        if (/FROM breach_notification_log/.test(sql)) return { rows: notifications.filter(n => Array.isArray(params[0]) ? params[0].includes(n.incident_id) : n.incident_id === params[0]) };
        if (/SELECT incident_id FROM privacy_breaches/.test(sql)) return { rows };
        if (/FROM privacy_breaches b/.test(sql)) return { rows: /b.incident_id=\$1/.test(sql) ? rows.filter(r => r.incident_id === params[0]) : rows };
        throw Error('Unexpected query');
    });
}
beforeEach(() => { query.mockReset(); unseal.mockClear(); });

test.each([1, 50])('breach list uses two reads for %i cases', async count => {
    database(Array.from({ length: count }, (_, i) => fixture(i)));
    const result = await listBreaches({ query: {} });
    expect(result.cases).toHaveLength(count);
    expect(query).toHaveBeenCalledTimes(2);
    expect(result.hasMore).toBe(false);
    expect(result.cases[0].assessment).toEqual({ discoveredAt: assessment.discoveredAt, regimes: ['gdpr'] });
});
test('uses a lookahead row without reading notifications for the next page', async () => {
    database(Array.from({ length: 51 }, (_, i) => fixture(i)));
    const result = await listBreaches({ query: { page: '2' } });
    expect(result.cases).toHaveLength(50);
    expect(result.hasMore).toBe(true);
    expect(query.mock.calls[0][1]).toEqual([50]);
    expect(query.mock.calls[1][1][0]).toHaveLength(50);
});
test('summarizes current-version notices without loading or decrypting their private evidence', async () => {
    const row = fixture(1);
    database([row], [{ incident_id: row.incident_id, assessment_version: 1, regime: 'gdpr', audience: 'authority', status: 'sent' },
        { incident_id: row.incident_id, assessment_version: 2, regime: 'gdpr', audience: 'authority', status: 'failed' }]);
    const result = await listBreaches({ query: {} });
    expect(result.cases[0].obligations.find(o => o.audience === 'authority').status).toBe('overdue');
    expect(query.mock.calls[1][0]).not.toMatch(/SELECT \*|evidence_ciphertext/);
    expect(unseal).toHaveBeenCalledTimes(1);
    expect(result.cases[0]).not.toHaveProperty('notifications');
});
test('empty breach page skips notification reads', async () => {
    database([]);
    expect(await listBreaches({ query: {} })).toEqual({ cases: [], page: 1, hasMore: false });
    expect(query).toHaveBeenCalledTimes(1);
});
