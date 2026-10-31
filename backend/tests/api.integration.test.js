const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('pg');
const crypto = require('crypto');
const request = require('supertest');

test('real API: registration, sessions, patient boundaries, administration, and audit integrity', {
    skip: process.env.RUN_DB_TESTS !== 'true', timeout: 60000,
}, async t => {
    assert.equal(process.env.NODE_ENV, 'test');
    assert.ok(['127.0.0.1', 'localhost', '::1'].includes(process.env.DB_HOST));
    assert.equal(process.env.DB_PORT, '55432');
    assert.match(process.env.DB_NAME, /test/);
    const adminConfig = { host: process.env.DB_HOST, port: 55432, database: process.env.DB_NAME,
        user: process.env.DB_USER, password: process.env.DB_PASSWORD, ssl: false };
    const admin = new Client(adminConfig);
    const database = `healthcare_api_test_${process.pid}`;
    assert.match(database, /^healthcare_api_test_\d+$/);
    await admin.connect();
    await admin.query(`CREATE DATABASE "${database}"`);
    process.env.DB_NAME = database;
    process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
    process.env.JWT_REFRESH_SECRET = crypto.randomBytes(48).toString('hex');
    process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    process.env.AI_ENABLED = 'false';
    process.env.BCRYPT_ROUNDS = '4';
    process.env.AUTO_LOGOUT_ENABLED = 'true';
    let db;
    let applicationRole;
    try {
        const migrationClient = new Client({ ...adminConfig, database });
        await migrationClient.connect();
        try { await require('../src/database/migrate').migrate(migrationClient, { log: () => {} }); }
        finally { await migrationClient.end(); }
        db = require('../src/config/db');
        const app = require('../src/app');
        const audit = require('../src/services/audit.service');
        const { generateAccessToken } = require('../src/config/jwt');
        const hash = value => crypto.createHash('sha256').update(value).digest('hex');
        const send = (method, url, token, body) => {
            const req = request(app)[method](url);
            if (token) req.set('Authorization', `Bearer ${token}`);
            return body === undefined ? req : req.send(body);
        };
        const expectStatus = (response, expected) => assert.equal(response.status, expected, JSON.stringify(response.body));
        const password = 'Fixture-Password-48!';
        const passHash = await require('bcrypt').hash(password, 4);
        const users = {};
        for (const role of ['patient', 'doctor', 'nurse', 'lab_technician', 'radiologist', 'pharmacist', 'hospital_admin', 'system_admin', 'insurance_provider', 'researcher']) {
            const result = await db.query(`INSERT INTO users(email,password_hash,role_id,first_name,is_verified,status)
                SELECT $1,$2,id,'Fixture',true,'active' FROM roles WHERE name=$3 RETURNING id`, [`${role}@example.invalid`, passHash, role]);
            users[role] = result.rows[0].id;
        }
        const otherPatient = (await db.query(`INSERT INTO users(email,password_hash,role_id,is_verified,status)
            SELECT 'other@example.invalid',$1,id,true,'active' FROM roles WHERE name='patient' RETURNING id`, [passHash])).rows[0].id;
        for (const patient of [users.patient, otherPatient]) await db.query('INSERT INTO patient_profiles(user_id,unique_health_id) VALUES($1,$2)', [patient, `TEST-${patient}`]);
        const org = (await db.query(`INSERT INTO organizations(name,type,license_number,admin_user_id,status,verified)
            VALUES('Fixture Hospital','hospital','FIXTURE-A',$1,'active',true) RETURNING id`, [users.hospital_admin])).rows[0].id;
        const otherOrg = (await db.query(`INSERT INTO organizations(name,type,license_number,status,verified)
            VALUES('Other Hospital','hospital','FIXTURE-B','active',true) RETURNING id`)).rows[0].id;
        for (const role of ['doctor', 'nurse', 'lab_technician', 'radiologist', 'pharmacist', 'hospital_admin']) {
            await db.query(`INSERT INTO staff_org_mapping(user_id,organization_id,role_id) SELECT $1,$2,id FROM roles WHERE name=$3`, [users[role], org, role]);
        }
        const visit = (await db.query(`INSERT INTO visits(patient_id,organization_id,status,visit_code,assigned_doctor_id,assigned_nurse_id)
            VALUES($1,$2,'in_progress','TEST01',$3,$4) RETURNING id`, [users.patient, org, users.doctor, users.nurse])).rows[0].id;
        const otherVisit = (await db.query(`INSERT INTO visits(patient_id,organization_id,status,visit_code)
            VALUES($1,$2,'in_progress','TEST02') RETURNING id`, [otherPatient, otherOrg])).rows[0].id;
        const record = (await db.query(`INSERT INTO medical_records(patient_id,visit_id,type,title,created_by)
            VALUES($1,$2,'consultation','Private fixture record',$3) RETURNING id`, [users.patient, visit, users.doctor])).rows[0].id;
        const tokens = {};
        for (const [role, userId] of Object.entries(users)) {
            tokens[role] = generateAccessToken({ userId });
            await db.query(`INSERT INTO sessions(user_id,token_hash,device_info,expires_at) VALUES($1,$2,'{}',NOW()+INTERVAL '1 hour')`, [userId, hash(tokens[role])]);
        }

        await t.test('health/readiness, invalid JSON, debug removal, and missing authentication', async () => {
            expectStatus(await send('get', '/readyz'), 200);
            expectStatus(await send('get', '/debug-columns'), 404);
            expectStatus(await send('get', '/api/emr/patients/' + users.patient + '/medical-records'), 401);
            expectStatus(await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{broken'), 400);
        });

        await t.test('random emailed OTP activates a patient and logout cannot be bypassed by another login', async () => {
            const { transporter } = require('../src/config/mail');
            const original = transporter.sendMail.bind(transporter);
            let sentOTP;
            transporter.sendMail = async options => {
                sentOTP = options.text.match(/is: (\d+)\./)?.[1];
                return original(options);
            };
            const email = 'registration@example.invalid';
            try {
                const registered = await send('post', '/api/auth/register/patient', null, { email, password, firstName: 'Registration', lastName: 'Fixture' });
                expectStatus(registered, 201);
                expectStatus(await send('post', '/api/auth/register/patient', null, { email, password: 'Replacement-Password-48!' }), 409);
                assert.match(sentOTP, /^\d{6}$/);
                expectStatus(await send('post', '/api/auth/verify-otp', null, { email, otp: sentOTP, purpose: 'registration' }), 200);
                expectStatus(await send('post', '/api/auth/verify-otp', null, { email, otp: sentOTP, purpose: 'registration' }), 400);
                const first = await send('post', '/api/auth/login', null, { email, password });
                const second = await send('post', '/api/auth/login', null, { email, password });
                expectStatus(first, 200); expectStatus(second, 200);
                assert.notEqual(first.body.token, second.body.token);
                expectStatus(await send('get', '/api/auth/verify', first.body.token), 200);
                expectStatus(await send('post', '/api/auth/logout', first.body.token), 200);
                expectStatus(await send('get', '/api/auth/verify', first.body.token), 401);
                const fresh = await send('post', '/api/auth/login', null, { email, password });
                expectStatus(fresh, 200);
                expectStatus(await send('get', '/api/auth/verify', first.body.token), 401);
                expectStatus(await send('get', '/api/auth/verify', second.body.token), 401);
            } finally { transporter.sendMail = original; }
        });

        await t.test('records require ownership or assigned clinical care plus live consent', async () => {
            expectStatus(await send('get', `/api/emr/medical-records/${record}`, tokens.patient), 200);
            expectStatus(await send('get', `/api/emr/patients/${otherPatient}/medical-records`, tokens.patient), 403);
            expectStatus(await send('get', `/api/emr/medical-records/${record}`, tokens.system_admin), 403);
            expectStatus(await send('get', `/api/emr/medical-records/${record}`, tokens.doctor), 403);
            const granted = await send('post', '/api/consent/grant', tokens.patient, {
                recipientUserId: users.doctor, dataCategory: 'all_medical_data', purpose: 'treatment', accessLevel: 'write',
            });
            expectStatus(granted, 201);
            expectStatus(await send('get', `/api/emr/medical-records/${record}`, tokens.doctor), 200);
            const created = await send('post', '/api/emr/medical-records', tokens.doctor, {
                patientId: users.patient, visitId: visit, type: 'consultation', title: 'Clinical workflow fixture', description: 'Synthetic only',
            });
            expectStatus(created, 201);
            const consentId = (await db.query('SELECT id FROM consents WHERE patient_id=$1 AND recipient_user_id=$2', [users.patient, users.doctor])).rows[0].id;
            expectStatus(await send('put', `/api/consent/revoke/${consentId}`, tokens.patient, { reason: 'Fixture revocation' }), 200);
            expectStatus(await send('get', `/api/emr/medical-records/${record}`, tokens.doctor), 403);
        });

        await t.test('clinical and tenant operations deny unauthorized principals', async () => {
            expectStatus(await send('post', '/api/workflow/lab-orders', tokens.patient, { visitId: visit, testName: 'Denied' }), 403);
            expectStatus(await send('get', '/api/lab/orders', tokens.patient), 403);
            expectStatus(await send('get', '/api/radiology/orders', tokens.patient), 403);
            expectStatus(await send('post', '/api/staff/invite', tokens.hospital_admin, { email: 'privilege@example.invalid', role: 'system_admin', organizationId: org }), 403);
            expectStatus(await send('post', '/api/staff/invite', tokens.hospital_admin, { email: 'cross@example.invalid', role: 'nurse', organizationId: otherOrg }), 403);
            expectStatus(await send('post', `/api/admin/organizations/${otherOrg}/approve`, tokens.hospital_admin, {}), 403);
            expectStatus(await send('get', `/api/visits/${otherVisit}/staff`, tokens.hospital_admin), 403);
            expectStatus(await send('post', '/api/chatbot/start', tokens.patient, {}), 503);
        });

        await t.test('audit records form a valid concurrent chain and reject mutation', async () => {
            await new Promise(resolve => setImmediate(resolve));
            await Promise.all(Array.from({ length: 12 }, (_, i) => audit.createAuditLog({ userId: users.patient, action: `fixture_${i}`, metadata: { password: 'never-retain', nested: { token: 'never-retain' } } })));
            const integrity = await audit.verifyAuditLogIntegrity();
            assert.equal(integrity.verified, true, JSON.stringify(integrity));
            const sample = (await db.query("SELECT id,metadata FROM audit_logs WHERE action='fixture_0'")).rows[0];
            assert.equal(sample.metadata.password, '[REDACTED]');
            assert.equal(sample.metadata.nested.token, '[REDACTED]');
            await assert.rejects(db.query("UPDATE audit_logs SET action='changed' WHERE id=$1", [sample.id]), /append-only/);
            await assert.rejects(db.query('DELETE FROM audit_logs WHERE id=$1', [sample.id]), /append-only/);
        });

        await t.test('emergency grants are patient-specific, read-only, audited, notified, and revocable', async () => {
            const activated = await send('post', '/api/emergency/activate', tokens.doctor, { patientId: users.patient, justification: 'Synthetic emergency fixture requiring immediate record review' });
            expectStatus(activated, 201);
            const grant = activated.body.data;
            expectStatus(await send('get', `/api/emr/medical-records/${record}`, tokens.doctor), 200);
            expectStatus(await send('post', '/api/emr/medical-records', tokens.doctor, { patientId: users.patient, visitId: visit, type: 'consultation', title: 'Must deny emergency write' }), 403);
            expectStatus(await send('post', '/api/emergency/activate', tokens.doctor, { patientId: otherPatient, justification: 'Synthetic emergency at another organization must be denied' }), 403);
            const notified = await db.query("SELECT id FROM notifications WHERE user_id=$1 AND related_entity_id=$2 AND type='emergency_access'", [users.patient, grant.id]);
            assert.equal(notified.rowCount, 1);
            expectStatus(await send('post', `/api/emergency/${grant.id}/revoke`, tokens.doctor, {}), 200);
            expectStatus(await send('get', `/api/emr/medical-records/${record}`, tokens.doctor), 403);
        });

        await t.test('encrypted report bytes require patient access and appear in the patient audit trail', async () => {
            const fs = require('fs/promises'); const path = require('path');
            const { encryptBuffer } = require('../src/services/file.crypto');
            const FileUploadService = require('../src/services/file.upload.service');
            const original = Buffer.from('%PDF-1.4 synthetic-only report');
            const name = '1000000000_0123456789abcdef.pdf';
            const url = `/api/files/${users.patient}/lab_results/${name}`;
            const directory = FileUploadService.getStoragePath(users.patient, 'lab_results');
            const location = path.join(directory, name);
            await fs.mkdir(directory, { recursive: true });
            await fs.writeFile(location, encryptBuffer(original));
            try {
                await db.query(`INSERT INTO lab_results(record_id,test_name,file_url,ordered_by,performed_by) VALUES($1,'Synthetic',$2,$3,$3)`, [record, url, users.doctor]);
                const response = await send('get', url, tokens.patient);
                expectStatus(response, 200);
                assert.deepEqual(response.body, original);
                assert.match(response.headers['content-disposition'], /attachment/);
                expectStatus(await send('get', url, tokens.doctor), 403);
                const trail = await send('get', '/api/audit/my-trail', tokens.patient);
                expectStatus(trail, 200);
                assert.ok(trail.body.data.logs.some(event => event.action === 'download_medical_file'));
            } finally { await fs.unlink(location); await fs.rmdir(directory); await fs.rmdir(path.dirname(directory)); }
        });

        await t.test('research and administrative audit views suppress unauthorized data', async () => {
            expectStatus(await send('get', '/api/research/stats', tokens.patient), 403);
            const stats = await send('get', '/api/research/stats', tokens.researcher);
            expectStatus(stats, 200); assert.equal(stats.body.data.totalRecords, null);
            assert.deepEqual((await send('get', '/api/research/symptoms', tokens.researcher)).body.data, []);
            assert.deepEqual((await send('get', '/api/research/demographics', tokens.researcher)).body.data, { ageGroups: [], gender: [] });
            const profile = await send('put', '/api/research/profile', tokens.researcher, { department: 'Synthetic department' });
            expectStatus(profile, 200); assert.equal(profile.body.data.department, 'Synthetic department');
            const otherEvent = await audit.createAuditLog({ userId: users.system_admin, action: 'cross_org_fixture', entityType: 'organization', entityId: otherOrg });
            const hospitalLogs = await send('get', '/api/audit/logs', tokens.hospital_admin);
            expectStatus(hospitalLogs, 200);
            assert.ok(!hospitalLogs.body.data.some(event => event.id === otherEvent.id));
            const compliance = await send('get', '/api/compliance/dashboard', tokens.system_admin);
            expectStatus(compliance, 200); assert.equal(compliance.body.data.complianceScore, null);
            const recipients = await send('get', '/api/users/consent-recipients', tokens.patient);
            expectStatus(recipients, 200);
            for (const role of ['doctor','nurse','lab_technician','radiologist','pharmacist','insurance_provider','researcher']) {
                assert.ok(recipients.body.data.some(person => person.role === role));
            }
            assert.ok(recipients.body.data.every(person => !('email' in person) && !('phone' in person)));
        });

        await t.test('the production application database role can append audit entries but cannot alter schema or retained evidence', async () => {
            applicationRole = `healthcare_api_app_${process.pid}`;
            process.env.DB_APP_USER = applicationRole;
            process.env.DB_APP_PASSWORD = crypto.randomBytes(32).toString('hex');
            await require('../scripts/provision-app-role').main();
            const client = new Client({ ...adminConfig, database, user: applicationRole, password: process.env.DB_APP_PASSWORD });
            await client.connect();
            try {
                const role = (await client.query('SELECT rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user')).rows[0];
                assert.deepEqual(role, { rolsuper: false, rolcreatedb: false, rolcreaterole: false });
                await client.query("INSERT INTO audit_logs(action) VALUES('limited_role_fixture')");
                await assert.rejects(client.query('CREATE TABLE forbidden_schema_write(id INTEGER)'), /permission denied/);
                await assert.rejects(client.query("UPDATE audit_logs SET action='tampered'"), /permission denied/);
                await assert.rejects(client.query('DELETE FROM _migrations'), /permission denied/);
            } finally { await client.end(); }
        });

        await t.test('OTP failure limits persist and concurrent verification consumes a challenge once', async () => {
            const { verifyOTP } = require('../src/services/otp.service');
            await db.query(`INSERT INTO otp_verifications(user_id,email,otp_hash,purpose,expires_at) VALUES($1,'attempts@example.invalid',$2,'registration',NOW()+INTERVAL '5 minutes')`, [users.patient, hash('654321')]);
            for (let i=0;i<3;i++) await assert.rejects(verifyOTP({ email: 'attempts@example.invalid', otp: '123456', purpose: 'registration' }), /Invalid OTP/);
            await assert.rejects(verifyOTP({ email: 'attempts@example.invalid', otp: '654321', purpose: 'registration' }), /Maximum OTP/);
            assert.equal((await db.query("SELECT attempts FROM otp_verifications WHERE email='attempts@example.invalid'")).rows[0].attempts, 3);
            await db.query(`INSERT INTO otp_verifications(user_id,email,otp_hash,purpose,expires_at) VALUES($1,'concurrent@example.invalid',$2,'registration',NOW()+INTERVAL '5 minutes')`, [users.patient, hash('654321')]);
            const outcomes = await Promise.allSettled([1,2].map(() => verifyOTP({ email: 'concurrent@example.invalid', otp: '654321', purpose: 'registration' })));
            assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
        });

        await t.test('research totals require five consenting patients and respond immediately to revocation', async () => {
            const patients = [users.patient];
            for (let i=0;i<4;i++) {
                const user = (await db.query(`INSERT INTO users(email,role_id,status,is_verified) SELECT $1,id,'active',true FROM roles WHERE name='patient' RETURNING id`, [`cohort${i}@example.invalid`])).rows[0].id;
                await db.query('INSERT INTO patient_profiles(user_id,unique_health_id) VALUES($1,$2)', [user, `COHORT-${user}`]); patients.push(user);
            }
            for (const user of patients.slice(0,4)) await db.query(`INSERT INTO consents(patient_id,recipient_user_id,data_category,purpose,access_level) VALUES($1,$2,'all_medical_data','clinical_research','read')`, [user,users.researcher]);
            assert.equal((await send('get','/api/research/stats',tokens.researcher)).body.data.anonymizedPatients,null);
            const fifth = (await db.query(`INSERT INTO consents(patient_id,recipient_user_id,data_category,purpose,access_level) VALUES($1,$2,'all_medical_data','clinical_research','read') RETURNING id`, [patients[4],users.researcher])).rows[0].id;
            assert.equal((await send('get','/api/research/stats',tokens.researcher)).body.data.anonymizedPatients,5);
            await db.query("UPDATE consents SET status='revoked' WHERE id=$1",[fifth]);
            assert.equal((await send('get','/api/research/stats',tokens.researcher)).body.data.anonymizedPatients,null);
        });

        await t.test('a patient can approve a reassigned clinician while the visit remains in progress', async () => {
            const nextDoctor = (await db.query(`INSERT INTO users(email,password_hash,role_id,is_verified,status)
                SELECT 'replacement@example.invalid',$1,id,true,'active' FROM roles WHERE name='doctor' RETURNING id`, [passHash])).rows[0].id;
            await db.query(`INSERT INTO staff_org_mapping(user_id,organization_id,role_id) SELECT $1,$2,id FROM roles WHERE name='doctor'`, [nextDoctor,org]);
            await db.query("UPDATE visits SET started_at=NOW()-INTERVAL '1 hour' WHERE id=$1",[visit]);
            const originalStart = (await db.query('SELECT started_at FROM visits WHERE id=$1',[visit])).rows[0].started_at;
            const nextLogin = await send('post','/api/auth/login',null,{email:'replacement@example.invalid',password});
            expectStatus(nextLogin,200);
            expectStatus(await send('patch',`/api/visits/${visit}/assign`,tokens.hospital_admin,{assignedDoctorId:nextDoctor}),200);
            expectStatus(await send('get',`/api/emr/medical-records/${record}`,nextLogin.body.token),403);
            const code = await send('post',`/api/visits/${visit}/access-code`,tokens.patient,{});
            expectStatus(code,200);
            expectStatus(await send('post',`/api/visits/${visit}/verify-otp`,tokens.patient,{otp:code.body.data.accessCode,accessLevel:'read'}),200);
            expectStatus(await send('get',`/api/emr/medical-records/${record}`,nextLogin.body.token),200);
            assert.deepEqual((await db.query('SELECT started_at FROM visits WHERE id=$1',[visit])).rows[0].started_at,originalStart);
        });

        await t.test('queue positions preserve database timestamp precision and never show negative waits', async () => {
            const doctor = (await db.query(`INSERT INTO users(email,role_id,status,is_verified)
                SELECT 'queue-precision@example.invalid',id,'active',true FROM roles WHERE name='doctor' RETURNING id`)).rows[0].id;
            const target = (await db.query(`INSERT INTO visits(patient_id,organization_id,assigned_doctor_id,status,visit_code,created_at)
                VALUES($1,$2,$3,'approved','QUEUE-PRECISION','2026-01-01 00:00:00.000999') RETURNING id`,[users.patient,org,doctor])).rows[0].id;
            const Visit = require('../src/models/visit.model');
            assert.deepEqual(await Visit.getQueuePosition(target,doctor), { position:1,total:1,status:'approved',eta_minutes:0 });
            await db.query(`INSERT INTO visits(patient_id,organization_id,assigned_doctor_id,status,visit_code,created_at)
                VALUES($1,$2,$3,'approved','QUEUE-AHEAD','2026-01-01 00:00:00.000500')`,[users.patient,org,doctor]);
            assert.deepEqual(await Visit.getQueuePosition(target,doctor), { position:2,total:2,status:'approved',eta_minutes:15 });
        });
    } finally {
        await new Promise(resolve => setImmediate(resolve));
        if (db) await db.pool.end();
        await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
        if (applicationRole) await admin.query(`DROP ROLE "${applicationRole}"`);
        await admin.end();
        require('../src/utils/logger').close();
    }
});
