const router=require('express').Router();
const {randomUUID}=require('node:crypto');
const db=require('../../config/db');
const {authenticate,authorize}=require('../../middleware/auth.middleware');
const {asyncHandler}=require('../../middleware/error.middleware');
const {seal,unseal}=require('./privacy-crypto');
const {uuid,evaluateRetention}=require('./retention-policy');
const {logAuditEvent}=require('../../services/audit.service');
router.use(authenticate,authorize('compliance_officer'));
const fault=(statusCode,message)=>Object.assign(new Error(message),{statusCode});
const basis=value=>{if(typeof value!=='string'||value.trim().length<10||value.length>4000)throw fault(400,'A reviewed retention or hold basis of 10–4000 characters is required');return value.trim();};
const event=(req,action,id,patientId)=>({userId:req.user.id,action,entityType:'retention',entityId:id,purpose:'retention_governance',metadata:{patientId:patientId||null}});
router.get('/policies',asyncHandler(async(req,res)=>{
    const rows=(await db.query('SELECT * FROM retention_policies ORDER BY created_at DESC LIMIT 200')).rows;
    res.json({success:true,data:rows.map(({basis_cipher,...row})=>({...row,basis:unseal(basis_cipher,`retention-policy:${row.id}`)}))});
}));
router.post('/policies',asyncHandler(async(req,res)=>{
    const {organizationId=null,recordType,retentionDays,jurisdiction}=req.body;
    const allowed=['consultation','diagnosis','treatment','prescription','lab_result','imaging','procedure','vaccination','note','other','care_message','triage_session'];
    if((organizationId!==null&&!uuid(organizationId))||!allowed.includes(recordType)||!Number.isInteger(retentionDays)||retentionDays<1||retentionDays>365000||typeof jurisdiction!=='string'||jurisdiction.trim().length<2||jurisdiction.length>100)throw fault(400,'Provide an explicit clinic scope, record type, retention days and jurisdiction');
    const explanation=basis(req.body.basis);const id=randomUUID();
    const row=await db.transaction(async client=>{
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`retention:${organizationId}:${recordType}`]);
        await client.query('UPDATE retention_policies SET active=false WHERE organization_id IS NOT DISTINCT FROM $1 AND record_type=$2 AND active',[organizationId,recordType]);
        const row=(await client.query('INSERT INTO retention_policies(id,organization_id,record_type,retention_days,jurisdiction,basis_cipher,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',[id,organizationId,recordType,retentionDays,jurisdiction.trim(),seal(explanation,`retention-policy:${id}`),req.user.id])).rows[0];
        await logAuditEvent(event(req,'publish_retention_policy',id),client);return row;
    });req.auditEventRecorded=true;res.status(201).json({success:true,data:row});
}));
router.get('/holds',asyncHandler(async(req,res)=>{
    const rows=(await db.query('SELECT * FROM retention_holds WHERE released_at IS NULL ORDER BY created_at DESC LIMIT 200')).rows;
    res.json({success:true,data:rows.map(({basis_cipher,...row})=>({...row,basis:unseal(basis_cipher,`retention-hold:${row.id}`)}))});
}));
router.post('/holds',asyncHandler(async(req,res)=>{
    if(!uuid(req.body.patientId))throw fault(400,'A valid patient ID is required');
    const explanation=basis(req.body.basis);const id=randomUUID();
    await db.transaction(async client=>{
        const patient=await client.query("SELECT u.id FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=$1 AND r.name='patient'",[req.body.patientId]);
        if(!patient.rowCount)throw fault(400,'Patient not found');
        await client.query('INSERT INTO retention_holds(id,patient_id,basis_cipher,created_by) VALUES($1,$2,$3,$4)',[id,req.body.patientId,seal(explanation,`retention-hold:${id}`),req.user.id]);
        await logAuditEvent(event(req,'create_legal_hold',id,req.body.patientId),client);
    });req.auditEventRecorded=true;res.status(201).json({success:true,data:{id}});
}));
router.post('/holds/:id/release',asyncHandler(async(req,res)=>{
    if(!uuid(req.params.id))throw fault(400,'A valid hold is required');
    await db.transaction(async client=>{
        const row=(await client.query('UPDATE retention_holds SET released_at=NOW(),released_by=$1 WHERE id=$2 AND released_at IS NULL RETURNING patient_id',[req.user.id,req.params.id])).rows[0];
        if(!row)throw fault(404,'Active hold not found');
        await logAuditEvent(event(req,'release_legal_hold',req.params.id,row.patient_id),client);
    });req.auditEventRecorded=true;res.json({success:true});
}));
router.get('/eligibility',asyncHandler(async(req,res)=>{
    const {files,...result}=await evaluateRetention({query:db.query},req.query.recordId,req.query.resourceType);
    res.json({success:true,data:{...result,attachmentCount:files.length}});
}));
router.get('/approvals',asyncHandler(async(req,res)=>{
    const rows=(await db.query('SELECT id,record_id,resource_type,patient_id,policy_id,approved_at,status,executed_at FROM retention_disposals ORDER BY approved_at DESC LIMIT 200')).rows;
    res.json({success:true,data:rows});
}));
router.post('/approvals',asyncHandler(async(req,res)=>{
    const explanation=basis(req.body.basis);const id=randomUUID();
    await db.transaction(async client=>{
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`retention-approval:${req.body.recordId}`]);
        const result=await evaluateRetention(client,req.body.recordId,req.body.resourceType);
        if(!result.eligible)throw fault(409,result.reasons.join('; '));
        const obsolete=(await client.query(`UPDATE retention_disposals d SET status='superseded',superseded_at=NOW(),superseded_by=$2
            WHERE d.record_id=$1 AND d.status='approved' AND d.policy_id<>$3
              AND EXISTS(SELECT 1 FROM retention_policies p WHERE p.id=d.policy_id AND NOT p.active) RETURNING d.id`,[result.recordId,req.user.id,result.policyId])).rows;
        for(const previous of obsolete)await logAuditEvent({...event(req,'supersede_retention_approval',previous.id,result.patientId),metadata:{patientId:result.patientId,replacementDecisionId:id}},client);
        await client.query('INSERT INTO retention_disposals(id,record_id,patient_id,policy_id,basis_cipher,approved_by,resource_type) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,result.recordId,result.patientId,result.policyId,seal(explanation,`retention-disposal:${id}`),req.user.id,result.resourceType]);
        await logAuditEvent(event(req,'approve_retention_disposal',id,result.patientId),client);
    });req.auditEventRecorded=true;res.status(201).json({success:true,data:{id}});
}));
module.exports=router;
