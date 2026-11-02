const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Client}=require('pg');
const {randomUUID}=require('node:crypto');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {withApplication}=require('./helpers/application-fixture');
test('coordinated recovery retains exact fulfillment receipts and decryptable case disposal scope',{skip:process.env.RUN_DB_TESTS!=='true',timeout:120000},async()=>{
    await withApplication('evidencerecovery',async({db,people,call})=>{
        const password='Synthetic-recovery-password-only!';
        await db.query('UPDATE users SET password_hash=$1 WHERE id=$2',[await require('../src/services/encryption.service').hashPassword(password),people.patient.id]);
        const open=async type=>{const row=(await call('patient','POST','/privacy/requests',{type,details:'Synthetic request recovery evidence for this patient only.'},201)).data;await call('officer','PUT',`/privacy/requests/${row.id}`,{status:'in_review'});return row;};
        const access=await open('access');
        const copy=await call('patient','POST',`/privacy/requests/${access.id}/export`,{currentPassword:password});
        await call('patient','POST',`/privacy/requests/${access.id}/receipts/${copy.receipt.id}/confirm`,{received:true,contentHash:copy.receipt.contentHash});
        await call('officer','PUT',`/privacy/requests/${access.id}`,{status:'fulfilled',resolution:'Only the requested supported structured information was supplied.',retentionBasis:'Synthetic reviewed scope without attachment delivery.',action:{type:'export_receipt',receiptId:copy.receipt.id}});
        const erasure=await open('erasure');
        const policy=(await call('officer','POST','/retention/policies',{recordType:'care_message',retentionDays:30,jurisdiction:'Synthetic',basis:'Reviewed synthetic disposal policy.'},201)).data;
        const disposal=randomUUID();const {seal,unseal}=require('../src/modules/privacy/privacy-crypto');
        await db.query("INSERT INTO retention_disposals(id,record_id,patient_id,resource_type,policy_id,basis_cipher,approved_by,status,executed_at,executed_by) VALUES($1,$2,$3,'care_message',$4,$5,$6,'completed',NOW(),'synthetic_fixture_owner')",[disposal,randomUUID(),people.patient.id,policy.id,seal('PRIVATE-DISPOSAL-BASIS',`retention-disposal:${disposal}`),people.officer.id]);
        await call('officer','POST',`/privacy/requests/${erasure.id}/disposals`,{disposalId:disposal,explanation:'Only synthetic correspondence is covered by this case association.'},201);
        const before=(await call('patient','GET','/privacy/requests')).data;
        assert.ok(!JSON.stringify(before).includes('PRIVATE-DISPOSAL-BASIS'));
        const directory=await fs.mkdtemp(path.join(os.tmpdir(),'fulfillment-recovery-'));
        const output=path.join(directory,'snapshot.shmsbkp'),uploads=path.join(directory,'uploads');
        const target=`healthcare_restore_fulfillment_${process.pid}`;
        const settings={host:'127.0.0.1',port:55432,user:process.env.DB_USER,password:process.env.DB_PASSWORD,ssl:false};
        const admin=new Client({...settings,database:'healthcare_test'});await admin.connect();let restored,created=false;
        const env={...process.env,BACKUP_DATABASE_SCHEMA:'healthcare',BACKUP_ENCRYPTION_KEY:'e'.repeat(64),FILE_STORAGE_BACKEND:'postgres'};
        try{
            await require('../scripts/coordinated-backup').createCoordinatedBackup({output,env});
            const {inspectBundle,restoreBackup}=require('../scripts/backup-helper');
            const manifest=await inspectBundle(output,Buffer.from(env.BACKUP_ENCRYPTION_KEY,'hex'));
            assert.ok(manifest.consistency.tables.some(table=>table.name==='privacy_export_confirmations'));
            await restoreBackup({input:output,uploads,env:{...env,RESTORE_DISPOSABLE:'true',RESTORE_DB_HOST:'127.0.0.1',RESTORE_DB_PORT:'55432',RESTORE_DB_NAME:target,RESTORE_DB_USER:settings.user,RESTORE_DB_PASSWORD:settings.password,RESTORE_ADMIN_DB:'healthcare_test'}});created=true;
            restored=new Client({...settings,database:target});await restored.connect();
            const verified=await require('../scripts/scheduled-backup').verifyRestoredSnapshot(restored,manifest,{uploads});
            assert.equal(verified.auditVerified,true);assert.equal(verified.ledgerVerified,true);
            await restored.query('SET search_path=healthcare,extensions,public');
            const evidence=await require('../src/modules/privacy/fulfillment-evidence.service').evidenceForRequests(restored,before.map(row=>row.id));
            for(const row of before)assert.deepEqual(JSON.parse(JSON.stringify(evidence[row.id])),row.evidence);
            const outcome=(await restored.query('SELECT outcome_cipher FROM privacy_rights_requests WHERE id=$1',[access.id])).rows[0];
            assert.deepEqual(unseal(outcome.outcome_cipher,`privacy-request:${access.id}:outcome`),before.find(row=>row.id===access.id).outcome);
            assert.equal(evidence[access.id].exports[0].contentHash,copy.receipt.contentHash);
            assert.equal((await restored.query('SELECT count(*)::int n FROM privacy_export_receipts WHERE patient_id=$1',[people.otherPatient.id])).rows[0].n,0);
            await assert.rejects(restored.query('DELETE FROM privacy_request_disposals WHERE disposal_id=$1',[disposal]),/immutable/);
        }finally{
            if(restored)await restored.end();if(created)await admin.query(`DROP DATABASE ${target} WITH (FORCE)`);await admin.end();
            assert.equal(path.dirname(directory),path.resolve(os.tmpdir()));assert.ok(path.basename(directory).startsWith('fulfillment-recovery-'));await fs.rm(directory,{recursive:true,force:true});
        }
    },{schema:'healthcare'});
});
