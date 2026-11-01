const { randomUUID } = require('node:crypto');
const { seal, unseal } = require('./privacy-crypto');
const { PURPOSES } = require('./processing-policy');
const fail = message => { throw Object.assign(new Error(message), { statusCode: 400 }); };
const applyFulfillment = async (client, req, request) => {
    const action = req.body.action;
    const applied = ['fulfilled','partially_fulfilled'].includes(req.body.status);
    if (!applied) { if (action) fail('Actions require a fulfilled or partially fulfilled decision'); return null; }
    if (!['restriction','objection','rectification'].includes(request.request_type)) {
        if (action) fail('This request type does not accept that fulfillment action');
        return null;
    }
    if (!action || typeof action !== 'object' || Array.isArray(action)) fail('Choose the actual processing restriction or correction to apply');
    if (['restriction','objection'].includes(request.request_type)) {
        if (action.type!=='restrict' || !PURPOSES.includes(action.purpose) || Object.keys(action).some(key=>!['type','purpose'].includes(key))) fail('Choose a valid processing purpose to restrict');
        const result = await client.query(`INSERT INTO patient_processing_controls(patient_id,request_id,purpose,created_by)
            VALUES($1,$2,$3,$4) ON CONFLICT(patient_id,purpose) WHERE released_at IS NULL DO NOTHING RETURNING id`,[request.patient_id,request.id,action.purpose,req.user.id]);
        const existing = result.rows[0] || (await client.query('SELECT id FROM patient_processing_controls WHERE patient_id=$1 AND purpose=$2 AND released_at IS NULL',[request.patient_id,action.purpose])).rows[0];
        return {type:'restriction',purpose:action.purpose,controlId:existing.id};
    }
    if (action.type==='profile_correction') {
        const fields = { first_name: ['users',100], last_name: ['users',100], date_of_birth: ['patient_profiles',10],
            gender: ['patient_profiles',10], address: ['patient_profiles',1000], city: ['patient_profiles',100],
            state: ['patient_profiles',100], country: ['patient_profiles',100], postal_code: ['patient_profiles',20] };
        if (Object.keys(action).some(key=>!['type','changes'].includes(key)) || !action.changes || typeof action.changes!=='object' || Array.isArray(action.changes)
            || !Object.keys(action.changes).length || Object.keys(action.changes).some(key=>!Object.hasOwn(fields,key))) fail('Choose supported demographic fields to correct');
        const after={}; const before={};
        for (const [field,value] of Object.entries(action.changes)) {
            if (typeof value!=='string' || !value.trim() || value.length>fields[field][1]) fail('Provide valid demographic correction values');
            after[field]=value.trim();
            if (field==='date_of_birth' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10)!==value || Date.parse(value)>Date.now())) fail('Provide a valid past date of birth');
            if (field==='gender' && !['male','female','other'].includes(value)) fail('Provide a supported gender value');
        }
        for (const table of ['users','patient_profiles']) {
            const selected=Object.keys(after).filter(field=>fields[field][0]===table);
            if (!selected.length) continue;
            const key=table==='users'?'id':'user_id';
            const original=(await client.query(`SELECT ${selected.join(',')} FROM ${table} WHERE ${key}=$1 FOR UPDATE`,[request.patient_id])).rows[0];
            if (!original) fail('The requesting patient profile is unavailable');
            Object.assign(before,original);
            await client.query(`UPDATE ${table} SET ${selected.map((field,index)=>`${field}=$${index+1}`).join(',')},updated_at=NOW() WHERE ${key}=$${selected.length+1}`,[...selected.map(field=>after[field]),request.patient_id]);
        }
        // These values are retained only inside the encrypted decision/history.
        return {type:'profile_correction',before,after};
    }
    if (action.type!=='correction' || typeof action.text!=='string' || action.text.trim().length<10 || action.text.length>10000
        || !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(action.recordId || '') || Object.keys(action).some(key=>!['type','recordId','text'].includes(key))) fail('Provide the patient record ID and a correction of 10–10000 characters');
    const owned = await client.query('SELECT id FROM medical_records WHERE id=$1 AND patient_id=$2 FOR SHARE',[action.recordId,request.patient_id]);
    if (!owned.rowCount) fail('The corrected record must belong to the requesting patient');
    const id = randomUUID();
    await client.query('INSERT INTO medical_record_corrections(id,record_id,patient_id,request_id,created_by,text_cipher) VALUES($1,$2,$3,$4,$5,$6)',
        [id,action.recordId,request.patient_id,request.id,req.user.id,seal(action.text.trim(),`record-correction:${id}`)]);
    return {type:'correction',correctionId:id,recordId:action.recordId};
};
const correctionsForRecord = async (recordId, execute) => (await execute('SELECT id,created_at,text_cipher FROM medical_record_corrections WHERE record_id=$1 ORDER BY created_at,id',[recordId])).rows
    .map(({text_cipher,...row})=>({...row,text:unseal(text_cipher,`record-correction:${row.id}`)}));
module.exports = { applyFulfillment, correctionsForRecord };
