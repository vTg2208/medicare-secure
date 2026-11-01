const fs=require('node:fs/promises');
const {createReadStream}=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {uploadPath,contained}=require('./backup-helper');
const quote=value=>`"${value.replaceAll('"','""')}"`;
const knownFiles=new Set(['organizations.license_document_url','doctor_profiles.degree_certificate_url','doctor_profiles.medical_reg_certificate_url','verification_documents.document_url','verification_documents.file_path','lab_results.file_url','imaging_reports.file_url','radiology_reports.file_path']);
const fileColumnsSql=`SELECT c.relname AS table_name,a.attname AS column_name FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class c ON c.oid=a.attrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relkind IN('r','p') AND a.attnum>0 AND NOT a.attisdropped AND (a.attname ~ '(file|document|certificate|attachment|image|report|storage).*(url|path|oid)$' OR a.attname IN('attachments','attachment','blob_oid')) ORDER BY c.relname,a.attname`;

function normalizeReference(value,root,field){
 if(typeof value!=='string'||!knownFiles.has(field)||/[\x00-\x1f%?#]/.test(value)||value.includes('://'))throw Error('Unsupported external file reference');
 const input=value.replaceAll('\\','/'),base=root.replaceAll('\\','/').replace(/\/$/,'');
 let relative,absolute=false;
 if(input.startsWith(base+'/')){relative=input.slice(base.length+1);absolute=true;}
 else if(input.startsWith('/api/files/'))relative='medical_files/'+input.slice('/api/files/'.length);
 else if(input.startsWith('/uploads/'))relative=input.slice('/uploads/'.length);
 else relative=input;
 uploadPath(relative);
 const medical=['lab_results.file_url','imaging_reports.file_url','radiology_reports.file_path'].includes(field);
 if(!relative.startsWith(medical?'medical_files/':'documents/'))throw Error('File reference has an unsupported storage category');
 return {relative,absolute};
}

async function referenceRows(client,schema,root,columns){
 if(!['public','healthcare'].includes(schema))throw Error('Unsupported file-reference schema');
 columns=columns||(await client.query(fileColumnsSql,[schema])).rows;
 const references=[];
 for(const {table_name:table,column_name:column} of columns){
  const field=`${table}.${column}`;
  if(!knownFiles.has(field))throw Error('Unknown external file column; coordinated backup requires review');
  const rows=(await client.query(`SELECT id,${quote(column)} AS value FROM ${quote(schema)}.${quote(table)} WHERE ${quote(column)} IS NOT NULL AND ${quote(column)}::text<>'' ORDER BY id`)).rows;
  for(const row of rows){
   references.push({table,column,id:row.id,...normalizeReference(row.value,root,field)});
   if(references.length>10000)throw Error('Too many file references');
  }
 }
 return references;
}

function cleanupPath(row){
 if(!/^[a-f\d-]{36}$/i.test(row.patient_id)||!['lab_results','imaging'].includes(row.file_type)||!/^\d+_[a-f\d]{16}\.[a-z0-9]{1,8}$/i.test(row.file_name))throw Error('Unsafe pending file cleanup identity');
 return uploadPath(`medical_files/${row.patient_id}/${row.file_type}/${row.file_name}`);
}
async function pendingCleanup(client,schema){
 if(!(await client.query('SELECT to_regclass($1) AS name',[`${schema}.retention_file_cleanup`])).rows[0].name)return [];
 return (await client.query(`SELECT id,patient_id,file_type,file_name FROM ${quote(schema)}.retention_file_cleanup WHERE cleaned_at IS NULL ORDER BY id`)).rows.map(row=>({id:row.id,relative:cleanupPath(row)}));
}
async function regularFile(root,relative){
 const file=contained(root,uploadPath(relative));
 const stat=await fs.lstat(file);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||await fs.realpath(file)!==file)throw Error('Unsafe or symlinked referenced file');
 return {relative,absolute:file};
}
async function collectSnapshotFiles(client,{schema,columns},requestedRoot){
 if(!requestedRoot||!path.isAbsolute(requestedRoot))throw Error('Coordinated backup requires an absolute UPLOAD_PATH on the application volume');
 const root=path.resolve(requestedRoot),stat=await fs.lstat(root);
 if(!stat.isDirectory()||stat.isSymbolicLink()||await fs.realpath(root)!==root)throw Error('Unsafe or unavailable upload root');
 const references=await referenceRows(client,schema,root,columns);
 const files=new Map();
 for(const reference of references)files.set(reference.relative,await regularFile(root,reference.relative));
 const cleanup=[];
 for(const job of await pendingCleanup(client,schema)){
  let present=true;
  try{files.set(job.relative,await regularFile(root,job.relative));}
  catch(error){if(error.code!=='ENOENT')throw error;present=false;}
  cleanup.push({...job,present});
 }
 if(files.size>10000)throw Error('Too many coordinated files');
 return {root,references,cleanup,files:[...files.values()].sort((a,b)=>a.relative.localeCompare(b.relative))};
}

const sorted=values=>values.map(value=>JSON.stringify(value)).sort();
function assertSame(actual,expected,message){if(JSON.stringify(sorted(actual))!==JSON.stringify(sorted(expected)))throw Error(message);}
async function rebaseSnapshotReferences(client,manifest,destination){
 const consistency=manifest.consistency;
 const suspended=[];
 for(const table of new Set(consistency.fileReferences.filter(r=>r.absolute).map(r=>r.table))){
  if(!consistency.fileReferences.some(r=>r.table===table&&knownFiles.has(`${table}.${r.column}`)))throw Error('Unsupported recovery file reference');
  const trigger=(await client.query(`SELECT t.tgenabled,p.proname,f.nspname AS function_schema FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid JOIN pg_catalog.pg_namespace f ON f.oid=p.pronamespace WHERE n.nspname=$1 AND c.relname=$2 AND t.tgname='clinical_change_audit' AND NOT t.tgisinternal`,[consistency.schema,table])).rows[0];
  if(trigger&&trigger.tgenabled!=='D'){
   if(trigger.proname!=='audit_clinical_change'||trigger.function_schema!==consistency.schema||!['O','A','R'].includes(trigger.tgenabled))throw Error('Unsupported file recovery audit trigger');
   // Only inside the newly created disposable database and its existing restore
   // transaction: relocating a storage root is not a new clinical amendment.
   await client.query(`ALTER TABLE ${quote(consistency.schema)}.${quote(table)} DISABLE TRIGGER clinical_change_audit`);
   suspended.push({table,state:trigger.tgenabled});
  }
 }
 for(const reference of consistency.fileReferences){
  const field=`${reference.table}.${reference.column}`;
  if(!knownFiles.has(field)||typeof reference.id!=='string')throw Error('Unsupported recovery file reference');
  const table=`${quote(consistency.schema)}.${quote(reference.table)}`,column=quote(reference.column);
  const row=(await client.query(`SELECT ${column} AS value FROM ${table} WHERE id=$1`,[reference.id])).rows[0];
  if(!row||JSON.stringify(normalizeReference(row.value,manifest.sourceUploadRoot,field))!==JSON.stringify({relative:reference.relative,absolute:reference.absolute}))throw Error('Restored file reference differs from snapshot');
  if(reference.absolute)await client.query(`UPDATE ${table} SET ${column}=$1 WHERE id=$2`,[contained(destination,reference.relative),reference.id]);
 }
 for(const {table,state} of suspended)await client.query(`ALTER TABLE ${quote(consistency.schema)}.${quote(table)} ENABLE ${state==='A'?'ALWAYS ':state==='R'?'REPLICA ':''}TRIGGER clinical_change_audit`);
 // Re-create only the exact safe parent directories required for retrying a
 // cleanup that had unlinked its file before committing the cleanup marker.
 for(const job of consistency.pendingFileCleanup)if(!job.present)await fs.mkdir(path.dirname(contained(destination,uploadPath(job.relative))),{recursive:true,mode:0o700});
}

async function verifySnapshotFiles(client,manifest,destination){
 const consistency=manifest.consistency;
 if(!destination||consistency.coordination!=='postgres-advisory-v1'||!Array.isArray(consistency.fileReferences)||!Array.isArray(consistency.pendingFileCleanup))throw Error('Coordinated recovery file manifest is required');
 const root=await fs.realpath(destination);
 if(root!==path.resolve(destination)||(await fs.lstat(destination)).isSymbolicLink())throw Error('Unsafe recovered upload root');
 assertSame(await referenceRows(client,consistency.schema,root),consistency.fileReferences,'Recovered file references differ from snapshot');
 const pending=await pendingCleanup(client,consistency.schema);
 assertSame(pending,consistency.pendingFileCleanup.map(({id,relative})=>({id,relative})),'Recovered cleanup ledger differs from snapshot');
 const expected=new Set([...consistency.fileReferences.map(r=>r.relative),...consistency.pendingFileCleanup.filter(j=>j.present).map(j=>j.relative)]);
 const entries=manifest.entries.filter(e=>e.path.startsWith('uploads/'));
 assertSame(entries.map(e=>e.path.slice(8)),[...expected],'Recovered file inventory differs from snapshot');
 for(const entry of entries){
  const file=await regularFile(root,entry.path.slice(8));const hash=crypto.createHash('sha256');let size=0;
  for await(const bytes of createReadStream(file.absolute)){hash.update(bytes);size+=bytes.length;}
  if(size!==entry.size||hash.digest('hex')!==entry.sha256)throw Error('Recovered file checksum differs from snapshot');
 }
 for(const job of consistency.pendingFileCleanup)if(!job.present){
  try{await fs.lstat(contained(root,job.relative));throw Error('Previously removed cleanup file was resurrected');}
  catch(error){if(error.code!=='ENOENT')throw error;}
 }
 return {filesVerified:entries.length};
}
module.exports={knownFiles,fileColumnsSql,normalizeReference,collectSnapshotFiles,rebaseSnapshotReferences,verifySnapshotFiles};
