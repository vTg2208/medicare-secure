const crypto = require('crypto');
const db = require('../../config/db');
const audit = require('../../services/audit.service');
const { comparePassword } = require('../../services/encryption.service');
const { seal, unseal } = require('./privacy-crypto');
const evidence = require('./fulfillment-evidence.service');

const TYPES = ['access', 'rectification', 'erasure', 'restriction', 'portability', 'objection'];
const TERMINAL = ['fulfilled', 'partially_fulfilled', 'retained', 'declined'];
const fault = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const role = req => req.user?.roleName;
const requireRole = (req, expected) => { if (role(req) !== expected) throw fault(403, 'Privacy access denied'); };
const narrative = (value, field, maximum = 10000) => {
    if (typeof value !== 'string' || value.trim().length < 10 || value.length > maximum) throw fault(400, `${field} must contain 10 to ${maximum} characters`);
    return value.trim();
};
const calendarMonthDue = received => {
    const due = new Date(received);
    const day = due.getUTCDate();
    due.setUTCDate(1);
    due.setUTCMonth(due.getUTCMonth() + 1);
    const finalDay = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth() + 1, 0)).getUTCDate();
    due.setUTCDate(Math.min(day, finalDay));
    return due;
};
const event = (req, action, entityId, patientId) => ({ userId: req.user.id, action, entityType: 'privacy_request', entityId,
    purpose: 'Patient information rights', ipAddress: req.ip, userAgent: req.headers?.['user-agent'],
    requestMethod: req.method, requestPath: req.path, statusCode: 200, metadata: { patientId } });
const decode = (row, histories = [], evidenceByRequest = {}) => ({ id: row.id, patientId: row.patient_id, patientName: row.patient_name,
    type: row.request_type, status: row.status, details: unseal(row.detail_cipher, `privacy-request:${row.id}:details`),
    outcome: row.outcome_cipher ? unseal(row.outcome_cipher, `privacy-request:${row.id}:outcome`) : null,
    dueAt: row.due_at, createdAt: row.created_at, updatedAt: row.updated_at, resolvedAt: row.resolved_at,
    evidence: evidenceByRequest[row.id] || { exports: [], disposals: [] },
    history: histories.filter(item => item.request_id === row.id).map(item => ({ id: item.id, sequence: item.event_sequence, actorId: item.actor_id,
        previousStatus: item.previous_status, status: item.status, createdAt: item.created_at,
        ...unseal(item.event_cipher, `privacy-history:${item.id}`) })) });
