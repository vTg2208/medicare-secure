const {withDatabaseSnapshot}=require('./database-snapshot');
const {createBackup}=require('./backup-helper');
const {collectSnapshotFiles}=require('./backup-file-references');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');

async function createCoordinatedBackup({output,env=process.env}={}){
 const backend=env.FILE_STORAGE_BACKEND||'filesystem';
 if(!['filesystem','postgres'].includes(backend))throw Error('Unsupported file storage backend');
 if(backend==='postgres'){
  const stageRoot=await fs.mkdtemp(path.join(os.tmpdir(),'shms-durable-files-'));await fs.chmod(stageRoot,0o700);
  try{
   const {collectPostgresSnapshotFiles}=require('./postgres-upload-snapshot');
   return await withDatabaseSnapshot({env,fileCapture:(client,metadata)=>collectPostgresSnapshotFiles(client,metadata,{sourceRoot:env.UPLOAD_PATH,stageRoot})},
    descriptor=>createBackup({output,env:{...env,UPLOAD_PATH:stageRoot},databaseSnapshot:descriptor}));
  }finally{await fs.rm(stageRoot,{recursive:true,force:true});}
 }
 return withDatabaseSnapshot({env,fileCapture:(client,metadata)=>collectSnapshotFiles(client,metadata,env.UPLOAD_PATH)},
  descriptor=>createBackup({output,env,databaseSnapshot:descriptor}));
}
if(require.main===module)createCoordinatedBackup({output:process.argv[2]})
 .then(result=>process.stdout.write(JSON.stringify({created:true,files:result.files})+'\n'))
 .catch(()=>{process.stderr.write('Coordinated backup failed; verify database, upload volume and file references\n');process.exitCode=1;});
module.exports={createCoordinatedBackup};
