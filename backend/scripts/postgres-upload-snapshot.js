const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {uploadPath,contained}=require('./backup-helper');
const {referenceRows,pendingCleanup}=require('./backup-file-references');
const quote=value=>`"${value.replaceAll('"','""')}"`;
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

async function verifyBudget(client,schema){
 if(!['public','healthcare'].includes(schema))throw Error('Unsupported durable object schema');
 const table=quote(schema);
 const budget=(await client.query(`SELECT bytes_used::text,max_bytes::text FROM ${table}.encrypted_upload_budget WHERE singleton=true`)).rows;
 const actual=(await client.query(`SELECT COALESCE(sum(byte_length),0)::text AS bytes,count(*)::int AS objects FROM ${table}.encrypted_upload_objects`)).rows[0];
 if(budget.length!==1||budget[0].bytes_used!==actual.bytes||Number(actual.bytes)>Number(budget[0].max_bytes)||Number(budget[0].max_bytes)>67108864||actual.objects>10000)throw Error('Durable encrypted object budget failed verification');
}
async function objectRow(client,schema,relative){
 uploadPath(relative);
 const row=(await client.query(`SELECT ciphertext,byte_length::text,cipher_sha256 FROM ${quote(schema)}.encrypted_upload_objects WHERE relative_key=$1`,[relative])).rows[0];
 if(!row)return null;
 if(!Buffer.isBuffer(row.ciphertext)||row.ciphertext.length<37||row.ciphertext.length>10485796||row.ciphertext.subarray(0,8).toString()!=='SHMSENC2'||String(row.ciphertext.length)!==row.byte_length||hash(row.ciphertext)!==row.cipher_sha256)throw Error('Durable ciphertext object integrity failed verification');
 return row;
}
async function collectPostgresSnapshotFiles(client,{schema,columns},{sourceRoot,stageRoot}){
 if(!sourceRoot||!path.isAbsolute(sourceRoot)||!stageRoot)throw Error('An absolute logical upload root and private staging directory are required');
 await verifyBudget(client,schema);
 const references=await referenceRows(client,schema,sourceRoot,columns),cleanup=[],files=new Map();
 async function stage(relative,required){
  if(files.has(relative))return true;
  const row=await objectRow(client,schema,relative);
  if(!row){if(required)throw Error('A referenced durable encrypted file is missing');return false;}
  const absolute=contained(stageRoot,relative);await fs.mkdir(path.dirname(absolute),{recursive:true,mode:0o700});
  await fs.writeFile(absolute,row.ciphertext,{flag:'wx',mode:0o600});files.set(relative,{relative,absolute});return true;
 }
 for(const reference of references)await stage(reference.relative,true);
 for(const job of await pendingCleanup(client,schema))cleanup.push({...job,present:await stage(job.relative,false)});
 return {root:stageRoot,sourceRoot,backend:'postgres',references,cleanup,files:[...files.values()].sort((a,b)=>a.relative.localeCompare(b.relative))};
}
async function verifyPostgresObjects(client,schema,entries){
 await verifyBudget(client,schema);
 for(const entry of entries.filter(e=>e.path.startsWith('uploads/'))){
  const row=await objectRow(client,schema,entry.path.slice(8));
  if(!row||Number(row.byte_length)!==entry.size||row.cipher_sha256!==entry.sha256)throw Error('Recovered durable object differs from the captured file checksum');
 }
}
module.exports={collectPostgresSnapshotFiles,verifyPostgresObjects};
