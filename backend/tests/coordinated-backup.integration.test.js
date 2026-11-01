const {test}=require('node:test');
// This suite must run in the clean container-client CI job as well as locally.
// This value encrypts disposable fixtures only; never load a deployment secret.
process.env.ENCRYPTION_KEY='e'.repeat(64);
const assert=require('node:assert/strict');
const {Client}=require('pg');
const {AsyncResource}=require('node:async_hooks');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const coordination=require('../src/services/file-coordination');
const enabled=process.env.RUN_DB_TESTS==='true';
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('file references preserve portable API paths and safely normalize Windows credential roots',()=>{
 const {normalizeReference}=require('../scripts/backup-file-references');
 assert.deepEqual(normalizeReference('C:\\private\\uploads\\documents\\degree.pdf','C:\\private\\uploads','doctor_profiles.degree_certificate_url'),{relative:'documents/degree.pdf',absolute:true});
 const medical='11111111-1111-4111-8111-111111111111/imaging/result.pdf';
 assert.deepEqual(normalizeReference('/api/files/'+medical,'/private/uploads','radiology_reports.file_path'),{relative:'medical_files/'+medical,absolute:false});
 for(const value of ['https://example.invalid/a.pdf','documents/../degree.pdf','documents/%2e%2e/degree.pdf','/private/other/degree.pdf','documents/degree.pdf?token=secret'])assert.throws(()=>normalizeReference(value,'/private/uploads','verification_documents.document_url'));
 assert.throws(()=>normalizeReference('/api/files/'+medical,'/private/uploads','organizations.license_document_url'));
});

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
  await t.test('a live session that no longer holds its advisory lock cannot claim ownership',async()=>{
   await assert.rejects(coordination.withFileBackupLock(async lease=>{
    await observer.query('SELECT pg_advisory_unlock_all()');
    await lease.assertHeld();
   },{client:observer,env}),/ownership|lock/i);
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
    const legacyPath=path.join(root,'documents/legacy.pdf');
    const legacy=require('../src/services/file.crypto').encryptBuffer(bytes);
    await fs.writeFile(legacyPath,legacy);
    const originalWrite=fs.writeFile;
    try{
     fs.writeFile=async(destination,data,options)=>{await originalWrite(destination,data.subarray(0,40),options);throw Error('synthetic interrupted credential write');};
     await assert.rejects(secureCredential({path:legacyPath,originalname:'legacy.pdf',mimetype:'application/pdf'}),/interrupted credential write/);
    }finally{fs.writeFile=originalWrite;}
    assert.deepEqual(await fs.readFile(legacyPath),legacy,'an interrupted rewrite must retain the complete previous ciphertext');
    assert.deepEqual((await fs.readdir(path.dirname(legacyPath))).sort(),['credential.pdf','legacy.pdf']);
   }finally{
    config.upload.uploadPath=previousRoot;
    if(previousTimeout===undefined)delete process.env.FILE_COORDINATION_TIMEOUT_MS;else process.env.FILE_COORDINATION_TIMEOUT_MS=previousTimeout;
    await fs.rm(root,{recursive:true,force:true});
   }
  });
 }finally{await observer.end();}
});

