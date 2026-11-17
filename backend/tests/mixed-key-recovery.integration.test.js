const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {Client}=require('pg');
const {createBackup,restoreBackup}=require('../scripts/backup-helper');
let verifier={};try{verifier=require('../scripts/verify-recovery-encryption');}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}

test('custody-side recovery decrypts restored mixed-key seeds, privacy payloads and files',{skip:process.env.RUN_DB_TESTS!=='true',timeout:60000},async()=>{
    assert.equal(typeof verifier.verifyRecoverySamples,'function');
    assert.equal(process.env.NODE_ENV,'test');assert.equal(process.env.DB_HOST,'127.0.0.1');
    const root=await fs.mkdtemp(path.join(os.tmpdir(),'mixed-recovery-'));
    const sourceName=`healthcare_backup_test_mixed_${process.pid}`,targetName=`healthcare_restore_test_mixed_${process.pid}`;
    const connection={host:'127.0.0.1',port:Number(process.env.DB_PORT),user:process.env.DB_USER,password:process.env.DB_PASSWORD,ssl:false};
    const admin=new Client({...connection,database:'postgres'});await admin.connect();let source,restored;
    const legacy='a'.repeat(64),current='c'.repeat(64),backup='b'.repeat(64);
    const ring={ENCRYPTION_KEY:legacy,APPLICATION_ENCRYPTION_KEYS:JSON.stringify({current}),ENCRYPTION_ACTIVE_KEY_ID:'current'};
    const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
    const saved={...process.env};
    try{
        await admin.query(`CREATE DATABASE ${sourceName} TEMPLATE template0`);
        source=new Client({...connection,database:sourceName});await source.connect();
        await source.query('CREATE TABLE recovery_fixture(id text PRIMARY KEY,seed jsonb,privacy text,context text,relative text); CREATE TABLE verification_documents(id text PRIMARY KEY,file_path text NOT NULL)');
        Object.assign(process.env,ring);
        const {encryptSecret}=require('../src/services/encryption.service');
        const {seal}=require('../src/modules/privacy/privacy-crypto');
        const {encryptBuffer}=require('../src/services/file.crypto');
        const uploads=path.join(root,'source-uploads');await fs.mkdir(path.join(uploads,'documents'),{recursive:true});
        for(const [label,keyId] of [['old','legacy'],['new','current']]){
            process.env.ENCRYPTION_ACTIVE_KEY_ID=keyId;
            const context=`privacy/recovery/${label}`,relative=`documents/${label}.pdf`;
            const seed=encryptSecret(`seed-${label}`,`mfa/${label}`),privacy=seal({fixture:label},context);
            await source.query('INSERT INTO recovery_fixture VALUES($1,$2,$3,$4,$5)',[label,JSON.stringify(seed),privacy,context,relative]);
            await fs.writeFile(path.join(uploads,relative),encryptBuffer(Buffer.from(`%PDF-1.4 ${label}`),relative));
            await source.query('INSERT INTO verification_documents VALUES($1,$2)',[label,path.join(uploads,relative)]);
        }
        Object.assign(process.env,ring);
        const fingerprints=JSON.stringify([legacy,current].map(key=>sha(Buffer.from(key,'hex'))));
        const worker={...process.env,ENCRYPTION_KEY:undefined,APPLICATION_ENCRYPTION_KEYS:undefined,ENCRYPTION_ACTIVE_KEY_ID:undefined,
            BACKUP_APPLICATION_KEY_SHA256S:fingerprints,BACKUP_ENCRYPTION_KEY:backup,BACKUP_QUIESCED:'true',
            DB_NAME:sourceName,DB_HOST:'127.0.0.1',DB_PORT:String(connection.port),DB_USER:connection.user,DB_PASSWORD:connection.password,
            PGSSLMODE:'disable',UPLOAD_PATH:uploads};
        const artifact=path.join(root,'mixed.backup');await createBackup({output:artifact,env:worker});
        const restoredUploads=path.join(root,'restored-uploads');
        await restoreBackup({input:artifact,uploads:restoredUploads,env:{...worker,RESTORE_DISPOSABLE:'true',RESTORE_DB_HOST:'127.0.0.1',
            RESTORE_DB_PORT:String(connection.port),RESTORE_DB_NAME:targetName,RESTORE_DB_USER:connection.user,RESTORE_DB_PASSWORD:connection.password}});
        restored=new Client({...connection,database:targetName});await restored.connect();
        const rows=(await restored.query('SELECT * FROM recovery_fixture ORDER BY id')).rows;
        const samples={mfa:[],privacy:[],uploads:[]};
        for(const row of rows){
            samples.mfa.push({envelope:row.seed,context:`mfa/${row.id}`,sha256:sha(`seed-${row.id}`)});
            samples.privacy.push({ciphertext:row.privacy,context:row.context,sha256:sha(JSON.stringify({fixture:row.id}))});
            samples.uploads.push({ciphertext:(await fs.readFile(path.join(restoredUploads,row.relative))).toString('base64'),context:row.relative,sha256:sha(`%PDF-1.4 ${row.id}`)});
        }
        assert.deepEqual(verifier.verifyRecoverySamples(samples,ring),{mfa:2,privacy:2,uploads:2});
        const noHistoricalKey={APPLICATION_ENCRYPTION_KEYS:ring.APPLICATION_ENCRYPTION_KEYS,ENCRYPTION_ACTIVE_KEY_ID:'current'};
        for(const category of Object.keys(samples)){
            const old=samples[category].find(sample=>sample.context.includes('old'));
            assert.throws(()=>verifier.verifyRecoverySamples({[category]:[old]},noHistoricalKey));
            assert.throws(()=>verifier.verifyRecoverySamples({[category]:[{...old,context:`wrong/${old.context}`}]},ring));
        }
    }finally{
        for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];Object.assign(process.env,saved);
        await source?.end();await restored?.end();
        await admin.query(`DROP DATABASE IF EXISTS ${sourceName} WITH (FORCE)`);await admin.query(`DROP DATABASE IF EXISTS ${targetName} WITH (FORCE)`);await admin.end();
        assert.equal(path.dirname(root),path.resolve(os.tmpdir()));await fs.rm(root,{recursive:true,force:true});
    }
});
