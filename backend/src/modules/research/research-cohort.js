const { derivePseudonymKey } = require('../../services/anonymization.service');
const { processingAllowedSql } = require('../privacy/processing-policy');

// Raw identities are used solely for consent checks and source joins, before
// the materialized pseudonymous observation boundary. Neither identities nor
// tokens leave analytics APIs. Only internal fixed projections enter SQL.
const eligibleCohort = (category = 'all_medical_data') => {
    if (!['all_medical_data', 'diagnoses', 'prescriptions'].includes(category)) throw new Error('Unsupported research category');
    return `WITH eligible AS (SELECT DISTINCT p.user_id, p.date_of_birth, p.gender
        FROM patient_profiles p JOIN consents c ON c.patient_id=p.user_id
        WHERE c.recipient_user_id=$1 AND c.purpose IN ('clinical_research','medical_study')
        AND c.data_category IN ('all','all_medical_data','*','${category}')
        AND c.status='active' AND c.start_time<=NOW() AND (c.end_time IS NULL OR c.end_time>NOW())
        AND ${processingAllowedSql('p.user_id','research')})`;
};
const participantToken = "'psn_v1_' || encode(hmac(convert_to(e.user_id::text,'UTF8'),$2::bytea,'sha256'),'hex')";
const cohortParameters = researcherId => [researcherId, derivePseudonymKey(`research:${researcherId}`)];

const researchQueries = {
    stats: `${eligibleCohort()}, cohort AS MATERIALIZED (
        SELECT ${participantToken} AS pseudonym_id, COUNT(mr.id)::int AS record_count
        FROM eligible e LEFT JOIN medical_records mr ON mr.patient_id=e.user_id GROUP BY e.user_id)
        SELECT COUNT(DISTINCT pseudonym_id)::int AS patients, COALESCE(SUM(record_count),0)::int AS records FROM cohort`,
    symptoms: `${eligibleCohort('diagnoses')}, cohort AS MATERIALIZED (
        SELECT ${participantToken} AS pseudonym_id, d.icd_code AS name
        FROM eligible e JOIN medical_records mr ON mr.patient_id=e.user_id JOIN diagnoses d ON d.record_id=mr.id)
        SELECT name, COUNT(DISTINCT pseudonym_id)::int AS count FROM cohort GROUP BY name
        HAVING COUNT(DISTINCT pseudonym_id)>=5 ORDER BY count DESC, name LIMIT 100`,
    treatments: `${eligibleCohort('prescriptions')}, cohort AS MATERIALIZED (
        SELECT ${participantToken} AS pseudonym_id, p.medication AS name
        FROM eligible e JOIN medical_records mr ON mr.patient_id=e.user_id JOIN prescriptions p ON p.record_id=mr.id)
        SELECT name, COUNT(*)::int AS "usageCount" FROM cohort GROUP BY name
        HAVING COUNT(DISTINCT pseudonym_id)>=5 ORDER BY "usageCount" DESC, name LIMIT 100`,
    demographics: `${eligibleCohort()}, cohort AS MATERIALIZED (
        SELECT ${participantToken} AS pseudonym_id,
        CASE WHEN date_of_birth IS NULL OR date_of_birth>CURRENT_DATE THEN 'Unknown'
        WHEN EXTRACT(YEAR FROM age(date_of_birth))<18 THEN '0-17'
        WHEN EXTRACT(YEAR FROM age(date_of_birth))<40 THEN '18-39'
        WHEN EXTRACT(YEAR FROM age(date_of_birth))<60 THEN '40-59' ELSE '60+' END AS range,
        CASE WHEN gender IN ('male','female','other') THEN gender ELSE 'Unknown' END AS gender FROM eligible e)
        SELECT range, gender, COUNT(DISTINCT pseudonym_id)::int AS count FROM cohort GROUP BY 1,2`,
};
module.exports = { researchQueries, cohortParameters };
