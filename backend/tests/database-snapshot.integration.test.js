const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {Client}=require('pg');
const {migrate}=require('../src/database/migrate');
const {createBackup,restoreBackup,inspectBundle,encryptionKey}=require('../scripts/backup-helper');
const snapshot=require('../scripts/database-snapshot');
const {verifyRestoredSnapshot,runScheduledBackup}=require('../scripts/scheduled-backup');
const applicationKey='a'.repeat(64),backupKey='b'.repeat(64);

test('backup operator can prove key separation using a fingerprint without receiving the application key',()=>{
 const hash=key=>crypto.createHash('sha256').update(Buffer.from(key,'hex')).digest('hex');
 assert.deepEqual(encryptionKey({BACKUP_ENCRYPTION_KEY:backupKey,BACKUP_APPLICATION_KEY_SHA256:hash(applicationKey)}),Buffer.from(backupKey,'hex'));
 assert.throws(()=>encryptionKey({BACKUP_ENCRYPTION_KEY:backupKey,BACKUP_APPLICATION_KEY_SHA256:hash(backupKey)}),/differ/);
 assert.throws(()=>encryptionKey({BACKUP_ENCRYPTION_KEY:backupKey,BACKUP_APPLICATION_KEY_SHA256:'invalid'}));
});
test('online snapshots preserve one database instant, restore extensions and refuse external files', {skip:process.env.RUN_DB_TESTS!=='true',timeout:120000},async t=>{
 assert.equal(process.env.NODE_ENV,'test');assert.ok(['127.0.0.1','localhost','::1'].includes(process.env.DB_HOST));
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'shms-snapshot-test-'));
 const config={host:process.env.DB_HOST,port:Number(process.env.DB_PORT),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,ssl:false};
 const admin=new Client(config);await admin.connect();const suffix=crypto.randomBytes(6).toString('hex');const sourceName=`healthcare_snapshot_${suffix}`,targetName=`healthcare_restore_snapshot_${suffix}`;
 let source,target;
 try{
  await admin.query(`CREATE DATABASE "${sourceName}" TEMPLATE template0`);
  source=new Client({...config,database:sourceName});await source.connect();
  await source.query('CREATE SCHEMA healthcare; CREATE SCHEMA extensions; CREATE EXTENSION "uuid-ossp" SCHEMA extensions; CREATE EXTENSION pgcrypto SCHEMA extensions; CREATE EXTENSION btree_gist SCHEMA healthcare; SET search_path=healthcare,extensions,public');
  await migrate(source,{log:()=>{}});
  await source.query("CREATE TABLE healthcare.snapshot_fixture(id integer PRIMARY KEY,payload text); INSERT INTO healthcare.snapshot_fixture VALUES(1,'before exported snapshot')");
  await source.query("INSERT INTO healthcare.audit_logs(action,entity_type) VALUES('SNAPSHOT_CHECK','system')");
  const env={...process.env,DB_NAME:sourceName,DB_SSL:'false',PGSSLMODE:'disable',BACKUP_DATABASE_SCHEMA:'healthcare',BACKUP_ENCRYPTION_KEY:backupKey,ENCRYPTION_KEY:applicationKey};
  delete env.BACKUP_QUIESCED;
  const output=path.join(root,'online.shmsbkp');
  await t.test('concurrent commit is excluded by the exact imported snapshot',async()=>{
   await snapshot.withDatabaseSnapshot({env},async descriptor=>{
    await source.query("INSERT INTO healthcare.snapshot_fixture VALUES(2,'committed after exported snapshot')");
    await fs.mkdir(path.join(root,'empty-uploads'));
    await createBackup({output,env:{...env,UPLOAD_PATH:path.join(root,'empty-uploads')},databaseSnapshot:descriptor});
   });
   const manifest=await inspectBundle(output,Buffer.from(backupKey,'hex'));
   assert.equal(manifest.consistency.mode,'database-only');assert.equal(manifest.consistency.schema,'healthcare');assert.ok(manifest.consistency.requiredSchemas.includes('extensions'));
   await restoreBackup({input:output,uploads:path.join(root,'restored-uploads'),env:{...env,RESTORE_DISPOSABLE:'true',RESTORE_DB_HOST:config.host,RESTORE_DB_PORT:String(config.port),RESTORE_DB_USER:config.user,RESTORE_DB_PASSWORD:config.password,RESTORE_ADMIN_DB:config.database,RESTORE_DB_NAME:targetName}});
   target=new Client({...config,database:targetName,options:'-c search_path=healthcare,extensions,public'});await target.connect();
   assert.deepEqual((await target.query('SELECT * FROM snapshot_fixture ORDER BY id')).rows,[{id:1,payload:'before exported snapshot'}]);
   assert.equal((await target.query('SELECT count(*)::int AS n FROM _migrations')).rows[0].n,require('../src/database/migrate').readMigrations().length);
   assert.equal((await target.query("SELECT encode(extensions.digest('restored crypto','sha256'),'hex') AS hash")).rows[0].hash,crypto.createHash('sha256').update('restored crypto').digest('hex'));
   assert.equal((await verifyRestoredSnapshot(target,manifest)).auditVerified,true);
   await target.query("INSERT INTO healthcare.snapshot_fixture VALUES(99,'unexpected recovery row')");
   await assert.rejects(verifyRestoredSnapshot(target,manifest),/row count/);
   await target.query('DELETE FROM healthcare.snapshot_fixture WHERE id=99');
   await target.query("ALTER TABLE healthcare.audit_logs DISABLE TRIGGER prevent_audit_mutation; UPDATE healthcare.audit_logs SET action='TAMPERED'");
   await assert.rejects(verifyRestoredSnapshot(target,manifest),/audit/i);
   await target.query("UPDATE healthcare.audit_logs SET action='SNAPSHOT_CHECK',current_hash='invalid'");
   await assert.rejects(verifyRestoredSnapshot(target,manifest),/audit/i);
   await target.query('UPDATE healthcare.audit_logs SET current_hash=NULL,hash_payload=NULL; ALTER TABLE healthcare.audit_chain_head DISABLE TRIGGER protect_audit_chain_head; UPDATE healthcare.audit_chain_head SET last_hash=NULL');
   await assert.rejects(verifyRestoredSnapshot(target,manifest),/audit/i);
   await target.query('ALTER TABLE healthcare.audit_logs ENABLE TRIGGER prevent_audit_mutation; ALTER TABLE healthcare.audit_chain_head ENABLE TRIGGER protect_audit_chain_head');
  });
  await t.test('known external files refuse publication rather than silently disappearing',async()=>{
   await source.query("INSERT INTO healthcare.organizations(name,type,license_number,license_document_url) VALUES('Fixture clinic','hospital','SYNTHETIC-SNAPSHOT','documents/fixture.pdf')");
   await assert.rejects(snapshot.createDatabaseSnapshot({output:path.join(root,'refused.shmsbkp'),env}),/external file/i);
   await assert.rejects(fs.stat(path.join(root,'refused.shmsbkp')),{code:'ENOENT'});
   await source.query('UPDATE healthcare.organizations SET license_document_url=NULL');
  });
  await t.test('unknown file columns and unsupported schema fail closed',async()=>{
   await source.query('ALTER TABLE healthcare.snapshot_fixture ADD COLUMN attachment_path text');
   await assert.rejects(snapshot.createDatabaseSnapshot({output:path.join(root,'unknown.shmsbkp'),env}),/file column/i);
   await source.query('ALTER TABLE healthcare.snapshot_fixture DROP COLUMN attachment_path');
   await assert.rejects(snapshot.createDatabaseSnapshot({output:path.join(root,'schema.shmsbkp'),env:{...env,BACKUP_DATABASE_SCHEMA:'private_custom'}}),/schema/i);
  });
  await t.test('legacy database-and-file backup still requires real write quiescence',async()=>{
   await assert.rejects(createBackup({output:path.join(root,'unsafe.shmsbkp'),env:{...env,UPLOAD_PATH:path.join(root,'empty-uploads')}}),/stopping application writes/);
  });
  await t.test('scheduled pipeline restores the fresh downloaded cloud copy before accepting retention',async()=>{
   const objects=new Map();const store={async list(){return [];},async upload(name,input){const bytes=await fs.readFile(input);const file={fileName:name,fileId:crypto.randomUUID(),action:'upload',contentLength:bytes.length,uploadTimestamp:Date.now()};objects.set(file.fileId,bytes);return file;},async download(file,destination){await fs.writeFile(destination,objects.get(file.fileId),{flag:'wx'});},async remove(){throw Error('No existing archive should be pruned');}};
   const password='synthetic-backup-reader-password-only-1234567890';
   const roleSql=(await fs.readFile(path.join(__dirname,'../scripts/backup-reader-role.sql'),'utf8')).replaceAll('__BACKUP_READER_PASSWORD__',password);
   await source.query(roleSql);
   const reader=new Client({...config,database:sourceName,user:'healthcare_backup',password});await reader.connect();
   try{
    await assert.rejects(reader.query("INSERT INTO healthcare.snapshot_fixture VALUES(200,'forbidden')"),error=>['25006','42501'].includes(error.code));
    await reader.query('SET default_transaction_read_only=off');
    await assert.rejects(reader.query("UPDATE healthcare.snapshot_fixture SET payload='forbidden'"),{code:'42501'});
    await assert.rejects(reader.query('DELETE FROM healthcare.snapshot_fixture'),{code:'42501'});
    await assert.rejects(reader.query('CREATE TABLE healthcare.forbidden(id integer)'),{code:'42501'});
   }finally{await reader.end();}
   const operator={...env,DB_USER:'healthcare_backup',DB_PASSWORD:password,RESTORE_DB_HOST:config.host,RESTORE_DB_PORT:String(config.port),RESTORE_DB_USER:config.user,RESTORE_DB_PASSWORD:config.password,RESTORE_ADMIN_DB:config.database,BACKUP_APPLICATION_KEY_SHA256:crypto.createHash('sha256').update(Buffer.from(applicationKey,'hex')).digest('hex')};delete operator.ENCRYPTION_KEY;
   await assert.rejects(runScheduledBackup({env:{...operator,RESTORE_DB_HOST:'remote.example.test'},store}),/loopback/);
   const result=await runScheduledBackup({env:operator,store});
   assert.equal(result.restoreVerified,true);assert.equal(result.auditVerified,true);assert.equal(result.uploaded,2);assert.equal(result.verified,true);
   assert.equal((await admin.query("SELECT count(*)::int AS n FROM pg_database WHERE datname LIKE 'healthcare_restore_scheduled_%'")).rows[0].n,0);
  });
 }finally{
  if(target)await target.end();if(source)await source.end();
  for(const name of [targetName,sourceName])await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await admin.query('DROP ROLE IF EXISTS healthcare_backup');
  await admin.end();await fs.rm(root,{recursive:true,force:true});
 }
});
