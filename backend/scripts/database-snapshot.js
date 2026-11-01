const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {Client}=require('pg');
const {databaseTls}=require('../src/config/database-tls');
const {readMigrations}=require('../src/database/migrate');
const {createBackup}=require('./backup-helper');
const quote=value=>`"${value.replaceAll('"','""')}"`;
const {knownFiles,fileColumnsSql}=require('./backup-file-references');
const {withFileBackupLock}=require('../src/services/file-coordination');

async function withDatabaseSnapshot({env=process.env,fileCapture}={},run){
 const schema=env.BACKUP_DATABASE_SCHEMA;
 if(!['public','healthcare'].includes(schema))throw Error('Explicit supported BACKUP_DATABASE_SCHEMA is required');
 if(!env.DB_HOST||!env.DB_NAME||!env.DB_USER||!Number.isInteger(Number(env.DB_PORT))||Number(env.DB_PORT)<1||Number(env.DB_PORT)>65535)throw Error('Explicit database connection settings are required');
 if(!['127.0.0.1','localhost','::1'].includes(env.DB_HOST)&&env.DB_SSL!=='true')throw Error('Remote snapshot requires verified database TLS');
 const client=new Client({host:env.DB_HOST,port:Number(env.DB_PORT),database:env.DB_NAME,user:env.DB_USER,password:env.DB_PASSWORD,ssl:databaseTls(env),connectionTimeoutMillis:15000,statement_timeout:60000,idle_in_transaction_session_timeout:300000,application_name:'healthcare-backup-snapshot'});
 try{
  await client.connect();
  const capture=async lease=>{
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const migrations=(await client.query(`SELECT id,file_hash FROM ${quote(schema)}._migrations`)).rows;
  if(!readMigrations().every(m=>migrations.some(row=>row.id===m.id&&row.file_hash===m.hash)))throw Error('Snapshot schema migration ledger is incomplete or changed');
  const columns=(await client.query(fileColumnsSql,[schema])).rows;
  for(const column of columns){
   if(!knownFiles.has(`${column.table_name}.${column.column_name}`))throw Error('Unknown external file column; coordinated backup required');
   if(fileCapture)continue;
   const exists=await client.query(`SELECT 1 FROM ${quote(schema)}.${quote(column.table_name)} WHERE ${quote(column.column_name)} IS NOT NULL AND ${quote(column.column_name)}::text<>'' LIMIT 1`);
   if(exists.rowCount)throw Error('Snapshot contains an external file reference; coordinated database/file backup required');
  }
  const cleanup=(await client.query(`SELECT to_regclass($1) AS name`,[`${schema}.retention_file_cleanup`])).rows[0].name;
  if(!fileCapture&&cleanup&&(await client.query(`SELECT 1 FROM ${quote(schema)}.retention_file_cleanup WHERE cleaned_at IS NULL LIMIT 1`)).rowCount)throw Error('Pending external file cleanup requires coordinated backup');
  const capturedFiles=fileCapture?await fileCapture(client,{schema,columns}):undefined;
  const tables=(await client.query(`SELECT c.relname AS name,c.relkind AS kind,has_table_privilege(current_user,c.oid,'SELECT') AS readable FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relkind IN('r','p','f','m') ORDER BY c.relname`,[schema])).rows;
  if(!tables.length||tables.length>200||tables.some(t=>!t.readable||!['r','p'].includes(t.kind)))throw Error('Unsupported or unreadable snapshot tables');
  for(const table of tables){table.rows=(await client.query(`SELECT count(*)::text AS count FROM ${quote(schema)}.${quote(table.name)}`)).rows[0].count;delete table.readable;delete table.kind;}
  const extensions=(await client.query(`SELECT e.extname AS name,n.nspname AS schema FROM pg_catalog.pg_extension e JOIN pg_catalog.pg_namespace n ON n.oid=e.extnamespace WHERE e.extname IN('uuid-ossp','pgcrypto','btree_gist') ORDER BY e.extname`)).rows;
  if(extensions.length!==3||extensions.some(e=>!['public','extensions',schema].includes(e.schema)))throw Error('Unsupported or missing snapshot extension namespace');
  const exported=(await client.query('SELECT pg_export_snapshot() AS id,transaction_timestamp() AS captured_at')).rows[0];
  const result=await run({id:exported.id,createdAt:exported.captured_at.toISOString(),schema,extensions,tables,mode:fileCapture?'coordinated':'database-only',capturedFiles,lease});
  await client.query('COMMIT');return result;
  };
  return fileCapture?await withFileBackupLock(capture,{client,env}):await capture();
 }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}
 finally{await client.end();}
}
async function createDatabaseSnapshot({output,env=process.env}={}){
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'shms-fileless-'));
 try{return await withDatabaseSnapshot({env},descriptor=>createBackup({output,env:{...env,UPLOAD_PATH:directory},databaseSnapshot:descriptor}));}
 finally{await fs.rm(directory,{recursive:true,force:true});}
}
if(require.main===module)createDatabaseSnapshot({output:process.argv[2]}).then(()=>process.stdout.write('Encrypted database snapshot created\n')).catch(()=>{process.stderr.write('Database snapshot failed; no recovery point was published\n');process.exitCode=1;});
module.exports={createDatabaseSnapshot,withDatabaseSnapshot};
