const router = require('express').Router();
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/rbac.middleware');
const { asyncHandler } = require('../../middleware/error.middleware');
const { auditLog } = require('../../middleware/audit.middleware');
const service = require('./notices.service');
router.get('/current',asyncHandler(async (req,res) => res.json({ success:true,data:await service.getCurrent() })));
router.get('/versions/:id',asyncHandler(async (req,res) => res.json({ success:true,data:await service.getVersion(req.params.id) })));
router.post('/versions',authenticate,requireRole('compliance_officer'),asyncHandler(async (req,res) => res.status(201).json({ success:true,data:await service.publish(req) })));
router.get('/versions',authenticate,requireRole('compliance_officer'),auditLog('review_privacy_notice_publications','privacy_notice'),asyncHandler(async (req,res) => res.json({ success:true,data:await service.publicationHistory(req.query) })));
router.get('/acknowledgements',authenticate,requireRole('patient'),auditLog('read_privacy_notice_receipts','patient'),asyncHandler(async (req,res) => {
    if (Object.keys(req.query).length) return res.status(400).json({ success:false,message:'Notice history always belongs to the signed-in patient' });
    res.json({ success:true,data:await service.history(req) });
}));
router.post('/acknowledgements',authenticate,requireRole('patient'),asyncHandler(async (req,res) => res.json({ success:true,data:await service.acknowledge(req) })));
module.exports = router;
