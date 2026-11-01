const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Client } = require('pg');
const { migrate,readMigrations } = require('../src/database/migrate');
const { withApplication } = require('./helpers/application-fixture');
const { noticeFixture } = require('./helpers/privacy-notice-fixture');
test('notice migration upgrades an existing ledger and coordinated recovery preserves publication and receipt provenance', {skip:process.env.RUN_DB_TESTS!=='true',timeout:120000},async t=>{
    assert.equal(process.env.NODE_ENV,'test');assert.equal(process.env.DB_HOST,'127.0.0.1');assert.equal(String(process.env.DB_PORT),'55432');
    const connection={host:'127.0.0.1',port:55432,user:process.env.DB_USER,password:process.env.DB_PASSWORD,ssl:false};
    const admin=new Client({...connection,database:process.env.DB_NAME});await admin.connect();
    try{
        await t.test('032 to 033 preserves old rows and exact hashes, and replay publishes no fabricated notice',async()=>{
            const database=`healthcare_noticeupgrade_${process.pid}`;await admin.query(`CREATE DATABASE "${database}"`);
            const client=new Client({...connection,database});await client.connect();
            try{
                await migrate(client,{migrations:readMigrations().filter(migration=>migration.id<'033'),log(){}});
                const old=(await client.query('SELECT id,file_hash FROM _migrations ORDER BY id')).rows;
                const patient=(await client.query("INSERT INTO users(email,role_id,status) VALUES('legacy@example.invalid',(SELECT id FROM roles WHERE name='patient'),'active') RETURNING id")).rows[0].id;
                await migrate(client,{log(){}});const replay=await migrate(client,{log(){}});assert.equal(replay.applied,0);
                assert.deepEqual((await client.query("SELECT id,file_hash FROM _migrations WHERE id<'033' ORDER BY id")).rows,old);
                assert.equal((await client.query('SELECT count(*)::int AS n FROM users WHERE id=$1',[patient])).rows[0].n,1);
                assert.equal((await client.query('SELECT version_id FROM privacy_notice_current')).rows[0].version_id,null);
                assert.equal((await client.query('SELECT count(*)::int AS n FROM privacy_notice_versions')).rows[0].n,0);
                assert.equal((await client.query('SELECT count(*)::int AS n FROM privacy_notice_acknowledgements')).rows[0].n,0);
            }finally{await client.end();await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);}
        });
        await t.test('a real encrypted dump restores exact notice content, receipt ownership and decryptable private review',async()=>{
            await withApplication('noticerecovery',async({people,call})=>{
                const fixture=noticeFixture();const version=(await call('officer','POST','/notices/versions',fixture,201)).data;
                const receipt=(await call('patient','POST','/notices/acknowledgements',{versionId:version.id,acknowledged:true})).data;
                const directory=await fs.mkdtemp(path.join(os.tmpdir(),'notice-recovery-'));const output=path.join(directory,'snapshot.shmsbkp'),uploads=path.join(directory,'uploads');
                const target=`healthcare_restore_notices_${process.pid}`;let restored,created=false;
                const env={...process.env,BACKUP_DATABASE_SCHEMA:'public',BACKUP_ENCRYPTION_KEY:'e'.repeat(64),FILE_STORAGE_BACKEND:'postgres'};
                try{
                    await require('../scripts/coordinated-backup').createCoordinatedBackup({output,env});
                    t.diagnostic('Synthetic coordinated snapshot created');
                    const {inspectBundle,restoreBackup}=require('../scripts/backup-helper');
                    const manifest=await inspectBundle(output,Buffer.from(env.BACKUP_ENCRYPTION_KEY,'hex'));
                    assert.equal(manifest.consistency.mode,'coordinated');assert.equal(manifest.consistency.storageBackend,'postgres');
                    await restoreBackup({input:output,uploads,env:{...env,RESTORE_DISPOSABLE:'true',RESTORE_DB_HOST:'127.0.0.1',RESTORE_DB_PORT:'55432',RESTORE_DB_NAME:target,RESTORE_DB_USER:connection.user,RESTORE_DB_PASSWORD:connection.password,RESTORE_ADMIN_DB:'healthcare_test'}});created=true;
                    t.diagnostic('Synthetic snapshot restored');
                    restored=new Client({...connection,database:target});await restored.connect();
                    const verification=await require('../scripts/scheduled-backup').verifyRestoredSnapshot(restored,manifest,{uploads});
                    assert.equal(verification.tables,manifest.consistency.tables.length);assert.equal(verification.auditVerified,true);assert.equal(verification.ledgerVerified,true);
                    const history=await require('../src/modules/privacy/notices.service').ownedReceipts(restored,people.patient.id);
                    assert.equal(history.length,1);assert.equal(history[0].id,receipt.id);assert.equal(history[0].contentHash,version.contentHash);assert.equal(history[0].notice.content.sections.security,fixture.sections.security);
                    assert.deepEqual(await require('../src/modules/privacy/notices.service').ownedReceipts(restored,people.otherPatient.id),[]);
                    const row=(await restored.query('SELECT review_basis_ciphertext FROM privacy_notice_versions WHERE id=$1',[version.id])).rows[0];
                    assert.equal(require('../src/modules/privacy/privacy-crypto').unseal(row.review_basis_ciphertext,`notice-review:${version.id}`).basis,fixture.reviewBasis);
                    await assert.rejects(restored.query('DELETE FROM privacy_notice_acknowledgements WHERE id=$1',[receipt.id]),/immutable/i);
                }finally{
                    if(restored)await restored.end();if(created)await admin.query(`DROP DATABASE "${target}" WITH (FORCE)`);
                    assert.equal(path.dirname(directory),path.resolve(os.tmpdir()));assert.ok(path.basename(directory).startsWith('notice-recovery-'));await fs.rm(directory,{recursive:true,force:true});
                }
            });
        });
    }finally{await admin.end();}
});
