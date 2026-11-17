const router = require('express').Router();
const mfa = require('../../services/mfa.service');
const { requireAuthenticationOrigin, sendAuthenticated } = require('../../services/auth-transport');
const { loginLimiter } = require('../../middleware/rateLimit.middleware');
const logger = require('../../utils/logger');
const { authenticate } = require('../../middleware/auth.middleware');

router.use(requireAuthenticationOrigin, loginLimiter);
const handle = operation => async (req, res) => {
    try {
        const result = await operation(req.headers['x-auth-challenge'], req);
        if (result.session) return sendAuthenticated(req, res, result);
        return res.json({ success: true, data: result });
    } catch (error) {
        if ([400, 401, 403, 429].includes(error.status)) return res.status(error.status).json({ success: false, message: error.message });
        logger.error('MFA operation unavailable', { code: error.code });
        return res.status(503).json({ success: false, message: 'Verification is temporarily unavailable. Please try again.' });
    }
};
router.post('/setup', handle((ticket, req) => mfa.startSetup(ticket, req)));
router.post('/setup/confirm', handle((ticket, req) => mfa.confirmSetup(ticket, req.body.code, req)));
router.post('/setup/acknowledge', handle((ticket, req) => mfa.acknowledgeSetup(ticket, req)));
router.post('/verify', handle((ticket, req) => mfa.verifyChallenge(ticket, req.body.code, req)));
router.post('/recover', handle((ticket, req) => mfa.recoverChallenge(ticket, req.body.code, req)));
router.post('/step-up', authenticate, handle((ticket, req) => mfa.authorizeStepUp(req.user.id, req.session.id, req.body.code, req)));
module.exports = router;
