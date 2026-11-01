const router = require('express').Router();
const { randomUUID } = require('node:crypto');
const db = require('../../config/db');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { clinicalScopeSql } = require('../../middleware/clinical-access.middleware');
const { asyncHandler } = require('../../middleware/error.middleware');
const { seal, unseal } = require('../privacy/privacy-crypto');
const { logAuditEvent } = require('../../services/audit.service');
const rateLimit = require('express-rate-limit');
const { processingAllowedSql } = require('../privacy/processing-policy');

router.use(authenticate, authorize(['patient', 'doctor', 'nurse']));
const fault = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const uuid = value => { if (!/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value || '')) throw fault(400, 'Invalid conversation identifier'); return value; };
const careScope = (patient, provider) => `(${processingAllowedSql(patient,'messaging')} AND ${clinicalScopeSql(patient, null, provider, 'doctor', 'clinical_notes')})`;
const permitted = async (client, patient, provider) => Boolean((await client.query(`SELECT u.id FROM users u JOIN roles r ON r.id=u.role_id
    WHERE u.id=$2 AND r.name IN ('doctor','nurse') AND u.status='active' AND COALESCE(u.account_status,'active')='active'
    AND ${careScope('$1', '$2')}`, [patient, provider])).rowCount);
const threadFor = async (client, req, lock = false) => {
    const thread = (await client.query(`SELECT * FROM care_message_threads WHERE id=$1 ${lock ? 'FOR UPDATE' : ''}`, [uuid(req.params.id)])).rows[0];
    if (!thread || ![thread.patient_id, thread.provider_id].includes(req.user.id)) throw fault(404, 'Conversation not found');
    if (req.user.roleName !== 'patient' && !await permitted(client, thread.patient_id, thread.provider_id)) throw fault(403, 'Current patient consent and assigned care are required');
    return thread;
};
const event = (req, action, thread, id = thread.id) => ({ userId: req.user.id, action, entityType: 'care_message', entityId: id,
    purpose: 'treatment', statusCode: 200, metadata: { patientId: thread.patient_id, threadId: thread.id, requestId: req.requestId } });

router.get('/contacts', asyncHandler(async (req, res) => {
    const patient = req.user.roleName === 'patient';
    const result = await db.query(`SELECT DISTINCT u.id, concat_ws(' ',u.first_name,u.last_name) AS name,r.name AS role
        FROM users u JOIN roles r ON r.id=u.role_id
        WHERE u.status='active' AND ${patient ? "r.name IN ('doctor','nurse')" : "r.name='patient'"}
        AND ${patient ? careScope('$1', 'u.id') : careScope('u.id', '$1')}
        ORDER BY name,u.id LIMIT 200`, [req.user.id]);
    res.json({ success: true, data: result.rows });
}));
router.get('/threads', asyncHandler(async (req, res) => {
    const patient = req.user.roleName === 'patient';
    const result = await db.query(`SELECT t.id,t.patient_id,concat_ws(' ',u.first_name,u.last_name) AS name,
        COALESCE((SELECT MAX(m.created_at) FROM care_messages m WHERE m.thread_id=t.id),t.created_at) AS updated_at
        FROM care_message_threads t JOIN users u ON u.id=${patient ? 't.provider_id' : 't.patient_id'}
        WHERE ${patient ? 't.patient_id=$1' : `t.provider_id=$1 AND ${careScope('t.patient_id', '$1')}`}
        ORDER BY updated_at DESC,t.id LIMIT 200`, [req.user.id]);
    res.json({ success: true, data: result.rows });
}));
router.post('/threads', asyncHandler(async (req, res) => {
    if (Object.keys(req.body || {}).some(key => key !== 'recipientId')) throw fault(400, 'Only the recipient may be supplied');
    const recipient = uuid(req.body?.recipientId);
    const patient = req.user.roleName === 'patient' ? req.user.id : recipient;
    const provider = req.user.roleName === 'patient' ? recipient : req.user.id;
    const thread = await db.transaction(async client => {
        if (!await permitted(client, patient, provider)) throw fault(403, 'Current patient consent and assigned care are required');
        return (await client.query(`INSERT INTO care_message_threads(patient_id,provider_id) VALUES($1,$2)
            ON CONFLICT(patient_id,provider_id) DO UPDATE SET patient_id=EXCLUDED.patient_id RETURNING id,patient_id,provider_id`, [patient, provider])).rows[0];
    });
    res.status(201).json({ success: true, data: thread });
}));
router.get('/threads/:id/messages', asyncHandler(async (req, res) => {
    const before = req.query.before;
    if (before !== undefined && !/^[1-9]\d{0,17}$/.test(before)) throw fault(400, 'Invalid message cursor');
    const data = await db.transaction(async client => {
        const thread = await threadFor(client, req);
        const messages = (await client.query(`SELECT id,sequence,sender_id,body_cipher,created_at FROM care_messages WHERE thread_id=$1
            ${before ? 'AND sequence<$2::bigint' : ''} ORDER BY sequence DESC LIMIT 51`, before ? [thread.id, before] : [thread.id])).rows;
        const canSend = await permitted(client, thread.patient_id, thread.provider_id);
        await logAuditEvent(event(req, 'read_care_messages', thread), client);
        return { patient_id: thread.patient_id, canSend, hasMore: messages.length > 50,
            messages: messages.slice(0, 50).reverse().map(({ body_cipher, ...message }) => ({ ...message, body: unseal(body_cipher, `care-message:${message.id}`) })) };
    });
    req.auditEventRecorded = true;
    res.json({ success: true, data });
}));
const sendLimit = rateLimit({ windowMs: 60000, max: 30, keyGenerator: req => req.user.id, standardHeaders: true, legacyHeaders: false });
router.post('/threads/:id/messages', sendLimit, asyncHandler(async (req, res) => {
    const body = req.body?.body;
    if (Object.keys(req.body || {}).some(key => key !== 'body') || typeof body !== 'string' || !body.trim() || body.length > 4000) throw fault(400, 'A message of 1–4000 characters is required');
    let message;
    try {
        message = await db.transaction(async client => {
            const thread = await threadFor(client, req, true);
            if (!await permitted(client, thread.patient_id, thread.provider_id)) throw fault(403, 'Current patient consent and assigned care are required');
            const id = randomUUID();
            const created = (await client.query(`INSERT INTO care_messages(id,thread_id,patient_id,sender_id,body_cipher)
                VALUES($1,$2,$3,$4,$5) RETURNING id,sequence,sender_id,created_at`, [id, thread.id, thread.patient_id, req.user.id, seal(body.trim(), `care-message:${id}`)])).rows[0];
            await logAuditEvent(event(req, 'send_care_message', thread, id), client);
            return { ...created, body: body.trim() };
        });
    } catch (error) { if (error.statusCode) throw error; throw fault(503, 'Message could not be saved. Please retry.'); }
    req.auditEventRecorded = true;
    res.status(201).json({ success: true, data: message });
}));
module.exports = router;
