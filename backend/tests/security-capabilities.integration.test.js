const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withApplication } = require('./helpers/application-fixture');

test('pseudonymous research and evidence-based dashboard enforce their data boundaries',
    { skip: process.env.RUN_DB_TESTS !== 'true', timeout: 90000 }, async t => withApplication('security_capabilities', async ({ db, people, organizations, visit, call }) => {
        // Exercise detection explicitly below instead of scheduling random
        // background checks that can race fixture database teardown.
        t.mock.method(Math, 'random', () => 0.99);
        const { researchQueries, cohortParameters } = require('../src/modules/research/research-cohort');
        const { generatePseudonym } = require('../src/services/anonymization.service');
        const patients = [];
        const grants = [];
        const recordIds = [];
        for (let i = 0; i < 5; i++) {
            const patient = i === 0 ? people.patient.id : (await db.query(`INSERT INTO users(email,role_id,status,is_verified)
                VALUES($1,(SELECT id FROM roles WHERE name='patient'),'active',true) RETURNING id`, [`research-${i}@example.invalid`])).rows[0].id;
            patients.push(patient);
            if (i) await db.query('INSERT INTO patient_profiles(user_id,unique_health_id) VALUES($1,$2)', [patient, `PRIVATE-${i}`]);
            await db.query("UPDATE patient_profiles SET date_of_birth='1990-01-01',gender='female' WHERE user_id=$1", [patient]);
            grants.push((await db.query(`INSERT INTO consents(patient_id,recipient_user_id,data_category,purpose,access_level,status,start_time)
                VALUES($1,$2,'all','clinical_research','read','active',NOW()-INTERVAL '1 minute') RETURNING id`, [patient, people.researcher.id])).rows[0].id);
            const record = (await db.query(`INSERT INTO medical_records(patient_id,type,title,created_by)
                VALUES($1,'diagnosis','PRIVATE narrative',$2) RETURNING id`, [patient, people.doctor.id])).rows[0].id;
            recordIds.push(record);
            await db.query("INSERT INTO diagnoses(record_id,icd_code,description,diagnosed_by) VALUES($1,'FIXTURE','PRIVATE narrative',$2)", [record, people.doctor.id]);
            await db.query("INSERT INTO prescriptions(record_id,medication,dosage,frequency,prescribed_by) VALUES($1,'Fixture medicine','1','daily',$2)", [record, people.doctor.id]);
        }
        await t.test('dashboard distinguishes pending reviews, investigations and resolved cases in one snapshot', async () => {
            const empty = (await call('officer', 'GET', '/compliance/dashboard')).data;
            assert.equal(empty.securityStatus, 'clear');
            assert.equal(empty.pendingReviews, 0);
            const events = [];
            for (const [status, severity] of [['Open', 'critical'], ['Investigating', 'high'], ['Resolved', 'critical']]) {
                events.push((await db.query("INSERT INTO security_events(event_type,severity,status,description) VALUES('suspicious_activity',$1,$2,'Fixture incident') RETURNING id", [severity, status])).rows[0].id);
            }
            const data = (await call('officer', 'GET', '/compliance/dashboard')).data;
            assert.equal(data.securityStatus, 'critical');
            assert.equal(data.openIncidents, 2);
            assert.equal(data.pendingReviews, 1);
            assert.equal(data.investigatingIncidents, 1);
            assert.equal(data.criticalIncidents, 1);
            assert.equal(data.highIncidents, 1);
            assert.ok(!Number.isNaN(Date.parse(data.generatedAt)));
            assert.ok(data.recentIncidents.every(event => Date.parse(event.date) > Date.now()-60000));
            assert.deepEqual(new Set(data.recentIncidents.map(row => row.id)), new Set(events.slice(0, 2)));
            await call('officer', 'PUT', `/compliance/incidents/${events[0]}`, { status: 'Investigating' });
            assert.equal((await call('officer', 'GET', '/compliance/dashboard')).data.pendingReviews, 0);
            await db.query("UPDATE security_events SET status='Resolved' WHERE id=ANY($1::uuid[])", [events]);
            await db.query(`INSERT INTO emergency_access_grants(user_id,patient_id,visit_id,organization_id,justification,expires_at)
                VALUES($1,$2,$3,$4,'Fixture emergency justification',NOW()+INTERVAL '1 minute')`, [people.doctor.id, people.patient.id, visit, organizations[0]]);
            const override = (await call('officer', 'GET', '/compliance/dashboard')).data;
            assert.equal(override.activeOverrides, 1); assert.equal(override.securityStatus, 'attention');
        });
        await t.test('all analytics process keyed pseudonymous observations and return aggregates only', async () => {
            const prefix = researchQueries.demographics.slice(0, researchQueries.demographics.lastIndexOf('SELECT range, gender,'));
            const observations = (await db.query(`${prefix} SELECT * FROM cohort`, cohortParameters(people.researcher.id))).rows;
            assert.equal(observations.length, 5);
            assert.deepEqual(new Set(observations.map(row => row.pseudonym_id)), new Set(patients.map(id => generatePseudonym(id, `research:${people.researcher.id}`))));
            assert.ok(observations.every(row => Object.keys(row).sort().join(',') === 'gender,pseudonym_id,range'));
            const otherScope = cohortParameters(people.otherDoctor.id);
            const otherToken = (await db.query("SELECT 'psn_v1_'||encode(hmac(convert_to($1::text,'UTF8'),$2::bytea,'sha256'),'hex') AS token", [patients[0], otherScope[1]])).rows[0].token;
            assert.ok(!observations.some(row => row.pseudonym_id === otherToken));
            assert.equal((await call('researcher', 'GET', '/research/stats')).data.anonymizedPatients, 5);
            assert.deepEqual((await call('researcher', 'GET', '/research/symptoms')).data, [{ name: 'FIXTURE', count: 5, severityAvg: null }]);
            assert.deepEqual((await call('researcher', 'GET', '/research/treatments')).data, [{ name: 'Fixture medicine', usageCount: 5, successRate: null }]);
            for (const endpoint of ['stats', 'symptoms', 'treatments', 'demographics']) {
                const result = JSON.stringify(await call('researcher', 'GET', `/research/${endpoint}`));
                for (const secret of [...patients, ...observations.map(row => row.pseudonym_id), 'PRIVATE', 'example.invalid']) assert.ok(!result.includes(secret));
            }
        });
        await t.test('duplicate clinical rows cannot manufacture the distinct-participant threshold', async () => {
            await db.query("INSERT INTO diagnoses(record_id,icd_code,description,diagnosed_by) SELECT $1,'RARE','Fixture',$2 FROM generate_series(1,6)", [recordIds[0], people.doctor.id]);
            assert.ok(!(await call('researcher', 'GET', '/research/symptoms')).data.some(row => row.name === 'RARE'));
        });
        await t.test('a restricted database reader can run pseudonymous analytics without schema-owner privileges', async () => {
            const role = `research_reader_${process.pid}`;
            assert.match(role, /^research_reader_\d+$/);
            const schema = process.env.SECURITY_TEST_SCHEMA || 'public';
            assert.ok(['public', 'healthcare'].includes(schema));
            await db.query(`CREATE ROLE ${role} NOLOGIN`);
            try {
                await db.query(`GRANT USAGE ON SCHEMA ${schema} TO ${role}`);
                if (schema === 'healthcare') await db.query(`GRANT USAGE ON SCHEMA extensions TO ${role}`);
                await db.query(`GRANT SELECT ON patient_profiles,consents,patient_processing_controls,medical_records,diagnoses,prescriptions TO ${role}`);
                await db.transaction(async client => {
                    await client.query(`SET LOCAL ROLE ${role}`);
                    for (const sql of Object.values(researchQueries)) await client.query(sql, cohortParameters(people.researcher.id));
                    assert.equal((await client.query(researchQueries.stats, cohortParameters(people.researcher.id))).rows[0].patients, 5);
                });
            } finally {
                await db.query(`DROP OWNED BY ${role}`);
                await db.query(`DROP ROLE ${role}`);
            }
        });
        await t.test('revocation, future/expired consent and research restrictions immediately suppress every endpoint', async () => {
            const checkSuppressed = async () => {
                assert.equal((await call('researcher', 'GET', '/research/stats')).data.suppressed, true);
                assert.deepEqual((await call('researcher', 'GET', '/research/symptoms')).data, []);
                assert.deepEqual((await call('researcher', 'GET', '/research/treatments')).data, []);
                assert.deepEqual((await call('researcher', 'GET', '/research/demographics')).data, { ageGroups: [], gender: [] });
            };
            for (const change of ["status='revoked'", "start_time=NOW()+INTERVAL '1 day'", "end_time=NOW()-INTERVAL '1 second'"]) {
                await db.query(`UPDATE consents SET ${change} WHERE id=$1`, [grants[4]]);
                await checkSuppressed();
                await db.query("UPDATE consents SET status='active',start_time=NOW()-INTERVAL '1 minute',end_time=NULL WHERE id=$1", [grants[4]]);
            }
            const request = (await call('patient', 'POST', '/privacy/requests', { type: 'objection', details: 'Fixture request to stop research processing.' }, 201)).data;
            const control = (await db.query("INSERT INTO patient_processing_controls(patient_id,purpose,request_id,created_by) VALUES($1,'research',$2,$3) RETURNING id", [patients[4], request.id, people.officer.id])).rows[0];
            await checkSuppressed();
            await db.query('UPDATE patient_processing_controls SET released_at=NOW(),released_by=$2 WHERE id=$1', [control.id, people.officer.id]);
            assert.equal((await call('researcher', 'GET', '/research/stats')).data.anonymizedPatients, 5);
        });
        await t.test('role checks prevent clinical users and researchers from reading the security dashboard', async () => {
            for (const actor of ['patient', 'doctor', 'researcher']) await call(actor, 'GET', '/compliance/dashboard', undefined, 403);
            await call('patient', 'GET', '/research/stats', undefined, 403);
        });
        await t.test('successful polling remains audited without generating after-hours alerts, while denials still count', async () => {
            for (let i = 0; i < 8; i++) await call('officer', 'GET', '/compliance/dashboard');
            const { detectSuspiciousPatterns } = require('../src/services/violation.service');
            const afterHours = new Date(2026, 10, 17, 2);
            const result = await detectSuspiciousPatterns(people.officer.id, afterHours);
            assert.equal(result.hasSuspiciousPatterns, false);
            const events = await db.query("SELECT COUNT(*)::int count FROM audit_logs WHERE user_id=$1 AND action='view_security_dashboard' AND status_code=200", [people.officer.id]);
            assert.ok(events.rows[0].count >= 8);
            const { logAuditEvent } = require('../src/services/audit.service');
            for (let i = 0; i < 6; i++) await logAuditEvent({ userId: people.officer.id, action: 'view_security_dashboard',
                entityType: 'compliance', requestMethod: 'GET', statusCode: 403 });
            const denied = await detectSuspiciousPatterns(people.officer.id, afterHours);
            assert.ok(denied.hasSuspiciousPatterns);
            assert.ok(denied.patterns.some(pattern => pattern.type === 'after_hours_access'));
        });
    }, { schema: process.env.SECURITY_TEST_SCHEMA || 'public' }));