const historyRows = async (client, ids) => ids.length ? (await client.query('SELECT id,event_sequence,request_id,actor_id,previous_status,status,event_cipher,created_at FROM privacy_rights_history WHERE request_id=ANY($1::uuid[]) ORDER BY event_sequence', [ids])).rows : [];
const appendHistory = async (client, req, requestId, previousStatus, status, content) => {
    const id = crypto.randomUUID();
    await client.query('INSERT INTO privacy_rights_history(id,request_id,actor_id,previous_status,status,event_cipher) VALUES($1,$2,$3,$4,$5,$6)',
        [id, requestId, req.user.id, previousStatus, status, seal(content, `privacy-history:${id}`)]);
};
const listRequests = async (req, review = false) => {
    requireRole(req, review ? 'compliance_officer' : 'patient');
    const result = await db.transaction(async client => {
        const rows = (await client.query(`SELECT r.*,concat_ws(' ',u.first_name,u.last_name) AS patient_name FROM privacy_rights_requests r
            JOIN users u ON u.id=r.patient_id ${review ? '' : 'WHERE r.patient_id=$1'} ORDER BY r.created_at DESC,r.id`, review ? [] : [req.user.id])).rows;
        const histories = await historyRows(client, rows.map(row => row.id));
        await audit.logAuditEvent(event(req, review ? 'review_privacy_requests' : 'view_privacy_requests', null, review ? null : req.user.id), client);
        const linked = await evidence.evidenceForRequests(client, rows.map(row => row.id));
        return rows.map(row => decode(row, histories, linked));
    });
    req.auditEventRecorded = true;
    return result;
};
const createRequest = async req => {
    requireRole(req, 'patient');
    const body = req.body || {};
    if (Object.keys(body).some(key => !['type', 'details'].includes(key))) throw fault(400, 'Only request type and details may be supplied');
    if (!TYPES.includes(body.type)) throw fault(400, 'Choose a valid privacy request type');
    const details = narrative(body.details, 'Request details');
    const id = crypto.randomUUID();
    const result = await db.transaction(async client => {
        const received = (await client.query('SELECT NOW() AS received')).rows[0].received;
        const row = (await client.query(`INSERT INTO privacy_rights_requests(id,patient_id,request_type,detail_cipher,due_at)
            VALUES($1,$2,$3,$4,$5) RETURNING *`, [id, req.user.id, body.type, seal(details, `privacy-request:${id}:details`), calendarMonthDue(received)])).rows[0];
        await appendHistory(client, req, id, null, 'submitted', { note: 'Request submitted' });
        await audit.logAuditEvent({ ...event(req, 'submit_privacy_request', id, req.user.id), statusCode: 201 }, client);
        return decode(row, await historyRows(client, [id]));
    });
    req.auditEventRecorded = true;
    return result;
};
const updateRequest = async req => {
    requireRole(req, 'compliance_officer');
    const body = req.body || {};
    if (Object.keys(body).some(key => !['status', 'resolution', 'retentionBasis', 'note', 'action'].includes(key))) throw fault(400, 'Only a review decision, fulfillment action and explanation may be supplied');
    const result = await db.transaction(async client => {
        const row = (await client.query('SELECT * FROM privacy_rights_requests WHERE id=$1 FOR UPDATE', [req.params.id])).rows[0];
        if (!row) throw fault(404, 'Privacy request not found');
        const allowed = row.status === 'submitted' ? ['in_review'] : row.status === 'in_review' ? TERMINAL : [];
        if (!allowed.includes(body.status)) throw fault(409, 'This request cannot move to that review status');
        const terminal = TERMINAL.includes(body.status);
        if (row.request_type === 'erasure' && body.status === 'fulfilled') throw fault(400, 'Clinical records are retained by this application. Record the actual retained, partial, or declined outcome with its basis.');
        const outcome = terminal ? { resolution: narrative(body.resolution, 'Resolution'), retentionBasis: narrative(body.retentionBasis, 'Decision or retention basis', 4000),
            ...(row.request_type === 'erasure' ? { clinicalRecordsDeleted: false, erasureScope: 'This workflow records a review decision; it does not delete clinical records.' } : {}) } : null;
        const note = body.note == null || body.note === '' ? null : narrative(body.note, 'Review note', 4000);
        const applied = await require('./privacy-fulfillment.service').applyFulfillment(client,req,row);
        if (outcome && applied) outcome.appliedAction = applied;
        if (outcome && applied?.type === 'disposal_evidence') {
            outcome.clinicalRecordsDeleted = applied.disposals.some(item => item.resourceType === 'medical_record');
            outcome.erasureScope = applied.scope;
        }
        const updated = (await client.query(`UPDATE privacy_rights_requests SET status=$1,outcome_cipher=$2,
            resolved_at=CASE WHEN $3 THEN NOW() ELSE NULL END,resolved_by=CASE WHEN $3 THEN $4::uuid ELSE NULL END,updated_at=NOW()
            WHERE id=$5 RETURNING *`, [body.status, outcome ? seal(outcome, `privacy-request:${row.id}:outcome`) : null, terminal, req.user.id, row.id])).rows[0];
        await appendHistory(client, req, row.id, row.status, body.status, { note, outcome });
        await audit.logAuditEvent(event(req, 'resolve_privacy_request', row.id, row.patient_id), client);
        return decode(updated, await historyRows(client, [row.id]), await evidence.evidenceForRequests(client, [row.id]));
    });
    req.auditEventRecorded = true;
    return result;
};

