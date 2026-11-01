const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Client } = require('pg');
const { readMigrations, isSchemaReady } = require('../src/database/migrate');
const { buildBrowserSchemaSql } = require('../scripts/export-browser-schema');
const { DEMO_ROLES, EXTRA_PATIENT_EMAILS, buildDemoSeedSql, seedHostedDemo } = require('../scripts/hosted-demo-seed');

function withDemoMode(callback) {
    const previous = process.env.DEMO_MODE;
    process.env.DEMO_MODE = 'true';
    try { return callback(); } finally {
        if (previous === undefined) delete process.env.DEMO_MODE;
        else process.env.DEMO_MODE = previous;
    }
}

const testHash = '$2b$12$' + 'A'.repeat(53);
const hashes = Object.fromEntries(DEMO_ROLES.map(role => [role, testHash]));

test('browser schema includes each immutable migration body and ledger hash', () => {
    const sql = buildBrowserSchemaSql();
    const migrations = readMigrations();
    assert.equal(migrations.length, 25);
    assert.ok(sql.startsWith('BEGIN;\nSELECT pg_advisory_xact_lock('));
    assert.ok(sql.indexOf('healthcare schema already exists') < sql.indexOf('CREATE SCHEMA healthcare;'));
    assert.match(sql, /SET LOCAL search_path TO healthcare, public, extensions;/);
    assert.match(sql, /REVOKE ALL ON SCHEMA healthcare FROM PUBLIC;/);
    let position = 0;
    for (const migration of migrations) {
        const next = sql.indexOf(migration.sql, position);
        assert.ok(next >= position, `Unmodified ordered SQL for ${migration.id}`);
        position = next + migration.sql.length;
        assert.ok(sql.includes(`VALUES ('${migration.id}', '${migration.hash}', 0);`));
        assert.equal(migration.hash, crypto.createHash('sha256').update(migration.sql).digest('hex'));
    }
    assert.ok(sql.endsWith('COMMIT;\n'));
});

test('synthetic seed requires explicit mode and a validated hash for every role', () => {
    const previous = process.env.DEMO_MODE;
    delete process.env.DEMO_MODE;
    try { assert.throws(() => buildDemoSeedSql(hashes), /DEMO_MODE=true/); }
    finally { if (previous !== undefined) process.env.DEMO_MODE = previous; }
    withDemoMode(() => {
        assert.throws(() => buildDemoSeedSql({ ...hashes, doctor: "'); DROP SCHEMA healthcare CASCADE; --" }), /bcrypt/);
        assert.throws(() => buildDemoSeedSql({ ...hashes, patient: null }), /patient/);
        const sql = buildDemoSeedSql(hashes);
        assert.match(sql, /LOCK TABLE healthcare.users IN EXCLUSIVE MODE/);
        assert.match(sql, /healthcare.users is not empty/);
        assert.match(sql, /exact current migration ledger/);
        for (const role of DEMO_ROLES) assert.ok(sql.includes(`${role}@demo.invalid`));
        assert.equal(DEMO_ROLES.length, 12);
    });
});

test('seed client rolls back on an execution error', async () => {
    const queries = [];
    const sql = withDemoMode(() => buildDemoSeedSql(hashes));
    const previous = process.env.DEMO_MODE;
    process.env.DEMO_MODE = 'true';
    try {
        await assert.rejects(seedHostedDemo({ query: async query => {
            queries.push(query);
            if (query !== 'ROLLBACK') throw new Error('synthetic failure');
        } }, hashes), /synthetic failure/);
        assert.equal(queries.length, 2);
        assert.equal(queries[1], 'ROLLBACK');
        assert.equal(queries[0].split('\n')[0], sql.split('\n')[0]);
    } finally {
        if (previous === undefined) delete process.env.DEMO_MODE;
        else process.env.DEMO_MODE = previous;
    }
});

