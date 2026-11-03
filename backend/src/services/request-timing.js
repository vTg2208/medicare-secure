const { AsyncLocalStorage } = require('node:async_hooks');
const { performance } = require('node:perf_hooks');

const timings = new AsyncLocalStorage();
const adminRoles = new Set(['hospital_admin', 'system_admin']);

function requestTiming(apiVersion) {
    const login = new Set(['/api/auth/login', `/api/${apiVersion}/auth/login`]);
    const audit = new Set(['/api/audit/logs', `/api/${apiVersion}/audit/logs`]);
    return (req, res, next) => {
        if (req.get('X-Performance-Trace') !== '1') return next();
        const isLogin = req.method === 'POST' && login.has(req.path);
        if (!isLogin && !(req.method === 'GET' && audit.has(req.path))) return next();

        const started = performance.now();
        const phases = new Map();
        const json = res.json.bind(res);
        res.json = data => {
            const role = isLogin ? data?.data?.user?.role : req.user?.roleName;
            if (res.statusCode === 200 && data?.success === true && adminRoles.has(role)) {
                phases.set('app', performance.now() - started);
                res.set('Server-Timing', [...phases].map(([name, duration]) => `${name};dur=${duration.toFixed(1)}`).join(', '));
            }
            return json(data);
        };
        return timings.run(phases, next);
    };
}

function measurePhase(name, operation) {
    const phases = timings.getStore();
    if (!phases) return operation();
    return (async () => {
        const started = performance.now();
        try {
            return await operation();
        } finally {
            phases.set(name, (phases.get(name) ?? 0) + performance.now() - started);
        }
    })();
}

// Detached security checks do not contribute to the response's critical path.
function outsideRequestTiming(operation) {
    return timings.getStore() ? timings.run(null, operation) : operation();
}

module.exports = { requestTiming, measurePhase, outsideRequestTiming };
