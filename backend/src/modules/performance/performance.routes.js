const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { recordBrowserVital } = require('../../middleware/metrics');

router.post('/', rateLimit({ windowMs: 60000, limit: 30, standardHeaders: true, legacyHeaders: false }), (req, res) => {
    if (!recordBrowserVital(req.body)) return res.status(400).json({ success: false, message: 'Invalid performance measurement' });
    res.status(204).end();
});
module.exports = router;
