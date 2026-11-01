const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const {Client}=require('pg');
const {readMigrations}=require('../src/database/migrate');
const {createDatabaseSnapshot}=require('./database-snapshot');
const {createCoordinatedBackup}=require('./coordinated-backup');
const {archiveBackup}=require('./backup-archive');
const {inspectBundle,encryptionKey,restoreBackup}=require('./backup-helper');
const quote=value=>`"${value.replaceAll('"','""')}"`;

async function verifyRestoredSnapshot(client,manifest,{uploads}={}){
 const consistency=manifest.consistency;
 if(!['database-only','coordinated'].includes(consistency?.mode)||!['public','healthcare'].includes(consistency.schema)||!Array.isArray(consistency.tables)||!consistency.tables.length||consistency.tables.length>200)throw Error('Unsupported recovery manifest');
 const schema=quote(consistency.schema);
 const actual=(await client.query(`SELECT c.relname AS name FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relkind IN('r','p') ORDER BY c.relname`,[consistency.schema])).rows.map(row=>row.name);
 if(JSON.stringify(actual)!==JSON.stringify(consistency.tables.map(t=>t.name)))throw Error('Restored table inventory differs from snapshot');
 for(const table of consistency.tables){
  const count=(await client.query(`SELECT count(*)::text AS n FROM ${schema}.${quote(table.name)}`)).rows[0].n;
  if(count!==table.rows)throw Error('Restored row count differs from snapshot');
 }
 const ledger=(await client.query(`SELECT id,file_hash FROM ${schema}._migrations`)).rows;
 if(!readMigrations().every(m=>ledger.some(row=>row.id===m.id&&row.file_hash===m.hash)))throw Error('Restored migration ledger differs from source');
 const cryptoSchema=(await client.query("SELECT n.nspname FROM pg_catalog.pg_extension e JOIN pg_catalog.pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pgcrypto'")).rows[0]?.nspname;
 if(!['public','extensions',consistency.schema].includes(cryptoSchema))throw Error('Unsupported restored audit crypto namespace');
 const invalid=await client.query(`WITH links AS(SELECT previous_hash,current_hash,hash_payload,hash_version,${schema}.audit_payload(a) AS expected_payload,lag(current_hash) OVER(ORDER BY sequence) AS prior FROM ${schema}.audit_logs a) SELECT count(*)::int AS n FROM links WHERE hash_version<>1 OR current_hash IS NULL OR hash_payload IS NULL OR hash_payload IS DISTINCT FROM expected_payload OR COALESCE(previous_hash,'')<>COALESCE(prior,'') OR current_hash IS DISTINCT FROM encode(${quote(cryptoSchema)}.digest(COALESCE(previous_hash,'')||hash_payload,'sha256'),'hex')`);
 if(invalid.rows[0].n)throw Error('Restored audit chain failed verification');
 const head=(await client.query(`SELECT last_hash FROM ${schema}.audit_chain_head WHERE singleton=1`)).rows;
 const tail=(await client.query(`SELECT current_hash FROM ${schema}.audit_logs ORDER BY sequence DESC LIMIT 1`)).rows[0]?.current_hash||null;
 if(head.length!==1||head[0].last_hash!==tail)throw Error('Restored audit head differs from retained evidence');
 const files=consistency.mode==='coordinated'?await require('./backup-file-references').verifySnapshotFiles(client,manifest,uploads):{};
 return {tables:actual.length,auditVerified:true,ledgerVerified:true,...files};
}

