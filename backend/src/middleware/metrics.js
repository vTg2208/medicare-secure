/**
 * Prometheus Metrics Middleware
 * Industry-standard HTTP metrics + Node.js defaults
 */

const promClient = require('prom-client');
const responseTime = require('response-time');

// Create a Registry
const register = new promClient.Registry();

// Default metrics (CPU, memory, event loop, etc.)
promClient.collectDefaultMetrics({ 
  register,
  prefix: 'nodejs_'
});

// ═══════════════════════════════════════════════════════
// HTTP Metrics (Standard)
// ═══════════════════════════════════════════════════════

const httpRequestCounter = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
});

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register]
});

const activeConnections = new promClient.Gauge({
  name: 'http_active_connections',
  help: 'Number of active HTTP connections',
  registers: [register]
});

const auditLogErrors = new promClient.Counter({
  name: 'audit_log_errors_total',
  help: 'Audit insert failures, including clinical transactions rolled back by audit enforcement',
  registers: [register],
});
const recordAuditError = () => auditLogErrors.inc();
// Aggregate browser measurements only: never label by user, URL or record.
const browserVitals = {
  LCP: { max: 120000, scale: 1000, histogram: new promClient.Histogram({ name: 'browser_lcp_seconds', help: 'Browser Largest Contentful Paint', buckets: [1, 2.5, 4, 8, 15, 30, 60], registers: [register] }) },
  INP: { max: 60000, scale: 1000, histogram: new promClient.Histogram({ name: 'browser_inp_seconds', help: 'Browser Interaction to Next Paint', buckets: [.1, .2, .5, 1, 2, 5, 10], registers: [register] }) },
  CLS: { max: 100, scale: 1, histogram: new promClient.Histogram({ name: 'browser_cls', help: 'Browser Cumulative Layout Shift', buckets: [.01, .05, .1, .25, .5, 1, 5], registers: [register] }) },
};
const recordBrowserVital = body => {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 2 ||
      !Object.hasOwn(body, 'name') || !Object.hasOwn(body, 'value') || typeof body.name !== 'string' || !Object.hasOwn(browserVitals, body.name)) return false;
  const { max, scale, histogram } = browserVitals[body.name];
  if (typeof body.value !== 'number' || !Number.isFinite(body.value) || body.value < 0 || body.value > max) return false;
  histogram.observe(body.value / scale);
  return true;
};

// ═══════════════════════════════════════════════════════
// Middleware
// ═══════════════════════════════════════════════════════

const metricsMiddleware = responseTime((req, res, time) => {
  if (req.route) {
    const labels = {
      method: req.method,
      route: req.route.path || req.path,
      status: res.statusCode
    };
    
    httpRequestCounter.inc(labels);
    httpRequestDuration.observe(labels, time / 1000);
  }
});

const trackConnections = (req, res, next) => {
  activeConnections.inc();
  res.once('close', () => activeConnections.dec());
  next();
};

const metricsEndpoint = async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).end(error.message);
  }
};

module.exports = {
  register,
  metricsMiddleware,
  trackConnections,
  metricsEndpoint,
  recordAuditError,
  recordBrowserVital
};
