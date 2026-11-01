const fs=require('node:fs/promises');
const {createReadStream}=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {inspectBundle,encryptionKey}=require('./backup-helper');
const PREFIX='medicare-backups/';
const MAX_ARTIFACT=256*1024*1024;
const BUDGET=8000000000;
const fail=message=>{throw Error(message);};

function providerUrl(value){
 const url=new URL(value);
 if(url.protocol!=='https:'||url.port||url.username||url.password||!/(^|\.)(backblazeb2\.com|backblaze\.com)$/.test(url.hostname))fail('Untrusted B2 endpoint');
 return url.href;
}
async function connectB2(env=process.env,fetchImpl=fetch){
 if(!env.B2_KEY_ID||!env.B2_APPLICATION_KEY||!env.B2_BUCKET_ID||(env.B2_PREFIX&&env.B2_PREFIX!==PREFIX))fail('Configure scoped B2 credentials, bucket ID and medicare-backups/ prefix');
 async function request(url,options={}){
  let response;
  try{response=await fetchImpl(providerUrl(url),{...options,redirect:'error',signal:AbortSignal.timeout(120000)});}catch{fail('B2 connection failed');}
  if(!response.ok){await response.body?.cancel();fail(`B2 request failed (HTTP ${response.status})`);}
  return response;
 }
 const auth=await (await request('https://api.backblazeb2.com/b2api/v4/b2_authorize_account',{headers:{Authorization:`Basic ${Buffer.from(`${env.B2_KEY_ID}:${env.B2_APPLICATION_KEY}`).toString('base64')}`}})).json();
 const api=auth.apiInfo?.storageApi;const allowed=api?.allowed;
 const capabilities=['listBuckets','listFiles','readFiles','writeFiles','deleteFiles'];
 if(allowed?.buckets?.length!==1||allowed.buckets[0].id!==env.B2_BUCKET_ID||allowed.namePrefix!==PREFIX||!capabilities.every(c=>allowed.capabilities?.includes(c)))fail('B2 key must be restricted to the backup bucket and exact backup prefix');
 const permitted=[...capabilities,'readBuckets','shareFiles','readFileRetentions','readFileLegalHolds','readBucketEncryption'];
 if(allowed.capabilities.some(c=>!permitted.includes(c)))fail('B2 key has unnecessary administrative capabilities');
 providerUrl(api.apiUrl);providerUrl(api.downloadUrl);
 const call=async(name,body)=> (await request(`${api.apiUrl}/b2api/v4/${name}`,{method:'POST',headers:{Authorization:auth.authorizationToken,'Content-Type':'application/json'},body:JSON.stringify(body)})).json();
 const bucket=(await call('b2_list_buckets',{accountId:auth.accountId,bucketId:env.B2_BUCKET_ID})).buckets;
 if(bucket?.length!==1||bucket[0].bucketId!==env.B2_BUCKET_ID||bucket[0].bucketType!=='allPrivate')fail('B2 archive bucket must be private');
 return {
  async list(){
   const files=[];let cursor={};const seen=new Set();
   for(let page=0;page<20;page++){
    const result=await call('b2_list_file_versions',{bucketId:env.B2_BUCKET_ID,prefix:PREFIX,maxFileCount:1000,...cursor});
    if(!Array.isArray(result.files))fail('Invalid B2 version listing');
    for(const file of result.files){
     if(!file.fileName?.startsWith(PREFIX)||!file.fileId||!Number.isSafeInteger(file.contentLength)||file.contentLength<0)fail('Invalid B2 file entry');
     files.push(file);
    }
    if(!result.nextFileName)return files;
    const next=JSON.stringify([result.nextFileName,result.nextFileId]);if(seen.has(next))fail('Repeated B2 pagination cursor');seen.add(next);
    cursor={startFileName:result.nextFileName,startFileId:result.nextFileId};
   }
   fail('B2 listing exceeds supported version count');
  },
  async upload(name,input){
   if(!managed({fileName:name,action:'upload'},new Date()))fail('Invalid archive object name');
   const stat=await fs.stat(input);if(stat.size>MAX_ARTIFACT)fail('Backup exceeds 256 MiB archive limit');
   const hash=crypto.createHash('sha1');for await(const chunk of createReadStream(input))hash.update(chunk);
   const upload=await call('b2_get_upload_url',{bucketId:env.B2_BUCKET_ID});
   const stream=createReadStream(input);
   try{return await (await request(upload.uploadUrl,{method:'POST',headers:{Authorization:upload.authorizationToken,'X-Bz-File-Name':encodeURIComponent(name),'X-Bz-Content-Sha1':hash.digest('hex'),'Content-Type':'application/octet-stream','Content-Length':String(stat.size)},body:stream,duplex:'half'})).json();}
   finally{stream.destroy();}
  },
  async download(file,destination){
   const response=await request(`${api.downloadUrl}/b2api/v4/b2_download_file_by_id?fileId=${encodeURIComponent(file.fileId)}`,{headers:{Authorization:auth.authorizationToken}});
   const handle=await fs.open(destination,'wx',0o600);let size=0;
   try{for await(const chunk of response.body){size+=chunk.length;if(size>MAX_ARTIFACT)fail('Downloaded backup exceeds archive limit');await handle.writeFile(chunk);}}
   finally{await response.body?.cancel().catch(()=>{});await handle.close();}
  },
  async remove(file){
   if(!managed(file,new Date()))fail('Refusing deletion outside managed archives');
   return call('b2_delete_file_version',{fileName:file.fileName,fileId:file.fileId});
  }
 };
}

