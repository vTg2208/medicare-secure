// Operator-only tool: no dotenv loading, no background job, and dry run by default.
const {uuid,evaluateRetention}=require('../src/modules/privacy/retention-policy');
const {withFileMutation}=require('../src/services/file-coordination');
const fail=message=>{throw Object.assign(new Error(message),{safeForOutput:true});};

async function executeDisposal(client,decisionId,{apply=false,quiesced=false}={}) {
    if(!uuid(decisionId))fail('A valid approved disposal decision ID is required');
    if(apply&&!quiesced)fail('Quiesce application and maintenance writes before applying disposal');
    if(apply)await client.query('BEGIN');
    try {
        let decision=(await client.query('SELECT * FROM retention_disposals WHERE id=$1',[decisionId])).rows[0];
        if(!decision)fail('Approved disposal decision not found');
        const table={medical_record:'medical_records',care_message:'care_messages',triage_session:'triage_sessions'}[decision.resource_type];
        if(!table)fail('Unsupported disposal resource type');
        if(apply) {
            const scope=(await client.query(`SELECT current_schema() AS schema,current_user=pg_get_userbyid(c.relowner) AS owner
                FROM pg_class c WHERE c.oid=$1::regclass`,[table])).rows[0];
            if(!scope?.owner||!['public','healthcare'].includes(scope.schema))fail('A separate migration/database owner in the supported application schema is required');
            await client.query(`SET LOCAL search_path=pg_catalog,"${scope.schema}",pg_temp`);
            await client.query('LOCK TABLE retention_policies,retention_holds IN SHARE MODE');
            await client.query(`LOCK TABLE ${table}${decision.resource_type==='medical_record'?',medical_record_corrections':''} IN ACCESS EXCLUSIVE MODE`);
            decision=(await client.query('SELECT * FROM retention_disposals WHERE id=$1 FOR UPDATE',[decisionId])).rows[0];
        }
        if(decision.status!=='approved')fail('Disposal is already executed or completed; use file cleanup for pending attachments');
        const eligibility=await evaluateRetention(client,decision.record_id,decision.resource_type);
        if(!eligibility.eligible)fail(eligibility.reasons.join('; '));
        if(eligibility.policyId!==decision.policy_id||eligibility.patientId!==decision.patient_id)fail('The reviewed policy or record ownership changed; obtain a new approval');
        if(!apply)return {applied:false,eligible:true,attachmentCount:eligibility.files.length};
        // Only the owner can temporarily change these named guards. All clinical
        // audit triggers stay enabled; DDL and deletion roll back together.
        if(decision.resource_type==='medical_record') {
            await client.query('ALTER TABLE medical_records DISABLE TRIGGER prevent_medical_record_delete');
            await client.query('ALTER TABLE medical_record_corrections DISABLE TRIGGER protect_record_correction');
            await client.query('DELETE FROM medical_record_corrections WHERE record_id=$1 AND patient_id=$2',[decision.record_id,decision.patient_id]);
        } else if(decision.resource_type==='care_message') await client.query('ALTER TABLE care_messages DISABLE TRIGGER protect_care_message');
        await client.query(`DELETE FROM ${table} WHERE id=$1 AND patient_id=$2`,[decision.record_id,decision.patient_id]);
        if(decision.resource_type==='medical_record') {
            await client.query('ALTER TABLE medical_records ENABLE TRIGGER prevent_medical_record_delete');
            await client.query('ALTER TABLE medical_record_corrections ENABLE TRIGGER protect_record_correction');
        } else if(decision.resource_type==='care_message') await client.query('ALTER TABLE care_messages ENABLE TRIGGER protect_care_message');
        for(const file of eligibility.files)await client.query('INSERT INTO retention_file_cleanup(disposal_id,patient_id,file_type,file_name) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[decisionId,decision.patient_id,file.fileType,file.fileName]);
        await client.query(`INSERT INTO audit_logs(action,entity_type,entity_id,purpose,metadata)
            VALUES('retention_disposal',$5,$1,'Reviewed retention expiry',jsonb_build_object('patientId',$2::uuid,'decisionId',$3::uuid,'approvedBy',$4::uuid,'databasePrincipal',current_user))`,[decision.record_id,decision.patient_id,decisionId,decision.approved_by,decision.resource_type]);
        const status=eligibility.files.length?'database_disposed':'completed';
        await client.query('UPDATE retention_disposals SET status=$1,executed_at=NOW(),executed_by=current_user WHERE id=$2',[status,decisionId]);
        await client.query('COMMIT');
        return {applied:true,status,attachmentCount:eligibility.files.length};
    } catch(error) {if(apply)await client.query('ROLLBACK');throw error;}
}

async function cleanupDisposalFilesUnlocked(client,decisionId,{uploadPath,apply=false,quiesced=false}={}) {
    if(!uuid(decisionId))fail('A valid disposal decision is required');
    const decision=(await client.query('SELECT status FROM retention_disposals WHERE id=$1',[decisionId])).rows[0];
    if(!decision||decision.status==='approved')fail('Database disposal must finish before attachment cleanup');
    const jobs=(await client.query('SELECT id,patient_id,file_type,file_name FROM retention_file_cleanup WHERE disposal_id=$1 AND cleaned_at IS NULL ORDER BY id',[decisionId])).rows;
    if(!apply)return {applied:false,pendingAttachments:jobs.length};
    if(!quiesced)fail('Quiesce writes before attachment cleanup');
    if(!uploadPath)fail('An explicit UPLOAD_PATH is required');
    const fs=require('node:fs/promises');const path=require('node:path');
    const root=await fs.realpath(path.resolve(uploadPath));
    for(const job of jobs) {
        if(!uuid(job.patient_id)||!['lab_results','imaging'].includes(job.file_type)||!/^\d+_[a-f\d]{16}\.[a-z0-9]{1,8}$/i.test(job.file_name))fail('Unsafe attachment cleanup identity');
        const directory=path.join(root,'medical_files',job.patient_id,job.file_type);
        const target=path.join(directory,job.file_name);
        await client.query(`INSERT INTO audit_logs(action,entity_type,entity_id,purpose,metadata) VALUES('retention_file_cleanup_intent','retention',$1,'Approved attachment disposal',jsonb_build_object('decisionId',$2::uuid))`,[job.id,decisionId]);
        // A missing directory indicates a wrong/unavailable mount, not prior cleanup.
        const realDirectory=await fs.realpath(directory);
        if(realDirectory!==directory)fail('Symlinked attachment paths are not supported');
        try {
            const stat=await fs.lstat(target);
            if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1)fail('Unsafe attachment file type');
            const handle=await fs.open(target,'r');
            try {const header=Buffer.alloc(8);await handle.read(header,0,8,0);if(header.toString()!=='SHMSENC2')fail('Only reviewed encrypted medical attachments can be disposed');}
            finally{await handle.close();}
            await fs.unlink(target);
        } catch(error) {if(error.code!=='ENOENT')throw error;}
        await client.query('UPDATE retention_file_cleanup SET cleaned_at=NOW() WHERE id=$1 AND cleaned_at IS NULL',[job.id]);
    }
    await client.query('BEGIN');
    try {
        await client.query(`INSERT INTO audit_logs(action,entity_type,entity_id,purpose) VALUES('retention_file_cleanup_completed','retention',$1,'Approved attachment cleanup completed')`,[decisionId]);
        await client.query("UPDATE retention_disposals SET status='completed' WHERE id=$1 AND status='database_disposed' AND NOT EXISTS(SELECT 1 FROM retention_file_cleanup WHERE disposal_id=$1 AND cleaned_at IS NULL)",[decisionId]);
        await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK');throw error;}
    return {applied:true,cleanedAttachments:jobs.length};
}

async function main(args=process.argv.slice(2),env=process.env) {
    const decisionId=args.find(arg=>!arg.startsWith('--'));
    if(args.some(arg=>arg!==decisionId&&!['--apply','--cleanup-files'].includes(arg))||!uuid(decisionId))fail('Usage: node scripts/retention-dispose.js <decision UUID> [--apply] [--cleanup-files]');
    const apply=args.includes('--apply');
    if(apply&&env.RETENTION_DISPOSAL_ENABLED!=='true')fail('Explicitly enable RETENTION_DISPOSAL_ENABLED before operator execution');
    const host=env.DB_HOST;
    if(!host||!env.DB_NAME||!env.DB_USER||!env.DB_PASSWORD)fail('Explicit database connection settings are required');
    if(!['127.0.0.1','localhost','::1'].includes(host)&&env.DB_SSL!=='true')fail('Remote operator connections require verified database TLS');
    const {Client}=require('pg');
    const client=new Client({host,port:Number(env.DB_PORT||5432),database:env.DB_NAME,user:env.DB_USER,password:env.DB_PASSWORD,
        ssl:require('../src/config/database-tls').databaseTls(env),
        connectionTimeoutMillis:10000,statement_timeout:30000,application_name:'healthcare-retention-operator'});
    await client.connect();
    try {
        const options={apply,quiesced:env.RETENTION_WRITES_QUIESCED==='true',uploadPath:env.UPLOAD_PATH};
        const result=args.includes('--cleanup-files')?await cleanupDisposalFiles(client,decisionId,options):await executeDisposal(client,decisionId,options);
        process.stdout.write(JSON.stringify(result)+'\n');return result;
    }finally{await client.end();}
}
if(require.main===module)main().catch(error=>{process.stderr.write((error.safeForOutput?error.message:'Retention operation failed; no success is assumed. Inspect protected operator evidence and retry the dry run.')+'\n');process.exitCode=1;});
// The caller's dedicated session remains owned by the caller. Hold this lock
// through filesystem deletion and the cleanup ledger commit, including retries.
async function cleanupDisposalFiles(client,decisionId,options={}) {
    return options.apply
        ? withFileMutation(()=>cleanupDisposalFilesUnlocked(client,decisionId,options),{client})
        : cleanupDisposalFilesUnlocked(client,decisionId,options);
}
module.exports={executeDisposal,cleanupDisposalFiles,main};
