const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('pg');
const crypto = require('node:crypto');
const request = require('supertest');
const standaloneFile = patientId => `/api/files/${patientId}/imaging/standalone.pdf`;

test('privacy requests and exports enforce owner, reviewer, encryption and durable evidence boundaries', {
    skip: process.env.RUN_DB_TESTS !== 'true', timeout: 90000,
}, async t => {
    assert.equal(process.env.NODE_ENV, 'test');
    assert.ok(['127.0.0.1', 'localhost', '::1'].includes(process.env.DB_HOST));
    assert.notEqual(String(process.env.DB_PORT), '5432');
    assert.match(process.env.DB_NAME, /test/);
    const database = `healthcare_privacy_test_${process.pid}`;
    const settings = { host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME,
        user: process.env.DB_USER, password: process.env.DB_PASSWORD, ssl: false };
    const admin = new Client(settings); await admin.connect();
    assert.match(database, /^healthcare_privacy_test_\d+$/);
    await admin.query(`CREATE DATABASE "${database}"`);
    process.env.DB_NAME = database;
    process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
    process.env.JWT_REFRESH_SECRET = crypto.randomBytes(48).toString('hex');
    process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    process.env.AI_ENABLED = 'false';
    process.env.RATE_LIMIT_MAX_REQUESTS = '10000';
    let db;
    try {
        const migrationClient = new Client({ ...settings, database }); await migrationClient.connect();
        try { await require('../src/database/migrate').migrate(migrationClient, { log: () => {} }); } finally { await migrationClient.end(); }
        db = require('../src/config/db');
        const app = require('../src/app');
        const audit = require('../src/services/audit.service');
        const { generateAccessToken } = require('../src/config/jwt');
        const { hashToken } = require('../src/services/encryption.service');
        const { unseal } = require('../src/modules/privacy/privacy-crypto');
        const password = 'Privacy-Fixture-Password-43!';
        const passwordHash = await require('bcrypt').hash(password, 4);
        const people = {};
        for (const [key, role] of Object.entries({ patient: 'patient', other: 'patient', reviewer: 'compliance_officer', admin: 'system_admin', doctor: 'doctor' })) {
            const id = (await db.query(`INSERT INTO users(email,first_name,last_name,password_hash,role_id,status,is_verified)
                SELECT $1,$2,'Fixture',$3,id,'active',true FROM roles WHERE name=$4 RETURNING id`, [`privacy-${key}@example.invalid`, key === 'doctor' ? 'UNRELATED_PROVIDER_MARKER' : key, passwordHash, role])).rows[0].id;
            const token = generateAccessToken({ userId: id });
            await db.query("INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')", [id, hashToken(token)]);
            people[key] = { id, token };
        }
        for (const key of ['patient', 'other']) await db.query('INSERT INTO patient_profiles(user_id,unique_health_id,govt_id_hash) VALUES($1,$2,$3)', [people[key].id, `PRIVACY-${key}`, `GOVERNMENT_HASH_SECRET-${key}`]);
        const org = (await db.query("INSERT INTO organizations(name,type,license_number,status,verified) VALUES('Privacy fixture','hospital','PRIVACY-FIXTURE','active',true) RETURNING id")).rows[0].id;
        const visit = (await db.query("INSERT INTO visits(patient_id,organization_id,visit_code,status,otp_code) VALUES($1,$2,'PRIVACY-OWN','completed','VISIT_OTP_SECRET') RETURNING id", [people.patient.id, org])).rows[0].id;
        const otherVisit = (await db.query("INSERT INTO visits(patient_id,organization_id,visit_code,status) VALUES($1,$2,'PRIVACY-OTHER','completed') RETURNING id", [people.other.id, org])).rows[0].id;
        const record = (await db.query("INSERT INTO medical_records(patient_id,visit_id,type,title,description,created_by) VALUES($1,$2,'consultation','Own fixture record','Own clinical content',$3) RETURNING id", [people.patient.id, visit, people.doctor.id])).rows[0].id;
        const otherRecord = (await db.query("INSERT INTO medical_records(patient_id,visit_id,type,title,description,created_by) VALUES($1,$2,'consultation','OTHER_PATIENT_RECORD_SECRET','OTHER_PATIENT_CONTENT_SECRET',$3) RETURNING id", [people.other.id, otherVisit, people.doctor.id])).rows[0].id;
        await db.query("INSERT INTO medical_records(patient_id,visit_id,type,title,created_by) SELECT $1,$2,'note','Own row ' || n,$3 FROM generate_series(1,105) n", [people.patient.id, visit, people.doctor.id]);
        const diagnosis = (await db.query("INSERT INTO diagnoses(record_id,icd_code,description,diagnosed_by) VALUES($1,'J00','Own fixture diagnosis',$2) RETURNING id", [record, people.doctor.id])).rows[0].id;
        const prescription = (await db.query("INSERT INTO prescriptions(record_id,medication,dosage,frequency,prescribed_by) VALUES($1,'Own fixture medication','1mg','daily',$2) RETURNING id", [record, people.doctor.id])).rows[0].id;
        const foreignPrescription = (await db.query("INSERT INTO prescriptions(record_id,medication,dosage,frequency,prescribed_by) VALUES($1,'OTHER_PRESCRIPTION_SECRET','1mg','daily',$2) RETURNING id", [otherRecord, people.doctor.id])).rows[0].id;
        const visitNote = (await db.query("INSERT INTO visit_notes(visit_id,author_id,subjective,objective,assessment,plan) VALUES($1,$2,'Own visit symptoms','Own examination','Own clinical assessment','Own follow-up plan') RETURNING id", [visit, people.doctor.id])).rows[0].id;
        await db.query("INSERT INTO visit_notes(visit_id,author_id,subjective) VALUES($1,$2,'FOREIGN_VISIT_NOTE_SECRET')", [otherVisit, people.doctor.id]);
        const medicationOrder = (await db.query("INSERT INTO medication_orders(visit_id,prescription_id,medication,dosage,ordered_by,status,administered_at) VALUES($1,$2,'Own administered medicine','1mg',$3,'administered',NOW()) RETURNING id", [visit, prescription, people.doctor.id])).rows[0].id;
        await db.query("INSERT INTO medication_orders(visit_id,prescription_id,medication,ordered_by) VALUES($1,$2,'CROSS_PATIENT_PRESCRIPTION_ORDER_SECRET',$3)", [visit, foreignPrescription, people.doctor.id]);
        await db.query("INSERT INTO medication_orders(visit_id,medication,ordered_by) VALUES($1,'FOREIGN_MEDICATION_ORDER_SECRET',$2)", [otherVisit, people.doctor.id]);
        const standaloneReport = (await db.query("INSERT INTO radiology_reports(patient_id,report_title,findings,status,file_path) VALUES($1,'Own standalone radiology report','Own historical radiology findings','finalized',$2) RETURNING id", [people.patient.id, standaloneFile(people.patient.id)])).rows[0].id;
        const foreignImagingOrder = (await db.query("INSERT INTO imaging_orders(patient_id,visit_id,organization_id,study_type) VALUES($1,$2,$3,'Foreign linked study') RETURNING id", [people.other.id, otherVisit, org])).rows[0].id;
        await db.query("INSERT INTO radiology_reports(patient_id,imaging_order_id,report_title,findings) VALUES($1,$2,'FOREIGN_RADIOLOGY_LINK_SECRET','Other patient report must remain excluded')", [people.patient.id, foreignImagingOrder]);
        await db.query("INSERT INTO radiology_reports(patient_id,report_title,findings) VALUES($1,'OTHER_RADIOLOGY_REPORT_SECRET','Other patient standalone report')", [people.other.id]);
        await db.query("INSERT INTO insurance_policies(id,patient_id,member_name,type,coverage_start,coverage_end) VALUES('POL-PRIVACY-OWN',$1,'Own policy member','Basic','2026-01-01','2026-12-31'),('POL-PRIVACY-OTHER',$2,'OTHER_INSURANCE_PERSON_MARKER','Basic','2026-01-01','2026-12-31')", [people.patient.id, people.other.id]);
        await db.query("INSERT INTO insurance_claims(id,visit_id,patient_id,policy_id,diagnosis,amount) VALUES('CLM-PRIVACY-OWN',$1,$2,'POL-PRIVACY-OWN','Own covered consultation',100),('CLM-PRIVACY-CROSS',$1,$2,'POL-PRIVACY-OTHER','CROSS_PATIENT_CLAIM_SECRET',100)", [visit, people.patient.id]);
        const localFile = `/api/files/${people.patient.id}/lab_results/fixture.pdf`;
        await db.query("INSERT INTO lab_results(record_id,test_name,file_url,results_data,ordered_by) VALUES($1,'Own fixture test',$2,$3,$4)", [record, localFile, JSON.stringify({ observation: { value: 12, unit: 'g/dL' }, private_key: 'NESTED_KEY_SECRET' }), people.doctor.id]);
        await db.query("INSERT INTO lab_results(record_id,test_name,file_url,ordered_by) VALUES($1,'Foreign file reference fixture',$2,$3)", [record, `/api/files/${people.other.id}/lab_results/foreign.pdf`, people.doctor.id]);
        await db.query("INSERT INTO imaging_reports(record_id,imaging_type,file_url,findings,ordered_by) VALUES($1,'x-ray','https://external.example.invalid/private?token=EXTERNAL_LINK_SECRET','Own fixture image',$2)", [record, people.doctor.id]);
        await db.query("INSERT INTO consents(patient_id,recipient_user_id,data_category,purpose,access_level) VALUES($1,$2,'all_medical_data','treatment','read')", [people.patient.id, people.doctor.id]);
        await db.query('INSERT INTO triage_sessions(patient_id,conversation,soap_summary) VALUES($1,$2,$3)', [people.patient.id, JSON.stringify([{ role: 'user', content: 'Own fixture symptom history.' }]), JSON.stringify({ subjective: 'Own fixture summary', secret: 'TRIAGE_KEY_SECRET' })]);
        await audit.logAuditEvent({ userId: people.patient.id, action: 'privacy_fixture', entityType: 'patient', entityId: people.patient.id,
            metadata: { token: 'AUDIT_TOKEN_SECRET', unrelatedPatient: people.other.id } });
        await audit.logAuditEvent({ userId: people.reviewer.id, action: 'shared_patient_list_fixture', entityType: 'patient_list',
            metadata: { patientIds: [people.patient.id, people.other.id], token: 'SHARED_LIST_SECRET' } });
        await audit.logAuditEvent({ userId: people.reviewer.id, action: 'foreign_only_list_fixture', entityType: 'patient_list', metadata: { patientIds: [people.other.id] } });
        const send = (key, method, path, body) => {
            const call = request(app)[method]('/api/privacy' + path).set('Authorization', `Bearer ${people[key].token}`);
            return body === undefined ? call : call.send(body);
        };
        const status = (response, expected) => assert.equal(response.status, expected, JSON.stringify(response.body));
        let ownRequest; let otherRequest;
        await t.test('patients create only their own requests and see only their own history', async () => {
            const created = await send('patient', 'post', '/requests', { type: 'access', details: 'Please review my own complete information.' });
            status(created, 201); ownRequest = created.body.data;
            const other = await send('other', 'post', '/requests', { type: 'portability', details: 'Other patient confidential request narrative.' });
            status(other, 201); otherRequest = other.body.data;
            const list = await send('patient', 'get', '/requests'); status(list, 200);
            assert.deepEqual(list.body.data.map(item => item.id), [ownRequest.id]);
            assert.ok(!JSON.stringify(list.body).includes(otherRequest.details));
            status(await send('patient', 'post', '/requests', { type: 'access', details: 'Attempt to name another patient.', patientId: people.other.id }), 400);
            status(await send('patient', 'post', '/requests', { type: 'not-a-right', details: 'Invalid type must be rejected.' }), 400);
            for (const key of ['reviewer', 'admin', 'doctor']) status(await send(key, 'post', '/requests', { type: 'access', details: 'Should not submit as a patient.' }), 403);
        });
        await t.test('only compliance reviewers can progress a request with a recorded basis', async () => {
            for (const key of ['patient', 'other', 'admin', 'doctor']) status(await send(key, 'get', '/review'), 403);
            const queue = await send('reviewer', 'get', '/review'); status(queue, 200); assert.equal(queue.body.data.length, 2);
            status(await send('other', 'put', `/requests/${ownRequest.id}`, { status: 'in_review' }), 403);
            status(await send('patient', 'put', `/requests/${ownRequest.id}`, { status: 'in_review' }), 403);
            status(await send('reviewer', 'put', `/requests/${ownRequest.id}`, { status: 'fulfilled', resolution: 'Trying to skip initial review.', retentionBasis: 'No exception has been identified.' }), 409);
            status(await send('reviewer', 'put', `/requests/${ownRequest.id}`, { status: 'in_review', note: 'Review accepted by privacy team.' }), 200);
            status(await send('reviewer', 'put', `/requests/${ownRequest.id}`, { status: 'fulfilled' }), 400);
            const copy = await require('../src/modules/privacy/privacy-rights.service').exportPatient({ user: { id: people.patient.id, roleName: 'patient' }, body: { currentPassword: password }, headers: {} }, { requestId: ownRequest.id });
            status(await send('patient','post',`/requests/${ownRequest.id}/receipts/${copy.receipt.id}/confirm`,{received:true,contentHash:copy.receipt.contentHash}),200);
            const resolved = await send('reviewer', 'put', `/requests/${ownRequest.id}`, { status: 'fulfilled', resolution: 'Access review completed and the requested copy was supplied.', retentionBasis: 'Existing clinical retention requirements continue to apply.', action:{type:'export_receipt',receiptId:copy.receipt.id} });
            status(resolved, 200); assert.equal(resolved.body.data.history.length, 5);
            assert.equal(resolved.body.data.history[1].previousStatus, 'submitted');
            assert.ok(resolved.body.data.resolvedAt);
            status(await send('reviewer', 'put', `/requests/${ownRequest.id}`, { status: 'in_review' }), 409);
            const list = await send('patient', 'get', '/requests'); status(list, 200);
            assert.match(list.body.data[0].outcome.retentionBasis, /clinical retention/);
        });
        await t.test('narratives and outcomes are encrypted with context-bound append-only history', async () => {
            const stored = (await db.query('SELECT detail_cipher,outcome_cipher FROM privacy_rights_requests WHERE id=$1', [ownRequest.id])).rows[0];
            assert.ok(!stored.detail_cipher.includes(ownRequest.details));
            assert.equal(Buffer.from(stored.detail_cipher, 'base64').subarray(0, 8).toString(), 'SHMSENC2');
            assert.equal(unseal(stored.detail_cipher, `privacy-request:${ownRequest.id}:details`), ownRequest.details);
            assert.throws(() => unseal(stored.detail_cipher, `privacy-request:${otherRequest.id}:details`));
            assert.match(unseal(stored.outcome_cipher, `privacy-request:${ownRequest.id}:outcome`).resolution, /Access review completed/);
            await assert.rejects(db.query("UPDATE privacy_rights_history SET status='declined' WHERE request_id=$1", [ownRequest.id]), /append-only/);
            await assert.rejects(db.query('DELETE FROM privacy_rights_history WHERE request_id=$1', [ownRequest.id]), /append-only/);
            await assert.rejects(db.query('DELETE FROM privacy_rights_requests WHERE id=$1', [ownRequest.id]), /retained/);
        });
        await t.test('erasure outcomes describe retained information instead of claiming deletion', async () => {
            const created = await send('patient', 'post', '/requests', { type: 'erasure', details: 'Please review whether my historical records can be removed.' }); status(created, 201);
            const id = created.body.data.id;
            status(await send('reviewer', 'put', `/requests/${id}`, { status: 'in_review' }), 200);
            status(await send('reviewer', 'put', `/requests/${id}`, { status: 'fulfilled', resolution: 'Claiming all records deleted.', retentionBasis: 'No exception was recorded.' }), 400);
            const retained = await send('reviewer', 'put', `/requests/${id}`, { status: 'retained', resolution: 'Clinical information remains stored; this application did not delete it.', retentionBasis: 'Clinical retention must be assessed by the responsible privacy reviewer.' });
            status(retained, 200); assert.equal(retained.body.data.outcome.clinicalRecordsDeleted, false);
            assert.equal((await db.query('SELECT count(*)::int count FROM medical_records WHERE patient_id=$1', [people.patient.id])).rows[0].count, 106);
        });
        await t.test('structured export confirms the current password and includes all owned rows without secrets', async () => {
            for (const key of ['reviewer', 'admin', 'doctor']) status(await send(key, 'post', '/export', { currentPassword: password }), 403);
            status(await send('patient', 'post', '/export', {}), 400);
            await assert.rejects(require('../src/modules/privacy/privacy-rights.service').exportPatient({ user: { id: people.patient.id, roleName: 'patient' }, body: { currentPassword: 'wrong-password' }, headers: {} }), error => {
                assert.equal(error.statusCode, 403, `${error.name}: ${error.message}`); return true;
            });
            status(await send('patient', 'post', '/export', { currentPassword: 'wrong-password' }), 403);
            status(await send('patient', 'post', '/export', { currentPassword: password, patientId: people.other.id }), 400);
            const exported = await send('patient', 'post', '/export', { currentPassword: password }); status(exported, 200);
            const data = exported.body.data; assert.equal(data.patientId, people.patient.id);
            assert.equal(data.medicalRecords.length, 106); assert.equal(data.diagnoses[0].id, diagnosis); assert.equal(data.prescriptions[0].id, prescription);
            assert.deepEqual(data.visitNotes.map(item => item.id), [visitNote]);
            assert.deepEqual(data.medicationOrders.map(item => item.id), [medicationOrder]);
            assert.equal(data.medicationOrders[0].status, 'administered');
            assert.ok(data.medicationOrders[0].administered_at);
            assert.deepEqual(data.radiologyReports.map(item => item.id), [standaloneReport]);
            assert.equal(data.radiologyReports[0].downloadPath, standaloneFile(people.patient.id));
            assert.deepEqual(data.insurancePolicies.map(item => item.id), ['POL-PRIVACY-OWN']);
            assert.deepEqual(data.insuranceClaims.map(item => item.id), ['CLM-PRIVACY-OWN']);
            assert.equal(data.labResults.find(item => item.test_name === 'Own fixture test').downloadPath, localFile); assert.equal(data.imagingReports[0].downloadPath, null);
            assert.equal(data.labResults.find(item => item.test_name === 'Foreign file reference fixture').downloadPath, null);
            assert.deepEqual(data.labResults.find(item => item.test_name === 'Own fixture test').results_data, { observation: { value: 12, unit: 'g/dL' } });
            assert.equal(typeof data.triageSessions[0].created_at, 'string');
            assert.deepEqual(data.triageSessions[0].soap_summary, { subjective: 'Own fixture summary' });
            assert.equal(data.privacyRequests.length, 2); assert.equal(data.privacyRequests.find(item => item.id === ownRequest.id).history.length, 5);
            assert.ok(data.auditHistory.some(item => item.action === 'export_patient_information'));
            assert.ok(data.auditHistory.some(item => item.action === 'shared_patient_list_fixture'));
            assert.ok(!data.auditHistory.some(item => item.action === 'foreign_only_list_fixture'));
            const serialized = JSON.stringify(data);
            for (const forbidden of [password, passwordHash, 'GOVERNMENT_HASH_SECRET', 'VISIT_OTP_SECRET', 'OTHER_PATIENT_RECORD_SECRET', 'OTHER_PATIENT_CONTENT_SECRET', otherRequest.details,
                'UNRELATED_PROVIDER_MARKER', 'AUDIT_TOKEN_SECRET', 'SHARED_LIST_SECRET', 'NESTED_KEY_SECRET', 'TRIAGE_KEY_SECRET', 'EXTERNAL_LINK_SECRET', 'external.example.invalid', people.other.id,
                'OTHER_PRESCRIPTION_SECRET', 'FOREIGN_VISIT_NOTE_SECRET', 'CROSS_PATIENT_PRESCRIPTION_ORDER_SECRET', 'FOREIGN_MEDICATION_ORDER_SECRET', 'FOREIGN_RADIOLOGY_LINK_SECRET', 'OTHER_RADIOLOGY_REPORT_SECRET', 'OTHER_INSURANCE_PERSON_MARKER', 'CROSS_PATIENT_CLAIM_SECRET', 'POL-PRIVACY-OTHER']) assert.ok(!serialized.includes(forbidden), `Export contains forbidden fixture ${forbidden}`);
            assert.ok(exported.headers['content-disposition'].includes('patient-information.json'));
            assert.match(exported.headers['cache-control'], /no-store/);
        });
        await t.test('audit failure rolls back requests and prevents exporting patient data', async () => {
            const before = (await db.query('SELECT count(*)::int count FROM privacy_rights_requests')).rows[0].count;
            const log = audit.logAuditEvent;
            audit.logAuditEvent = async () => { throw new Error('Injected privacy audit failure'); };
            try {
                const created = await send('patient', 'post', '/requests', { type: 'rectification', details: 'Audit failure must roll back this new request.' }); status(created, 500); assert.equal(created.body.data, undefined);
                const exported = await send('patient', 'post', '/export', { currentPassword: password }); status(exported, 500); assert.equal(exported.body.data, undefined);
                const list = await send('patient', 'get', '/requests'); status(list, 500); assert.equal(list.body.data, undefined);
            } finally { audit.logAuditEvent = log; }
            assert.equal((await db.query('SELECT count(*)::int count FROM privacy_rights_requests')).rows[0].count, before);
        });
        await t.test('export rate limits are scoped to the authenticated patient', async () => {
            status(await send('patient', 'post', '/export', { currentPassword: password }), 429);
            const other = await send('other', 'post', '/export', { currentPassword: password }); status(other, 200);
            assert.equal(other.body.data.patientId, people.other.id);
            assert.equal(other.body.data.medicalRecords.length, 1);
        });
        await t.test('a serialization conflict rolls back export evidence and asks for a retry', async () => {
            const before = (await db.query("SELECT count(*)::int count FROM audit_logs WHERE action='export_patient_information'")).rows[0].count;
            const log = audit.logAuditEvent;
            const req = { user: { id: people.patient.id, roleName: 'patient' }, body: { currentPassword: password }, headers: {} };
            audit.logAuditEvent = async (data, client) => { await log(data, client); throw Object.assign(new Error('Injected serialization conflict'), { code: '40001' }); };
            try {
                await assert.rejects(require('../src/modules/privacy/privacy-rights.service').exportPatient(req), error => error.statusCode === 503 && /retry/i.test(error.message));
                assert.notEqual(req.auditEventRecorded, true);
            } finally { audit.logAuditEvent = log; }
            assert.equal((await db.query("SELECT count(*)::int count FROM audit_logs WHERE action='export_patient_information'")).rows[0].count, before);
        });
        await t.test('request event order survives a clock moving backward and is preserved in exports', async () => {
            await db.query("CREATE FUNCTION fixture_reverse_privacy_clock() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.created_at := TIMESTAMPTZ '2040-01-01 00:00:00+00' - (SELECT count(*) FROM privacy_rights_history WHERE request_id=NEW.request_id) * INTERVAL '1 second'; RETURN NEW; END $$");
            await db.query('CREATE TRIGGER fixture_reverse_privacy_clock BEFORE INSERT ON privacy_rights_history FOR EACH ROW EXECUTE FUNCTION fixture_reverse_privacy_clock()');
            try {
                const created = await send('patient', 'post', '/requests', { type: 'objection', details: 'Please record a review with a fixture backward-moving clock.' }); status(created, 201);
                const id = created.body.data.id;
                status(await send('reviewer', 'put', `/requests/${id}`, { status: 'in_review' }), 200);
                const resolved = await send('reviewer', 'put', `/requests/${id}`, { status: 'fulfilled', resolution: 'The fixture objection review has been completed.', retentionBasis: 'This fixture preserves the actual recorded event order.', action: { type: 'restrict', purpose: 'research' } }); status(resolved, 200);
                const history = resolved.body.data.history;
                assert.deepEqual(history.map(item => item.status), ['submitted', 'in_review', 'fulfilled']);
                assert.ok(new Date(history[0].createdAt) > new Date(history[1].createdAt));
                assert.ok(new Date(history[1].createdAt) > new Date(history[2].createdAt));
                assert.ok(BigInt(history[0].sequence) < BigInt(history[1].sequence));
                assert.ok(BigInt(history[1].sequence) < BigInt(history[2].sequence));
                const exported = await require('../src/modules/privacy/privacy-rights.service').exportPatient({ user: { id: people.patient.id, roleName: 'patient' }, body: { currentPassword: password }, headers: {} });
                assert.deepEqual(exported.privacyRequests.find(item => item.id === id).history.map(item => item.sequence), history.map(item => item.sequence));
            } finally {
                await db.query('DROP TRIGGER fixture_reverse_privacy_clock ON privacy_rights_history');
                await db.query('DROP FUNCTION fixture_reverse_privacy_clock()');
            }
        });
    } finally {
        if (db) await db.pool.end();
        await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
        await admin.end();
        require('../src/utils/logger').close();
    }
});
