const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const loggerPath=path.resolve(__dirname,'../src/utils/logger.js');
const forbidden=['confidential@example.invalid','919876543210','SENSITIVE-DIAGNOSIS','SecretPass!995','sensitive-invite-token-111','SENSITIVE-PG-ROW'];
const loggingProbe=String.raw`
const logger=require(process.argv[1]);
const mode=process.argv[2];
const error=new Error('SENSITIVE-DIAGNOSIS confidential@example.invalid SecretPass!995');
error.code='23505'; error.detail='SENSITIVE-PG-ROW 919876543210'; error.sql='SENSITIVE-PG-ROW';
if(mode==='normal') {
    logger.info('Safe operational event',{requestId:'11111111-1111-1111-1111-111111111111',count:3,email:'confidential@example.invalid',phone:'919876543210',diagnosis:'SENSITIVE-DIAGNOSIS',password:'SecretPass!995',token:'sensitive-invite-token-111',nested:{email:'confidential@example.invalid',clinical:{diagnosis:'SENSITIVE-DIAGNOSIS'}},context:{requestId:'11111111-1111-1111-1111-111111111111',count:2,email:'confidential@example.invalid'}});
    logger.error('Database operation failed',error);
    logger.error(error);
    logger.warn('Delivery to confidential@example.invalid phone 919876543210 /api/staff/invitations/sensitive-invite-token-111/accept');
    logger.log({level:'error',message:'SENSITIVE-PG-ROW',stack:'SENSITIVE-PG-ROW',detail:'SENSITIVE-PG-ROW',error});
    logger.on('finish',()=>setTimeout(()=>{logger.close();setTimeout(()=>process.exit(0),60)},100));
    logger.end();
} else {
    if(mode==='exception') process.emit('uncaughtException',error);
    else process.emit('unhandledRejection',error,Promise.resolve());
    setTimeout(()=>process.exit(1),5000).unref();
}
`;

async function probe(mode,run) {
    const directory=await fs.mkdtemp(path.join(os.tmpdir(),'shms-log-redaction-'));
    try {
        let result;
        try { result=await promisify(execFile)(process.execPath,['-e',loggingProbe,loggerPath,mode],{cwd:directory,env:{...process.env,NODE_ENV:'test'},timeout:10000,maxBuffer:2*1024*1024}); }
        catch(error) { if(mode==='normal'||error.code!==1) throw error; result=error; }
        const files=await fs.readdir(path.join(directory,'logs'));
        const contents=await Promise.all(files.map(file=>fs.readFile(path.join(directory,'logs',file),'utf8')));
        const all=[result.stdout,result.stderr,...contents].join('\n');
        for(const value of forbidden) assert.ok(!all.includes(value),`${mode} log leaked a protected fixture value`);
        await run({directory,result,files,contents,all});
    } finally { await fs.rm(directory,{recursive:true,force:true}); }
}

test('written JSON and console logs retain operational signals without clinical or credential data',async()=>probe('normal',async({directory,result})=>{
    const rows=(await fs.readFile(path.join(directory,'logs','combined.log'),'utf8')).trim().split('\n').map(line=>JSON.parse(line));
    const event=rows.find(row=>row.message==='Safe operational event');
    assert.ok(event); assert.equal(event.count,3); assert.equal(event.requestId,'11111111-1111-1111-1111-111111111111');
    assert.ok(rows.some(row=>row.message==='Database operation failed'&&row.errorCode==='23505'));
    assert.match(result.stdout,/Safe operational event/);
    for(const row of rows) for(const key of ['stack','detail','sql','error','email','phone','diagnosis','password','token']) assert.equal(row[key],undefined);
}));

for(const mode of ['exception','rejection']) test(`${mode} handler writes sanitized fatal evidence`,async()=>probe(mode,async({directory})=>{
    const name=mode==='exception'?'exceptions.log':'rejections.log';
    const rows=(await fs.readFile(path.join(directory,'logs',name),'utf8')).trim().split('\n').map(line=>JSON.parse(line));
    assert.ok(rows.length); assert.ok(rows.some(row=>row.errorCode==='23505'));
    for(const row of rows) for(const key of ['error','stack','process','os','trace','detail','sql']) assert.equal(row[key],undefined);
}));

test('application file logs have a finite disk budget for failure storms', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'shms-logging-'));
    const original = process.cwd();
    let logger;
    try {
        process.chdir(directory);
        logger = require('../src/utils/logger');
        const files = [...logger.transports,
            ...Array.from(logger.exceptions.handlers.keys()),
            ...Array.from(logger.rejections.handlers.keys())];
        assert.ok(files.length >= 4, 'Normal and fatal-error logging must both remain configured');
        for (const transport of files.filter(item => item.filename)) {
            assert.ok(Number.isInteger(transport.maxsize) && transport.maxsize > 0 && transport.maxsize <= 10 * 1024 * 1024,
                `${transport.filename} must cap each log file at 10MiB`);
            assert.ok(Number.isInteger(transport.maxFiles) && transport.maxFiles > 0 && transport.maxFiles <= 5,
                `${transport.filename} must retain at most five rotated files`);
        }
    } finally {
        logger?.close();
        process.chdir(original);
        // File transports can finish opening asynchronously after close.
        await new Promise(resolve => setTimeout(resolve, 50));
        await fs.rm(directory, { recursive: true, force: true });
    }
});
