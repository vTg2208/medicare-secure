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
  metricsEndpoint
};
