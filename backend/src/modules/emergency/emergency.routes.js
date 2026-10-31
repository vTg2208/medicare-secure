const express = require('express');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { asyncHandler } = require('../../middleware/error.middleware');
const { query, transaction } = require('../../config/db');
const { orgContext } = require('../../middleware/clinical-access.middleware');
const router = express.Router();
const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
router.use(authenticate, authorize('doctor'), orgContext);
router.get('/active', asyncHandler(async (req, res) => {
    const result = await query(`SELECT id,patient_id,expires_at FROM emergency_access_grants
        WHERE user_id=$1 AND organization_id=$2 AND status='active' AND expires_at>NOW() ORDER BY created_at DESC`, [req.user.id, req.organizationId]);
    res.json({ success: true, data: result.rows });
}));
router.post('/activate', asyncHandler(async (req, res) => {
    const { patientId, justification } = req.body;
    if (!uuid.test(patientId || '') || typeof justification !== 'string' || justification.trim().length < 20 || justification.length > 2000) {
        return res.status(400).json({ success: false, message: 'A valid patient ID and an emergency justification of 20–2000 characters are required' });
    }
    const grant = await transaction(async client => {
        const visit = (await client.query(`SELECT id FROM visits WHERE patient_id=$1 AND organization_id=$2
            AND status IN ('checked_in','in_progress') ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [patientId, req.organizationId])).rows[0];
        if (!visit) return null;
        const created = (await client.query(`INSERT INTO emergency_access_grants(user_id,patient_id,visit_id,organization_id,justification,expires_at)
            VALUES($1,$2,$3,$4,$5,NOW()+INTERVAL '60 minutes') RETURNING id,patient_id,expires_at`, [req.user.id, patientId, visit.id, req.organizationId, justification.trim()])).rows[0];
        await client.query(`INSERT INTO audit_logs(user_id,action,entity_type,entity_id,purpose,status_code,metadata)
            VALUES($1,'emergency_access','patient',$2,'Emergency read access',201,$3)`, [req.user.id, patientId, JSON.stringify({ patientId, organizationId: req.organizationId, grantId: created.id })]);
        await client.query(`INSERT INTO security_events(user_id,event_type,severity,description,metadata)
            VALUES($1,'suspicious_activity','high','Emergency record access requires compliance review',$2)`, [req.user.id, JSON.stringify({ patientId, grantId: created.id, organizationId: req.organizationId })]);
        await client.query(`INSERT INTO notifications(user_id,type,title,message,related_entity_type,related_entity_id)
            VALUES($1,'emergency_access','Emergency access activated','A doctor in your current care facility activated temporary read access. Your audit trail records this event.','emergency_access',$2)`, [patientId, created.id]);
        return created;
    });
    if (!grant) return res.status(403).json({ success: false, message: 'An active visit in your current care facility is required' });
    res.status(201).json({ success: true, data: grant, message: 'Patient-specific read access expires in 60 minutes. The patient has an in-app notification.' });
}));
router.post('/:id/revoke', asyncHandler(async (req, res) => {
    if (!uuid.test(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid grant identifier' });
    const result = await transaction(async client => {
        const grant = (await client.query(`UPDATE emergency_access_grants SET status='revoked' WHERE id=$1 AND user_id=$2 AND organization_id=$3 AND status='active' RETURNING patient_id`, [req.params.id, req.user.id, req.organizationId])).rows[0];
        if (grant) await client.query(`INSERT INTO audit_logs(user_id,action,entity_type,entity_id,purpose,metadata) VALUES($1,'emergency_access_revoked','patient',$2,'Emergency read access revoked',$3)`, [req.user.id, grant.patient_id, JSON.stringify({ patientId: grant.patient_id, organizationId: req.organizationId })]);
        return grant;
    });
    if (!result) return res.status(404).json({ success: false, message: 'Active grant not found' });
    res.json({ success: true });
}));
module.exports = router;