async function drillRecovery(input,env,parent){
 const name=`healthcare_restore_scheduled_${crypto.randomBytes(8).toString('hex')}`;
 const uploads=path.join(parent,`recovery-${crypto.randomUUID()}`);
 const restoreEnv={...env,RESTORE_DISPOSABLE:'true',RESTORE_DB_NAME:name,DB_SSL:'false',PGSSLMODE:'disable'};
 let created=false,client;
 try{
  const manifest=await inspectBundle(input,encryptionKey(env));
  await restoreBackup({input,uploads,env:restoreEnv});created=true;
  client=new Client({host:env.RESTORE_DB_HOST,port:Number(env.RESTORE_DB_PORT),database:name,user:env.RESTORE_DB_USER,password:env.RESTORE_DB_PASSWORD,ssl:false,connectionTimeoutMillis:10000});await client.connect();
  return await verifyRestoredSnapshot(client,manifest,{uploads});
 }finally{
  if(client)await client.end();
  if(created){
   const admin=new Client({host:env.RESTORE_DB_HOST,port:Number(env.RESTORE_DB_PORT),database:env.RESTORE_ADMIN_DB||'postgres',user:env.RESTORE_DB_USER,password:env.RESTORE_DB_PASSWORD,ssl:false,connectionTimeoutMillis:10000});
   try{await admin.connect();await admin.query(`DROP DATABASE ${quote(name)} WITH (FORCE)`);}finally{await admin.end();}
   await fs.rm(uploads,{recursive:true,force:true});
  }
 }
}

async function runScheduledBackup({env=process.env,store}={}){
 const mode=env.BACKUP_MODE||'database-only';
 if(!['database-only','coordinated'].includes(mode))throw Error('Unsupported BACKUP_MODE');
 if(!['127.0.0.1','localhost','::1'].includes(env.RESTORE_DB_HOST)||!Number.isInteger(Number(env.RESTORE_DB_PORT))||Number(env.RESTORE_DB_PORT)<1||Number(env.RESTORE_DB_PORT)>65535||!env.RESTORE_DB_USER)throw Error('Explicit loopback recovery database is required');
 encryptionKey(env);
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'shms-scheduled-'));await fs.chmod(directory,0o700);
 let stage='snapshot';
 try{
  const configured={...env};
  if(env.DB_SSL_CA){
   const ca=path.join(directory,'postgres-ca.crt');await fs.writeFile(ca,env.DB_SSL_CA.replace(/\\n/g,'\n'),{mode:0o444});configured.PGSSLROOTCERT=ca;configured.DB_SSL_CA_FILE=ca;
  }
  const input=path.join(directory,'snapshot.shmsbkp');
  await (mode==='coordinated'?createCoordinatedBackup:createDatabaseSnapshot)({output:input,env:configured});
  const manifest=await inspectBundle(input,encryptionKey(env));
  stage='cloud upload or recovery';let recovery;
  const archive=await archiveBackup({input,env:configured,store,verifyRecovery:async downloaded=>{recovery=await drillRecovery(downloaded,configured,directory);}});
  if(!recovery)throw Error('Fresh cloud recovery was not verified');
  return {createdAt:manifest.createdAt,mode,restoreVerified:true,auditVerified:recovery.auditVerified,tables:recovery.tables,...(mode==='coordinated'&&{filesVerified:recovery.filesVerified}),...archive};
 }catch(error){throw Object.assign(Error(`Backup failed during ${stage}; previous recovery points were not intentionally removed`),{code:'BACKUP_FAILED',cause:error});}
 finally{await fs.rm(directory,{recursive:true,force:true});}
}
if(require.main===module)runScheduledBackup().then(async result=>{
 process.stdout.write(JSON.stringify(result)+'\n');
 if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,`### Verified encrypted backup\n\nCaptured: ${result.createdAt}\n\nRestored ${result.tables} tables from the fresh cloud download; migration ledger and audit chain passed.${result.mode==='coordinated'?` Verified ${result.filesVerified} encrypted uploaded files and their database references.`:''} Uploaded ${result.uploaded} copies; removed ${result.pruned} expired versions.\n\n${result.objects.map(f=>`- \`${f.fileName}\``).join('\n')}\n`);
}).catch(error=>{const code=/^[A-Z0-9_]{1,40}$/.test(error.cause?.code||'')?error.cause.code:'VERIFICATION_FAILED';process.stderr.write(`Scheduled backup failed (${code}). Check database connectivity, external-file policy, credentials and recovery service. Required recovery points remain protected.\n`);process.exitCode=1;});
module.exports={runScheduledBackup,verifyRestoredSnapshot,drillRecovery};
