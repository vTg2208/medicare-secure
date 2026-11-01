const uuid = value => typeof value==='string' && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value);
const fileReference = (value, patientId) => {
    const match=typeof value==='string' && value.match(/^\/(?:api(?:\/v\d+)?\/files|uploads\/medical_files)\/([a-f\d-]{36})\/(lab_results|imaging)\/(\d+_[a-f\d]{16}\.[a-z0-9]{1,8})$/i);
    return match && match[1].toLowerCase()===patientId.toLowerCase() ? {fileType:match[2],fileName:match[3]} : null;
};
async function evaluateRetention(client,recordId,resourceType='medical_record') {
    if (!uuid(recordId)) throw Object.assign(new Error('A valid medical record ID is required'),{statusCode:400});
    if (!['medical_record','care_message','triage_session'].includes(resourceType)) throw Object.assign(new Error('Unsupported retention resource'),{statusCode:400});
    const record=resourceType==='care_message' ? (await client.query("SELECT id,patient_id,'care_message' AS type,NULL::uuid AS organization_id,created_at AS last_activity FROM care_messages WHERE id=$1",[recordId])).rows[0]
        : resourceType==='triage_session' ? (await client.query("SELECT id,patient_id,'triage_session' AS type,NULL::uuid AS organization_id,GREATEST(created_at,updated_at) AS last_activity,status FROM triage_sessions WHERE id=$1",[recordId])).rows[0]
        : (await client.query(`SELECT r.id,r.patient_id,r.type,v.organization_id,
        GREATEST(r.created_at,r.updated_at,v.check_out_time,v.closed_at,v.completed_at,v.cancelled_at,(SELECT MAX(created_at) FROM diagnoses WHERE record_id=r.id),
            (SELECT MAX(updated_at) FROM prescriptions WHERE record_id=r.id),(SELECT MAX(uploaded_at) FROM lab_results WHERE record_id=r.id),
            (SELECT MAX(uploaded_at) FROM imaging_reports WHERE record_id=r.id),(SELECT MAX(created_at) FROM medical_record_corrections WHERE record_id=r.id)) AS last_activity
        FROM medical_records r LEFT JOIN visits v ON v.id=r.visit_id WHERE r.id=$1`,[recordId])).rows[0];
    if (!record) throw Object.assign(new Error('Medical record not found'),{statusCode:404});
    const policy=(await client.query('SELECT id,retention_days FROM retention_policies WHERE organization_id IS NOT DISTINCT FROM $1 AND record_type=$2 AND active',[record.organization_id,record.type])).rows[0];
    const reasons=[];
    if (resourceType==='triage_session' && record.status!=='completed') reasons.push('Active AI intake prevents disposal');
    if (!policy) reasons.push('No approved retention policy applies to this record category and clinic');
    const eligibleAfter=policy ? new Date(new Date(record.last_activity).getTime()+policy.retention_days*86400000) : null;
    if (eligibleAfter && eligibleAfter>new Date()) reasons.push('The retention period has not expired');
    if ((await client.query('SELECT 1 FROM retention_holds WHERE patient_id=$1 AND released_at IS NULL LIMIT 1',[record.patient_id])).rowCount) reasons.push('An active legal hold prevents disposal');
    if ((await client.query("SELECT 1 FROM visits WHERE patient_id=$1 AND status IN ('pending','approved','scheduled','checked_in','in_progress') LIMIT 1",[record.patient_id])).rowCount) reasons.push('Active care prevents disposal');
    if (resourceType==='medical_record' && (await client.query(`SELECT 1 FROM diagnoses WHERE record_id=$1 AND status IN ('active','chronic')
        UNION ALL SELECT 1 FROM prescriptions WHERE record_id=$1 AND status IN ('pending','active') LIMIT 1`,[recordId])).rowCount) reasons.push('An active diagnosis or prescription is still retained');
    if (resourceType==='medical_record' && (await client.query(`SELECT 1 FROM lab_orders o JOIN lab_results r ON r.id=o.lab_result_id WHERE r.record_id=$1
        UNION ALL SELECT 1 FROM imaging_orders o JOIN imaging_reports r ON r.id=o.imaging_report_id WHERE r.record_id=$1
        UNION ALL SELECT 1 FROM medication_orders o JOIN prescriptions r ON r.id=o.prescription_id WHERE r.record_id=$1 LIMIT 1`,[recordId])).rowCount) reasons.push('Retained workflow dependencies require a coordinated disposal review');
    const urls=resourceType==='medical_record' ? (await client.query('SELECT file_url FROM lab_results WHERE record_id=$1 UNION SELECT file_url FROM imaging_reports WHERE record_id=$1',[recordId])).rows : [];
    const files=urls.filter(row=>row.file_url).map(row=>fileReference(row.file_url,record.patient_id));
    if (files.some(file=>!file)) reasons.push('Attachment references require reconciliation before disposal');
    return {recordId:record.id,resourceType,patientId:record.patient_id,recordType:record.type,policyId:policy?.id || null,eligibleAfter,
        eligible:reasons.length===0,reasons,files:files.filter(Boolean)};
}
module.exports={uuid,fileReference,evaluateRetention};
