const { randomUUID } = require('node:crypto');
const db = require('../../config/db');
const { logAuditEvent } = require('../../services/audit.service');
const { isValidEmail } = require('../../utils/validators');
const { seal, unseal } = require('./privacy-crypto');
const SECTIONS = ['purposes','processingBasis','dataCategories','recipients','retention','transfers','rights','complaints','security'];
const fault = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const uuid = value => typeof value === 'string' && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value);
const text = (value, name, minimum, maximum) => {
    if (typeof value !== 'string' || value.trim().length < minimum || value.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw fault(400, `Provide ${name} of ${minimum}–${maximum} characters`);
    return value.trim();
};
function validatePublication(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['title','operatorName','contactEmail','sections','reviewBasis'].includes(key))) throw fault(400, 'Supply only the notice content and reviewed publication basis');
    const content = { title: text(body.title,'a notice title',3,200), operatorName: text(body.operatorName,'the responsible operator',3,200), contactEmail: text(body.contactEmail,'a privacy contact email',3,254) };
    if (!isValidEmail(content.contactEmail)) throw fault(400, 'Provide a valid privacy contact email');
    if (!body.sections || typeof body.sections !== 'object' || Array.isArray(body.sections) || Object.keys(body.sections).some(key => !SECTIONS.includes(key))) throw fault(400, 'Provide the required plain-text notice sections');
    content.sections = Object.fromEntries(SECTIONS.map(key => [key,text(body.sections[key],key,20,6000)]));
    if (Buffer.byteLength(JSON.stringify(content),'utf8') > 60000) throw fault(400,'Notice content exceeds the supported size');
    return { content, reviewBasis: text(body.reviewBasis,'the publication review basis',10,4000) };
}
const publicVersion = row => row ? { id: row.id, versionNumber: String(row.version_number), content: row.content, contentHash: row.content_hash, publishedAt: row.published_at } : null;
const event = (req, action, entityId, patientId) => ({ userId: req.user.id, action, entityType: 'privacy_notice', entityId,
    purpose: 'privacy_transparency', metadata: { ...(patientId && { patientId }) } });
async function current(client = db, lock = '') {
    return (await client.query(`SELECT v.* FROM privacy_notice_current c LEFT JOIN privacy_notice_versions v ON v.id=c.version_id WHERE c.singleton=true ${lock}`)).rows[0] || null;
}
async function getCurrent() { const row = await current(); return row?.id ? publicVersion(row) : null; }
async function getVersion(id) {
    if (!uuid(id)) throw fault(400, 'A valid published notice ID is required');
    const row = (await db.query('SELECT * FROM privacy_notice_versions WHERE id=$1',[id])).rows[0];
    if (!row) throw fault(404,'Published notice not found');
    return publicVersion(row);
}
async function publish(req) {
    if (req.user?.roleName !== 'compliance_officer') throw fault(403,'Only a compliance officer may publish a privacy notice');
    const { content, reviewBasis } = validatePublication(req.body); const id = randomUUID();
    const version = await db.transaction(async client => {
        const pointer = await client.query('SELECT version_id FROM privacy_notice_current WHERE singleton=true FOR UPDATE');
        if (pointer.rowCount !== 1) throw fault(503,'Privacy notice configuration is unavailable');
        const row = (await client.query('INSERT INTO privacy_notice_versions(id,content,review_basis_ciphertext,published_by) VALUES($1,$2,$3,$4) RETURNING *',
            [id,content,seal({ basis: reviewBasis },`notice-review:${id}`),req.user.id])).rows[0];
        await client.query('UPDATE privacy_notice_current SET version_id=$1 WHERE singleton=true',[id]);
        await logAuditEvent({ ...event(req,'publish_privacy_notice',id),statusCode:201 },client);
        return publicVersion(row);
    });
    req.auditEventRecorded = true;
    return version;
}
async function ownedReceipts(client, patientId) {
    const rows = (await client.query(`SELECT r.id AS receipt_id,r.acknowledged_at,v.*
        FROM privacy_notice_acknowledgements r JOIN privacy_notice_versions v ON v.id=r.version_id
        WHERE r.patient_id=$1 ORDER BY r.acknowledged_at,r.id`,[patientId])).rows;
    return rows.map(row => ({ id: row.receipt_id, versionId: row.id, contentHash: row.content_hash, acknowledgedAt: row.acknowledged_at, notice: publicVersion(row) }));
}
async function history(req) {
    const result = await db.transaction(async client => {
        const row = await current(client); const receipts = await ownedReceipts(client,req.user.id);
        return { patientId: req.user.id, currentVersionId: row?.id || null, acknowledgedCurrent: Boolean(row?.id && receipts.some(receipt => receipt.versionId === row.id)), receipts };
    },{ isolationLevel:'repeatable read' });
    return result;
}
async function acknowledge(req) {
    if (req.user?.roleName !== 'patient') throw fault(403,'Only a patient may acknowledge their notice');
    const body = req.body;
    if (!body || Object.keys(body).some(key => !['versionId','acknowledged'].includes(key)) || !uuid(body.versionId) || body.acknowledged !== true) throw fault(400,'Explicitly acknowledge the displayed published notice');
    const receipt = await db.transaction(async client => {
        // Lock only the non-nullable pointer side; the unconfigured version is a LEFT JOIN.
        const row = await current(client,'FOR SHARE OF c');
        if (!row?.id || row.id !== body.versionId) throw fault(409,'The current notice changed or is not published. Read the current notice before acknowledging it.');
        const inserted = (await client.query(`INSERT INTO privacy_notice_acknowledgements(patient_id,version_id,notice_hash)
            VALUES($1,$2,$3) ON CONFLICT(patient_id,version_id) DO NOTHING RETURNING id`,[req.user.id,row.id,row.content_hash])).rows[0];
        if (inserted) await logAuditEvent(event(req,'acknowledge_privacy_notice',inserted.id,req.user.id),client);
        return (await ownedReceipts(client,req.user.id)).find(value => value.versionId === row.id);
    });
    req.auditEventRecorded = true;
    return receipt;
}
async function publicationHistory(query = {}) {
    const before = query.before;
    if (Object.keys(query).some(key => key !== 'before') || (before !== undefined && (typeof before !== 'string' || !/^[1-9]\d{0,18}$/.test(before) || BigInt(before)>9223372036854775807n))) throw fault(400,'Provide a valid publication cursor');
    const rows = (await db.query(`SELECT * FROM privacy_notice_versions ${before ? 'WHERE version_number<$1' : ''} ORDER BY version_number DESC LIMIT 21`,before ? [before] : [])).rows;
    const versions = rows.slice(0,20).map(row => ({ ...publicVersion(row), publishedBy: row.published_by, reviewBasis: unseal(row.review_basis_ciphertext,`notice-review:${row.id}`).basis }));
    return { versions,hasMore:rows.length>20,nextBefore:rows.length>20 ? versions[versions.length-1].versionNumber : null };
}
module.exports = { getCurrent, getVersion, publish, history, acknowledge, ownedReceipts, publicationHistory, SECTIONS };
