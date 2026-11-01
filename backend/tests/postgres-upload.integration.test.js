const {test}=require('node:test');
process.env.ENCRYPTION_KEY='f'.repeat(64);
process.env.JWT_SECRET||='8'.repeat(64);
process.env.JWT_REFRESH_SECRET||='9'.repeat(64);
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const os=require('node:os');
const {Client}=require('pg');
const {withApplication}=require('./helpers/application-fixture');

test('durable encrypted uploads survive ephemeral filesystem loss and enforce clinical access', {skip:process.env.RUN_DB_TESTS!=='true',timeout:120000},async t=>{
 process.env.FILE_STORAGE_BACKEND='postgres';
 await withApplication('durable_upload',async({db,people,visit,call})=>{
  const request=require('supertest'),app=require('../src/app'),Files=require('../src/services/file.upload.service');
  const config=require('../src/config/env');
  const bytes=Buffer.from('%PDF-1.4\nSynthetic durable uploaded-file backup verification\n%%EOF\n');
  const record=(await db.query("INSERT INTO medical_records(patient_id,visit_id,type,title,created_by) VALUES($1,$2,'lab_result','Synthetic durable upload',$3) RETURNING id",[people.patient.id,visit,people.doctor.id])).rows[0].id;
  let fileUrl,relative,ciphertext;
  await t.test('an actual multipart upload persists only encrypted bytes with generated integrity metadata',async()=>{
   const response=await request(app).post('/api/emr/lab-results').set('Authorization','Bearer '+people.doctor.token).field('recordId',record).field('testName','Synthetic durable PDF').attach('file',bytes,{filename:'verification.PDF',contentType:'application/pdf'});
   assert.equal(response.status,201,JSON.stringify(response.body));fileUrl=response.body.data.file_url;
   relative='medical_files/'+fileUrl.slice('/api/files/'.length);
   const row=(await db.query('SELECT ciphertext,byte_length,cipher_sha256 FROM encrypted_upload_objects WHERE relative_key=$1',[relative])).rows[0];
   assert.ok(row);ciphertext=row.ciphertext;assert.equal(ciphertext.subarray(0,8).toString(),'SHMSENC2');assert.equal(ciphertext.includes(bytes),false);
   assert.equal(Number(row.byte_length),ciphertext.length);assert.equal(row.cipher_sha256,crypto.createHash('sha256').update(ciphertext).digest('hex'));
   await assert.rejects(fs.stat(path.join(config.upload.uploadPath,...relative.split('/'))),{code:'ENOENT'});
  });
  await t.test('a restart with an empty local upload tree still serves the authorized patient and rejects another patient',async()=>{
   assert.ok(path.basename(config.upload.uploadPath).startsWith('healthcare-fixture-'));
   await fs.rm(config.upload.uploadPath,{recursive:true,force:true});
   const response=await request(app).get(fileUrl).set('Authorization','Bearer '+people.patient.token).buffer(true).parse((res,done)=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>done(null,Buffer.concat(chunks)));});
   assert.equal(response.status,200);assert.deepEqual(response.body,bytes);
   const denied=await request(app).get(fileUrl).set('Authorization','Bearer '+people.otherPatient.token);assert.equal(denied.status,403);
  });
  await t.test('ciphertext rows are immutable and quota accounting matches committed bytes',async()=>{
   await assert.rejects(db.query('UPDATE encrypted_upload_objects SET ciphertext=$1 WHERE relative_key=$2',[ciphertext,relative]),/immutable/i);
   const accounting=(await db.query('SELECT (SELECT bytes_used FROM encrypted_upload_budget WHERE singleton=true)=(SELECT COALESCE(sum(byte_length),0) FROM encrypted_upload_objects) AS valid')).rows[0];assert.equal(accounting.valid,true);
  });
  await t.test('production scanner failure does not create a durable object',async()=>{
   const previous=process.env.NODE_ENV;process.env.NODE_ENV='production';
   try{
    const count=(await db.query('SELECT count(*)::int AS n FROM encrypted_upload_objects')).rows[0].n;
    await assert.rejects(Files.processUpload({buffer:bytes,originalname:'blocked.pdf',mimetype:'application/pdf',size:bytes.length},{patientId:people.patient.id,fileType:'lab_results'}),/scanning service.*configured/i);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM encrypted_upload_objects')).rows[0].n,count);
   }finally{process.env.NODE_ENV=previous;}
  });
  await t.test('a rejected registration and malformed lab metadata reclaim unpublished durable objects',async()=>{
   const before=(await db.query('SELECT bytes_used::text FROM encrypted_upload_budget')).rows[0].bytes_used;
   const credentialPath=path.join(config.upload.uploadPath,'documents','rejected-registration.pdf');
   await require('../src/services/credential-file.service').secureCredential({path:credentialPath,buffer:bytes,originalname:'rejected-registration.pdf',mimetype:'application/pdf'});
   const res={status(code){this.code=code;return this;},json(value){this.body=value;return this;}};
   await require('../src/modules/auth/auth.controller').registerOrganization({body:{},file:{path:credentialPath},headers:{}},res);
   assert.equal(res.code,400);assert.equal((await db.query('SELECT bytes_used::text FROM encrypted_upload_budget')).rows[0].bytes_used,before);
   const rejected=await request(app).post('/api/emr/lab-results').set('Authorization','Bearer '+people.doctor.token).field('recordId',record).field('testName','Synthetic invalid metadata').field('resultsData','{invalid-json').attach('file',bytes,{filename:'rejected.pdf',contentType:'application/pdf'});
   assert.equal(rejected.status,500);assert.equal((await db.query('SELECT bytes_used::text FROM encrypted_upload_budget')).rows[0].bytes_used,before);
  });
  await t.test('a minimally privileged writer obeys a serialized storage budget under concurrent inserts',async()=>{
   const role=`healthcare_upload_fixture_${process.pid}_${crypto.randomBytes(4).toString('hex')}`;assert.match(role,/^healthcare_upload_fixture_\d+_[a-f\d]+$/);
   await db.query(`CREATE ROLE ${role} NOLOGIN; GRANT USAGE ON SCHEMA healthcare,extensions TO ${role}; GRANT SELECT,INSERT,DELETE ON encrypted_upload_objects TO ${role}`);
   const clients=[];
   try{
    await db.query('UPDATE encrypted_upload_budget SET max_bytes=bytes_used+$1 WHERE singleton=true',[ciphertext.length]);
    for(let i=0;i<2;i++){const client=await db.pool.connect();await client.query(`SET ROLE ${role}`);clients.push(client);}
    const results=await Promise.allSettled(clients.map((client,index)=>client.query('INSERT INTO encrypted_upload_objects(relative_key,ciphertext) VALUES($1,$2)',[`documents/quota-${index}.pdf`,ciphertext])));
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.code==='P7801').length,1);
    await assert.rejects(clients[0].query('UPDATE encrypted_upload_budget SET bytes_used=0'),{code:'42501'});
    await assert.rejects(clients[0].query('UPDATE encrypted_upload_objects SET ciphertext=$1 WHERE relative_key=$2',[ciphertext,relative]),{code:'42501'});
    assert.equal((await db.query('SELECT bytes_used=(SELECT sum(byte_length) FROM encrypted_upload_objects) AS valid FROM encrypted_upload_budget')).rows[0].valid,true);
   }finally{
    for(const client of clients){await client.query('RESET ROLE');client.release();}
    await db.query("DELETE FROM encrypted_upload_objects WHERE relative_key IN('documents/quota-0.pdf','documents/quota-1.pdf')");
    await db.query('UPDATE encrypted_upload_budget SET max_bytes=67108864');
    await db.query(`DROP OWNED BY ${role}; DROP ROLE ${role}`);
   }
  });
  await t.test('approved retention cleanup deletes durable bytes and advances its ledger without a local mount',async()=>{
   const pending=await Files.processUpload({buffer:bytes,originalname:'retention.pdf',mimetype:'application/pdf',size:bytes.length},{patientId:people.patient.id,fileType:'imaging'});
   const policy=(await db.query("INSERT INTO retention_policies(record_type,retention_days,jurisdiction,basis_cipher,created_by) VALUES('lab_result',30,'synthetic','fixture',$1) RETURNING id",[people.officer.id])).rows[0].id;
   const decision=(await db.query("INSERT INTO retention_disposals(record_id,patient_id,policy_id,basis_cipher,approved_by,status) VALUES($1,$2,$3,'fixture',$4,'database_disposed') RETURNING id",[record,people.patient.id,policy,people.officer.id])).rows[0].id;
   await db.query("INSERT INTO retention_file_cleanup(disposal_id,patient_id,file_type,file_name) VALUES($1,$2,'imaging',$3)",[decision,people.patient.id,pending.fileName]);
   const client=await db.pool.connect();
   try{await require('../scripts/retention-dispose').cleanupDisposalFiles(client,decision,{uploadPath:config.upload.uploadPath,apply:true,quiesced:true});}
   finally{client.release();}
   assert.equal((await db.query('SELECT status FROM retention_disposals WHERE id=$1',[decision])).rows[0].status,'completed');
   await assert.rejects(Files.getFile(pending.filePath),{code:'ENOENT'});
   assert.equal((await db.query('SELECT bytes_used=(SELECT sum(byte_length) FROM encrypted_upload_objects) AS valid FROM encrypted_upload_budget')).rows[0].valid,true);
  });
  await t.test('a remote coordinated worker captures durable bytes without the source filesystem or application key',async()=>{
   const {createCoordinatedBackup}=require('../scripts/coordinated-backup');
   const {inspectBundle,restoreBackup}=require('../scripts/backup-helper');
   const {verifyRestoredSnapshot,runScheduledBackup}=require('../scripts/scheduled-backup');
   const directory=await fs.mkdtemp(path.join(os.tmpdir(),'shms-durable-recovery-'));
   const input=path.join(directory,'durable.shmsbkp'),uploads=path.join(directory,'recovered');
   const name=`healthcare_restore_durable_${process.pid}`;let reader,roleCreated=false;
   const operator={...process.env,UPLOAD_PATH:config.upload.uploadPath,BACKUP_DATABASE_SCHEMA:'healthcare',BACKUP_MODE:'coordinated',FILE_STORAGE_BACKEND:'postgres',BACKUP_ENCRYPTION_KEY:'d'.repeat(64),BACKUP_APPLICATION_KEY_SHA256:crypto.createHash('sha256').update(Buffer.from(process.env.ENCRYPTION_KEY,'hex')).digest('hex'),RESTORE_DISPOSABLE:'true',RESTORE_DB_HOST:process.env.DB_HOST,RESTORE_DB_PORT:process.env.DB_PORT,RESTORE_DB_NAME:name,RESTORE_DB_USER:process.env.DB_USER,RESTORE_DB_PASSWORD:process.env.DB_PASSWORD,RESTORE_ADMIN_DB:'healthcare_test'};delete operator.ENCRYPTION_KEY;
   try{
    const password='synthetic-durable-backup-reader-password-only-1234567890';
    await db.query((await fs.readFile(path.join(__dirname,'../scripts/backup-reader-role.sql'),'utf8')).replaceAll('__BACKUP_READER_PASSWORD__',password));roleCreated=true;
    operator.DB_USER='healthcare_backup';operator.DB_PASSWORD=password;
    await createCoordinatedBackup({output:input,env:operator});
    const manifest=await inspectBundle(input,Buffer.from(operator.BACKUP_ENCRYPTION_KEY,'hex'));
    assert.equal(manifest.consistency.storageBackend,'postgres');assert.equal(manifest.sourceUploadRoot,config.upload.uploadPath);assert.equal(manifest.entries.length,2);
    await restoreBackup({input,uploads,env:operator});
    reader=new Client({host:operator.RESTORE_DB_HOST,port:Number(operator.RESTORE_DB_PORT),database:name,user:operator.RESTORE_DB_USER,password:operator.RESTORE_DB_PASSWORD,ssl:false,options:'-c search_path=healthcare,extensions,public'});await reader.connect();
    assert.equal((await verifyRestoredSnapshot(reader,manifest,{uploads})).filesVerified,1);
    const recovered=await fs.readFile(path.join(uploads,...relative.split('/')));assert.deepEqual(recovered,ciphertext);
    assert.deepEqual(require('../src/services/file.crypto').decryptBuffer(recovered,relative),bytes);
    const objects=new Map();const store={async list(){return [];},async upload(fileName,source){const data=await fs.readFile(source),file={fileName,fileId:crypto.randomUUID(),action:'upload',contentLength:data.length,uploadTimestamp:Date.now()};objects.set(file.fileId,data);return file;},async download(file,destination){await fs.writeFile(destination,objects.get(file.fileId),{flag:'wx'});},async remove(){assert.fail('No previous backup exists');}};
    const result=await runScheduledBackup({env:operator,store});assert.equal(result.mode,'coordinated');assert.equal(result.filesVerified,1);assert.equal(result.restoreVerified,true);assert.equal(result.uploaded,2);
    await reader.query('ALTER TABLE encrypted_upload_objects DISABLE TRIGGER account_encrypted_upload_bytes');
    await reader.query('UPDATE encrypted_upload_objects SET ciphertext=set_byte(ciphertext,byte_length::int-1,get_byte(ciphertext,byte_length::int-1)#1) WHERE relative_key=$1',[relative]);
    await assert.rejects(verifyRestoredSnapshot(reader,manifest,{uploads}),/checksum|ciphertext|object/i);
   }finally{
    if(reader)await reader.end();
    await db.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    if(roleCreated){await db.query('DROP OWNED BY healthcare_backup');await db.query('DROP ROLE healthcare_backup');}
    await fs.rm(directory,{recursive:true,force:true});
   }
  });
 },{schema:'healthcare'});
});
