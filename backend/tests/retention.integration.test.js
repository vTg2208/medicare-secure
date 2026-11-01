const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withApplication } = require('./helpers/application-fixture');

test('retention requires a policy, released holds, review approval and a privileged operator', { skip: process.env.RUN_DB_TESTS !== 'true', timeout: 60000 }, async t => withApplication('retention', async ({db,people,visit,call}) => {
    const createOld = async title => (await db.query("INSERT INTO medical_records(patient_id,type,title,created_by,immutable_flag,created_at,updated_at) VALUES($1,'note',$2,$3,true,NOW()-INTERVAL '400 days',NOW()-INTERVAL '400 days') RETURNING id",[people.patient.id,title,people.doctor.id])).rows[0].id;
    const record=await createOld('Synthetic expired clinical note');
    const basis='Reviewed synthetic jurisdiction-specific retention basis.';
    let approval;
    await t.test('no retention interval is invented and active care blocks disposal',async()=>{
        const before=(await call('officer','GET',`/retention/eligibility?recordId=${record}`)).data;
        assert.equal(before.eligible,false); assert.match(before.reasons.join(' '),/policy/i);
        await call('admin','POST','/retention/policies',{recordType:'note',retentionDays:30,jurisdiction:'Synthetic jurisdiction',basis},403);
        await call('officer','POST','/retention/policies',{recordType:'note',retentionDays:30,jurisdiction:'Synthetic jurisdiction',basis},201);
        const active=(await call('officer','GET',`/retention/eligibility?recordId=${record}`)).data;
        assert.equal(active.eligible,false); assert.match(active.reasons.join(' '),/active care/i);
        await db.query("UPDATE visits SET status='completed' WHERE id=$1",[visit]);
        assert.equal((await call('officer','GET',`/retention/eligibility?recordId=${record}`)).data.eligible,true);
        const fresh=(await db.query("INSERT INTO medical_records(patient_id,type,title,created_by,immutable_flag) VALUES($1,'note','New record',$2,true) RETURNING id",[people.patient.id,people.doctor.id])).rows[0].id;
        assert.equal((await call('officer','GET',`/retention/eligibility?recordId=${fresh}`)).data.eligible,false);
    });
    await t.test('holds prevent approval and can only be released by a governance officer',async()=>{
        const hold=(await call('officer','POST','/retention/holds',{patientId:people.patient.id,basis},201)).data;
        await call('officer','POST','/retention/approvals',{recordId:record,basis},409);
        await call('patient','POST',`/retention/holds/${hold.id}/release`,{},403);
        await call('officer','POST',`/retention/holds/${hold.id}/release`,{});
        approval=(await call('officer','POST','/retention/approvals',{recordId:record,basis},201)).data;
        assert.equal((await db.query('SELECT COUNT(*)::int count FROM medical_records WHERE id=$1',[record])).rows[0].count,1);
        await call('officer','POST',`/retention/approvals/${approval.id}/execute`,{},404);
    });
    await t.test('dry run is harmless and a hold created after approval is rechecked',async()=>{
        const {executeDisposal}=require('../scripts/retention-dispose');
        const client=await db.pool.connect();
        try {
            const preview=await executeDisposal(client,approval.id);
            assert.equal(preview.applied,false); assert.equal(preview.eligible,true);
            await assert.rejects(executeDisposal(client,approval.id,{apply:true}),/quiesc/i);
            const hold=(await call('officer','POST','/retention/holds',{patientId:people.patient.id,basis},201)).data;
            await assert.rejects(executeDisposal(client,approval.id,{apply:true,quiesced:true}),/hold/i);
            assert.equal((await db.query('SELECT COUNT(*)::int count FROM medical_records WHERE id=$1',[record])).rows[0].count,1);
            await call('officer','POST',`/retention/holds/${hold.id}/release`,{});
        } finally {client.release();}
    });
    await t.test('audit failure restores both the retained row and its delete protection',async()=>{
        const {executeDisposal}=require('../scripts/retention-dispose');
        await db.query("CREATE FUNCTION reject_fixture_disposal_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='retention_disposal' THEN RAISE EXCEPTION 'Fixture audit outage'; END IF; RETURN NEW; END $$");
        await db.query('CREATE TRIGGER reject_fixture_disposal_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_fixture_disposal_audit()');
        const client=await db.pool.connect();
        try {
            await assert.rejects(executeDisposal(client,approval.id,{apply:true,quiesced:true}),/audit|Fixture/i);
            assert.equal((await db.query('SELECT COUNT(*)::int count FROM medical_records WHERE id=$1',[record])).rows[0].count,1);
            await assert.rejects(db.query('DELETE FROM medical_records WHERE id=$1',[record]),/retained/i);
        } finally {client.release();await db.query('DROP TRIGGER reject_fixture_disposal_audit ON audit_logs');}
    });
    await t.test('approved expired data is disposed once while audit and decision evidence remain',async()=>{
        const {executeDisposal}=require('../scripts/retention-dispose');
        const client=await db.pool.connect();
        try {
            const disposed=await executeDisposal(client,approval.id,{apply:true,quiesced:true});
            assert.equal(disposed.applied,true);
            assert.equal((await db.query('SELECT COUNT(*)::int count FROM medical_records WHERE id=$1',[record])).rows[0].count,0);
            assert.equal((await db.query('SELECT status FROM retention_disposals WHERE id=$1',[approval.id])).rows[0].status,'completed');
            assert.equal((await db.query("SELECT COUNT(*)::int count FROM audit_logs WHERE action='retention_disposal' AND entity_id=$1",[record])).rows[0].count,1);
            await assert.rejects(executeDisposal(client,approval.id,{apply:true,quiesced:true}),/already|completed/i);
        } finally {client.release();}
    });
    await t.test('an application runtime role cannot apply an approved disposal',async()=>{
        const record=await createOld('Runtime must retain this record');
        const approval=(await call('officer','POST','/retention/approvals',{recordId:record,basis},201)).data;
        const {executeDisposal}=require('../scripts/retention-dispose');
        const role=`retention_runtime_${process.pid}`;
        await db.query(`CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE`);
        await db.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
        await db.query(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${role}`);
        const client=await db.pool.connect();
        try {
            await client.query(`SET ROLE ${role}`);
            await assert.rejects(executeDisposal(client,approval.id,{apply:true,quiesced:true}),/database owner/i);
        } finally {
            await client.query('RESET ROLE');client.release();
            await db.query(`DROP OWNED BY ${role}`);await db.query(`DROP ROLE ${role}`);
        }
        assert.equal((await db.query('SELECT COUNT(*)::int count FROM medical_records WHERE id=$1',[record])).rows[0].count,1);
    });
    await t.test('encrypted attachments stay pending until safe, auditable physical cleanup',async()=>{
        const fs=require('node:fs/promises');const os=require('node:os');const path=require('node:path');
        const {encryptBuffer}=require('../src/services/file.crypto');
        const {executeDisposal,cleanupDisposalFiles}=require('../scripts/retention-dispose');
        const root=await fs.mkdtemp(path.join(os.tmpdir(),'retention-attachments-'));
        const name='1234567890123_0123456789abcdef.pdf';
        const directory=path.join(root,'medical_files',people.patient.id,'lab_results');await fs.mkdir(directory,{recursive:true});
        const file=path.join(directory,name);const bytes=encryptBuffer(Buffer.from('Synthetic report'),`medical_files/${people.patient.id}/lab_results/${name}`);await fs.writeFile(file,bytes);
        const record=(await db.query("INSERT INTO medical_records(patient_id,type,title,created_by,immutable_flag,created_at,updated_at) VALUES($1,'lab_result','Expired standalone report',$2,true,NOW()-INTERVAL '400 days',NOW()-INTERVAL '400 days') RETURNING id",[people.patient.id,people.doctor.id])).rows[0].id;
        await db.query("INSERT INTO lab_results(record_id,test_name,file_url,ordered_by,uploaded_at,created_at) VALUES($1,'Synthetic test',$2,$3,NOW()-INTERVAL '400 days',NOW()-INTERVAL '400 days')",[record,`/api/files/${people.patient.id}/lab_results/${name}`,people.doctor.id]);
        await call('officer','POST','/retention/policies',{recordType:'lab_result',retentionDays:30,jurisdiction:'Synthetic jurisdiction',basis},201);
        const approval=(await call('officer','POST','/retention/approvals',{recordId:record,basis},201)).data;
        const client=await db.pool.connect();
        try {
            const result=await executeDisposal(client,approval.id,{apply:true,quiesced:true});
            assert.equal(result.status,'database_disposed');assert.deepEqual(await fs.readFile(file),bytes);
            assert.equal((await cleanupDisposalFiles(client,approval.id,{uploadPath:root})).pendingAttachments,1);
            const wrongRoot=path.join(root,'wrong-mount');await fs.mkdir(wrongRoot);
            await assert.rejects(cleanupDisposalFiles(client,approval.id,{uploadPath:wrongRoot,apply:true,quiesced:true}),/ENOENT|directory/i);
            assert.equal((await cleanupDisposalFiles(client,approval.id,{})).pendingAttachments,1);
            const outside=path.join(root,'unrelated.txt');await fs.writeFile(outside,'Unrelated fixture');
            await fs.unlink(file);await fs.symlink(outside,file);
            await assert.rejects(cleanupDisposalFiles(client,approval.id,{uploadPath:root,apply:true,quiesced:true}),/Unsafe/);
            assert.equal(await fs.readFile(outside,'utf8'),'Unrelated fixture');
            await fs.unlink(file);await fs.writeFile(file,bytes);
            await cleanupDisposalFiles(client,approval.id,{uploadPath:root,apply:true,quiesced:true});
            await assert.rejects(fs.access(file),{code:'ENOENT'});
            assert.equal((await db.query('SELECT status FROM retention_disposals WHERE id=$1',[approval.id])).rows[0].status,'completed');
        } finally {client.release();await fs.rm(root,{recursive:true,force:true});}
    });
    await t.test('correspondence and completed AI intake have explicit policies and controlled expiry too',async()=>{
        const {randomUUID}=require('node:crypto');const {seal}=require('../src/modules/privacy/privacy-crypto');
        const {executeDisposal}=require('../scripts/retention-dispose');
        const thread=(await db.query('INSERT INTO care_message_threads(patient_id,provider_id) VALUES($1,$2) RETURNING id',[people.patient.id,people.doctor.id])).rows[0].id;
        const message=randomUUID();
        await db.query("INSERT INTO care_messages(id,thread_id,patient_id,sender_id,body_cipher,created_at) VALUES($1,$2,$3,$3,$4,NOW()-INTERVAL '400 days')",[message,thread,people.patient.id,seal('Synthetic expired correspondence',`care-message:${message}`)]);
        const triage=(await db.query("INSERT INTO triage_sessions(patient_id,status,created_at,updated_at) VALUES($1,'completed',NOW()-INTERVAL '400 days',NOW()-INTERVAL '400 days') RETURNING id",[people.patient.id])).rows[0].id;
        for(const [resourceType,recordId,table] of [['care_message',message,'care_messages'],['triage_session',triage,'triage_sessions']]) {
            await call('officer','POST','/retention/policies',{recordType:resourceType,retentionDays:30,jurisdiction:'Synthetic jurisdiction',basis},201);
            const approval=(await call('officer','POST','/retention/approvals',{recordId,resourceType,basis},201)).data;
            const client=await db.pool.connect();
            try {await executeDisposal(client,approval.id,{apply:true,quiesced:true});}
            finally {client.release();}
            assert.equal((await db.query(`SELECT COUNT(*)::int count FROM ${table} WHERE id=$1`,[recordId])).rows[0].count,0);
        }
    });
    await t.test('a replacement policy allows an audited new approval without losing old evidence',async()=>{
        const id=await createOld('Policy replacement fixture');
        const old=(await call('officer','POST','/retention/approvals',{recordId:id,basis},201)).data;
        await call('officer','POST','/retention/policies',{recordType:'note',retentionDays:31,jurisdiction:'Synthetic jurisdiction',basis},201);
        const next=(await call('officer','POST','/retention/approvals',{recordId:id,basis},201)).data;
        assert.equal((await db.query('SELECT status FROM retention_disposals WHERE id=$1',[old.id])).rows[0].status,'superseded');
        const client=await db.pool.connect();try{const {executeDisposal}=require('../scripts/retention-dispose');await assert.rejects(executeDisposal(client,old.id),/already|supersed/i);await executeDisposal(client,next.id,{apply:true,quiesced:true});}finally{client.release();}
        assert.equal((await db.query("SELECT COUNT(*)::int count FROM audit_logs WHERE action='supersede_retention_approval' AND entity_id=$1",[old.id])).rows[0].count,1);
    });
    await t.test('resolving an old diagnosis restarts retention instead of allowing immediate disposal',async()=>{
        const record=await createOld('Recently resolved old diagnosis');
        const diagnosis=(await db.query("INSERT INTO diagnoses(record_id,icd_code,description,status,diagnosed_by,created_at,diagnosed_at) VALUES($1,'FIXTURE','Synthetic historical diagnosis','active',$2,NOW()-INTERVAL '400 days',NOW()-INTERVAL '400 days') RETURNING id",[record,people.doctor.id])).rows[0].id;
        await require('../src/models/diagnosis.model').updateStatus(diagnosis,'resolved');
        const result=(await call('officer','GET',`/retention/eligibility?recordId=${record}`)).data;
        assert.equal(result.eligible,false);assert.match(result.reasons.join(' '),/period.*not expired/);
    });
}));
