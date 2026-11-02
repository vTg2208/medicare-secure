const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {Client}=require('pg');
const {randomUUID}=require('node:crypto');
const {migrate,readMigrations}=require('../src/database/migrate');
test('fulfillment migration and later provisioning preserve immutable evidence in both schemas',{skip:process.env.RUN_DB_TESTS!=='true',timeout:90000},async t=>{
    assert.equal(process.env.DB_HOST,'127.0.0.1');assert.equal(String(process.env.DB_PORT),'55432');assert.equal(process.env.NODE_ENV,'test');
    const settings={host:'127.0.0.1',port:55432,user:process.env.DB_USER,password:process.env.DB_PASSWORD,ssl:false};
    const admin=new Client({...settings,database:process.env.DB_NAME});await admin.connect();const roles=[];
    try{
        for(const role of ['healthcare_api','healthcare_backup','anon','authenticated']){assert.equal((await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount,0);await admin.query(`CREATE ROLE ${role} NOLOGIN`);roles.push(role);}
        for(const schema of ['public','healthcare'])await t.test(`${schema}: upgrade retains old decisions and provisioning cannot forge receipt timestamps`,async()=>{
            const database=`healthcare_evidence_${schema}_${process.pid}`;await admin.query(`CREATE DATABASE ${database}`);const client=new Client({...settings,database});await client.connect();
            try{
                if(schema==='healthcare')await client.query('CREATE SCHEMA healthcare; CREATE SCHEMA extensions; CREATE EXTENSION "uuid-ossp" SCHEMA extensions; CREATE EXTENSION pgcrypto SCHEMA extensions; CREATE EXTENSION btree_gist SCHEMA healthcare; SET search_path=healthcare,extensions,public');
                await migrate(client,{migrations:readMigrations().filter(m=>m.id<'034'),log(){}});
                const oldLedger=(await client.query('SELECT id,file_hash FROM _migrations ORDER BY id')).rows;
                const patient=(await client.query("INSERT INTO users(email,role_id,status) VALUES('migration@example.invalid',(SELECT id FROM roles WHERE name='patient'),'active') RETURNING id")).rows[0].id;
                const other=(await client.query("INSERT INTO users(email,role_id,status) VALUES('other@example.invalid',(SELECT id FROM roles WHERE name='patient'),'active') RETURNING id")).rows[0].id;
                const requestId=randomUUID();
                await client.query("INSERT INTO privacy_rights_requests(id,patient_id,request_type,status,detail_cipher,outcome_cipher,due_at,resolved_at) VALUES($1,$2,'access','fulfilled','historical-synthetic-cipher','historical-synthetic-outcome',NOW(),NOW())",[requestId,patient]);
                const legacy=(await client.query('SELECT * FROM privacy_rights_requests WHERE id=$1',[requestId])).rows[0];
                if(schema==='healthcare')await client.query(require('../scripts/export-browser-upgrade').buildBrowserUpgradeSql({from:'033'}));else await migrate(client,{log(){}});
                assert.equal((await migrate(client,{log(){}})).applied,0);
                assert.deepEqual((await client.query("SELECT id,file_hash FROM _migrations WHERE id<'034' ORDER BY id")).rows,oldLedger);
                assert.deepEqual((await client.query('SELECT * FROM privacy_rights_requests WHERE id=$1',[requestId])).rows[0],legacy);
                assert.equal((await client.query('SELECT count(*)::int n FROM privacy_export_receipts')).rows[0].n,0);
                await client.query(`GRANT USAGE ON SCHEMA ${schema} TO healthcare_api,healthcare_backup`);
                if(schema==='healthcare')await client.query('GRANT USAGE ON SCHEMA extensions TO healthcare_api');
                const check=async()=>{
                    await client.query('SET ROLE healthcare_api');
                    try{
                        await assert.rejects(client.query("INSERT INTO privacy_export_receipts(request_id,patient_id,content_hash,byte_length,schema_version,scope,exclusions,prepared_at) VALUES($1,$2,$3,12,1,'Structured scope','[]','2000-01-01')",[requestId,patient,'a'.repeat(64)]),{code:'42501'});
                        await assert.rejects(client.query("INSERT INTO privacy_export_receipts(request_id,patient_id,content_hash,byte_length,schema_version,scope,exclusions) VALUES($1,$2,$3,12,1,'Structured scope','[]')",[requestId,other,'a'.repeat(64)]),{code:'23503'});
                        const receipt=(await client.query("INSERT INTO privacy_export_receipts(request_id,patient_id,content_hash,byte_length,schema_version,scope,exclusions) VALUES($1,$2,$3,12,1,'Structured scope','[]') RETURNING id",[requestId,patient,'a'.repeat(64)])).rows[0];
                        await client.query('INSERT INTO privacy_export_confirmations(receipt_id,request_id,patient_id,content_hash) VALUES($1,$2,$3,$4)',[receipt.id,requestId,patient,'a'.repeat(64)]);
                        await assert.rejects(client.query('UPDATE privacy_export_receipts SET scope=$1 WHERE id=$2',['forged',receipt.id]),{code:'42501'});
                        await assert.rejects(client.query('DELETE FROM privacy_export_confirmations WHERE receipt_id=$1',[receipt.id]),{code:'42501'});
                        await assert.rejects(client.query('TRUNCATE privacy_request_disposals'),{code:'42501'});
                    }finally{await client.query('RESET ROLE');}
                };
                await check();
                if(schema==='healthcare')await client.query(fs.readFileSync(path.resolve(__dirname,'../scripts/private-runtime-grants.sql'),'utf8'));
                else {const execution=spawnSync(process.execPath,[path.resolve(__dirname,'../scripts/provision-app-role.js')],{env:{...process.env,DB_NAME:database,DB_APP_USER:'healthcare_api',DB_APP_PASSWORD:'synthetic-evidence-role-password-only'},encoding:'utf8',timeout:20000});assert.equal(execution.status,0,execution.stderr);}
                await check();
                await client.query('SET ROLE healthcare_backup');
                assert.ok((await client.query('SELECT * FROM privacy_export_receipts')).rowCount>0);
                await assert.rejects(client.query('DELETE FROM privacy_export_receipts'),{code:'42501'});
                await client.query('RESET ROLE; SET ROLE anon');await assert.rejects(client.query(`SELECT * FROM ${schema}.privacy_export_receipts`),{code:'42501'});await client.query('RESET ROLE');
            }finally{await client.query('RESET ROLE').catch(()=>{});await client.end();await admin.query(`DROP DATABASE ${database} WITH (FORCE)`);}
        });
    }finally{for(const role of roles.reverse())await admin.query(`DROP ROLE ${role}`);await admin.end();}
});
