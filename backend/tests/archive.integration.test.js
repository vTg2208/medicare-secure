const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {createBackup}=require('../scripts/backup-helper');
const archive=require('../scripts/backup-archive');
const env={BACKUP_ENCRYPTION_KEY:'b'.repeat(64),ENCRYPTION_KEY:'a'.repeat(64),B2_KEY_ID:'fixture',B2_APPLICATION_KEY:'fixture-secret',B2_BUCKET_ID:'bucket',B2_PREFIX:'medicare-backups/'};
const file=(kind,period,id)=>({fileName:`medicare-backups/${kind}/${period}/${id}.shmsbkp`,fileId:id,action:'upload',contentLength:100,uploadTimestamp:1});

test('retention keeps seven distinct days, three months and ignores foreign or future names',()=>{
 const files=Array.from({length:9},(_,i)=>file('daily',`2026-10-${String(23+i).padStart(2,'0')}`,String(i)));
 files.push(file('daily','2026-10-31','retry'),...['07','08','09','10'].map(m=>file('monthly',`2026-${m}`,`m${m}`)),file('daily','2099-01-01','future'),{...file('daily','2026-01-01','other'),fileName:'other/important'});
 const removed=archive.retentionPlan(files,new Date('2026-11-01T00:00:00Z')).map(f=>f.fileId).sort();
 assert.deepEqual(removed,['0','1','8','m07'].sort());
});

function transport({publicBucket=false,wrongScope=false,foreignUrl=false}={}){
 const calls=[];let pages=0;
 const fetch=async(url,options={})=>{
  calls.push({url,options});
  if(url.includes('authorize_account'))return Response.json({accountId:'account',authorizationToken:'token',apiInfo:{storageApi:{apiUrl:foreignUrl?'https://evil.test':'https://api001.backblazeb2.com',downloadUrl:'https://f001.backblazeb2.com',allowed:{buckets:wrongScope?null:[{id:'bucket'}],namePrefix:'medicare-backups/',capabilities:['listBuckets','listFiles','readFiles','writeFiles','deleteFiles']}}}});
  if(url.includes('list_buckets'))return Response.json({buckets:[{bucketId:'bucket',bucketType:publicBucket?'allPublic':'allPrivate'}]});
  if(url.includes('list_file_versions'))return Response.json(++pages===1?{files:[file('daily','2026-10-30','a')],nextFileName:'next',nextFileId:'next-id'}:{files:[file('daily','2026-10-31','b')],nextFileName:null,nextFileId:null});
  return new Response('provider-secret-must-not-leak',{status:403});
 };return {fetch,calls};
}
test('B2 refuses public buckets, unrestricted keys and credential-bearing foreign endpoints',async()=>{
 for(const option of [{publicBucket:true},{wrongScope:true},{foreignUrl:true}]){
  const remote=transport(option);await assert.rejects(archive.connectB2(env,remote.fetch));
  assert.ok(remote.calls.every(c=>!c.url.includes('evil.test')));
 }
});
test('B2 enumerates all versions and suppresses provider error bodies',async()=>{
 const remote=transport();const store=await archive.connectB2(env,remote.fetch);
 assert.deepEqual((await store.list()).map(f=>f.fileId),['a','b']);
 await assert.rejects(store.remove(file('daily','2026-10-30','a')),error=>!error.message.includes('provider-secret'));
 assert.ok(remote.calls.every(c=>c.options.redirect==='error'));
});