const safeDownloadPath = (value, patientId) => {
    const parts = typeof value === 'string' && value.match(/^\/api(?:\/v\d+)?\/files\/([a-f\d-]{36})\/(?:lab_results|imaging|imaging_reports|radiology)\/([A-Za-z0-9_.-]+)$/i);
    return parts && parts[1].toLowerCase() === patientId.toLowerCase() && !['.', '..'].includes(parts[2]) ? value : null;
};
const secretKey = /password|secret|token|credential|private.?key|authorization|cookie|otp|govt.?id.?hash/i;
const safeJson = value => {
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map(safeJson);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).filter(([key]) => !secretKey.test(key)).map(([key, item]) => [key, safeJson(item)]));
};
const exportPatient = async (req, { requestId } = {}) => {
    requireRole(req, 'patient');
    if (Object.keys(req.body || {}).some(key => key !== 'currentPassword')) throw fault(400, 'The export always belongs to the signed-in patient');
    const password = req.body?.currentPassword;
    if (typeof password !== 'string' || !password || password.length > 1024) throw fault(400, 'Confirm your current password to export your information');
    const snapshot = () => db.transaction(async client => {
        const account = (await client.query('SELECT password_hash FROM users WHERE id=$1', [req.user.id])).rows[0];
        if (!account?.password_hash || !await comparePassword(password, account.password_hash)) throw fault(403, 'Current password could not be confirmed');
        let linkedRequest;
        if (requestId) {
            linkedRequest = await evidence.lockRequest(client, { ...req, params: { id: requestId } }, { patient: true });
            evidence.inReview(linkedRequest);
            if (!['access','portability'].includes(linkedRequest.request_type)) throw fault(400, 'Only access and portability requests accept an information copy');
        }
        const own = [req.user.id];
        const rows = async sql => (await client.query(sql, own)).rows;
        const accountProfile = (await rows('SELECT id,email,phone,first_name,last_name,address,status,is_verified,created_at,updated_at FROM users WHERE id=$1'))[0];
        const patientProfile = (await rows(`SELECT unique_health_id,date_of_birth,gender,blood_group,emergency_contact_name,emergency_contact_phone,emergency_contact_relation,
            address,city,state,country,postal_code,insurance_provider,insurance_policy_number,created_at,updated_at FROM patient_profiles WHERE user_id=$1`))[0] || null;
        const visits = await rows(`SELECT id,organization_id,status,visit_code,visit_type,chief_complaint,reason,symptoms,scheduled_time,
            check_in_time,check_out_time,checked_in_at,started_at,completed_at,cancelled_at,no_show_at,created_at,updated_at FROM visits WHERE patient_id=$1 ORDER BY created_at,id`);
        const medicalRecords = await rows(`SELECT mr.id,CASE WHEN v.patient_id=$1 THEN mr.visit_id ELSE NULL END AS visit_id,mr.type,mr.title,mr.description,
            mr.immutable_flag,mr.created_at,mr.updated_at FROM medical_records mr LEFT JOIN visits v ON v.id=mr.visit_id WHERE mr.patient_id=$1 ORDER BY mr.created_at,mr.id`);
        const diagnoses = await rows(`SELECT d.id,d.record_id,d.icd_code,d.description,d.severity,d.status,d.version,d.is_primary,d.notes,d.diagnosed_at,d.created_at
            FROM diagnoses d JOIN medical_records mr ON mr.id=d.record_id WHERE mr.patient_id=$1 ORDER BY d.created_at,d.id`);
        const prescriptions = await rows(`SELECT p.id,p.record_id,p.medication,p.generic_name,p.drug_code,p.dosage,p.frequency,p.route,p.duration,p.quantity,p.refills,
            p.instructions,p.status,p.prescribed_at,p.dispensed_at,p.created_at,p.updated_at FROM prescriptions p JOIN medical_records mr ON mr.id=p.record_id WHERE mr.patient_id=$1 ORDER BY p.created_at,p.id`);
        const labResults = await rows(`SELECT l.id,l.record_id,l.test_name,l.test_code,l.test_category,l.file_url,l.file_type,l.file_size,l.results_data,l.interpretation,
            l.reference_range,l.abnormal_flag,l.uploaded_at,l.result_date,l.created_at FROM lab_results l JOIN medical_records mr ON mr.id=l.record_id WHERE mr.patient_id=$1 ORDER BY l.created_at,l.id`);
        const imagingReports = await rows(`SELECT i.id,i.record_id,i.imaging_type,i.body_part,i.file_url,i.file_type,i.file_size,i.is_dicom,i.findings,i.impression,i.radiologist_notes,
            i.uploaded_at,i.study_date,i.created_at FROM imaging_reports i JOIN medical_records mr ON mr.id=i.record_id WHERE mr.patient_id=$1 ORDER BY i.created_at,i.id`);
        const visitNotes = await rows(`SELECT n.id,n.visit_id,n.note_type,n.subjective,n.objective,n.assessment,n.plan,n.is_locked,n.locked_at,n.created_at,n.updated_at
            FROM visit_notes n JOIN visits v ON v.id=n.visit_id WHERE v.patient_id=$1 ORDER BY n.created_at,n.id`);
        const medicationOrders = await rows(`SELECT m.id,m.visit_id,m.prescription_id,m.medication,m.dosage,m.route,m.frequency,m.status,m.ordered_at,
            m.dispensed_at,m.administered_at,m.discontinued_at,m.discontinuation_reason,m.refused_at,m.refusal_reason,m.notes,m.created_at,m.updated_at
            FROM medication_orders m JOIN visits v ON v.id=m.visit_id LEFT JOIN prescriptions p ON p.id=m.prescription_id
            LEFT JOIN medical_records mr ON mr.id=p.record_id LEFT JOIN visits pv ON pv.id=mr.visit_id
            WHERE v.patient_id=$1 AND (m.prescription_id IS NULL OR (mr.patient_id=$1 AND (mr.visit_id IS NULL OR pv.patient_id=$1))) ORDER BY m.created_at,m.id`);
        const radiologyReports = await rows(`SELECT r.id,r.imaging_order_id,r.report_title,r.findings,r.impression,r.recommendations,r.file_path AS file_url,r.file_size,
            r.status,r.finalized_at,r.created_at,r.updated_at FROM radiology_reports r LEFT JOIN imaging_orders i ON i.id=r.imaging_order_id
            LEFT JOIN visits v ON v.id=i.visit_id WHERE r.patient_id=$1 AND (r.imaging_order_id IS NULL OR (i.id IS NOT NULL
            AND (i.patient_id IS NULL OR i.patient_id=$1) AND (i.visit_id IS NULL OR v.patient_id=$1))) ORDER BY r.created_at,r.id`);
        const insurancePolicies = await rows(`SELECT id,member_name,type,status,coverage_start,coverage_end,copay,deductible_used,deductible_total,created_at,updated_at
            FROM insurance_policies WHERE patient_id=$1 ORDER BY created_at,id`);
        const insuranceClaims = await rows(`SELECT c.id,c.visit_id,c.policy_id,c.diagnosis,c.amount,c.status,c.notes,c.submitted_at,c.updated_at
            FROM insurance_claims c JOIN insurance_policies p ON p.id=c.policy_id LEFT JOIN visits v ON v.id=c.visit_id
            WHERE c.patient_id=$1 AND p.patient_id=$1 AND (c.visit_id IS NULL OR v.patient_id=$1) ORDER BY c.submitted_at,c.id`);
        const fileReferences = records => records.map(({ file_url, ...item }) => ({ ...item, downloadPath: safeDownloadPath(file_url, req.user.id), fileAvailable: Boolean(safeDownloadPath(file_url, req.user.id)) }));
        const consents = await rows(`SELECT id,recipient_user_id,recipient_organization_id,data_category,purpose,access_level,start_time,end_time,status,source,visit_id,revoked_at,revocation_reason,
            created_at,updated_at FROM consents WHERE patient_id=$1 ORDER BY created_at,id`);
        const requests = await rows('SELECT * FROM privacy_rights_requests WHERE patient_id=$1 ORDER BY created_at,id');
        const requestHistory = await historyRows(client, requests.map(item => item.id));
        const linked = await evidence.evidenceForRequests(client, requests.map(item => item.id));
        const triageSessions = await rows('SELECT id,conversation,soap_summary,recommended_department,priority,confidence_score,status,created_at,updated_at FROM triage_sessions WHERE patient_id=$1 ORDER BY created_at,id');
        const careMessages = (await rows(`SELECT m.id,m.sequence,m.sender_id,m.body_cipher,m.created_at
            FROM care_messages m JOIN care_message_threads t ON t.id=m.thread_id
            WHERE m.patient_id=$1 AND t.patient_id=$1 ORDER BY m.sequence`)).map(({ body_cipher, ...message }) => ({
                ...message, body: unseal(body_cipher, `care-message:${message.id}`),
            }));
        const processingControls = await rows('SELECT id,purpose,created_at,released_at FROM patient_processing_controls WHERE patient_id=$1 ORDER BY created_at,id');
        const corrections = (await rows('SELECT id,record_id,text_cipher,created_at FROM medical_record_corrections WHERE patient_id=$1 ORDER BY created_at,id')).map(({text_cipher,...correction})=>({...correction,text:unseal(text_cipher,`record-correction:${correction.id}`)}));
        const retentionDecisions = await rows('SELECT id,record_id,resource_type,approved_at,status,executed_at FROM retention_disposals WHERE patient_id=$1 ORDER BY approved_at,id');
        const noticeAcknowledgements = await require('./notices.service').ownedReceipts(client,req.user.id);
        const ownedIds = [req.user.id, ...[visits, medicalRecords, diagnoses, prescriptions, labResults, imagingReports, visitNotes, medicationOrders, radiologyReports, consents, requests, triageSessions].flatMap(group => group.map(item => item.id))];
        await audit.logAuditEvent({ ...event(req, 'export_patient_information', req.user.id, req.user.id), entityType: 'patient' }, client);
        const auditHistory = (await client.query(`SELECT id,action,entity_type,CASE WHEN entity_id=ANY($2::uuid[]) THEN entity_id ELSE NULL END AS entity_id,timestamp,status_code
            FROM audit_logs WHERE user_id=$1 OR entity_id=ANY($2::uuid[]) OR metadata->>'patientId'=$1::text OR (metadata->'patientIds') ? $1::text ORDER BY sequence`, [req.user.id, ownedIds])).rows;
        const data = { schemaVersion: 1, exportedAt: new Date().toISOString(), patientId: req.user.id,
            scope: 'All rows with verified patient ownership in the included categories; no row-count truncation.',
            exclusions: ['Passwords, government-ID hashes, tokens, passkeys, infrastructure credentials, and other patients or unrelated provider profiles.',
                'Binary attachments are separate authenticated downloads; legacy or external file locations are omitted.', 'Audit metadata and request paths are omitted to avoid exposing credentials or unrelated identities.',
                'Care or insurance entries with inconsistent patient or visit links are excluded until reconciled.'],
            profile: { account: accountProfile, patient: patientProfile }, visits, medicalRecords, diagnoses, prescriptions,
            labResults: fileReferences(labResults).map(item => ({ ...item, results_data: safeJson(item.results_data) })), imagingReports: fileReferences(imagingReports),
            visitNotes, medicationOrders, radiologyReports: fileReferences(radiologyReports), insurancePolicies, insuranceClaims,
            consents, careMessages, processingControls, corrections, retentionDecisions, noticeAcknowledgements, triageSessions: triageSessions.map(safeJson), auditHistory, privacyRequests: requests.map(item => decode(item, requestHistory, linked)) };
        return linkedRequest ? { data, receipt: await evidence.prepareExport(client, req, linkedRequest, data) } : data;
    }, { isolationLevel: 'repeatable read' });
    let result;
    // The callback only reads and appends audit evidence in its own transaction.
    // A stale audit-head snapshot rolls back completely before another attempt.
    for (let attempt = 0; attempt < 3; attempt++) {
        try { result = await snapshot(); break; }
        catch (error) {
            if (error.code !== '40001') throw error;
            if (attempt === 2) throw fault(503, 'New activity arrived while preparing your copy. Please retry the export.');
        }
    }
    req.auditEventRecorded = true;
    return result;
};
module.exports = { calendarMonthDue, listRequests, createRequest, updateRequest, exportPatient };