test('coordinated capture restores one database instant with its encrypted files', {skip:!enabled,timeout:120000},async t=>{
 assert.equal(process.env.NODE_ENV,'test');assert.ok(['127.0.0.1','localhost','::1'].includes(process.env.DB_HOST));assert.equal(String(process.env.DB_PORT),'55432');
 const {createCoordinatedBackup}=require('../scripts/coordinated-backup');
 const {inspectBundle,restoreBackup}=require('../scripts/backup-helper');
 const {verifyRestoredSnapshot}=require('../scripts/scheduled-backup');
 const {migrate}=require('../src/database/migrate');
 const {encryptBuffer,decryptBuffer}=require('../src/services/file.crypto');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'shms-coordinated-test-'));
 const uploads=path.join(root,'uploads');await fs.mkdir(path.join(uploads,'documents'),{recursive:true});
 const config={host:process.env.DB_HOST,port:Number(process.env.DB_PORT),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,ssl:false};
 const admin=new Client(config);await admin.connect();
 const suffix=crypto.randomBytes(6).toString('hex'),sourceName=`healthcare_coordinated_${suffix}`,targetName=`healthcare_restore_coordinated_${suffix}`;
 let source,target,readerRoleCreated=false;const extraTargets=[];
 const env={...process.env,DB_NAME:sourceName,BACKUP_DATABASE_SCHEMA:'healthcare',UPLOAD_PATH:uploads,BACKUP_ENCRYPTION_KEY:'d'.repeat(64)};
 const restoreEnv={...env,RESTORE_DISPOSABLE:'true',RESTORE_DB_HOST:config.host,RESTORE_DB_PORT:String(config.port),RESTORE_DB_USER:config.user,RESTORE_DB_PASSWORD:config.password,RESTORE_ADMIN_DB:config.database,RESTORE_DB_NAME:targetName};
 const plain=Buffer.from('%PDF-1.4\nSynthetic coordinated recovery content');
 const write=async relative=>{const absolute=path.join(uploads,...relative.split('/'));await fs.mkdir(path.dirname(absolute),{recursive:true});await fs.writeFile(absolute,encryptBuffer(plain,relative));return absolute;};
 try{
  await admin.query(`CREATE DATABASE "${sourceName}" TEMPLATE template0`);
  source=new Client({...config,database:sourceName});await source.connect();
  await source.query('CREATE SCHEMA healthcare; CREATE SCHEMA extensions; CREATE EXTENSION "uuid-ossp" SCHEMA extensions; CREATE EXTENSION pgcrypto SCHEMA extensions; CREATE EXTENSION btree_gist SCHEMA healthcare; SET search_path=healthcare,extensions,public');
  await migrate(source,{log:()=>{}});
  const patient=(await source.query("INSERT INTO users(email,role_id) VALUES('coordinated@example.invalid',(SELECT id FROM roles WHERE name='patient')) RETURNING id")).rows[0].id;
  const record=(await source.query("INSERT INTO medical_records(patient_id,type,title,created_by) VALUES($1,'lab_result','Synthetic recovery record',$1) RETURNING id",[patient])).rows[0].id;
  const medical=`medical_files/${patient}/lab_results/1700000000000_0123456789abcdef.pdf`;
  await write(medical);await write('documents/credential.pdf');const license=await write('documents/license.pdf');
  await write('documents/unpublished-orphan.pdf');
  const organization=(await source.query("INSERT INTO organizations(name,type,license_number,license_document_url) VALUES('Synthetic clinic','clinic','COORDINATED', $1) RETURNING id",[license])).rows[0].id;
  await source.query("INSERT INTO verification_documents(user_id,document_type,document_url) VALUES($1,'medical_license',$2)",[patient,path.join(uploads,'documents/credential.pdf')]);
  await source.query("INSERT INTO lab_results(record_id,test_name,file_url,ordered_by) VALUES($1,'Synthetic test',$2,$3)",[record,`/api/files/${patient}/lab_results/1700000000000_0123456789abcdef.pdf`,patient]);
  await source.query("CREATE TABLE healthcare.capture_fixture(id integer PRIMARY KEY); INSERT INTO healthcare.capture_fixture VALUES(1)");
  const input=path.join(root,'coordinated.shmsbkp');
  let manifest;
  await t.test('captures referenced files and excludes unpublished uploads without a quiescence flag',async()=>{
   delete env.BACKUP_QUIESCED;
   const result=await createCoordinatedBackup({output:input,env});assert.equal(result.files,3);
   manifest=await inspectBundle(input,Buffer.from(env.BACKUP_ENCRYPTION_KEY,'hex'));
   assert.equal(manifest.consistency.mode,'coordinated');assert.equal(manifest.consistency.fileReferences.length,3);
   assert.equal(manifest.entries.some(e=>e.path.includes('unpublished-orphan')),false);
   assert.equal(manifest.entries.length,4);
  });
  await t.test('fresh recovery rebases absolute references and decrypts every recovered file',async()=>{
   const recovered=path.join(root,'recovered');await restoreBackup({input,uploads:recovered,env:restoreEnv});
   target=new Client({...config,database:targetName,options:'-c search_path=healthcare,extensions,public'});await target.connect();
   const verification=await verifyRestoredSnapshot(target,manifest,{uploads:recovered});assert.equal(verification.filesVerified,3);
   assert.equal((await target.query('SELECT document_url FROM verification_documents')).rows[0].document_url,path.join(recovered,'documents/credential.pdf'));
   assert.equal((await target.query('SELECT license_document_url FROM organizations')).rows[0].license_document_url,path.join(recovered,'documents/license.pdf'));
   for(const relative of ['documents/credential.pdf','documents/license.pdf',medical])assert.deepEqual(decryptBuffer(await fs.readFile(path.join(recovered,...relative.split('/'))),relative),plain);
   await fs.unlink(path.join(recovered,...medical.split('/')));
   await assert.rejects(verifyRestoredSnapshot(target,manifest,{uploads:recovered}),/file|ENOENT/i);
  });
  await t.test('missing files, remote references, unknown columns and symbolic links refuse publication',async()=>{
   const refused=async(name,pattern)=>{const output=path.join(root,name+'.shmsbkp');await assert.rejects(createCoordinatedBackup({output,env}),pattern);await assert.rejects(fs.stat(output),{code:'ENOENT'});};
   await fs.rename(license,license+'.offline');await refused('missing',/file|ENOENT/i);await fs.rename(license+'.offline',license);
   await source.query('UPDATE organizations SET license_document_url=$1 WHERE id=$2',['https://example.invalid/remote.pdf',organization]);await refused('remote',/file|reference/i);
   await source.query('UPDATE organizations SET license_document_url=$1 WHERE id=$2',[license,organization]);
   await source.query('ALTER TABLE healthcare.capture_fixture ADD COLUMN attachment_path text');await refused('unknown',/file column/i);await source.query('ALTER TABLE healthcare.capture_fixture DROP COLUMN attachment_path');
   await fs.rename(license,license+'.offline');await fs.symlink(license+'.offline',license);await refused('symlink',/symbolic|symlink/i);await fs.unlink(license);await fs.rename(license+'.offline',license);
   assert.deepEqual((await source.query('SELECT id FROM capture_fixture')).rows,[{id:1}]);
  });
  await t.test('concurrent DB commits stay outside the snapshot and file deletion waits for encrypted publication',async()=>{
   const {withDatabaseSnapshot}=require('../scripts/database-snapshot');
   const {collectSnapshotFiles}=require('../scripts/backup-file-references');
   const {createBackup}=require('../scripts/backup-helper');
   const separate=new AsyncResource('concurrent-retention-worker');let deletion,deleted=false;
   const raceInput=path.join(root,'racing.shmsbkp');
   try{
    await withDatabaseSnapshot({env,fileCapture:(client,metadata)=>collectSnapshotFiles(client,metadata,uploads)},async descriptor=>{
     await source.query('INSERT INTO healthcare.capture_fixture VALUES(2)');
     deletion=separate.runInAsyncScope(()=>coordination.withFileMutation(async()=>{await fs.unlink(path.join(uploads,...medical.split('/')));deleted=true;},{env}));
     await createBackup({output:raceInput,env,databaseSnapshot:descriptor});
     assert.equal(deleted,false);assert.ok(await fs.stat(path.join(uploads,...medical.split('/'))));
    });
    await deletion;assert.equal(deleted,true);
    const name=`healthcare_restore_racing_${suffix}`;extraTargets.push(name);const recovered=path.join(root,'race-recovery');
    await restoreBackup({input:raceInput,uploads:recovered,env:{...restoreEnv,RESTORE_DB_NAME:name}});
    const reader=new Client({...config,database:name,options:'-c search_path=healthcare,extensions,public'});await reader.connect();
    try{
     assert.deepEqual((await reader.query('SELECT id FROM capture_fixture ORDER BY id')).rows,[{id:1}]);
     assert.equal((await verifyRestoredSnapshot(reader,await inspectBundle(raceInput,Buffer.from(env.BACKUP_ENCRYPTION_KEY,'hex')),{uploads:recovered})).filesVerified,3);
     assert.deepEqual(decryptBuffer(await fs.readFile(path.join(recovered,...medical.split('/'))),medical),plain);
    }finally{await reader.end();}
   }finally{if(deletion)await deletion;await write(medical);separate.emitDestroy();}
  });
  await t.test('pending retention files and an interrupted unlink recover without resurrecting removed bytes',async()=>{
   const policy=(await source.query("INSERT INTO retention_policies(record_type,retention_days,jurisdiction,basis_cipher,created_by) VALUES('lab_result',30,'synthetic','fixture',$1) RETURNING id",[patient])).rows[0].id;
   const disposal=(await source.query("INSERT INTO retention_disposals(record_id,patient_id,policy_id,basis_cipher,approved_by,status) VALUES($1,$2,$3,'fixture',$2,'database_disposed') RETURNING id",[record,patient,policy])).rows[0].id;
   const retained=`medical_files/${patient}/imaging/1700000000001_0123456789abcdef.pdf`;
   const removed=`medical_files/${patient}/imaging/1700000000002_0123456789abcdef.pdf`;await write(retained);
   await source.query("INSERT INTO retention_file_cleanup(disposal_id,patient_id,file_type,file_name) VALUES($1,$2,'imaging','1700000000001_0123456789abcdef.pdf'),($1,$2,'imaging','1700000000002_0123456789abcdef.pdf')",[disposal,patient]);
   const pendingInput=path.join(root,'pending.shmsbkp');await createCoordinatedBackup({output:pendingInput,env});
   const pendingManifest=await inspectBundle(pendingInput,Buffer.from(env.BACKUP_ENCRYPTION_KEY,'hex'));
   assert.deepEqual(pendingManifest.consistency.pendingFileCleanup.map(row=>row.present).sort(),[false,true]);
   const name=`healthcare_restore_pending_${suffix}`;extraTargets.push(name);const recovered=path.join(root,'pending-recovery');
   await restoreBackup({input:pendingInput,uploads:recovered,env:{...restoreEnv,RESTORE_DB_NAME:name}});
   const reader=new Client({...config,database:name,options:'-c search_path=healthcare,extensions,public'});await reader.connect();
   try{
    assert.equal((await verifyRestoredSnapshot(reader,pendingManifest,{uploads:recovered})).filesVerified,4);
    assert.deepEqual(decryptBuffer(await fs.readFile(path.join(recovered,...retained.split('/'))),retained),plain);
    await assert.rejects(fs.stat(path.join(recovered,...removed.split('/'))),{code:'ENOENT'});
    const {cleanupDisposalFiles}=require('../scripts/retention-dispose');
    await cleanupDisposalFiles(reader,disposal,{uploadPath:recovered,apply:true,quiesced:true});
    assert.equal((await reader.query('SELECT count(*)::int AS n FROM retention_file_cleanup WHERE cleaned_at IS NULL')).rows[0].n,0);
   }finally{await reader.end();}
  });
  await t.test('a failed dump or lost lock session leaves no bundle and releases file writers',async()=>{
   const failed=path.join(root,'failed-tool.shmsbkp');
   await assert.rejects(createCoordinatedBackup({output:failed,env:{...env,PG_DUMP_BIN:'/nonexistent/pg_dump'}}),/tool/i);
   await assert.rejects(fs.stat(failed),{code:'ENOENT'});
   await coordination.withFileMutation(async()=>{}, {env});
   const {withDatabaseSnapshot}=require('../scripts/database-snapshot');
   const {collectSnapshotFiles}=require('../scripts/backup-file-references');
   const {createBackup}=require('../scripts/backup-helper');
   const lost=path.join(root,'lost-session.shmsbkp');
   await assert.rejects(withDatabaseSnapshot({env,fileCapture:(client,metadata)=>collectSnapshotFiles(client,metadata,uploads)},async descriptor=>{
    const aborted=new Promise(resolve=>descriptor.lease.signal.addEventListener('abort',resolve,{once:true}));
    await source.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND application_name='healthcare-backup-snapshot'",[sourceName]);
    if(!descriptor.lease.signal.aborted)await aborted;
    await createBackup({output:lost,env,databaseSnapshot:descriptor});
   }),/session|ownership|connection|tool/i);
   await assert.rejects(fs.stat(lost),{code:'ENOENT'});
   assert.equal((await fs.readdir(root)).some(name=>name.includes('.partial-')),false);
   await coordination.withFileMutation(async()=>{}, {env});
  });
  await t.test('scheduled coordinated archives verify files from a cloud download before pruning',async()=>{
   const {runScheduledBackup}=require('../scripts/scheduled-backup');
   const objects=new Map();let removed=0,corrupt=false;
   const store={
    async list(){return [...objects.values()].map(({bytes,...file})=>file);},
    async upload(fileName,input){const bytes=await fs.readFile(input),fileId=crypto.randomUUID();const file={fileName,fileId,action:'upload',contentLength:bytes.length,uploadTimestamp:Date.now()};objects.set(fileId,{...file,bytes});return file;},
    async download(file,destination){const bytes=Buffer.from(objects.get(file.fileId).bytes);if(corrupt)bytes[bytes.length-1]^=1;await fs.writeFile(destination,bytes,{flag:'wx'});},
    async remove(file){removed++;objects.delete(file.fileId);}
   };
   const password='synthetic-coordinated-reader-password-only-1234567890';
   const roleSql=(await fs.readFile(path.join(__dirname,'../scripts/backup-reader-role.sql'),'utf8')).replaceAll('__BACKUP_READER_PASSWORD__',password);
   await source.query(roleSql);readerRoleCreated=true;
   const operator={...env,DB_USER:'healthcare_backup',DB_PASSWORD:password,BACKUP_MODE:'coordinated',RESTORE_DB_HOST:config.host,RESTORE_DB_PORT:String(config.port),RESTORE_DB_USER:config.user,RESTORE_DB_PASSWORD:config.password,RESTORE_ADMIN_DB:config.database};
   operator.BACKUP_APPLICATION_KEY_SHA256=crypto.createHash('sha256').update(Buffer.from(env.ENCRYPTION_KEY,'hex')).digest('hex');delete operator.ENCRYPTION_KEY;
   const result=await runScheduledBackup({env:operator,store});
   assert.equal(result.mode,'coordinated');assert.equal(result.filesVerified,4);assert.equal(result.restoreVerified,true);assert.equal(result.uploaded,2);assert.equal(removed,0);
   const previous=new Set(objects.keys());corrupt=true;
   await assert.rejects(runScheduledBackup({env:operator,store}),/Backup failed/);
   assert.equal(removed,0);for(const id of previous)assert.ok(objects.has(id));
   assert.equal((await admin.query("SELECT count(*)::int AS n FROM pg_database WHERE datname LIKE 'healthcare_restore_scheduled_%'")).rows[0].n,0);
   await assert.rejects(runScheduledBackup({env:{...operator,BACKUP_MODE:'misspelled'},store}),/mode/i);
  });
  await t.test('absolute lab, imaging and radiology references rebase without changing captured audit evidence',async()=>{
   const imaging=`medical_files/${patient}/imaging/1700000000003_0123456789abcdef.pdf`;
   const radiology=`medical_files/${patient}/imaging/1700000000004_0123456789abcdef.pdf`;
   await write(imaging);await write(radiology);
   await source.query('UPDATE lab_results SET file_url=$1 WHERE record_id=$2',[path.join(uploads,...medical.split('/')),record]);
   const imagingRecord=(await source.query("INSERT INTO medical_records(patient_id,type,title,created_by) VALUES($1,'imaging','Synthetic absolute-path recovery',$1) RETURNING id",[patient])).rows[0].id;
   await source.query("INSERT INTO imaging_reports(record_id,imaging_type,file_url,ordered_by) VALUES($1,'mri',$2,$3)",[imagingRecord,path.join(uploads,...imaging.split('/')),patient]);
   await source.query('INSERT INTO radiology_reports(patient_id,file_path) VALUES($1,$2)',[patient,path.join(uploads,...radiology.split('/'))]);
   const before=(await source.query('SELECT last_hash FROM audit_chain_head WHERE singleton=1')).rows[0].last_hash;
   const input=path.join(root,'absolute-medical.shmsbkp');await createCoordinatedBackup({output:input,env});
   const name=`healthcare_restore_absolute_${suffix}`;extraTargets.push(name);const recovered=path.join(root,'absolute-recovery');
   await restoreBackup({input,uploads:recovered,env:{...restoreEnv,RESTORE_DB_NAME:name}});
   const reader=new Client({...config,database:name,options:'-c search_path=healthcare,extensions,public'});await reader.connect();
   try{
    const manifest=await inspectBundle(input,Buffer.from(env.BACKUP_ENCRYPTION_KEY,'hex'));
    assert.equal((await verifyRestoredSnapshot(reader,manifest,{uploads:recovered})).filesVerified,6);
    assert.equal((await reader.query('SELECT last_hash FROM audit_chain_head WHERE singleton=1')).rows[0].last_hash,before);
    assert.equal((await reader.query('SELECT file_url FROM lab_results WHERE record_id=$1',[record])).rows[0].file_url,path.join(recovered,...medical.split('/')));
    assert.equal((await reader.query('SELECT file_url FROM imaging_reports')).rows[0].file_url,path.join(recovered,...imaging.split('/')));
    assert.equal((await reader.query('SELECT file_path FROM radiology_reports')).rows[0].file_path,path.join(recovered,...radiology.split('/')));
    const triggers=(await reader.query("SELECT c.relname,t.tgenabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='healthcare' AND t.tgname='clinical_change_audit' AND c.relname IN('lab_results','imaging_reports','radiology_reports') ORDER BY c.relname")).rows;
    assert.equal(triggers.length,3);assert.ok(triggers.every(row=>row.tgenabled==='O'));
   }finally{await reader.end();}
  });
 }finally{
  if(target)await target.end();if(source)await source.end();
  for(const name of [targetName,sourceName,...extraTargets])await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  if(readerRoleCreated)await admin.query('DROP ROLE healthcare_backup');
  await admin.end();await fs.rm(root,{recursive:true,force:true});
 }
});
