const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/rbac.middleware');
const { asyncHandler } = require('../../middleware/error.middleware');
const service = require('./privacy-rights.service');
const exportLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, keyGenerator: req => req.user.id,
    standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many export attempts. Try again after 15 minutes.' } });
router.use(authenticate);
router.get('/requests', requireRole('patient'), asyncHandler(async (req, res) => res.json({ success: true, data: await service.listRequests(req) })));
router.post('/requests', requireRole('patient'), asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await service.createRequest(req) })));
router.get('/review', requireRole('compliance_officer'), asyncHandler(async (req, res) => res.json({ success: true, data: await service.listRequests(req, true) })));
router.put('/requests/:id', requireRole('compliance_officer'), asyncHandler(async (req, res) => res.json({ success: true, data: await service.updateRequest(req) })));
router.post('/export', requireRole('patient'), exportLimiter, asyncHandler(async (req, res) => {
    const data = await service.exportPatient(req);
    res.set('Content-Disposition', 'attachment; filename="patient-information.json"');
    res.json({ success: true, data });
}));
module.exports = router;