// Opt in only: hardcoded disposable local service, never the inspection database.
test('fresh private browser install and guarded synthetic seed are atomic', {
    skip: process.env.RUN_BROWSER_DB_TESTS !== 'true'
}, async () => {
    assert.equal(process.env.NODE_ENV,'test');
    assert.equal(process.env.DB_HOST,'127.0.0.1');
    assert.equal(process.env.DB_PORT,'55432');
    assert.match(process.env.DB_NAME,/test/);
    const configuration = { host: '127.0.0.1', port: 55432, user: process.env.DB_USER, password: process.env.DB_PASSWORD, ssl: false };
    const databaseName = `healthcare_browser_test_${process.pid}_${crypto.randomBytes(4).toString('hex')}`;
    assert.match(databaseName, /^healthcare_browser_test_\d+_[a-f0-9]{8}$/);
    const owner = new Client({ ...configuration, database: process.env.DB_NAME });
    let client;
    let created = false;
    const previousMode = process.env.DEMO_MODE;
    try {
        await owner.connect();
        assert.equal((await owner.query('SELECT 1 FROM pg_database WHERE datname=$1', [databaseName])).rowCount, 0);
        await owner.query(`CREATE DATABASE "${databaseName}"`);
        created = true;
        client = new Client({ ...configuration, database: databaseName });
        await client.connect();
        // Match hosted installations where extension functions live in extensions.
        await client.query('CREATE SCHEMA extensions; CREATE EXTENSION "uuid-ossp" WITH SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;');
        const migrations = readMigrations();
        await assert.rejects(client.query(buildBrowserSchemaSql([...migrations, {
            id: '999_test_failure', hash: 'test-only', sql: 'SELECT nonexistent_browser_install_function();'
        }])), /nonexistent_browser_install_function/);
        await client.query('ROLLBACK');
        assert.equal((await client.query("SELECT to_regnamespace('healthcare') AS schema")).rows[0].schema, null);

        const schemaSql = buildBrowserSchemaSql();
        await client.query(schemaSql);
        await client.query('SET search_path TO healthcare,public,extensions');
        assert.equal(await isSchemaReady(client), true);
        assert.equal((await client.query('SELECT count(*)::int AS count FROM healthcare._migrations')).rows[0].count, migrations.length);
        assert.equal((await client.query("SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public'")).rows[0].count, 0);
        assert.equal((await client.query('SELECT count(*)::int AS count FROM healthcare.users')).rows[0].count, 0);
        await assert.rejects(client.query(schemaSql), /healthcare schema already exists/);
        await client.query('ROLLBACK');
        assert.equal(await isSchemaReady(client), true);

        process.env.DEMO_MODE = 'true';
        const seedSql = buildDemoSeedSql(hashes);
        await assert.rejects(client.query(seedSql.replace('COMMIT;', 'SELECT nonexistent_demo_seed_function();\nCOMMIT;')), /nonexistent_demo_seed_function/);
        await client.query('ROLLBACK');
        assert.equal((await client.query('SELECT count(*)::int AS count FROM healthcare.users')).rows[0].count, 0);
        assert.equal((await client.query('SELECT count(*)::int AS count FROM healthcare.organizations')).rows[0].count, 0);

        await client.query("UPDATE healthcare._migrations SET file_hash='drift' WHERE id=$1", [migrations[0].id]);
        await assert.rejects(seedHostedDemo(client, hashes), /exact current migration ledger/);
        assert.equal((await client.query('SELECT count(*)::int AS count FROM healthcare.users')).rows[0].count, 0);
        await client.query('UPDATE healthcare._migrations SET file_hash=$1 WHERE id=$2', [migrations[0].hash, migrations[0].id]);

        await seedHostedDemo(client, hashes);
        const users = (await client.query(`SELECT u.email,u.status,u.is_verified,u.verification_status,r.name AS role
            FROM healthcare.users u JOIN healthcare.roles r ON u.role_id=r.id ORDER BY r.name`)).rows;
        assert.deepEqual([...new Set(users.map(user => user.role))], [...DEMO_ROLES].sort());
        assert.equal(users.length, 16);
        for (const user of users) {
            assert.ok(user.email === `${user.role}@demo.invalid` || EXTRA_PATIENT_EMAILS.includes(user.email));
            assert.equal(user.status, 'active');
            assert.equal(user.is_verified, true);
            assert.equal(user.verification_status, 'verified');
        }
        for (const [table, count] of [['organizations', 1], ['staff_org_mapping', 8], ['doctor_profiles', 1],
            ['nurse_profiles', 1], ['patient_profiles', 5], ['visits', 1], ['visit_staff_assignments', 2], ['consents', 11], ['medical_records', 1]]) {
            assert.equal((await client.query(`SELECT count(*)::int AS count FROM healthcare.${table}`)).rows[0].count, count, table);
        }
        await assert.rejects(seedHostedDemo(client, hashes), /healthcare.users is not empty/);
        assert.equal((await client.query('SELECT count(*)::int AS count FROM healthcare.users')).rows[0].count, 16);
        // Trigger functions must find digest() under the deployed extension layout.
        await client.query("INSERT INTO healthcare.audit_logs(action) VALUES('synthetic_browser_test')");
        const audit = (await client.query('SELECT current_hash,hash_version FROM healthcare.audit_logs')).rows[0];
        assert.match(audit.current_hash, /^[a-f0-9]{64}$/);
        assert.equal(audit.hash_version, 1);
    } finally {
        if (previousMode === undefined) delete process.env.DEMO_MODE;
        else process.env.DEMO_MODE = previousMode;
        if (client) await client.end();
        if (created) await owner.query(`DROP DATABASE "${databaseName}"`);
        await owner.end();
    }
});
