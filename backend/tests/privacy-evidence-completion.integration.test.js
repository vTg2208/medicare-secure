const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {withApplication}=require('./helpers/application-fixture');

test('privacy case completion requires confirmed exports or completed owned disposal', {skip:process.env.RUN_DB_TESTS!=='true',timeout:90000},async t=>withApplication('evidencecompletion',async({db,people,visit,call})=>{
    const password='Synthetic-completion-password-42!';
    const {hashPassword}=require('../src/services/encryption.service');
    await db.query('UPDATE users SET password_hash=$1 WHERE id=ANY($2::uuid[])',[await hashPassword(password),[people.patient.id,people.otherPatient.id]]);
    const service=require('../src/modules/privacy/privacy-rights.service');
    const request=(id,body={},actor='patient')=>({user:{id:people[actor].id,roleName:people[actor].role},params:{id},body,headers:{}});
    const open=async(type='access',actor='patient')=>{const row=(await call(actor,'POST','/privacy/requests',{type,details:'Please review this synthetic request and its exact supported scope.'},201)).data;await call('officer','PUT',`/privacy/requests/${row.id}`,{status:'in_review'});return row;};
    const decision={status:'fulfilled',resolution:'The supported structured copy was received; attachments were not requested.',retentionBasis:'Reviewed synthetic request scope and retained clinical obligations.'};
    const prepare=async row=>service.exportPatient(request(row.id,{currentPassword:password}),{requestId:row.id});
    const confirm=async(row,receipt)=>call('patient','POST',`/privacy/requests/${row.id}/receipts/${receipt.id}/confirm`,{received:true,contentHash:receipt.contentHash});
    await t.test('narrative-only access and portability completion is rejected',async()=>{
        for(const type of ['access','portability']){
            const row=await open(type);
            await call('officer','PUT',`/privacy/requests/${row.id}`,decision,400);
            assert.equal((await db.query('SELECT status FROM privacy_rights_requests WHERE id=$1',[row.id])).rows[0].status,'in_review');
        }
    });
    await t.test('closure requires a confirmed receipt for this exact case and preserves retry identity',async()=>{
        const row=await open();const copy=await prepare(row); const action={type:'export_receipt',receiptId:copy.receipt.id};
        await call('officer','PUT',`/privacy/requests/${row.id}`,{...decision,action},409);
        await confirm(row,copy.receipt);
        const unrelated=await open('portability');
        await call('officer','PUT',`/privacy/requests/${unrelated.id}`,{...decision,action},400);
        const finished=(await call('officer','PUT',`/privacy/requests/${row.id}`,{...decision,action})).data;
        assert.equal(finished.outcome.appliedAction.receipt.contentHash,copy.receipt.contentHash);
        assert.ok(finished.outcome.appliedAction.receipt.confirmedAt);
        const retry=(await confirm(row,copy.receipt)).data;assert.equal(retry.confirmedAt,finished.outcome.appliedAction.receipt.confirmedAt);
        await assert.rejects(prepare(row),error=>error.statusCode===409);
    });
    await t.test('audit outages roll back preparation and confirmation and prevent disclosure',async()=>{
        const row=await open();
        await db.query("CREATE FUNCTION fail_evidence_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action IN ('prepare_privacy_request_export','confirm_privacy_request_export') THEN RAISE EXCEPTION 'Synthetic evidence audit outage'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_evidence_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION fail_evidence_audit()");
        try{await assert.rejects(prepare(row),/Synthetic evidence audit outage/);assert.equal((await db.query('SELECT count(*)::int n FROM privacy_export_receipts WHERE request_id=$1',[row.id])).rows[0].n,0);}
        finally{await db.query('DROP TRIGGER fail_evidence_audit ON audit_logs');}
        const copy=await prepare(row);
        await db.query('CREATE TRIGGER fail_evidence_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION fail_evidence_audit()');
        try{await call('patient','POST',`/privacy/requests/${row.id}/receipts/${copy.receipt.id}/confirm`,{received:true,contentHash:copy.receipt.contentHash},500);assert.equal((await db.query('SELECT count(*)::int n FROM privacy_export_confirmations WHERE request_id=$1',[row.id])).rows[0].n,0);}
        finally{await db.query('DROP TRIGGER fail_evidence_audit ON audit_logs');}
    });
    await t.test('concurrent closure and confirmation never append a new confirmation after a terminal decision',async()=>{
        const row=await open();const copy=await prepare(row);
        const outputs=await Promise.all([
            call('patient','POST',`/privacy/requests/${row.id}/receipts/${copy.receipt.id}/confirm`,{received:true,contentHash:copy.receipt.contentHash},null),
            call('officer','PUT',`/privacy/requests/${row.id}`,{...decision,status:'declined'},null)
        ]);
        assert.equal(outputs[1].status,200);assert.ok([200,409].includes(outputs[0].status));
        const history=(await call('patient','GET','/privacy/requests')).data.find(item=>item.id===row.id).history;
        assert.equal(history.at(-1).status,'declined');
    });
    const basis='Reviewed synthetic limited-scope disposal policy.';
    await db.query("UPDATE visits SET status='completed' WHERE id=$1",[visit]);
    const policy=(await call('officer','POST','/retention/policies',{recordType:'care_message',retentionDays:30,jurisdiction:'Synthetic',basis},201)).data.id;
    const makeDecision=async({patientId=people.patient.id,status='approved',executedAt=null}={})=>{
        const id=randomUUID();
        await db.query(`INSERT INTO retention_disposals(id,record_id,patient_id,resource_type,policy_id,basis_cipher,approved_by,status,executed_at,executed_by) VALUES($1,$2,$3,'care_message',$4,$5,$6,$7,$8,$9)`,[id,randomUUID(),patientId,policy,require('../src/modules/privacy/privacy-crypto').seal(basis,`retention-disposal:${id}`),people.officer.id,status,executedAt,executedAt?'synthetic_owner':null]);
        return id;
    };
    const link=(row,id,actor='officer')=>call(actor,'POST',`/privacy/requests/${row.id}/disposals`,{disposalId:id,explanation:'This reviewed disposal addresses only the specified correspondence.'},null);
    await t.test('erasure requires owned, case-timely disposal evidence and cannot claim full erasure',async()=>{
        const row=await open('erasure');
        const partial={...decision,status:'partially_fulfilled'};
        await call('officer','PUT',`/privacy/requests/${row.id}`,partial,400);
        await call('officer','PUT',`/privacy/requests/${row.id}`,decision,400);
        assert.equal((await link(row,await makeDecision({patientId:people.otherPatient.id}))).status,404);
        assert.equal((await link(row,await makeDecision({status:'completed',executedAt:'2000-01-01'}))).status,409);
        assert.equal((await link(row,await makeDecision({status:'superseded'}))).status,409);
        const pending=await makeDecision();assert.equal((await link(row,pending,'patient')).status,403);
        assert.equal((await link(row,pending)).status,201);
        await call('officer','PUT',`/privacy/requests/${row.id}`,{...partial,action:{type:'disposal_evidence',disposalIds:[pending]}},409);
        const incomplete=await makeDecision({status:'database_disposed',executedAt:new Date().toISOString()});
        assert.equal((await link(row,incomplete)).status,201);
        await call('officer','PUT',`/privacy/requests/${row.id}`,{...partial,action:{type:'disposal_evidence',disposalIds:[incomplete]}},409);
        const cleanup=await makeDecision({status:'completed',executedAt:new Date().toISOString()});assert.equal((await link(row,cleanup)).status,201);
        await db.query("INSERT INTO retention_file_cleanup(disposal_id,patient_id,file_type,file_name) VALUES($1,$2,'lab_results','1234567890123_0123456789abcdef.pdf')",[cleanup,people.patient.id]);
        await call('officer','PUT',`/privacy/requests/${row.id}`,{...partial,action:{type:'disposal_evidence',disposalIds:[cleanup]}},409);
    });
    await t.test('actual operator-completed message disposal supports only a limited partial outcome',async()=>{
        const row=await open('erasure');
        const thread=(await db.query('INSERT INTO care_message_threads(patient_id,provider_id) VALUES($1,$2) RETURNING id',[people.patient.id,people.doctor.id])).rows[0].id;
        const message=randomUUID();const {seal}=require('../src/modules/privacy/privacy-crypto');
        await db.query("INSERT INTO care_messages(id,thread_id,patient_id,sender_id,body_cipher,created_at) VALUES($1,$2,$3,$3,$4,NOW()-INTERVAL '400 days')",[message,thread,people.patient.id,seal('Expired synthetic correspondence',`care-message:${message}`)]);
        const approval=(await call('officer','POST','/retention/approvals',{recordId:message,resourceType:'care_message',basis},201)).data;
        assert.equal((await link(row,approval.id)).status,201);
        const client=await db.pool.connect();try{await require('../scripts/retention-dispose').executeDisposal(client,approval.id,{apply:true,quiesced:true});}finally{client.release();}
        const finished=(await call('officer','PUT',`/privacy/requests/${row.id}`,{...decision,status:'partially_fulfilled',resolution:'Only the selected correspondence was removed; clinical records, audit evidence and backups remain.',action:{type:'disposal_evidence',disposalIds:[approval.id]}})).data;
        assert.equal(finished.outcome.clinicalRecordsDeleted,false);
        assert.equal(finished.outcome.appliedAction.disposals[0].resourceType,'care_message');
        assert.equal(finished.outcome.appliedAction.disposals[0].resourceId,message);
        assert.ok(finished.outcome.appliedAction.disposals[0].executedAt);
        assert.equal((await db.query('SELECT count(*)::int n FROM care_messages WHERE id=$1',[message])).rows[0].n,0);
        const foreign=(await call('otherPatient','GET','/privacy/requests')).data;
        assert.ok(!JSON.stringify(foreign).includes(approval.id));
    });
}));
