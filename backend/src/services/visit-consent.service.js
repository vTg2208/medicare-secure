const db = require('../config/db');

// Visit-generated grants are separate from the patient's manually managed grants.
class VisitConsentService {
    static async createConsentForVisit(visit, accessLevel, client = db) {
        if (!['read', 'write'].includes(accessLevel)) throw new Error('Invalid visit access level');
        if (!visit.assigned_doctor_id) throw new Error('No doctor assigned to visit');
        const recipients = [...new Set([visit.assigned_doctor_id, visit.assigned_nurse_id].filter(Boolean))];
        const grants = [];
        for (const recipient of recipients) {
            const result = await client.query(`INSERT INTO consents (
                patient_id, recipient_user_id, visit_id, source, data_category, purpose, access_level, start_time, end_time, status
            ) VALUES ($1,$2,$3,'visit','all',$4,$5,NOW(),NOW()+INTERVAL '30 days','active')
            ON CONFLICT (visit_id,recipient_user_id) WHERE visit_id IS NOT NULL
            DO UPDATE SET access_level=EXCLUDED.access_level,status='active',start_time=NOW(),end_time=EXCLUDED.end_time,updated_at=NOW()
            RETURNING id, patient_id, recipient_user_id, visit_id, access_level`, [visit.patient_id, recipient, visit.id, `Patient-approved care for visit ${visit.id}`, accessLevel]);
            grants.push(result.rows[0]);
        }
        return grants;
    }
    static async revokeConsentForVisit(visitId, client = db) {
        await client.query("UPDATE consents SET status='revoked',revoked_at=NOW(),updated_at=NOW() WHERE visit_id=$1 AND source='visit' AND status='active'", [visitId]);
    }
}
module.exports = VisitConsentService;
