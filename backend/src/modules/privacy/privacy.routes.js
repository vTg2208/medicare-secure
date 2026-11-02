const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/rbac.middleware');
const { asyncHandler } = require('../../middleware/error.middleware');
const service = require('./privacy-rights.service');
const exportLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, keyGenerator: req => req.user.id,
    standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many export attempts. Try again after 15 minutes.' } });
router.use(authenticate);
router.get('/controls', requireRole('patient'), asyncHandler(async (req,res) => {
    const result = await require('../../config/db').query('SELECT id,purpose,created_at FROM patient_processing_controls WHERE patient_id=$1 AND released_at IS NULL ORDER BY created_at,id',[req.user.id]);
    res.json({success:true,data:result.rows});
}));
router.post('/controls/release', requireRole('patient'), asyncHandler(async (req,res) => {
    if (Object.keys(req.body || {}).some(key=>key!=='controlId') || !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(req.body?.controlId || '')) return res.status(400).json({success:false,message:'A valid processing control is required'});
    const control = await require('../../config/db').transaction(async client => {
        const row = (await client.query('UPDATE patient_processing_controls SET released_at=NOW(),released_by=$1 WHERE id=$2 AND patient_id=$1 AND released_at IS NULL RETURNING id,purpose',[req.user.id,req.body.controlId])).rows[0];
        if (!row) return null;
        await require('../../services/audit.service').logAuditEvent({userId:req.user.id,action:'release_processing_restriction',entityType:'patient',entityId:req.user.id,purpose:'patient_request',metadata:{patientId:req.user.id,controlId:row.id}},client);
        return row;
    });
    if (!control) return res.status(404).json({success:false,message:'Active processing control not found'});
    req.auditEventRecorded = true;
    res.json({success:true,data:control});
}));
router.get('/requests', requireRole('patient'), asyncHandler(async (req, res) => res.json({ success: true, data: await service.listRequests(req) })));
router.post('/requests', requireRole('patient'), asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await service.createRequest(req) })));
router.get('/review', requireRole('compliance_officer'), asyncHandler(async (req, res) => res.json({ success: true, data: await service.listRequests(req, true) })));
router.put('/requests/:id', requireRole('compliance_officer'), asyncHandler(async (req, res) => res.json({ success: true, data: await service.updateRequest(req) })));
router.post('/requests/:id/export', requireRole('patient'), exportLimiter, asyncHandler(async (req,res) => {
    const result = await service.exportPatient(req, { requestId: req.params.id });
    res.set('Content-Disposition', 'attachment; filename="patient-information.json"');
    res.json({ success: true, ...result });
}));
router.post('/requests/:id/receipts/:receiptId/confirm', requireRole('patient'), asyncHandler(async (req,res) => {
    res.json({ success: true, data: await require('./fulfillment-evidence.service').confirmReceipt(req) });
}));
router.post('/export', requireRole('patient'), exportLimiter, asyncHandler(async (req, res) => {
    const data = await service.exportPatient(req);
    res.set('Content-Disposition', 'attachment; filename="patient-information.json"');
    res.json({ success: true, data });
}));
module.exports = router;
