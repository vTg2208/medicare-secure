const mockModule = (path, exports) => {
    const resolved = require.resolve(path);
    require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
};
const query = vi.fn();
mockModule('../../src/config/db', { query, transaction: callback => callback({ query }) });
const LabOrder = require('../../src/models/lab_order.model');
const ImagingOrder = require('../../src/models/imaging_order.model');
const Workflow = require('../../src/modules/workflow/workflow.controller');
const response = () => ({ status: vi.fn(function(code) { this.code = code; return this; }), json: vi.fn(function(body) { this.body = body; return this; }) });

describe.each([
    ['lab', LabOrder, 'labResultId', 'lab_result_id', 'lab_orders'],
    ['imaging', ImagingOrder, 'imagingReportId', 'imaging_report_id', 'imaging_orders'],
])('%s order transitions', (kind, Model, resultKey, resultColumn, table) => {
    beforeEach(() => { query.mockReset(); });

    it.each(['completed', 'cancelled'])('does not reopen a %s order', async status => {
        query.mockResolvedValue({ rows: [{ id: 'order', visit_id: 'visit', status }] });
        await expect(Model.updateStatus('order', 'in_progress')).rejects.toMatchObject({ statusCode: 409 });
    });

    it('cannot claim completion without a published result', async () => {
        query.mockResolvedValue({ rows: [{ id: 'order', visit_id: 'visit', status: 'ordered' }] });
        await expect(Model.updateStatus('order', 'completed')).rejects.toMatchObject({ statusCode: 409 });
    });

    it('rejects attaching a result from another visit', async () => {
        query.mockImplementation(async sql => ({ rows: /FOR UPDATE/.test(sql) ? [{ id: 'order', visit_id: 'visit', status: 'ordered' }] : [] }));
        await expect(Model.updateStatus('order', 'completed', { [resultKey]: 'foreign-result' })).rejects.toMatchObject({ statusCode: 400 });
    });

    it('publishes a matching result and derives completion time on the server', async () => {
        let saved = { id: 'order', visit_id: 'visit', status: 'ordered' };
        query.mockImplementation(async (sql, values) => {
            if (/FOR UPDATE/.test(sql)) return { rows: [saved] };
            if (sql.startsWith(`UPDATE ${table}`)) { saved = { ...saved, status: values[0], [resultColumn]: values[1] }; return { rows: [saved] }; }
            return { rows: [{ id: 'matching-result' }] };
        });
        expect(await Model.updateStatus('order', 'completed', { [resultKey]: 'matching-result', performed_at: '1900-01-01', result_available_at: '1900-01-01' }))
            .toMatchObject({ status: 'completed', [resultColumn]: 'matching-result' });
        expect(query.mock.calls.filter(([sql]) => sql.startsWith(`UPDATE ${table}`))[0][1]).not.toContain('1900-01-01');
    });

    it('surfaces completion conflicts through the workflow API', async () => {
        query.mockResolvedValue({ rows: [{ id: 'order', visit_id: 'visit', status: 'ordered' }] });
        const res = response();
        const handler = kind === 'lab' ? Workflow.updateLabOrderStatus : Workflow.updateImagingOrderStatus;
        await handler({ params: { id: 'order' }, body: { status: 'completed' } }, res);
        expect(res.code).toBe(409);
    });
});
