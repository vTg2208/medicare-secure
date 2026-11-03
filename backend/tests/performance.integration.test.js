const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Client } = require('pg');

test('performance queries preserve isolation, searchable pagination and bounded breach reads on PostgreSQL', {
    skip: process.env.RUN_PERFORMANCE_DB_TESTS !== 'true', timeout: 60000
}, async t => {
    assert.equal(process.env.NODE_ENV, 'test');
    assert.equal(process.env.DB_HOST, '127.0.0.1');
    assert.equal(process.env.DB_NAME, 'healthcare_performance_test');
    assert.equal(process.env.DB_USER, 'postgres');
    assert.ok(Number(process.env.DB_PORT) >= 1024);
    // Match the UTC PostgreSQL container/production runtime for legacy TIMESTAMP sessions.
    process.env.TZ = 'UTC';
    const connection = { host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, ssl: false };
    const admin = new Client({ ...connection, database: process.env.DB_NAME });
    await admin.connect();
    const database = `healthcare_performance_test_${process.pid}`;
    await admin.query(`CREATE DATABASE ${database}`);
    process.env.DB_NAME = database;
    process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
    process.env.JWT_REFRESH_SECRET = crypto.randomBytes(48).toString('hex');
    process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    process.env.AI_ENABLED = 'false';
    let db;
    try {
        const migrator = new Client({ ...connection, database });
        await migrator.connect();
        try { await require('../src/database/migrate').migrate(migrator, { log() {} }); }
        finally { await migrator.end(); }
        db = require('../src/config/db');
        const user = async (name, role) => (await db.query(`INSERT INTO users(email,first_name,last_name,role_id,status,is_verified)
            SELECT $1,$2,'Fixture',id,'active',true FROM roles WHERE name=$3 RETURNING id`, [`${crypto.randomUUID()}@example.invalid`, name, role])).rows[0].id;
        const patient = await user('Patient', 'patient');
        const otherPatient = await user('Other Patient', 'patient');
        const officer = await user('Officer', 'compliance_officer');
        const organization = (await db.query("INSERT INTO organizations(name,type,license_number,hospital_code,status,verified) VALUES('Performance fixture','hospital','PERF-LIC','PERF','active',true) RETURNING id")).rows[0].id;
        let doctor;
        for (let index = 0; index < 65; index++) {
            const id = await user(index === 64 ? 'Beyond listing' : `Doctor ${index}`, 'doctor');
            doctor ||= id;
            await db.query("INSERT INTO staff_org_mapping(user_id,organization_id,role_id,status) SELECT $1,$2,id,'active' FROM roles WHERE name='doctor'", [id, organization]);
        }
        await user('Beyond listing', 'doctor'); // Same name, outside this organization.
        const users = require('../src/models/user.model');
        await t.test('finds matches beyond the first page without crossing the organization scope', async () => {
            const options = { organizationId: organization, role: 'doctor', search: 'Beyond listing' };
            assert.equal((await users.getAllUsers(options)).length, 1);
            assert.equal(await users.countAllUsers(options), 1);
            assert.equal((await users.getAllUsers({ organizationId: organization, limit: 20, offset: 60 })).length, 5);
            assert.equal(await users.countAllUsers({ organizationId: organization }), 65);
            assert.equal((await users.getAllUsers({ search: 'Beyond%', organizationId: organization })).length, 0);
        });
        for (let index = 0; index < 65; index++) await db.query(`INSERT INTO medical_records(patient_id,type,title,description,created_by,created_at)
            VALUES($1,'consultation',$2,'Summary',$3,NOW()-($4*INTERVAL '1 day'))`, [patient, index === 64 ? 'Rare older visit' : `Visit ${index}`, doctor, index]);
        const records = require('../src/models/medical_record.model');
        await t.test('search, matching count, safe projection and stable pages work for records', async () => {
            const options = { summary: true, limit: 20, search: 'Rare older' };
            const result = await records.findByPatientId(patient, options);
            assert.equal(result.length, 1);
            assert.equal(result[0].title, 'Rare older visit');
            assert.equal(Object.hasOwn(result[0], 'immutable_flag'), false);
            assert.equal(await records.countByPatient(patient, null, null, 'Rare older'), 1);
            assert.equal((await records.findByPatientId(otherPatient, options)).length, 0);
            assert.equal(await records.countByPatient(otherPatient, null, null, 'Rare older'), 0);
            const first = await records.findByPatientId(patient, { limit: 20 });
            const second = await records.findByPatientId(patient, { limit: 20, offset: 20 });
            assert.equal(first.length, 20); assert.equal(second.length, 20);
            assert.equal(first.some(row => second.some(next => next.id === row.id)), false);
        });
        await t.test('HTTP pagination preserves admin scope and patient authorization', async http => {
            const request = require('supertest');
            const app = require('../src/app');
            const administrator = await user('Owner', 'hospital_admin');
            await db.query('UPDATE organizations SET admin_user_id=$1 WHERE id=$2', [administrator, organization]);
            const { generateAccessToken } = require('../src/config/jwt');
            const session = async (id, roleName) => {
                const token = generateAccessToken({ userId: id, roleName });
                await db.query("INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')", [id, crypto.createHash('sha256').update(token).digest('hex')]);
                return token;
            };
            const adminToken = await session(administrator, 'hospital_admin');
            const patientToken = await session(patient, 'patient');
            const listed = await request(app).get('/api/users?role=doctor&search=Beyond&limit=10000&offset=-4').set('Authorization', `Bearer ${adminToken}`);
            assert.equal(listed.status, 200, JSON.stringify(listed.body));
            assert.equal(listed.body.data.length, 1);
            assert.deepEqual(listed.body.pagination, { total: 1, limit: 100, offset: 0 });
            const history = await request(app).get(`/api/emr/patients/${patient}/medical-records?search=Rare&summary=true&limit=10000&offset=-3`).set('Authorization', `Bearer ${patientToken}`);
            assert.equal(history.status, 200, JSON.stringify(history.body));
            assert.equal(history.body.data.records[0].title, 'Rare older visit');
            assert.deepEqual(history.body.data.pagination, { total: 1, limit: 100, offset: 0 });
            assert.equal((await request(app).get(`/api/emr/patients/${otherPatient}/medical-records?search=Rare`).set('Authorization', `Bearer ${patientToken}`)).status, 403);
            const measured = await request(app).post('/api/performance').send({ name: 'LCP', value: 1500 });
            assert.equal(measured.status, 204);
            assert.equal(measured.headers['cache-control'], 'no-store');
            await http.test('visit and audit searches reach beyond page one within their access scope', async () => {
                const otherOrg = (await db.query("INSERT INTO organizations(name,type,license_number,hospital_code,status,verified) VALUES('Other fixture','hospital','OTHER-LIC','OTHER','active',true) RETURNING id")).rows[0].id;
                await db.query(`INSERT INTO visits(patient_id,organization_id,visit_code,status,assigned_doctor_id,created_at)
                    SELECT $1,$2,'Queue-'||lpad(n::text,2,'0'),'checked_in',$3,NOW()-n*INTERVAL '1 minute' FROM generate_series(1,25) n`, [patient, organization, doctor]);
                await db.query(`INSERT INTO visits(patient_id,organization_id,visit_code,status,assigned_doctor_id)
                    VALUES($1,$2,'Queue-25-other','checked_in',$3),($1,$2,'Queue-01-other','checked_in',$3),($1,$4,'Queue-25-pending','pending',$3)`, [patient, otherOrg, doctor, organization]);
                const doctorToken = await session(doctor, 'doctor');
                const get = (path, token) => request(app).get(path).set('Authorization', `Bearer ${token}`);
                for (const [path, token, target] of [['/api/visits/hospital', adminToken, 'Queue-25'], ['/api/visits/assigned', doctorToken, 'Queue-01']]) {
                    const firstPage = await get(`${path}?limit=20&status=checked_in`, token);
                    assert.equal(firstPage.status, 200, JSON.stringify(firstPage.body));
                    assert.equal(firstPage.body.data.length, 20);
                    assert.equal(firstPage.body.pagination.total, 25);
                    assert.ok(!firstPage.body.data.some(row => row.visit_code === target));
                    const secondPage = await get(`${path}?limit=20&offset=20&status=checked_in`, token);
                    assert.equal(secondPage.body.data.length, 5);
                    assert.ok(secondPage.body.data.some(row => row.visit_code === target));
                    const matches = await get(`${path}?limit=20&status=checked_in&search=${target}`, token);
                    assert.deepEqual(matches.body.data.map(row => row.visit_code), [target]);
                    assert.equal(matches.body.pagination.total, 1);
                }
                // The audit trigger assigns timestamps, so insert the target first.
                const older = (await db.query(`INSERT INTO audit_logs(action,entity_type,entity_id,purpose)
                    VALUES ('fixture_queue_event','organization',$1,'Older audit needle')
                    RETURNING timestamp::date::text AS day, timestamp::text AS instant`, [organization])).rows[0];
                await db.query(`INSERT INTO audit_logs(action,entity_type,entity_id,purpose) VALUES
                    ('fixture_queue_event','organization',$2,'Older audit needle'),
                    ('different_action','organization',$1,'Older audit needle')`, [organization, otherOrg]);
                await db.query(`INSERT INTO audit_logs(action,entity_type,entity_id,purpose)
                    SELECT 'fixture_queue_event','organization',$1,'Routine event '||n FROM generate_series(1,25) n`, [organization]);
                const auditPath = '/api/audit/logs?limit=20&action=fixture_queue_event';
                const initialLogs = await get(auditPath, adminToken);
                assert.equal(initialLogs.status, 200, JSON.stringify(initialLogs.body));
                assert.equal(initialLogs.body.pagination.total, 26);
                assert.ok(!initialLogs.body.data.some(row => row.details === 'Older audit needle'));
                const nextLogs = await get(auditPath + '&page=2', adminToken);
                assert.equal(nextLogs.body.data.length, 6);
                assert.ok(nextLogs.body.data.some(row => row.details === 'Older audit needle'));
                const found = await get(auditPath + `&search=Older%20audit%20needle&startDate=${older.day}&endDate=${older.day}`, adminToken);
                assert.equal(found.status, 200, JSON.stringify(found.body));
                assert.deepEqual(found.body.data.map(row => row.details), ['Older audit needle']);
                assert.equal(found.body.pagination.total, 1);
                const excluded = await get(auditPath + '&search=Older&endBefore=' + encodeURIComponent(older.instant), adminToken);
                assert.equal(excluded.status, 200, JSON.stringify(excluded.body));
                assert.equal(excluded.body.pagination.total, 0);
            });
        });
        const { seal } = require('../src/modules/privacy/privacy-crypto');
        const assessment = { discoveredAt: '2026-01-01T00:00:00.000Z', regimes: ['gdpr'], gdprRole: 'controller', riskLevel: 'risk' };
        const addCase = async () => {
            const id = crypto.randomUUID();
            await db.query("INSERT INTO security_events(id,user_id,event_type,severity,description,status) VALUES($1,$2,'data_breach','high','Performance fixture','Open')", [id, officer]);
            await db.query('INSERT INTO privacy_breaches(incident_id,discovered_at,assessment_ciphertext,created_by) VALUES($1,$2,$3,$4)', [id, assessment.discoveredAt, seal(assessment, `breach:${id}:1`), officer]);
            return id;
        };
        const firstCase = await addCase();
        const breaches = require('../src/modules/compliance/breach.service');
        async function listWithCount(page = '1') {
            const original = db.query;
            let count = 0;
            db.query = (...args) => { count++; return original(...args); };
            try { const result = await breaches.listBreaches({ query: { page } }); assert.equal(count, 2); return result; }
            finally { db.query = original; }
        }
        await t.test('one and fifty cases use two data queries and never decrypt notice evidence', async () => {
            assert.equal((await listWithCount()).cases.length, 1);
            await db.query('INSERT INTO breach_assessment_history(incident_id,version,assessment_ciphertext,recorded_by) VALUES($1,1,$2,$3)', [firstCase, seal(assessment, `breach:${firstCase}:1`), officer]);
            await db.query(`INSERT INTO breach_notification_log(incident_id,assessment_version,regime,audience,status,occurred_at,channel,evidence_ciphertext,recorded_by)
                VALUES($1,1,'gdpr','authority','sent',NOW(),'portal','list-must-not-decrypt-this',$2)`, [firstCase, officer]);
            for (let index = 1; index < 50; index++) await addCase();
            const result = await listWithCount();
            assert.equal(result.cases.length, 50); assert.equal(result.hasMore, false);
            assert.equal(result.cases.find(row => row.id === firstCase).obligations.find(row => row.audience === 'authority').status, 'recorded');
            await addCase();
            assert.equal((await listWithCount()).hasMore, true);
            assert.equal((await listWithCount('2')).cases.length, 1);
        });
    } finally {
        if (db) await db.pool.end();
        await admin.query(`DROP DATABASE ${database}`);
        await admin.end();
    }
});
