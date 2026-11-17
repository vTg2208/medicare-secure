const express = require('express');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { asyncHandler } = require('../../middleware/error.middleware');
const { auditLog } = require('../../middleware/audit.middleware');
const { query } = require('../../config/db');
const { isValidPhone } = require('../../utils/validators');
const { researchQueries, cohortParameters } = require('./research-cohort');
const router = express.Router();
router.use(authenticate, authorize('researcher'));
// Only explicit research consent is used. Aggregate groups below five distinct
// patients are suppressed, and no text notes, identities or row-level exports leave the API.
const respond = (res, data) => res.json({ success: true, data, minimumCohort: 5 });

router.get('/stats', auditLog('research_statistics', 'research'), asyncHandler(async (req, res) => {
    const result = await query(researchQueries.stats, cohortParameters(req.user.id));
    const { patients, records } = result.rows[0];
    const enough = patients >= 5;
    respond(res, { anonymizedPatients: enough ? patients : null, totalRecords: enough ? records : null,
        dataPointsCollected: enough ? records : null, activeStudies: null, suppressed: !enough });
}));
router.get('/symptoms', auditLog('research_diagnosis_aggregates', 'research'), asyncHandler(async (req, res) => {
    const result = await query(researchQueries.symptoms, cohortParameters(req.user.id));
    respond(res, result.rows.map(row => ({ ...row, severityAvg: null })));
}));
router.get('/treatments', auditLog('research_treatment_aggregates', 'research'), asyncHandler(async (req, res) => {
    const result = await query(researchQueries.treatments, cohortParameters(req.user.id));
    respond(res, result.rows.map(row => ({ ...row, successRate: null })));
}));
router.get('/demographics', auditLog('research_demographics', 'research'), asyncHandler(async (req, res) => {
    const result = await query(researchQueries.demographics, cohortParameters(req.user.id));
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
