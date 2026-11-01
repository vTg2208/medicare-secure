const {withDatabaseSnapshot}=require('./database-snapshot');
const {createBackup}=require('./backup-helper');
const {collectSnapshotFiles}=require('./backup-file-references');

async function createCoordinatedBackup({output,env=process.env}={}){
 return withDatabaseSnapshot({env,fileCapture:(client,metadata)=>collectSnapshotFiles(client,metadata,env.UPLOAD_PATH)},
  descriptor=>createBackup({output,env,databaseSnapshot:descriptor}));
}
if(require.main===module)createCoordinatedBackup({output:process.argv[2]})
 .then(result=>process.stdout.write(JSON.stringify({created:true,files:result.files})+'\n'))
 .catch(()=>{process.stderr.write('Coordinated backup failed; verify database, upload volume and file references\n');process.exitCode=1;});
module.exports={createCoordinatedBackup};
