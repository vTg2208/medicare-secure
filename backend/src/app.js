const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { timingSafeEqual } = require('crypto');
const config = require('./config/env');
const { query } = require('./config/db');
const { assertSchemaReady } = require('./services/readiness.service');
const { errorHandler, notFoundHandler, asyncHandler } = require('./middleware/error.middleware');
const { apiLimiter } = require('./middleware/rateLimit.middleware');
const { demoGuard, deploymentInfo } = require('./middleware/demo.middleware');
const { metricsMiddleware, trackConnections, metricsEndpoint } = require('./middleware/metrics');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', config.trustProxy);
app.use(helmet());
app.use(cors({ origin: config.cors.origin, credentials: false }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use(trackConnections);
app.use(metricsMiddleware);

app.get('/health', (req, res) => res.json({ success: true, message: 'Healthcare API is running' }));
app.get('/readyz', asyncHandler(async (req, res) => {
    try {
        await query('SELECT 1');
        await assertSchemaReady();
        res.json({ success: true });
    } catch {
        res.status(503).json({ success: false, message: 'Service is not ready' });
    }
}));

// Scrapers use a separate token; metrics are never reverse-proxied to the public.
app.get('/metrics', (req, res, next) => {
    if (config.nodeEnv !== 'production') return next();
    const expected = process.env.METRICS_TOKEN;
    const supplied = (req.headers.authorization || '').replace(/^Bearer /, '');
    if (!expected || Buffer.byteLength(expected) !== Buffer.byteLength(supplied) ||
        !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) return res.sendStatus(404);
    next();
}, metricsEndpoint);

app.use('/api', apiLimiter);
app.use('/api', demoGuard);
app.get(['/api/public/deployment', `/api/${config.apiVersion}/public/deployment`], deploymentInfo);
const routes = {
    auth: './modules/auth/auth.routes', users: './modules/users/user.routes',
    consent: './modules/consent/consent.routes', emr: './modules/emr/emr.routes',
    workflow: './modules/workflow/workflow.routes', audit: './modules/audit/audit.routes',
    patient: './modules/patient/patient.routes', chatbot: './modules/chatbot/chatbot.routes',
    staff: './modules/staff/staff.routes', nurse: './modules/nurse/nurse.routes',
    'doctors/verification': './modules/doctors/doctor.verification.routes',
    radiology: './modules/radiology/radiology.routes', pharmacist: './modules/pharmacist/pharmacist.routes',
    insurance: './modules/insurance/insurance.routes', compliance: './modules/compliance/compliance.routes',
    lab: './modules/lab/lab.routes', visits: './modules/visit/visit.routes', admin: './modules/admin/admin.routes',
    files: './modules/files/files.routes',
    research: './modules/research/research.routes',
    emergency: './modules/emergency/emergency.routes',
};
for (const [prefix, source] of Object.entries(routes)) {
    const router = require(source);
    app.use(`/api/${config.apiVersion}/${prefix}`, router);
    app.use(`/api/${prefix}`, router);
}
app.get(['/api/public/stats', `/api/${config.apiVersion}/public/stats`], asyncHandler(async (req, res) => {
    const result = await query("SELECT COUNT(*)::int AS count FROM organizations WHERE status='active' AND verified=true");
    res.json({ success: true, data: { hospitalsCount: result.rows[0].count, patientsManaged: null } });
}));
app.use(notFoundHandler);
app.use(errorHandler);
module.exports = app;
