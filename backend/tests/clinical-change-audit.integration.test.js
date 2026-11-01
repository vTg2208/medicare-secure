const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Client } = require('pg');
const request = require('supertest');

test('clinical mutations and actor evidence commit or roll back together', {
    skip: process.env.RUN_DB_TESTS !== 'true', timeout: 60000,
}, async t => {
    assert.equal(process.env.NODE_ENV, 'test');
    assert.equal(process.env.DB_HOST, '127.0.0.1');
    assert.equal(process.env.DB_PORT, '55432');
    assert.match(process.env.DB_NAME, /test/);
    const config = { host: process.env.DB_HOST, port: 55432, database: process.env.DB_NAME,
        user: process.env.DB_USER, password: process.env.DB_PASSWORD, ssl: false };
    const owner = new Client(config);
    const name = `healthcare_change_test_${process.pid}`;
    await owner.connect(); await owner.query(`CREATE DATABASE ${name}`);
    process.env.DB_NAME = name;
    process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
    process.env.JWT_REFRESH_SECRET = crypto.randomBytes(48).toString('hex');
    process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    let fixture; let db;
    try {
        fixture = new Client({ ...config, database: name }); await fixture.connect();
        await require('../src/database/migrate').migrate(fixture, { log() {} });
        const actor = (await fixture.query("INSERT INTO users(email,role_id,status,is_verified) VALUES('actor@example.invalid',(SELECT id FROM roles WHERE name='doctor'),'active',true) RETURNING id")).rows[0].id;
        const patient = (await fixture.query("INSERT INTO users(email,role_id,status,is_verified) VALUES('patient@example.invalid',(SELECT id FROM roles WHERE name='patient'),'active',true) RETURNING id")).rows[0].id;
        const other = (await fixture.query("INSERT INTO users(email,role_id,status,is_verified) VALUES('other@example.invalid',(SELECT id FROM roles WHERE name='patient'),'active',true) RETURNING id")).rows[0].id;
        await fixture.query("INSERT INTO patient_profiles(user_id,unique_health_id) VALUES($1,'AUDIT-PATIENT'),($2,'AUDIT-OTHER')", [patient,other]);
        const org = (await fixture.query("INSERT INTO organizations(name,type,license_number,status,verified) VALUES('Audit fixture','hospital','AUDIT-ONLY','active',true) RETURNING id")).rows[0].id;
        const visit = (await fixture.query("INSERT INTO visits(patient_id,organization_id,visit_code,status,assigned_doctor_id) VALUES($1,$2,'AUDIT-VISIT','in_progress',$3) RETURNING id",[patient,org,actor])).rows[0].id;
        await fixture.query("INSERT INTO staff_org_mapping(user_id,organization_id,role_id,status) VALUES($1,$2,(SELECT id FROM roles WHERE name='doctor'),'active')",[actor,org]);
        await fixture.query("INSERT INTO consents(patient_id,recipient_user_id,data_category,purpose,access_level,start_time,end_time,status) VALUES($1,$2,'all','treatment','write',NOW()-INTERVAL '1 minute',NOW()+INTERVAL '1 hour','active')",[patient,actor]);
        db = require('../src/config/db');
        const app = require('../src/app');
        const { generateAccessToken } = require('../src/config/jwt');
        const tokens = {};
        for (const [role,id] of [['doctor',actor],['patient',patient],['other',other]]) {
            const token = generateAccessToken({ userId: id, roleName: role === 'other' ? 'patient' : role });
            await fixture.query("INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')",[id,crypto.createHash('sha256').update(token).digest('hex')]);
            tokens[role] = token;
        }
        const send = (method,url,token,body) => {
            const pending = request(app)[method](url).set('Authorization',`Bearer ${token}`);
            return body === undefined ? pending : pending.send(body);
        };
        await t.test('maintenance writes identify the database principal without inventing an app actor', async () => {
            const event = (await fixture.query("SELECT user_id,metadata FROM audit_logs WHERE action='clinical_change' AND entity_type='visits' AND entity_id=$1",[visit])).rows[0];
            assert.equal(event.user_id,null); assert.equal(event.metadata.actorSource,'database_principal');
            assert.equal(event.metadata.databasePrincipal,config.user); assert.equal(event.metadata.requestId,null);
        });
        let record;
        await t.test('real authenticated HTTP writes record actor and server request correlation', async () => {
            const response = await send('post','/api/emr/medical-records',tokens.doctor,{ patientId:patient,visitId:visit,type:'note',title:'Fixture vitals',description:'Never retain this clinical content in audit metadata' });
            assert.equal(response.status,201,JSON.stringify(response.body)); record=response.body.data.id;
            const event=(await fixture.query("SELECT user_id,metadata FROM audit_logs WHERE action='clinical_change' AND entity_id=$1",[record])).rows[0];
            assert.equal(event.user_id,actor); assert.equal(event.metadata.patientId,patient);
            assert.equal(event.metadata.requestId,response.headers['x-request-id']);
            assert.equal(event.metadata.actorSource,'authenticated_request');
            assert.ok(!JSON.stringify(event.metadata).includes('Never retain'));
        });
        await t.test('later database work does not inherit a pooled request actor', async () => {
            const created=(await db.query("INSERT INTO medical_records(patient_id,visit_id,type,title,created_by) VALUES($1,$2,'note','Maintenance after HTTP',$3) RETURNING id",[patient,visit,actor])).rows[0];
            const event=(await fixture.query("SELECT user_id,metadata FROM audit_logs WHERE action='clinical_change' AND entity_id=$1",[created.id])).rows[0];
            assert.equal(event.user_id,null); assert.equal(event.metadata.requestId,null);
        });
        await t.test('consent revocation rolls back on audit outage and records the patient actor on success', async () => {
            const consent=(await fixture.query('SELECT id FROM consents WHERE patient_id=$1 AND recipient_user_id=$2',[patient,actor])).rows[0].id;
            await fixture.query(`CREATE FUNCTION refuse_consent_change_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='clinical_change' AND NEW.entity_type='consents' THEN RAISE EXCEPTION 'fixture consent audit outage'; END IF; RETURN NEW; END $$`);
            await fixture.query('CREATE TRIGGER refuse_consent_change_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION refuse_consent_change_audit()');
            try {
                const denied=await send('put',`/api/consent/revoke/${consent}`,tokens.patient,{reason:'Fixture test'});
                assert.equal(denied.status,500,JSON.stringify(denied.body));
                assert.equal((await fixture.query('SELECT status FROM consents WHERE id=$1',[consent])).rows[0].status,'active');
                assert.equal((await fixture.query("SELECT 1 FROM audit_logs WHERE action='clinical_change' AND entity_id=$1 AND metadata->>'operation'='UPDATE'",[consent])).rowCount,0);
            } finally {
                await fixture.query('DROP TRIGGER refuse_consent_change_audit ON audit_logs');
                await fixture.query('DROP FUNCTION refuse_consent_change_audit()');
            }
            const response=await send('put',`/api/consent/revoke/${consent}`,tokens.patient,{reason:'Fixture test'});
            assert.equal(response.status,200,JSON.stringify(response.body));
            const event=(await fixture.query("SELECT user_id,metadata FROM audit_logs WHERE action='clinical_change' AND entity_id=$1 ORDER BY sequence DESC LIMIT 1",[consent])).rows[0];
            assert.equal(event.user_id,patient); assert.equal(event.metadata.patientId,patient);
            assert.equal(event.metadata.requestId,response.headers['x-request-id']);
            await fixture.query("UPDATE consents SET status='active' WHERE id=$1",[consent]);
        });
        await t.test('explicit transaction rollback discards clinical changes and their trigger audit', async () => {
            const id=crypto.randomUUID();
            await assert.rejects(db.transaction(async client => {
                await client.query("INSERT INTO medical_records(id,patient_id,visit_id,type,title,created_by) VALUES($1,$2,$3,'note','Rollback fixture',$4)",[id,patient,visit,actor]);
                throw new Error('rollback fixture');
            }),/rollback fixture/);
            assert.equal((await fixture.query('SELECT 1 FROM medical_records WHERE id=$1',[id])).rowCount,0);
            assert.equal((await fixture.query("SELECT 1 FROM audit_logs WHERE action='clinical_change' AND entity_id=$1",[id])).rowCount,0);
        });
        await t.test('failed trigger audit aborts a real HTTP clinical mutation before it commits', async () => {
            const counter=require('../src/middleware/metrics').register.getSingleMetric('audit_log_errors_total');
            const before=(await counter.get()).values[0].value;
            await fixture.query(`CREATE FUNCTION refuse_clinical_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='clinical_change' THEN RAISE EXCEPTION 'fixture audit outage'; END IF; RETURN NEW; END $$`);
            await fixture.query('CREATE TRIGGER refuse_clinical_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION refuse_clinical_audit()');
            try {
                const response=await send('post','/api/emr/medical-records',tokens.doctor,{patientId:patient,visitId:visit,type:'note',title:'MUST-NOT-COMMIT'});
                assert.equal(response.status,500,JSON.stringify(response.body));
                assert.equal((await fixture.query("SELECT 1 FROM medical_records WHERE title='MUST-NOT-COMMIT'")).rowCount,0);
                assert.ok((await counter.get()).values[0].value >= before+1);
            } finally {
                await fixture.query('DROP TRIGGER refuse_clinical_audit ON audit_logs');
                await fixture.query('DROP FUNCTION refuse_clinical_audit()');
            }
        });
        await t.test('multi-patient list access appears in each patient trail without disclosing the other identity', async () => {
            const lab=(await fixture.query("INSERT INTO users(email,role_id,status,is_verified) VALUES('lab@example.invalid',(SELECT id FROM roles WHERE name='lab_technician'),'active',true) RETURNING id")).rows[0].id;
            await fixture.query("INSERT INTO staff_org_mapping(user_id,organization_id,role_id,status) VALUES($1,$2,(SELECT id FROM roles WHERE name='lab_technician'),'active')",[lab,org]);
            const otherVisit=(await fixture.query("INSERT INTO visits(patient_id,organization_id,visit_code,status,assigned_doctor_id) VALUES($1,$2,'AUDIT-OTHER-VISIT','in_progress',$3) RETURNING id",[other,org,actor])).rows[0].id;
            for (const [patientId,visitId] of [[patient,visit],[other,otherVisit]]) {
                await fixture.query("INSERT INTO consents(patient_id,recipient_user_id,data_category,purpose,access_level,start_time,end_time,status) VALUES($1,$2,'lab_results','treatment','read',NOW()-INTERVAL '1 minute',NOW()+INTERVAL '1 hour','active')",[patientId,lab]);
                await fixture.query("INSERT INTO lab_orders(visit_id,ordered_by,test_name) VALUES($1,$2,'Fixture CBC')",[visitId,actor]);
            }
            const token=generateAccessToken({userId:lab,roleName:'lab_technician'});
            await fixture.query("INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')",[lab,crypto.createHash('sha256').update(token).digest('hex')]);
            const queue=await send('get','/api/lab/orders',token);
            assert.equal(queue.status,200,JSON.stringify(queue.body));
            assert.deepEqual(new Set(queue.body.data.map(order=>order.patient_id)),new Set([patient,other]));
            for (const [key,id,foreign] of [['patient',patient,other],['other',other,patient]]) {
                const response=await send('get','/api/audit/my-trail',tokens[key]);
                assert.equal(response.status,200);
                const event=response.body.data.logs.find(entry=>entry.action==='view_lab_queue');
                assert.ok(event); assert.deepEqual(event.metadata.patientIds,[id]);
                assert.ok(!JSON.stringify(event).includes(foreign));
            }
        });
        await t.test('audit chain remains valid after transactional clinical changes', async () => {
            assert.equal((await require('../src/services/audit.service').verifyAuditLogIntegrity()).verified,true);
        });
        await t.test('temporary tables cannot redirect clinical evidence or its patient identity', async () => {
            const connection=new Client({...config,database:name}); await connection.connect();
            const id=crypto.randomUUID();
            try {
                await connection.query('BEGIN');
                for (const table of ['audit_logs','visits','medical_records']) {
                    await connection.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING DEFAULTS) ON COMMIT DROP`);
                }
                await connection.query("INSERT INTO public.medical_records(id,patient_id,visit_id,type,title,created_by) VALUES($1,$2,$3,'note','Temporary shadow fixture',$4)",[id,patient,visit,actor]);
                const event=(await connection.query("SELECT metadata FROM public.audit_logs WHERE action='clinical_change' AND entity_id=$1",[id])).rows[0];
                assert.ok(event,'Mutation evidence must be retained in the application audit table');
                assert.equal(event.metadata.patientId,patient);
                assert.equal((await connection.query('SELECT COUNT(*)::int AS count FROM pg_temp.audit_logs')).rows[0].count,0);
            } finally { await connection.query('ROLLBACK'); await connection.end(); }
        });
        await t.test('stale repeatable-read audit writers fail safely without forking retained evidence', async () => {
            const stale=new Client({...config,database:name}); await stale.connect();
            try {
                await stale.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
                await stale.query('SELECT last_hash FROM audit_chain_head WHERE singleton=1');
                await fixture.query("INSERT INTO audit_logs(action) VALUES('concurrent_committed_fixture')");
                await assert.rejects(stale.query("INSERT INTO audit_logs(action) VALUES('stale_snapshot_fixture')"),error=>error.code==='40001');
                await stale.query('ROLLBACK');
                assert.equal((await fixture.query("SELECT 1 FROM audit_logs WHERE action='stale_snapshot_fixture'")).rowCount,0);
                assert.equal((await require('../src/services/audit.service').verifyAuditLogIntegrity()).verified,true);
            } finally { await stale.end(); }
        });
        await t.test('audit head rejects direct changes and transaction isolation accepts only named levels', async () => {
            await assert.rejects(fixture.query("UPDATE audit_chain_head SET last_hash='forged'"),/only advance/);
            await assert.rejects(fixture.query('DELETE FROM audit_chain_head'),/only advance/);
            await assert.rejects(db.transaction(async()=>{}, {isolationLevel:'repeatable read; DROP TABLE users'}),/Unsupported/);
            const level=await db.transaction(async client=>(await client.query('SHOW transaction_isolation')).rows[0].transaction_isolation,{isolationLevel:'repeatable read'});
            assert.equal(level,'repeatable read');
        });
    } finally {
        if (db) await db.pool.end();
        if (fixture) await fixture.end();
        await owner.query(`DROP DATABASE ${name} WITH (FORCE)`); await owner.end();
    }
});
