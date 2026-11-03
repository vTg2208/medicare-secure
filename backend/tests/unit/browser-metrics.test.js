const express = require('express');
const request = require('supertest');
const app = express();
app.use(express.json());
app.use('/performance', require('../../src/modules/performance/performance.routes'));
const { register } = require('../../src/middleware/metrics');

test('collects anonymous web vitals as aggregate histograms', async () => {
    for (const [name, value] of [['LCP', 2500], ['INP', 200], ['CLS', 0.1]]) {
        const response = await request(app).post('/performance').send({ name, value });
        expect(response.status).toBe(204);
        expect(response.text).toBe('');
    }
    const lcp = await register.getSingleMetric('browser_lcp_seconds').get();
    expect(lcp.values.find(value => value.metricName === 'browser_lcp_seconds_sum').value).toBe(2.5);
});
test('rejects unbounded metrics and additional fields without retaining attribution', async () => {
    for (const body of [{ name: '__proto__', value: 2 }, { name: 'CLS', value: -1 }, { name: 'LCP', value: 99999999 },
        { name: 'INP', value: '200' }, { name: 'LCP', value: 200, patientId: 'private' }]) {
        expect((await request(app).post('/performance').send(body)).status).toBe(400);
    }
});
