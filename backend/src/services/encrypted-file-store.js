const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const config=require('../config/env');
const {withFileMutation}=require('./file-coordination');
const {uploadPath}=require('../../scripts/backup-helper');

function isPostgresStorage(){
 const mode=process.env.FILE_STORAGE_BACKEND||'filesystem';
 if(!['filesystem','postgres'].includes(mode))throw Error('Unsupported FILE_STORAGE_BACKEND');
 return mode==='postgres';
}
function relativeKey(file,root=config.upload.uploadPath){
 const relative=path.relative(path.resolve(root),path.resolve(file));
 if(!relative||relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw Error('File is outside encrypted storage');
 return uploadPath(relative.split(path.sep).join('/'));
}
const database=options=>options?.client||require('../config/db');
const missing=()=>Object.assign(Error('Encrypted file not found'),{code:'ENOENT'});

async function readEncrypted(file,options={}){
 if(!isPostgresStorage())return fs.readFile(file);
 const row=(await database(options).query('SELECT ciphertext,byte_length,cipher_sha256 FROM encrypted_upload_objects WHERE relative_key=$1',[relativeKey(file,options.root)])).rows[0];
 if(!row)throw missing();
 if(row.ciphertext.subarray(0,8).toString()!=='SHMSENC2'||Number(row.byte_length)!==row.ciphertext.length||crypto.createHash('sha256').update(row.ciphertext).digest('hex')!==row.cipher_sha256)throw Error('Encrypted file integrity verification failed');
 return row.ciphertext;
}
async function writeEncrypted(file,bytes,options={}){
 return withFileMutation(async()=>{
  if(!isPostgresStorage())return fs.writeFile(file,bytes,{mode:0o600,flag:'wx'});
  if(!Buffer.isBuffer(bytes)||bytes.length<37||bytes.length>10485796||bytes.subarray(0,8).toString()!=='SHMSENC2')throw Object.assign(Error('Unsupported encrypted file size or format'),{statusCode:413});
  try{return await database(options).query('INSERT INTO encrypted_upload_objects(relative_key,ciphertext) VALUES($1,$2)',[relativeKey(file,options.root),bytes]);}
  catch(error){if(error.code==='P7801')throw Object.assign(Error('File storage is full. Contact an administrator.'),{statusCode:507});throw error;}
 });
}
async function removeEncrypted(file,options={}){
 return withFileMutation(async()=>{
  if(isPostgresStorage())return database(options).query('DELETE FROM encrypted_upload_objects WHERE relative_key=$1',[relativeKey(file,options.root)]);
  return fs.unlink(file).catch(error=>{if(error.code!=='ENOENT')throw error;});
 });
}
async function fileMetadata(file,options={}){
 if(!isPostgresStorage()){const stat=await fs.stat(file);return {size:stat.size,created:stat.birthtime,modified:stat.mtime};}
 const row=(await database(options).query('SELECT byte_length,created_at FROM encrypted_upload_objects WHERE relative_key=$1',[relativeKey(file,options.root)])).rows[0];
 if(!row)throw missing();return {size:Number(row.byte_length),created:row.created_at,modified:row.created_at};
}
module.exports={isPostgresStorage,relativeKey,readEncrypted,writeEncrypted,removeEncrypted,fileMetadata};