function managed(file,now){
 if(file.action!=='upload')return null;
 const match=/^medicare-backups\/(daily|monthly)\/(\d{4}-\d{2}(?:-\d{2})?)\/([a-zA-Z0-9-]+)\.shmsbkp$/.exec(file.fileName||'');
 if(!match)return null;
 const [,kind,period]=match;const iso=now.toISOString();
 const day=kind==='daily'?period:`${period}-01`;
 if(period.length!==(kind==='daily'?10:7)||!Number.isFinite(Date.parse(day))||new Date(day).toISOString().slice(0,10)!==day||period>iso.slice(0,period.length))return null;
 return {kind,period};
}
function retentionPlan(files,now=new Date()){
 const remove=[];
 for(const kind of ['daily','monthly']){
  const candidates=files.filter(f=>managed(f,now)?.kind===kind).sort((a,b)=>b.fileName.split('/')[2].localeCompare(a.fileName.split('/')[2])||b.uploadTimestamp-a.uploadTimestamp||b.fileId.localeCompare(a.fileId));
  const periods=new Set();
  for(const file of candidates){const period=managed(file,now).period;if(periods.has(period)||periods.size>=(kind==='daily'?7:3))remove.push(file);else periods.add(period);}
 }
 return remove;
}
async function digest(input){const hash=crypto.createHash('sha256');for await(const chunk of createReadStream(input))hash.update(chunk);return hash.digest('hex');}

async function archiveBackup({input,env=process.env,store,now=new Date()}={}){
 const key=encryptionKey(env);if(!input||!Number.isFinite(now.getTime()))fail('Backup input and valid time required');
 const stat=await fs.lstat(input);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>MAX_ARTIFACT)fail('Backup must be a regular file no larger than 256 MiB');
 const staging=await fs.mkdtemp(path.join(os.tmpdir(),'shms-archive-'));await fs.chmod(staging,0o700);
 try{
  const snapshot=path.join(staging,'bundle.enc');await fs.copyFile(input,snapshot);await fs.chmod(snapshot,0o400);
  const manifest=await inspectBundle(snapshot,key); // Authenticate before credentials or ciphertext leave this host.
  const created=Date.parse(manifest.createdAt);
  if(!Number.isFinite(created)||created>now.getTime()+300000||new Date(created).toISOString().slice(0,10)!==now.toISOString().slice(0,10))fail('Only a fresh backup from the current UTC day may rotate archives');
  const checksum=await digest(snapshot);const bytes=(await fs.stat(snapshot)).size;
  store=store||await connectB2(env);
  const files=await store.list();const date=now.toISOString();
  const monthly=files.some(f=>managed(f,now)?.kind==='monthly'&&managed(f,now).period===date.slice(0,7));
  const kinds=monthly?['daily']:['daily','monthly'];
  const total=files.reduce((sum,f)=>sum+f.contentLength,0);
  if(!Number.isSafeInteger(total)||total+bytes*kinds.length>BUDGET)fail('Backup prefix would exceed the 8 GB storage budget; no files were pruned');
  const uploaded=[];
  for(const kind of kinds){
   const name=`${PREFIX}${kind}/${date.slice(0,kind==='daily'?10:7)}/${crypto.randomUUID()}.shmsbkp`;
   const file=await store.upload(name,snapshot);
   if(file.fileName!==name||!file.fileId||file.contentLength!==bytes)fail('Uploaded backup identity or size mismatch');
   const downloaded=path.join(staging,`${kind}.enc`);await store.download(file,downloaded);
   if(await digest(downloaded)!==checksum)fail('Remote backup checksum mismatch; previous backups retained');
   await inspectBundle(downloaded,key);uploaded.push(file);
  }
  const expired=retentionPlan([...files,...uploaded],now);
  const expiredIds=new Set(expired.map(f=>f.fileId));
  // A prior interrupted upload must never become a recovery anchor merely
  // because its name looks valid. Authenticate every retained prior bundle.
  for(const file of files.filter(f=>managed(f,now)&&!expiredIds.has(f.fileId))){
   const check=path.join(staging,`${crypto.randomUUID()}.enc`);await store.download(file,check);await inspectBundle(check,key);await fs.unlink(check);
  }
  for(const file of expired)await store.remove(file);
  return {uploaded:uploaded.length,pruned:expired.length,verified:true};
 }finally{await fs.rm(staging,{recursive:true,force:true});}
}
if(require.main===module)archiveBackup({input:process.argv[2]}).then(result=>process.stdout.write(`Archive verified: ${result.uploaded} uploaded, ${result.pruned} expired versions removed\n`)).catch(()=>{process.stderr.write('Archive failed; inspect configuration and provider status. No credentials or provider response bodies are logged.\n');process.exitCode=1;});
module.exports={connectB2,archiveBackup,retentionPlan};
