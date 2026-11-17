const query = vi.fn();
const dbPath = require.resolve('../../src/config/db');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { query } };
delete require.cache[require.resolve('../../src/modules/compliance/compliance.controller')];
const { getDashboardStats } = require('../../src/modules/compliance/compliance.controller');
const snapshot = { auth_anomalies: 0, open_incidents: 2, pending_reviews: 1, investigating_incidents: 1,
    critical_incidents: 1, high_incidents: 0, active_overrides: 0, generated_at: '2026-11-17T08:00:00Z', recent_incidents: [] };
const call = async row => {
    query.mockResolvedValue({ rows: [row] });
    const res = { json: vi.fn() }; const next = vi.fn();
    await getDashboardStats({}, res, next);
    expect(next).not.toHaveBeenCalled();
    return res.json.mock.calls[0][0].data;
};
it('uses a coherent snapshot and distinguishes unreviewed from investigating cases', async () => {
    const result = await call(snapshot);
    expect(query).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ openIncidents: 2, pendingReviews: 1, investigatingIncidents: 1, criticalIncidents: 1,
        generatedAt: snapshot.generated_at, securityStatus: 'critical', recentIncidents: [], complianceScore: null });
});
it('reports review required for noncritical incidents, overrides or authentication anomalies', async () => {
    for (const values of [{ open_incidents: 1 }, { active_overrides: 1 }, { auth_anomalies: 1 }]) {
        const result = await call({ ...snapshot, open_incidents: 0, critical_incidents: 0, ...values });
        expect(result.securityStatus).toBe('attention');
    }
});
it('reports no open alerts only for a snapshot with no current signals', async () => {
    const result = await call({ ...snapshot, open_incidents: 0, critical_incidents: 0, pending_reviews: 0, investigating_incidents: 0 });
    expect(result.securityStatus).toBe('clear');
});
it('propagates database failures instead of returning reassuring zeros', async () => {
    const error = new Error('unavailable'); query.mockRejectedValue(error);
    const res = { json: vi.fn() }; const next = vi.fn();
    await getDashboardStats({}, res, next);
    expect(next).toHaveBeenCalledWith(error);
    expect(res.json).not.toHaveBeenCalled();
});
