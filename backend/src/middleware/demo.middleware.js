const config = require('../config/env');

const disabledFeatures = Object.freeze([
    'registration', 'email', 'staffInvitations', 'staffOnboarding',
    'passkeyRegistration', 'uploads', 'aiTriage',
]);
const blockedWrites = [
    /^\/auth\/register\/(patient|doctor|organization)$/,
    /^\/auth\/resend-otp$/,
    /^\/auth\/passkey\/register\/(options|verify)$/,
    /^\/staff\/invite$/,
    /^\/staff\/invitations\/[^/]+\/(resend|accept)$/,
    /^\/users\/staff\/onboard$/,
];

// Mount before all API routers, especially multer disk upload handlers.
const demoGuard = (req, res, next) => {
    if (!config.demo || ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    // Nested Express mounts can consume an extra separator (e.g. /auth//register).
    // Keep percent-encoded parameter values intact: Express decodes parameters,
    // but does not decode literal route segments or treat encoded slashes as separators.
    let path = req.path.toLowerCase().replace(/\/{2,}/g, '/').replace(/\/$/, '');
    const version = `/${config.apiVersion.toLowerCase()}`;
    if (path.startsWith(`${version}/`)) path = path.slice(version.length);
    if (req.is('multipart/*') || blockedWrites.some(pattern => pattern.test(path))) {
        return res.status(503).json({
            success: false,
            code: 'DEMO_FEATURE_DISABLED',
            message: 'This feature is unavailable in the public demo. Use an existing demo account and synthetic data.',
        });
    }
    next();
};

const deploymentInfo = (req, res) => res.json({
    success: true,
    data: { demo: config.demo, disabledFeatures: config.demo ? disabledFeatures : [] },
});

module.exports = { demoGuard, deploymentInfo };
