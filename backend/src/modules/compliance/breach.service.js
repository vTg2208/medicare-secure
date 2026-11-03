const crypto = require('crypto');
const db = require('../../config/db');
const { logAuditEvent } = require('../../services/audit.service');
const { seal, unseal } = require('../privacy/privacy-crypto');
const { breachObligations, normalizeAssessment, obligationStatus } = require('./breach.policy');

const fail = (statusCode, message) => { throw Object.assign(new Error(message), { statusCode }); };
const uuid = value => { if (!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(value || '')) fail(400, 'Invalid incident identifier'); return value.toLowerCase(); };
const actorAudit = (req, action, id, metadata) => ({ userId: req.user.id, action, entityType: 'security_event', entityId: id,
    purpose: 'incident_response', requestMethod: req.method, requestPath: `${req.baseUrl}${req.route?.path || ''}`, statusCode: 200, metadata });
const context = (id, version) => `breach:${id}:${version}`;
async function readCase(client, id, lock = false) {
    id = uuid(id);
    if (lock) await client.query('SELECT id FROM security_events WHERE id=$1 FOR UPDATE',[id]);
    const row = (await client.query(`SELECT b.*,e.status,e.severity FROM privacy_breaches b JOIN security_events e ON e.id=b.incident_id WHERE b.incident_id=$1 ${lock ? 'FOR UPDATE OF b' : ''}`, [id])).rows[0];
    if (!row) fail(404, 'Breach assessment not found');
    const assessment = unseal(row.assessment_ciphertext, context(id, row.assessment_version));
    const attempts = (await client.query('SELECT * FROM breach_notification_log WHERE incident_id=$1 ORDER BY event_sequence', [id])).rows;
    const obligations = breachObligations(assessment).map(obligation => ({ ...obligation,
        status: obligationStatus(obligation, attempts.filter(a => a.assessment_version === row.assessment_version)) }));
    return { id: row.incident_id, status: row.status, severity: row.severity, version: row.assessment_version,
        createdAt: row.created_at, updatedAt: row.updated_at, assessment, obligations,
        notifications: attempts.map(({ evidence_ciphertext, ...attempt }) => ({ ...attempt, evidence: unseal(evidence_ciphertext, `breach-notice:${attempt.id}`) })) };
}

async function createBreach(req) {
    const assessment = normalizeAssessment(req.body);
    const id = crypto.randomUUID();
    const severity = req.body.severity || 'high';
    if (!['low','medium','high','critical'].includes(severity)) fail(400, 'Invalid severity');
    const result = await db.transaction(async client => {
        await client.query(`INSERT INTO security_events(id,user_id,event_type,severity,description,status) VALUES($1,$2,'data_breach',$3,'Potential personal-data breach; restricted assessment available','Open')`, [id, req.user.id, severity]);
        const encrypted = seal(assessment, context(id,1));
        await client.query('INSERT INTO privacy_breaches(incident_id,discovered_at,assessment_ciphertext,created_by) VALUES($1,$2,$3,$4)', [id, assessment.discoveredAt, encrypted, req.user.id]);
        await client.query('INSERT INTO breach_assessment_history(incident_id,version,assessment_ciphertext,recorded_by) VALUES($1,1,$2,$3)', [id,encrypted,req.user.id]);
        await logAuditEvent(actorAudit(req,'breach_reported',id,{ regimes: assessment.regimes, assessmentVersion: 1 }),client);
        return readCase(client,id);
    });
    req.auditEventRecorded = true;
    return result;
}

async function updateAssessment(req) {
    const id = uuid(req.params.id);
    const assessment = normalizeAssessment(req.body);
    const expected = req.body.expectedVersion;
    if (!Number.isSafeInteger(expected) || expected < 1) fail(400, 'A current assessment version is required');
    const result = await db.transaction(async client => {
        const current = await readCase(client,id,true);
        if (current.status === 'Resolved') fail(409, 'Reopen the incident before reassessing it');
        if (current.version !== expected) fail(409, 'The assessment changed; reload before saving');
        if (new Date(assessment.discoveredAt) > new Date(current.assessment.discoveredAt)) fail(400, 'Awareness cannot move forward to extend notification reminders');
        const version = expected + 1;
        const encrypted = seal(assessment,context(id,version));
        await client.query('INSERT INTO breach_assessment_history(incident_id,version,assessment_ciphertext,recorded_by) VALUES($1,$2,$3,$4)',[id,version,encrypted,req.user.id]);
        await client.query('UPDATE privacy_breaches SET discovered_at=$1,assessment_version=$2,assessment_ciphertext=$3,updated_at=NOW() WHERE incident_id=$4',[assessment.discoveredAt,version,encrypted,id]);
        await logAuditEvent(actorAudit(req,'breach_reassessed',id,{ assessmentVersion:version }),client);
        return readCase(client,id);
    });
    req.auditEventRecorded = true;
    return result;
}

