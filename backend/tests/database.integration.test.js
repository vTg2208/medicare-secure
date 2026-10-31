const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('pg');

// This suite only runs against an explicitly selected disposable local database.
const enabled = process.env.RUN_DB_TESTS === 'true';

test('administrator bootstrap rejects missing, weak and truncated credentials', () => {
    const { validateAdmin } = require('../scripts/bootstrap-admin');
    assert.throws(() => validateAdmin({}), /ADMIN_EMAIL/);
    assert.throws(() => validateAdmin({ email: 'admin@example.invalid', password: 'short' }), /ADMIN_PASSWORD/);
    assert.throws(() => validateAdmin({ email: 'admin@example.invalid', password: '😄'.repeat(20) }), /72 UTF-8/);
    assert.throws(() => validateAdmin({ email: 'admin@example.invalid', password: 'long-enough-password', role: 'doctor' }), /ADMIN_ROLE/);
});

test('migration failures roll back DDL and metadata; applied migrations reject drift', { skip: !enabled }, async () => {
    assert.equal(process.env.NODE_ENV, 'test');
    assert.equal(process.env.DB_PORT, '55432');
    assert.match(process.env.DB_NAME || '', /test/i);
    const { migrate, readMigrations, isSchemaReady } = require('../src/database/migrate');
    const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME,
        user: process.env.DB_USER, password: process.env.DB_PASSWORD, ssl: false });
    await client.connect();
    try {
        const failureId = `test_failure_${process.pid}`;
        await assert.rejects(migrate(client, { log: () => {}, migrations: [{ id: failureId, hash: 'test', sql: `CREATE TABLE ${failureId}(id INTEGER); SELECT nonexistent_migration_function();` }] }), /nonexistent_migration_function/);
        assert.equal((await client.query('SELECT to_regclass($1) AS name', [failureId])).rows[0].name, null);
        assert.equal((await client.query('SELECT id FROM _migrations WHERE id=$1', [failureId])).rowCount, 0);
        const migration = readMigrations()[0];
        await assert.rejects(migrate(client, { log: () => {}, migrations: [{ ...migration, hash: 'changed' }] }), /has changed/);
        assert.equal((await migrate(client, { log: () => {} })).applied, 0);
        assert.equal((await migrate(client, { log: () => {} })).applied, 0);
        assert.equal(await isSchemaReady(client), true);
    } finally { await client.end(); }
});
test('fresh provisioning supports patient, visit and clinical workflows without demo data', { skip: !enabled }, async () => {
    assert.equal(process.env.NODE_ENV, 'test');
    assert.ok(['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST));
    assert.match(process.env.DB_NAME || '', /test/i);
    assert.notEqual(process.env.DB_PORT, '5432');
    const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME,
        user: process.env.DB_USER, password: process.env.DB_PASSWORD, ssl: false });
    await client.connect();
    try {
        const required = ['roles', 'users', 'patient_profiles', 'visits', 'consents', 'nurse_profiles', 'staff_invitations',
            'insurance_policies', 'insurance_claims', 'triage_sessions', 'security_events', 'passkey_credentials',
            'care_team_assignments', 'bed_allocations', 'lab_orders', 'imaging_orders', 'medication_orders', 'notifications', 'pharmacy_inventory', 'workflow_logs', 'one_time_tokens'];
        const tables = await client.query('SELECT tablename FROM pg_tables WHERE schemaname = current_schema()');
        for (const table of required) assert.ok(tables.rows.some(row => row.tablename === table), `Missing ${table}`);
        await client.query('BEGIN');
        const patient = (await client.query("INSERT INTO users (email, first_name, role_id) VALUES ('schema-smoke-patient@example.invalid', 'Patient', (SELECT id FROM roles WHERE name='patient')) RETURNING id")).rows[0].id;
        const doctor = (await client.query("INSERT INTO users (email, first_name, role_id) VALUES ('schema-smoke-doctor@example.invalid', 'Doctor', (SELECT id FROM roles WHERE name='doctor')) RETURNING id")).rows[0].id;
        await client.query("INSERT INTO patient_profiles(user_id, unique_health_id) VALUES($1, 'SMOKE-ONLY')", [patient]);
        const org = (await client.query("INSERT INTO organizations(name,type,license_number,hospital_code) VALUES('Smoke hospital','hospital','SMOKE-LICENSE','SMOKE1') RETURNING id")).rows[0].id;
        const visit = (await client.query("INSERT INTO visits(patient_id,organization_id,visit_code,type,priority,chief_complaint,assigned_doctor_id,status) VALUES($1,$2,'SMOKE-VISIT','walk_in','normal','smoke test',$3,'pending') RETURNING id", [patient, org, doctor])).rows[0].id;
        await client.query("INSERT INTO visit_staff_assignments(visit_id,staff_user_id,role) VALUES($1,$2,'doctor')", [visit, doctor]);
        await client.query("INSERT INTO care_team_assignments(visit_id,staff_user_id,role,assigned_by) VALUES($1,$2,'primary',$2)", [visit, doctor]);
        await client.query("INSERT INTO bed_allocations(visit_id,ward,room,bed,allocated_by) VALUES($1,'A','1','1',$2)", [visit, doctor]);
        await client.query("INSERT INTO lab_orders(visit_id,ordered_by,test_name,test_category) VALUES($1,$2,'CBC','hematology')", [visit, doctor]);
        await client.query("INSERT INTO imaging_orders(visit_id,ordered_by,imaging_type,body_part) VALUES($1,$2,'X-Ray','chest')", [visit, doctor]);
        await client.query("INSERT INTO medication_orders(visit_id,medication,dosage,route,frequency,ordered_by) VALUES($1,'smoke-only','1','oral','daily',$2)", [visit, doctor]);
        await client.query("INSERT INTO notifications(user_id,type,title,message,channels) VALUES($1,'visit','Smoke','Smoke','[\"in_app\"]')", [doctor]);
        await client.query("INSERT INTO workflow_logs(visit_id,user_id,action) VALUES($1,$2,'smoke')", [visit,doctor]);
        await client.query("INSERT INTO one_time_tokens(user_id,created_by,token_hash,scope,expires_at) VALUES($1,$2,'smoke-token-hash','{}',NOW()+INTERVAL '1 minute')", [patient,doctor]);
        await client.query("INSERT INTO triage_sessions(patient_id,status) VALUES($1,'in_progress')", [patient]);
        await client.query("INSERT INTO consents(patient_id,recipient_organization_id,data_category,purpose,access_level) VALUES($1,$2,'ALL_RECORDS','TREATMENT','full')", [patient, org]);
        const record = (await client.query("INSERT INTO medical_records(patient_id,visit_id,type,title,created_by) VALUES($1,$2,'consultation','Smoke',$3) RETURNING id", [patient, visit, doctor])).rows[0].id;
        await client.query('SAVEPOINT immutable_check');
        await assert.rejects(client.query("UPDATE medical_records SET title='Changed' WHERE id=$1", [record]), /immutable/i);
        await client.query('ROLLBACK TO SAVEPOINT immutable_check');
        await client.query("UPDATE visits SET status='completed' WHERE id=$1", [visit]);
        const closed = (await client.query('SELECT closed_at,status_history FROM visits WHERE id=$1', [visit])).rows[0];
        assert.ok(closed.closed_at);
        assert.equal(closed.status_history.at(-1).to, 'completed');
        assert.equal((await client.query('SELECT access_level FROM visit_staff_assignments WHERE visit_id=$1', [visit])).rows[0].access_level, 'read_only');
        assert.equal((await client.query('SELECT p.unique_health_id FROM visits v JOIN users u ON v.patient_id=u.id JOIN patient_profiles p ON u.id=p.user_id WHERE v.id=$1', [visit])).rows[0].unique_health_id, 'SMOKE-ONLY');
    } finally {
        await client.query('ROLLBACK');
        await client.end();
    }
});
