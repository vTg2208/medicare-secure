const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Client}=require('pg');
const {AsyncResource}=require('node:async_hooks');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const coordination=require('../src/services/file-coordination');
const enabled=process.env.RUN_DB_TESTS==='true';
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('file mutation gate serializes backup ownership across PostgreSQL sessions', {skip:!enabled,timeout:20000},async t=>{
 assert.equal(process.env.NODE_ENV,'test');assert.ok(['127.0.0.1','localhost','::1'].includes(process.env.DB_HOST));
 const env={...process.env,FILE_COORDINATION_TIMEOUT_MS:'200'};
 const config={host:env.DB_HOST,port:Number(env.DB_PORT),user:env.DB_USER,password:env.DB_PASSWORD,database:env.DB_NAME,ssl:false};
 const observer=new Client(config);await observer.connect();
 const independent=new AsyncResource('independent-file-client');
 const separately=run=>independent.runInAsyncScope(run);
 try{
  await t.test('readers can coexist and nested mutation does not deadlock',async()=>{
   await coordination.withFileMutation(async()=>{
    await coordination.withFileMutation(async()=>{});
    await separately(()=>coordination.withFileMutation(async()=>{}, {env}));
    await assert.rejects(separately(()=>coordination.withFileBackupLock(async()=>assert.fail('backup entered an active writer'),{env})),/timeout|lock/i);
   },{env});
  });
  await t.test('backup blocks new file mutation and failure releases its session lock',async()=>{
   await assert.rejects(coordination.withFileBackupLock(async()=>{
    await assert.rejects(separately(()=>coordination.withFileMutation(async()=>assert.fail('writer entered backup'),{env})),/timeout|lock/i);
    throw Error('synthetic capture failure');
   },{env}),/synthetic capture failure/);
   await coordination.withFileMutation(async()=>{}, {env});
  });
  await t.test('a supplied session remains usable and loses ownership on disconnection',async()=>{
   const client=new Client(config);await client.connect();
   await assert.rejects(coordination.withFileBackupLock(async lease=>{
    assert.equal(lease.signal.aborted,false);
    await client.end();await tick();
   },{client,env}),/session|ownership|connection/i);
   await coordination.withFileBackupLock(async()=>{}, {client:observer,env});
   assert.equal((await observer.query('SELECT 1 AS n')).rows[0].n,1);
  });
  await t.test('actual report and credential writers cannot publish while backup owns the lock',async()=>{
   const config=require('../src/config/env');const Files=require('../src/services/file.upload.service');
   const {secureCredential,readCredential}=require('../src/services/credential-file.service');
   const root=await fs.mkdtemp(path.join(os.tmpdir(),'shms-file-lock-'));
   const previousRoot=config.upload.uploadPath,previousTimeout=process.env.FILE_COORDINATION_TIMEOUT_MS;
   config.upload.uploadPath=root;process.env.FILE_COORDINATION_TIMEOUT_MS='200';
   const bytes=Buffer.from('%PDF-1.4\nSynthetic coordinated report');
   const file={buffer:bytes,originalname:'result.pdf',mimetype:'application/pdf',size:bytes.length};
   const credential={...file,path:path.join(root,'documents','credential.pdf')};
   try{
    await fs.mkdir(path.join(root,'documents'));
    await coordination.withFileBackupLock(async()=>{
     await assert.rejects(separately(()=>Files.processUpload(file,{patientId:'11111111-1111-4111-8111-111111111111',fileType:'lab_results'})),/lock timeout/i);
     await assert.rejects(separately(()=>secureCredential(credential)),/lock timeout/i);
     assert.deepEqual(await fs.readdir(root),['documents']);
    },{env});
    await secureCredential(credential);assert.deepEqual(await readCredential(credential.path),bytes);
    const saved=await Files.processUpload(file,{patientId:'11111111-1111-4111-8111-111111111111',fileType:'lab_results'});
    assert.deepEqual(await Files.getFile(saved.filePath),bytes);
    await coordination.withFileBackupLock(async()=>{
     await assert.rejects(separately(()=>Files.deleteFile(saved.filePath)),/lock timeout/i);
     assert.deepEqual(await Files.getFile(saved.filePath),bytes);
    },{env});
    await Files.deleteFile(saved.filePath);await assert.rejects(fs.stat(saved.filePath),{code:'ENOENT'});
   }finally{
    config.upload.uploadPath=previousRoot;
    if(previousTimeout===undefined)delete process.env.FILE_COORDINATION_TIMEOUT_MS;else process.env.FILE_COORDINATION_TIMEOUT_MS=previousTimeout;
    await fs.rm(root,{recursive:true,force:true});
   }
  });
 }finally{await observer.end();}
});
