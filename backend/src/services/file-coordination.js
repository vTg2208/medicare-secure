const {AsyncLocalStorage}=require('node:async_hooks');
const {Client}=require('pg');
const {databaseTls}=require('../config/database-tls');

// Two-int advisory keys are scoped to the current database, across API replicas
// and maintenance processes. Never borrow a transaction-pooler connection here.
const key=[1734962500,1];
const context=new AsyncLocalStorage();
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function coordinate(mode,run,{env=process.env,client:supplied}={}){
 const inherited=context.getStore();
 if(inherited){
  inherited.assertActive();
  if(inherited.mode!=='mutation'||mode!=='mutation')throw Error('Nested backup/file lock ownership is not supported');
  return run(inherited);
 }
 const timeout=Number(env.FILE_COORDINATION_TIMEOUT_MS||30000);
 if(!Number.isInteger(timeout)||timeout<100||timeout>60000)throw Error('File lock timeout must be between 100 and 60000 ms');
 if(!supplied&&(!env.DB_HOST||!env.DB_NAME||!env.DB_USER||!Number.isInteger(Number(env.DB_PORT))||Number(env.DB_PORT)<1||Number(env.DB_PORT)>65535))throw Error('Explicit database settings are required for file coordination');
 if(!supplied&&!['127.0.0.1','localhost','::1'].includes(env.DB_HOST)&&env.DB_SSL!=='true')throw Error('File coordination requires verified remote database TLS');
 const client=supplied||new Client({host:env.DB_HOST,port:Number(env.DB_PORT),database:env.DB_NAME,user:env.DB_USER,password:env.DB_PASSWORD,ssl:databaseTls(env),connectionTimeoutMillis:10000,statement_timeout:10000,application_name:'healthcare-file-coordination'});
 const controller=new AbortController();let active=false,acquired=false;
 const lost=()=>controller.abort(Error('File coordination session lost ownership'));
 const assertActive=()=>{if(!active||controller.signal.aborted)throw Error('File coordination session lost ownership');};
 const lease={mode,signal:controller.signal,assertActive,async assertHeld(){assertActive();await client.query('SELECT 1');assertActive();}};
 client.on('error',lost);client.on('end',lost);
 const shared=mode==='mutation'?'_shared':'';
 try{
  if(!supplied)await client.connect();
  const deadline=Date.now()+timeout;
  do{
   if(controller.signal.aborted)throw Error('File coordination session lost ownership');
   acquired=(await client.query(`SELECT pg_try_advisory_lock${shared}($1::int,$2::int) AS acquired`,key)).rows[0].acquired;
   if(acquired)break;
   if(Date.now()>=deadline)throw Object.assign(Error('File coordination lock timeout'),{code:'FILE_LOCK_TIMEOUT'});
   await wait(Math.min(25,Math.max(1,deadline-Date.now())));
  }while(true);
  active=true;
  const result=await context.run(lease,()=>run(lease));
  await lease.assertHeld();return result;
 }finally{
  active=false;
  if(acquired&&!controller.signal.aborted)await client.query(`SELECT pg_advisory_unlock${shared}($1::int,$2::int)`,key).catch(lost);
  if(!supplied)await client.end().catch(()=>{});
  client.removeListener('error',lost);client.removeListener('end',lost);
 }
}

const withFileMutation=(run,options)=>coordinate('mutation',run,options);
const withFileBackupLock=(run,options)=>coordinate('backup',run,options);
module.exports={withFileMutation,withFileBackupLock};
