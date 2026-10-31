const axios = require('axios');
const { randomUUID } = require('crypto');
const { query } = require('../../config/db');
const config = require('../../config/env');
const { createAuditLog } = require('../../services/audit.service');
const { clinicalScopeSql } = require('../../middleware/clinical-access.middleware');
const logger = require('../../utils/logger');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fault = (status, message) => Object.assign(new Error(message), { status });
const validId = id => { if (typeof id !== 'string' || !UUID.test(id)) throw fault(400, 'A valid session identifier is required.'); return id; };
const requireRole = (req, roles) => { if (!roles.includes(req.user?.roleName)) throw fault(403, 'Clinical access denied.'); };
const aiOptions = () => {
    if (!config.ai?.enabled || !config.ai.token) throw fault(503, 'AI pre-screening is unavailable.');
    return { timeout: 30000, headers: { Authorization: `Bearer ${config.ai.token}` }, maxRedirects: 0, maxContentLength: 65536, maxBodyLength: 16384 };
};
const aiCall = async (method, path, body) => {
    const options = aiOptions();
    try {
        const url = `${config.ai.url.replace(/\/$/, '')}${path}`;
        return method === 'get' ? (await axios.get(url, options)).data : (await axios.post(url, body, options)).data;
    } catch (error) {
        if (error.response?.status === 409) throw fault(409, 'Session expired or has no conversation. Start a new pre-screening session.');
        throw fault(503, 'AI pre-screening is unavailable. Please contact a clinician for assistance.');
    }
};
const audit = (req, action, entityId) => createAuditLog({ userId: req.user.id, action, entityType: 'triage_session', entityId,
    purpose: 'PRE_SCREENING', ipAddress: req.ip, userAgent: req.headers?.['user-agent'], requestMethod: req.method, requestPath: req.path, statusCode: 200 });
const handler = fn => async (req, res) => {
    try { await fn(req, res); } catch (error) {
        if (!error.status) logger.error('Triage request failed', { code: error.code });
        res.status(error.status || 500).json({ message: error.status ? error.message : 'Unable to process triage request.' });
    }
};
const ownSession = async (req, id) => {
    requireRole(req, ['patient']); validId(id);
    const result = await query('SELECT id, patient_id, status FROM triage_sessions WHERE id = $1 AND patient_id = $2', [id, req.user.id]);
    if (!result.rows.length) throw fault(404, 'Session not found.');
    if (result.rows[0].status !== 'in_progress') throw fault(409, 'Session is already completed.');
    return result.rows[0];
};
const validSummary = summary => summary && ['subjective', 'objective', 'assessment', 'plan', 'recommended_department'].every(key =>
    typeof summary[key] === 'string' && summary[key].trim().length > 0 && summary[key].length <= 8000) &&
    typeof summary.confidence_score === 'number' && Number.isFinite(summary.confidence_score) && summary.confidence_score >= 0 && summary.confidence_score <= 1;

exports.startSession = handler(async (req, res) => {
    requireRole(req, ['patient']); aiOptions();
    const session_id = randomUUID();
    // Initialize upstream before persisting a usable session: failed dependencies leave no abandoned database session.
    await aiCall('post', '/chatbot/start', { session_id });
    await query("INSERT INTO triage_sessions (id, patient_id, status) VALUES ($1, $2, 'in_progress')", [session_id, req.user.id]);
    await audit(req, 'CHATBOT_TRIAGE_STARTED', session_id);
    res.status(200).json({ session_id, message: 'Chatbot session started.' });
});
exports.sendMessage = handler(async (req, res) => {
    const { session_id, message } = req.body || {};
    if (typeof message !== 'string' || !message.trim() || message.length > 4000) throw fault(400, 'Message must contain between 1 and 4000 characters.');
    await ownSession(req, session_id);
    const data = await aiCall('post', '/chatbot/message', { session_id, message: message.trim() });
    if (typeof data?.reply !== 'string' || !data.reply.trim() || data.reply.length > 16000) throw fault(503, 'AI returned an invalid response.');
    const result = await query(`UPDATE triage_sessions SET conversation = COALESCE(conversation, '[]'::jsonb) || $1::jsonb
        WHERE id = $2 AND patient_id = $3 AND status = 'in_progress' RETURNING id`,
    [JSON.stringify([{ role: 'patient', text: message.trim() }, { role: 'bot', text: data.reply }]), session_id, req.user.id]);
    if (!result.rows.length) throw fault(409, 'Session is no longer active.');
    await audit(req, 'CHATBOT_MESSAGE_SENT', session_id);
    res.status(200).json({ reply: data.reply });
});
exports.analyzeSession = handler(async (req, res) => {
    const { session_id } = req.body || {};
    await ownSession(req, session_id);
    const { summary } = await aiCall('get', `/chatbot/summary/${session_id}`);
    if (!validSummary(summary)) throw fault(503, 'AI returned an invalid summary.');
    // Model confidence measures department selection, never medical urgency. Preserve clinician priority.
    const result = await query(`UPDATE triage_sessions SET soap_summary = $1::jsonb, recommended_department = $2,
        confidence_score = $3, status = 'completed' WHERE id = $4 AND patient_id = $5 AND status = 'in_progress' RETURNING id`,
    [JSON.stringify(summary), summary.recommended_department, summary.confidence_score, session_id, req.user.id]);
    if (!result.rows.length) throw fault(409, 'Session is no longer active.');
    await audit(req, 'CHATBOT_TRIAGE_COMPLETED', session_id);
    res.status(200).json({ summary });
});
exports.getSummary = handler(async (req, res) => {
    requireRole(req, ['patient', 'doctor']); const id = validId(req.params.id);
    const scope = req.user.roleName === 'patient' ? 't.patient_id = $2' : clinicalScopeSql('t.patient_id', null, '$2', 'doctor');
    const result = await query(`SELECT t.* FROM triage_sessions t WHERE t.id = $1 AND ${scope}`, [id, req.user.id]);
    if (!result.rows.length) throw fault(404, 'Session not found.');
    await audit(req, 'CHATBOT_SUMMARY_VIEWED', id);
    res.status(200).json(result.rows[0]);
});
exports.getAllSessions = handler(async (req, res) => {
    requireRole(req, ['doctor']);
    const scope = clinicalScopeSql('t.patient_id', null, '$1', 'doctor');
    const result = await query(`SELECT t.id, t.patient_id, t.status, t.soap_summary, t.recommended_department, t.confidence_score,
        t.priority, t.created_at, u.first_name, u.last_name FROM triage_sessions t JOIN users u ON t.patient_id = u.id
        WHERE ${scope} ORDER BY CASE WHEN t.priority = 'high' THEN 1 WHEN t.priority = 'normal' THEN 2 ELSE 3 END, t.created_at DESC LIMIT 100`, [req.user.id]);
    await audit(req, 'CHATBOT_QUEUE_VIEWED');
    res.status(200).json(result.rows);
});