async function listBreaches(req) {
    const page = Number(req.query.page || 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000) fail(400,'Invalid page');
    const rows = (await db.query(`SELECT b.incident_id,b.assessment_version,b.assessment_ciphertext,e.status,e.severity
        FROM privacy_breaches b JOIN security_events e ON e.id=b.incident_id
        ORDER BY b.created_at DESC,b.incident_id LIMIT 51 OFFSET $1`,[(page-1)*50])).rows;
    const visible = rows.slice(0,50);
    const attempts = visible.length ? (await db.query(`SELECT incident_id,assessment_version,regime,audience,status
        FROM breach_notification_log WHERE incident_id=ANY($1::uuid[])`,[visible.map(row=>row.incident_id)])).rows : [];
    const byIncident = new Map();
    for (const attempt of attempts) {
        if (!byIncident.has(attempt.incident_id)) byIncident.set(attempt.incident_id,[]);
        byIncident.get(attempt.incident_id).push(attempt);
    }
    const cases = visible.map(row => {
        const assessment = unseal(row.assessment_ciphertext,context(row.incident_id,row.assessment_version));
        const currentAttempts = (byIncident.get(row.incident_id)||[]).filter(attempt=>attempt.assessment_version===row.assessment_version);
        return {id:row.incident_id,status:row.status,severity:row.severity,version:row.assessment_version,
            assessment:{discoveredAt:assessment.discoveredAt,regimes:assessment.regimes},
            obligations:breachObligations(assessment).map(obligation=>({regime:obligation.regime,audience:obligation.audience,
                status:obligationStatus(obligation,currentAttempts)}))};
    });
    return { cases, page, hasMore: rows.length > 50 };
}

async function getBreach(req) {
    const current = await readCase(db,req.params.id);
    const history = (await db.query('SELECT version,assessment_ciphertext,recorded_by,recorded_at FROM breach_assessment_history WHERE incident_id=$1 ORDER BY version',[current.id])).rows;
    return { ...current, history: history.map(({ assessment_ciphertext, ...event }) => ({ ...event, assessment:unseal(assessment_ciphertext,context(current.id,event.version)) })) };
}

async function recordNotification(req) {
    const id = uuid(req.params.id);
    const { regime, audience, status, channel, occurredAt, evidence, delayReason } = req.body;
    if (!['sent','failed'].includes(status) || !['portal','post','email','telephone','in_person','other'].includes(channel)) fail(400,'Invalid delivery status or channel');
    const when = new Date(occurredAt);
    if (!occurredAt || Number.isNaN(when.getTime()) || when > new Date()) fail(400,'A valid past delivery/attempt time is required');
    if (typeof evidence !== 'string' || evidence.trim().length < 10 || evidence.length > 4000) fail(400,'Provide 10–4000 characters of evidence/reference; avoid patient identifiers');
    if (delayReason !== undefined && (typeof delayReason !== 'string' || delayReason.length > 4000)) fail(400,'Invalid delay explanation');
    const result = await db.transaction(async client => {
        const current = await readCase(client,id,true);
        if (current.status === 'Resolved') fail(409,'Reopen the incident before adding evidence');
        if (req.body.expectedVersion !== current.version) fail(409,'The assessment changed; reload before recording evidence');
        const obligation = current.obligations.find(o=>o.regime===regime && o.audience===audience);
        if (!obligation) fail(400,'This audience is outside the current assessment');
        if (when < new Date(current.assessment.discoveredAt)) fail(400,'Attempt cannot precede awareness');
        if (obligation.dueAt && when > new Date(obligation.dueAt) && (typeof delayReason !== 'string' || delayReason.trim().length < 10)) fail(400,'Record an explanation for an attempt after the reminder deadline');
        const noticeId = crypto.randomUUID();
        const encrypted = seal({ reference:evidence.trim(), delayReason:delayReason?.trim() || null },`breach-notice:${noticeId}`);
        await client.query(`INSERT INTO breach_notification_log(id,incident_id,assessment_version,regime,audience,status,occurred_at,channel,evidence_ciphertext,recorded_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[noticeId,id,current.version,regime,audience,status,when.toISOString(),channel,encrypted,req.user.id]);
        await logAuditEvent(actorAudit(req,'breach_notification_recorded',id,{ noticeId,assessmentVersion:current.version,regime,audience,deliveryStatus:status }),client);
        return readCase(client,id);
    });
    req.auditEventRecorded = true;
    return result;
}

async function updateIncidentStatus(req) {
    const id = uuid(req.params.id);
    const { status } = req.body;
    if (!['Open','Investigating','Resolved'].includes(status)) fail(400,'Invalid incident status');
    await db.transaction(async client => {
        const row = (await client.query('SELECT id,status FROM security_events WHERE id=$1 FOR UPDATE',[id])).rows[0];
        if (!row) fail(404,'Incident not found');
        const breach = (await client.query('SELECT incident_id FROM privacy_breaches WHERE incident_id=$1',[id])).rows[0];
        if (breach && req.user.roleName !== 'compliance_officer') fail(403,'Only a compliance officer may change a breach case');
        if (breach && status==='Resolved') {
            const current = await readCase(client,id,true);
            if (current.obligations.some(o=>o.decision==='pending' || !['recorded','not_required'].includes(o.status))) fail(409,'Complete the assessment and record required notification evidence before resolving');
        }
        await client.query('UPDATE security_events SET status=$1,resolved=$2,resolved_at=$3,resolved_by=$4 WHERE id=$5',[status,status==='Resolved',status==='Resolved'?new Date():null,status==='Resolved'?req.user.id:null,id]);
        await logAuditEvent(actorAudit(req,'incident_status_changed',id,{ previousStatus:row.status,status }),client);
    });
    req.auditEventRecorded = true;
    return { id,status };
}

module.exports = { createBreach,updateAssessment,listBreaches,getBreach,recordNotification,updateIncidentStatus };
