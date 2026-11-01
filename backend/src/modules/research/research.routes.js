const express = require('express');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { asyncHandler } = require('../../middleware/error.middleware');
const { auditLog } = require('../../middleware/audit.middleware');
const { query } = require('../../config/db');
const { isValidPhone } = require('../../utils/validators');
const { processingAllowedSql } = require('../privacy/processing-policy');
const router = express.Router();
router.use(authenticate, authorize('researcher'));
// Only explicit research consent is used. Aggregate groups below five distinct
// patients are suppressed, and no text notes, identities or row-level exports leave the API.
const cohort = (category = 'all_medical_data') => `WITH cohort AS (SELECT DISTINCT p.* FROM patient_profiles p JOIN consents c ON c.patient_id=p.user_id
    WHERE c.recipient_user_id=$1 AND c.purpose IN ('clinical_research','medical_study')
    AND c.data_category IN ('all','all_medical_data','*','${category}')
    AND c.status='active' AND c.start_time<=NOW() AND (c.end_time IS NULL OR c.end_time>NOW()) AND ${processingAllowedSql('p.user_id','research')})`;
const respond = (res, data) => res.json({ success: true, data, minimumCohort: 5 });

router.get('/stats', auditLog('research_statistics', 'research'), asyncHandler(async (req, res) => {
    const result = await query(`${cohort()} SELECT COUNT(DISTINCT c.user_id)::int patients, COUNT(mr.id)::int records
        FROM cohort c LEFT JOIN medical_records mr ON mr.patient_id=c.user_id`, [req.user.id]);
    const { patients, records } = result.rows[0];
    const enough = patients >= 5;
    respond(res, { anonymizedPatients: enough ? patients : null, totalRecords: enough ? records : null,
        dataPointsCollected: enough ? records : null, activeStudies: null, suppressed: !enough });
}));
router.get('/symptoms', auditLog('research_diagnosis_aggregates', 'research'), asyncHandler(async (req, res) => {
    const result = await query(`${cohort('diagnoses')} SELECT d.icd_code AS name, COUNT(DISTINCT c.user_id)::int AS count
        FROM cohort c JOIN medical_records mr ON mr.patient_id=c.user_id JOIN diagnoses d ON d.record_id=mr.id
        GROUP BY d.icd_code HAVING COUNT(DISTINCT c.user_id)>=5 ORDER BY count DESC LIMIT 100`, [req.user.id]);
    respond(res, result.rows.map(row => ({ ...row, severityAvg: null })));
}));
router.get('/treatments', auditLog('research_treatment_aggregates', 'research'), asyncHandler(async (req, res) => {
    const result = await query(`${cohort('prescriptions')} SELECT p.medication AS name, COUNT(*)::int AS "usageCount"
        FROM cohort c JOIN medical_records mr ON mr.patient_id=c.user_id JOIN prescriptions p ON p.record_id=mr.id
        GROUP BY p.medication HAVING COUNT(DISTINCT c.user_id)>=5 ORDER BY "usageCount" DESC LIMIT 100`, [req.user.id]);
    respond(res, result.rows.map(row => ({ ...row, successRate: null })));
}));
router.get('/demographics', auditLog('research_demographics', 'research'), asyncHandler(async (req, res) => {
    const result = await query(`${cohort()} SELECT
        CASE WHEN date_of_birth IS NULL THEN 'Unknown' WHEN EXTRACT(YEAR FROM age(date_of_birth))<18 THEN '0-17'
        WHEN EXTRACT(YEAR FROM age(date_of_birth))<40 THEN '18-39' WHEN EXTRACT(YEAR FROM age(date_of_birth))<60 THEN '40-59' ELSE '60+' END AS range,
        COALESCE(gender,'Unknown') AS gender, COUNT(*)::int AS count FROM cohort GROUP BY 1,2`, [req.user.id]);
    const ages = new Map(); const genders = new Map();
    for (const row of result.rows) { ages.set(row.range, (ages.get(row.range) || 0) + row.count); genders.set(row.gender, (genders.get(row.gender) || 0) + row.count); }
    const groups = (map, key) => {
        const allowed = [...map].filter(([, count]) => count >= 5);
        const total = allowed.reduce((sum, [, count]) => sum + count, 0);
        return allowed.map(([label, count]) => ({ [key]: label, count, percentage: Math.round(count * 100 / total) }));
    };
    respond(res, { ageGroups: groups(ages, 'range'), gender: groups(genders, 'label') });
}));
const profile = async userId => (await query(`SELECT id,email,phone,first_name AS "firstName",last_name AS "lastName",department,
    created_at AS "createdAt" FROM users WHERE id=$1`, [userId])).rows[0];
router.get('/profile', asyncHandler(async (req, res) => respond(res, await profile(req.user.id))));
router.put('/profile', auditLog('update_research_profile', 'user'), asyncHandler(async (req, res) => {
    const { phone, department } = req.body;
    if ((phone && !isValidPhone(phone)) || (department != null && (typeof department !== 'string' || department.length > 255))) return res.status(400).json({ success: false, message: 'Invalid profile details' });
    await query('UPDATE users SET phone=COALESCE($1,phone),department=COALESCE($2,department),updated_at=NOW() WHERE id=$3', [phone || null, department ?? null, req.user.id]);
    respond(res, await profile(req.user.id));
}));
module.exports = router;