async function fixture(run){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'shms-archive-test-'));
 try{
  await fs.mkdir(path.join(root,'uploads'));
  const input=path.join(root,'bundle.shmsbkp');
  await createBackup({output:input,env:{...env,PATH:process.env.PATH,BACKUP_QUIESCED:'true',UPLOAD_PATH:path.join(root,'uploads'),DB_HOST:'127.0.0.1',DB_PORT:'55432',DB_NAME:'fixture',DB_USER:'fixture'},dumpCommand:{file:process.execPath,args:['-e','process.stdout.write("fixture-database")','--']}});
  await run(root,input);
 }finally{await fs.rm(root,{recursive:true,force:true});}
}
function memoryStore({corrupt=false,failUpload=false,huge=false,bytes=Buffer.alloc(0)}={}){
 const objects=new Map();const deleted=[];const uploaded=[];
 const old=file('daily','2026-01-01','old');
 const listing=[old,...Array.from({length:7},(_,i)=>file('daily',`2026-10-${25+i}`,`keep${i}`))];
 if(huge)listing.push({...old,fileId:'huge',fileName:'medicare-backups/unmanaged',contentLength:8000000000});
 for(const item of listing)objects.set(item.fileId,bytes);
 return {deleted,uploaded,async list(){return listing;},async upload(name,input){if(failUpload)throw Error('fixture failure');const bytes=await fs.readFile(input);const entry={fileName:name,fileId:crypto.randomUUID(),action:'upload',contentLength:bytes.length,uploadTimestamp:Date.now()};objects.set(entry.fileId,bytes);uploaded.push(entry);return entry;},async download(entry,destination){const bytes=Buffer.from(objects.get(entry.fileId));if(corrupt)bytes[30]^=1;await fs.writeFile(destination,bytes,{flag:'wx'});},async remove(entry){deleted.push(entry.fileId);}};
}
test('verified ciphertext is archived daily and monthly before exact old versions are pruned',async()=>fixture(async(root,input)=>{
 const store=memoryStore({bytes:await fs.readFile(input)});const result=await archive.archiveBackup({input,env,store,now:new Date(new Date().setUTCHours(23,59,0,0))});
 assert.equal(result.uploaded,2);assert.equal(store.uploaded.length,2);assert.deepEqual(store.deleted.sort(),['keep0','old']);
 assert.ok(store.uploaded.some(f=>f.fileName.startsWith(`medicare-backups/monthly/${new Date().toISOString().slice(0,7)}/`)));
 assert.equal(await fs.readFile(input).then(b=>b.subarray(0,8).toString()),'SHMSBKP1');
}));
test('unverified prior archives cannot be used as retention anchors',async()=>fixture(async(root,input)=>{
 const store=memoryStore();await assert.rejects(archive.archiveBackup({input,env,store,now:new Date(new Date().setUTCHours(23,59,0,0))}));assert.deepEqual(store.deleted,[]);
}));
test('B2 transport sends ciphertext with its checksum and downloads the exact version',async()=>fixture(async(root,input)=>{
 const base=transport();let stored;let deleted=false;
 const name=`medicare-backups/daily/${new Date().toISOString().slice(0,10)}/fixture.shmsbkp`;
 const fetchImpl=async(url,options)=>{
  if(url.includes('b2_get_upload_url'))return Response.json({uploadUrl:'https://pod.backblaze.com/upload',authorizationToken:'upload-token'});
  if(url==='https://pod.backblaze.com/upload'){
   const chunks=[];for await(const chunk of options.body)chunks.push(chunk);stored=Buffer.concat(chunks);
   assert.equal(stored.subarray(0,8).toString(),'SHMSBKP1');
   assert.equal(options.headers['X-Bz-Content-Sha1'],crypto.createHash('sha1').update(stored).digest('hex'));
   assert.equal(decodeURIComponent(options.headers['X-Bz-File-Name']),name);
   return Response.json({fileName:name,fileId:'uploaded',contentLength:stored.length});
  }
  if(url.includes('b2_download_file_by_id')){assert.ok(url.endsWith('fileId=uploaded'));return new Response(stored);}
  if(url.includes('b2_delete_file_version')){assert.deepEqual(JSON.parse(options.body),{fileName:name,fileId:'uploaded'});deleted=true;return Response.json({});}
  return base.fetch(url,options);
 };
 const store=await archive.connectB2(env,fetchImpl);const item=await store.upload(name,input);const target=path.join(root,'download.enc');
 await store.download(item,target);assert.deepEqual(await fs.readFile(target),await fs.readFile(input));
 await store.remove({...item,action:'upload'});assert.equal(deleted,true);
}));
test('corrupt local bundle is refused before contacting storage',async()=>fixture(async(root,input)=>{
 const bytes=await fs.readFile(input);bytes[30]^=1;await fs.writeFile(input,bytes);
 const store=memoryStore();await assert.rejects(archive.archiveBackup({input,env,store}));assert.equal(store.uploaded.length,0);assert.deepEqual(store.deleted,[]);
}));
test('remote corruption, upload failure and budget overflow never prune previous backups',async()=>fixture(async(root,input)=>{
 for(const options of [{corrupt:true},{failUpload:true},{huge:true}]){
  const store=memoryStore(options);await assert.rejects(archive.archiveBackup({input,env,store,now:new Date(new Date().setUTCHours(23,59,0,0))}));assert.deepEqual(store.deleted,[]);
  if(options.huge)assert.equal(store.uploaded.length,0);
 }
}));
test('an old authenticated snapshot cannot be relabeled as a current recovery point',async()=>fixture(async(root,input)=>{
 const store=memoryStore();await assert.rejects(archive.archiveBackup({input,env,store,now:new Date(Date.now()+86400000)}),/fresh backup/);
 assert.equal(store.uploaded.length,0);assert.deepEqual(store.deleted,[]);
}));
