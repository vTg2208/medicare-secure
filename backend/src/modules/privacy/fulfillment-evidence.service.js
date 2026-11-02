const {createHash,randomUUID}=require('node:crypto');
const db=require('../../config/db');
const audit=require('../../services/audit.service');
const {seal,unseal}=require('./privacy-crypto');
const fault=(statusCode,message)=>Object.assign(new Error(message),{statusCode});
const uuid=value=>typeof value==='string'&&/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value);
const requireUuid=value=>{if(!uuid(value))throw fault(400,'A valid evidence or request identifier is required');};
const role=(req,expected)=>{if(req.user?.roleName!==expected)throw fault(403,'Privacy evidence access denied');};
const keys=(body,allowed)=>{if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>!allowed.includes(key)))throw fault(400,'Unexpected fulfillment evidence fields');};
const receipt=row=>({id:row.id,requestId:row.request_id,patientId:row.patient_id,contentHash:row.content_hash,byteLength:Number(row.byte_length),schemaVersion:row.schema_version,scope:row.scope,exclusions:row.exclusions,preparedAt:row.prepared_at,confirmedAt:row.confirmed_at||null});
async function lockRequest(client,req,{patient=false}={}) {
    requireUuid(req.params.id);
    const row=(await client.query(`SELECT * FROM privacy_rights_requests WHERE id=$1${patient?' AND patient_id=$2':''} FOR UPDATE`,patient?[req.params.id,req.user.id]:[req.params.id])).rows[0];
    if(!row)throw fault(404,'Privacy request not found');
    return row;
}
const inReview=row=>{if(row.status!=='in_review')throw fault(409,'This request must be in review');};
async function history(client,req,row,action,content) {
    const id=randomUUID();
    await client.query('INSERT INTO privacy_rights_history(id,request_id,actor_id,previous_status,status,event_cipher) VALUES($1,$2,$3,$4,$4,$5)',[id,row.id,req.user.id,row.status,seal(content,`privacy-history:${id}`)]);
    await audit.logAuditEvent({userId:req.user.id,action,entityType:'privacy_request',entityId:row.id,purpose:'Patient request fulfillment',metadata:{patientId:row.patient_id}},client);
}
async function evidenceForRequests(client,ids) {
    const result=Object.fromEntries(ids.map(id=>[id,{exports:[],disposals:[]} ]));
    if(!ids.length)return result;
    const exports=(await client.query(`SELECT r.*,c.confirmed_at FROM privacy_export_receipts r LEFT JOIN privacy_export_confirmations c ON c.receipt_id=r.id WHERE r.request_id=ANY($1::uuid[]) ORDER BY r.prepared_at,r.id`,[ids])).rows;
    for(const row of exports)result[row.request_id].exports.push(receipt(row));
    const links=(await client.query(`SELECT l.*,d.resource_type,d.record_id,d.policy_id,d.status,d.executed_at,
        (SELECT count(*)::int FROM retention_file_cleanup f WHERE f.disposal_id=d.id AND f.cleaned_at IS NULL) AS pending_attachments
        FROM privacy_request_disposals l JOIN retention_disposals d ON d.id=l.disposal_id AND d.patient_id=l.patient_id
        WHERE l.request_id=ANY($1::uuid[]) ORDER BY l.linked_at,l.id`,[ids])).rows;
    for(const row of links)result[row.request_id].disposals.push({id:row.id,disposalId:row.disposal_id,resourceType:row.resource_type,resourceId:row.record_id,policyId:row.policy_id,status:row.status,executedAt:row.executed_at,pendingAttachments:row.pending_attachments,linkedAt:row.linked_at,explanation:unseal(row.explanation_cipher,`request-disposal:${row.id}`)});
    return result;
}
async function prepareExport(client,req,row,data) {
    const bytes=Buffer.from(JSON.stringify(data,null,2),'utf8');
    const saved=(await client.query(`INSERT INTO privacy_export_receipts(request_id,patient_id,content_hash,byte_length,schema_version,scope,exclusions) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[row.id,req.user.id,createHash('sha256').update(bytes).digest('hex'),bytes.length,data.schemaVersion,data.scope,JSON.stringify(data.exclusions)])).rows[0];
    await history(client,req,row,'prepare_privacy_request_export',{note:'Request-linked copy prepared; receipt not confirmed.',receiptId:saved.id});
    return receipt(saved);
}
async function confirmReceipt(req) {
    role(req,'patient'); requireUuid(req.params.receiptId); keys(req.body,['received','contentHash']);
    if(req.body.received!==true||! /^[a-f0-9]{64}$/.test(req.body.contentHash||''))throw fault(400,'Explicit receipt confirmation and the matching download hash are required');
    const result=await db.transaction(async client=>{
        const row=await lockRequest(client,req,{patient:true});
        const existing=(await client.query(`SELECT r.*,c.confirmed_at FROM privacy_export_receipts r LEFT JOIN privacy_export_confirmations c ON c.receipt_id=r.id WHERE r.id=$1 AND r.request_id=$2 AND r.patient_id=$3`,[req.params.receiptId,row.id,req.user.id])).rows[0];
        if(!existing)throw fault(404,'Export receipt not found');
        if(existing.content_hash!==req.body.contentHash)throw fault(400,'Download hash does not match the prepared copy');
        if(existing.confirmed_at)return receipt(existing);
        inReview(row);
        const confirmation=(await client.query('INSERT INTO privacy_export_confirmations(receipt_id,request_id,patient_id,content_hash) VALUES($1,$2,$3,$4) RETURNING confirmed_at',[existing.id,row.id,req.user.id,existing.content_hash])).rows[0];
        await history(client,req,row,'confirm_privacy_request_export',{note:'Patient explicitly confirmed receipt of this copy; this does not establish reading or file persistence.',receiptId:existing.id});
        return receipt({...existing,...confirmation});
    }); req.auditEventRecorded=true; return result;
}
module.exports={evidenceForRequests,prepareExport,confirmReceipt,lockRequest,inReview};
