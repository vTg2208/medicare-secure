const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const { withApplication } = require('./helpers/application-fixture');
const { noticeFixture } = require('./helpers/privacy-notice-fixture');
test('private notice runtime grants preserve immutable timestamps and reader-only backup access', { skip:process.env.RUN_DB_TESTS!=='true',timeout:90000 },async t=>{
    assert.equal(process.env.NODE_ENV,'test'); assert.equal(process.env.DB_HOST,'127.0.0.1'); assert.equal(String(process.env.DB_PORT),'55432');
    const settings={host:'127.0.0.1',port:55432,user:process.env.DB_USER,password:process.env.DB_PASSWORD,ssl:false};
    const admin=new Client({...settings,database:process.env.DB_NAME}); await admin.connect(); const created=[];
    try {
        await withApplication('noticeruntime',async({db,people,call})=>{
            const original=(await call('officer','POST','/notices/versions',noticeFixture(),201)).data;
            for(const role of ['healthcare_api','healthcare_backup','anon','authenticated']){
                assert.equal((await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount,0,'The role fixture must not overwrite an existing principal');
                await admin.query(`CREATE ROLE ${role} NOLOGIN`); created.push(role);
            }
            // This deployment order is supported: API principal provisioned after migration.
            await db.query('GRANT USAGE ON SCHEMA healthcare TO healthcare_api,healthcare_backup');
            await db.query(fs.readFileSync(path.resolve(__dirname,'../scripts/private-runtime-grants.sql'),'utf8'));
            const writer=await db.pool.connect();
            try {
                await writer.query('SET ROLE healthcare_api');
                await t.test('the real application role can read and publish without broader history permissions',async()=>{
                    assert.equal((await writer.query('SELECT count(*)::int AS n FROM healthcare.privacy_notice_versions')).rows[0].n,1);
                    const fixture=noticeFixture('Runtime role publication'); const {reviewBasis,...content}=fixture;
                    const id=require('node:crypto').randomUUID(); const ciphertext=require('../src/modules/privacy/privacy-crypto').seal({basis:reviewBasis},`notice-review:${id}`);
                    await writer.query('INSERT INTO healthcare.privacy_notice_versions(id,content,review_basis_ciphertext,published_by) VALUES($1,$2,$3,$4)',[id,content,ciphertext,people.officer.id]);
                    await writer.query('UPDATE healthcare.privacy_notice_current SET version_id=$1',[id]);
                    await assert.rejects(writer.query('UPDATE healthcare.privacy_notice_current SET version_id=$1',[original.id]),/forward|newer/);
                    await assert.rejects(writer.query("UPDATE healthcare.privacy_notice_versions SET content='{}' WHERE id=$1",[id]),{code:'42501'});
                    await assert.rejects(writer.query('DELETE FROM healthcare.privacy_notice_versions WHERE id=$1',[id]),{code:'42501'});
                    await assert.rejects(writer.query('INSERT INTO healthcare.privacy_notice_acknowledgements(patient_id,version_id,notice_hash,acknowledged_at) VALUES($1,$2,$3,NOW())',[people.patient.id,original.id,original.contentHash]),{code:'42501'});
                    await assert.rejects(writer.query('INSERT INTO healthcare.privacy_notice_acknowledgements(patient_id,version_id,notice_hash) VALUES($1,$2,$3)',[people.patient.id,original.id,'0'.repeat(64)]),{code:'23503'});
                    await writer.query('INSERT INTO healthcare.privacy_notice_acknowledgements(patient_id,version_id,notice_hash) VALUES($1,$2,$3)',[people.patient.id,original.id,original.contentHash]);
                    await assert.rejects(writer.query('TRUNCATE healthcare.privacy_notice_acknowledgements'),{code:'42501'});
                    const privileges=(await writer.query("SELECT has_schema_privilege(current_user,'healthcare','CREATE') AS ddl,has_function_privilege(current_user,'healthcare.protect_privacy_notice_history()','EXECUTE') AS direct_guard")).rows[0];
                    assert.deepEqual(privileges,{ddl:false,direct_guard:false});
                });
                await writer.query('RESET ROLE');
                await writer.query('GRANT SELECT ON ALL TABLES IN SCHEMA healthcare TO healthcare_backup');
                await writer.query('SET ROLE healthcare_backup');
                assert.equal((await writer.query('SELECT count(*)::int AS n FROM healthcare.privacy_notice_acknowledgements')).rows[0].n,1);
                await assert.rejects(writer.query('DELETE FROM healthcare.privacy_notice_acknowledgements'),{code:'42501'});
                await writer.query('RESET ROLE; SET ROLE anon');
                await assert.rejects(writer.query('SELECT * FROM healthcare.privacy_notice_versions'),{code:'42501'});
            } finally { await writer.query('RESET ROLE'); writer.release(); }
        },{schema:'healthcare'});
    } finally { for(const role of created.reverse()) await admin.query(`DROP ROLE ${role}`); await admin.end(); }
});
