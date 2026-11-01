const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Client } = require('pg');
const request = require('supertest');

test('breach governance protects assessments, decisions and immutable notification evidence', {skip:process.env.RUN_DB_TESTS!=='true',timeout:60000}, async t=>{
    assert.equal(process.env.NODE_ENV,'test');
    assert.ok(['127.0.0.1','localhost','::1'].includes(process.env.DB_HOST));
    assert.equal(process.env.DB_PORT,'55432');
    assert.match(process.env.DB_NAME,/test/);
    const config={host:process.env.DB_HOST,port:55432,database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD,ssl:false};
    const admin=new Client(config);await admin.connect();
    const database=`healthcare_breach_test_${process.pid}`;
    await admin.query(`CREATE DATABASE "${database}"`);
    process.env.DB_NAME=database;
    process.env.JWT_SECRET=crypto.randomBytes(48).toString('hex');
    process.env.JWT_REFRESH_SECRET=crypto.randomBytes(48).toString('hex');
    process.env.ENCRYPTION_KEY=crypto.randomBytes(32).toString('hex');
    process.env.AI_ENABLED='false';process.env.BCRYPT_ROUNDS='4';
    let db;
    try {
        const migration=new Client({...config,database});await migration.connect();
        try {await require('../src/database/migrate').migrate(migration,{log:()=>{}});}finally{await migration.end();}
        db=require('../src/config/db');const app=require('../src/app');
        const {generateAccessToken}=require('../src/config/jwt');
        const tokens={};const users={};
        for(const role of ['patient','doctor','system_admin','compliance_officer']){
            const row=(await db.query("INSERT INTO users(email,role_id,status,is_verified) SELECT $1,id,'active',true FROM roles WHERE name=$2 RETURNING id",[`${role}@breach.example.invalid`,role])).rows[0];
            users[role]=row.id;tokens[role]=generateAccessToken({userId:row.id});
            await db.query("INSERT INTO sessions(user_id,token_hash,device_info,expires_at) VALUES($1,$2,'{}',NOW()+INTERVAL '1 hour')",[row.id,crypto.createHash('sha256').update(tokens[role]).digest('hex')]);
        }
        const send=(method,path,body,role='compliance_officer')=>{const req=request(app)[method](`/api/compliance${path}`);if(role)req.set('Authorization',`Bearer ${tokens[role]}`);return body===undefined?req:req.send(body);};
        const status=(res,expected)=>assert.equal(res.status,expected,JSON.stringify(res.body));
        const assessment=extra=>({discoveredAt:new Date(Date.now()-4*86400000).toISOString(),regimes:['gdpr','hipaa'],affectedCount:500,
            riskLevel:'unknown',hipaaDetermination:'pending',mediaDecision:'pending',facts:'Synthetic restricted incident facts',consequences:'Potential confidentiality loss',
            measures:'Access revoked and environment contained',contact:'Privacy response office contact',rationale:'Synthetic documented assessment reasoning',hipaaFactors:'Identifiers, recipient, acquisition and mitigation reviewed',...extra});
        let first;
        await t.test('only a compliance officer can read or create restricted breach casework',async()=>{
            for(const role of [null,'patient','doctor','system_admin']) {status(await send('get','/breaches',undefined,role),role?403:401);status(await send('post','/breaches',assessment(),role),role?403:401);}
            status(await send('post','/breaches',assessment({regimes:'gdpr'})),400);
            status(await send('post','/breaches',assessment({discoveredAt:'2100-01-01T00:00:00Z'})),400);
            status(await send('get','/breaches/not-a-uuid'),400);
            status(await send('get',`/breaches/${crypto.randomUUID()}`),404);
        });
        await t.test('encrypted assessments retain a version and immutable change history',async()=>{
            const created=await send('post','/breaches',assessment());status(created,201);first=created.body.data;
            assert.equal(first.version,1);assert.equal(first.obligations.find(o=>o.regime==='gdpr'&&o.audience==='authority').status,'assessment_overdue');
            const row=(await db.query('SELECT * FROM privacy_breaches WHERE incident_id=$1',[first.id])).rows[0];
            assert.ok(!row.assessment_ciphertext.includes('Synthetic restricted'));
            assert.equal((await db.query('SELECT description FROM security_events WHERE id=$1',[first.id])).rows[0].description,'Potential personal-data breach; restricted assessment available');
            await assert.rejects(db.query('UPDATE breach_assessment_history SET version=9 WHERE incident_id=$1',[first.id]),/append-only/);
            const detail=await send('get',`/breaches/${first.id}`);status(detail,200);assert.equal(detail.body.data.history.length,1);
            const listed=await send('get','/breaches');status(listed,200);
            assert.ok(!JSON.stringify(listed.body.data).includes('Synthetic restricted incident facts'));
            assert.ok(!JSON.stringify(listed.body.data).includes('assessment_ciphertext'));
            for(const role of ['patient','doctor','system_admin'])status(await send('get',`/breaches/${first.id}`,undefined,role),403);
            status(await send('put',`/incidents/${first.id}`,{status:'Investigating'},'system_admin'),403);
        });
        await t.test('preemptive notices do not substitute for completing pending assessment decisions',async()=>{
            const created=await send('post','/breaches',assessment());status(created,201);
            const id=created.body.data.id;
            for(const obligation of created.body.data.obligations) {
                status(await send('post',`/breaches/${id}/notifications`,{expectedVersion:1,regime:obligation.regime,audience:obligation.audience,
                    status:'sent',channel:'portal',occurredAt:new Date(Date.now()-60000).toISOString(),
                    evidence:'Conservative preliminary notice delivery reference',delayReason:'Initial awareness escalation delay is documented for this fixture'}),201);
            }
            const current=await send('get',`/breaches/${id}`);status(current,200);
            assert.equal(current.body.data.notifications.length,created.body.data.obligations.length);
            assert.ok(current.body.data.obligations.some(obligation=>obligation.decision==='pending'&&['assessment_pending','assessment_overdue'].includes(obligation.status)));
            status(await send('put',`/incidents/${id}`,{status:'Resolved'}),409);
            assert.equal((await db.query('SELECT status FROM security_events WHERE id=$1',[id])).rows[0].status,'Open');
        });
        await t.test('resolution requires completed decisions; versions prevent overwriting concurrent assessment',async()=>{
            status(await send('put',`/incidents/${first.id}`,{status:'Resolved'}),409);
            status(await send('put',`/incidents/${first.id}`,{status:'invented'}),400);
            const body={...first.assessment,expectedVersion:1,riskLevel:'unlikely',hipaaDetermination:'not_notifiable',mediaDecision:'not_required'};
            const updates=await Promise.all([send('put',`/breaches/${first.id}`,body),send('put',`/breaches/${first.id}`,body)]);
            assert.deepEqual(updates.map(r=>r.status).sort(),[200,409]);
            first=(await send('get',`/breaches/${first.id}`)).body.data;assert.equal(first.version,2);assert.equal(first.history.length,2);
            status(await send('put',`/breaches/${first.id}`,{...body,expectedVersion:2,discoveredAt:new Date().toISOString()}),400);
            status(await send('put',`/incidents/${first.id}`,{status:'Resolved'}),200);
            status(await send('put',`/breaches/${first.id}`,{...body,expectedVersion:2}),409);
            status(await send('put',`/incidents/${first.id}`,{status:'Investigating'}),200);
        });
        await t.test('failed attempts and late notices retain evidence without falsely completing duties',async()=>{
            const created=await send('post','/breaches',assessment({riskLevel:'high',hipaaDetermination:'notifiable',mediaDecision:'not_required'}));status(created,201);
            const current=created.body.data;const path=`/breaches/${current.id}/notifications`;
            const notice={expectedVersion:1,regime:'gdpr',audience:'authority',status:'failed',channel:'portal',occurredAt:new Date(Date.now()-60000).toISOString(),evidence:'Synthetic failed submission receipt'};
            status(await send('post',path,notice),400);
            const failed=await send('post',path,{...notice,delayReason:'Late discovery escalation under documented investigation'});status(failed,201);
            assert.equal(failed.body.data.notifications.length,1);
            assert.equal(failed.body.data.obligations.find(o=>o.regime==='gdpr'&&o.audience==='authority').status,'overdue');
            status(await send('put',`/incidents/${current.id}`,{status:'Resolved'}),409);
            status(await send('post',path,{...notice,status:'sent',delayReason:'Documented delayed notification with initial facts supplied'}),201);
            for(const [regime,audience] of [['gdpr','individual'],['hipaa','individual'],['hipaa','secretary']])status(await send('post',path,{...notice,regime,audience,status:'sent',evidence:'Synthetic successful delivery reference'}),201);
            const detail=(await send('get',`/breaches/${current.id}`)).body.data;
            assert.equal(detail.notifications.length,5);assert.equal(detail.notifications[0].status,'failed');
            const stored=(await db.query('SELECT * FROM breach_notification_log WHERE incident_id=$1 ORDER BY recorded_at',[current.id])).rows;
            assert.ok(stored.every(n=>!n.evidence_ciphertext.includes('Synthetic')));
            await assert.rejects(db.query('DELETE FROM breach_notification_log WHERE incident_id=$1',[current.id]),/append-only/);
            status(await send('put',`/incidents/${current.id}`,{status:'Resolved'}),200);
            status(await send('post',path,notice),409);
            const audit=(await db.query("SELECT metadata FROM audit_logs WHERE entity_id=$1 AND action='breach_notification_recorded'",[current.id])).rows;
            assert.equal(audit.length,5);assert.ok(!JSON.stringify(audit).includes('delivery reference'));
        });
        await t.test('audit failure rolls back case creation rather than leaving undocumented governance changes',async()=>{
            const before=Number((await db.query('SELECT COUNT(*) AS count FROM privacy_breaches')).rows[0].count);
            await db.query("CREATE FUNCTION reject_breach_audit_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='breach_reported' THEN RAISE EXCEPTION 'fixture audit outage'; END IF; RETURN NEW; END $$");
            await db.query('CREATE TRIGGER reject_breach_audit_fixture BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_breach_audit_fixture()');
            try{status(await send('post','/breaches',assessment()),500);assert.equal(Number((await db.query('SELECT COUNT(*) AS count FROM privacy_breaches')).rows[0].count),before);}
            finally{await db.query('DROP TRIGGER reject_breach_audit_fixture ON audit_logs');await db.query('DROP FUNCTION reject_breach_audit_fixture()');}
        });
    } finally {
        if(db)await db.pool.end();
        await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);await admin.end();
    }
});
