const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { buildBrowserUpgradeSql, readOrderedMigrations, main, OUTPUT_DIRECTORY, LOCK_KEY } = require('../scripts/export-browser-upgrade');

const migrations = readOrderedMigrations();
const base = migrations.slice(0, 17);
const hash = sql => crypto.createHash('sha256').update(sql).digest('hex');

test('incremental export requires an explicit known contiguous prefix and unchanged SQL hashes', () => {
    assert.throws(() => buildBrowserUpgradeSql(), /explicit/);
    assert.throws(() => buildBrowserUpgradeSql({ from: '999' }), /unknown/);
    assert.throws(() => buildBrowserUpgradeSql({ from: '017', migrations: migrations.slice(1) }), /contiguous/);
    assert.throws(() => buildBrowserUpgradeSql({ from: '017', migrations: migrations.map((item, index) => index === 0 ? { ...item, sql: `${item.sql}\n-- drift` } : item) }), /exact SQL hashes/);
    const sql = buildBrowserUpgradeSql({ from: '017' });
    for (const migration of base) assert.ok(!sql.includes(migration.sql), `Historical body must not be emitted: ${migration.id}`);
    for (const migration of migrations.slice(17)) assert.ok(sql.includes(migration.sql), `Pending body is unchanged: ${migration.id}`);
});

test('CLI creates SQL exclusively within ignored .local and refuses symlink/output escapes', async () => {
    const suffix = crypto.randomBytes(8).toString('hex');
    const output = path.join(OUTPUT_DIRECTORY, `browser-upgrade-test-${suffix}.sql`);
    const link = path.join(OUTPUT_DIRECTORY, `browser-upgrade-link-${suffix}`);
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'shms-upgrade-output-test-'));
    try {
        assert.equal(main(['--from', '017', '--output', output]), output);
        const bytes = await fs.readFile(output);
        assert.throws(() => main(['--from', '017', '--output', output]), { code: 'EEXIST' });
        assert.deepEqual(await fs.readFile(output), bytes);
        assert.throws(() => main(['--from', '017', '--output', path.join(outside, 'escaped.sql')]), /inside the ignored/);
        await fs.symlink(outside, link, 'dir');
        assert.throws(() => main(['--from', '017', '--output', path.join(link, 'escaped.sql')]), /Unsafe/);
        assert.deepEqual(await fs.readdir(outside), []);
    } finally {
        assert.equal(path.dirname(output), OUTPUT_DIRECTORY); assert.equal(path.dirname(link), OUTPUT_DIRECTORY);
        await fs.unlink(output).catch(error => { if (error.code !== 'ENOENT') throw error; });
        await fs.unlink(link).catch(error => { if (error.code !== 'ENOENT') throw error; });
        assert.equal(path.dirname(outside), path.resolve(os.tmpdir()));
        await fs.rm(outside, { recursive: true, force: true });
    }
});

const enabled = process.env.RUN_DB_TESTS === 'true' || process.env.RUN_BROWSER_DB_TESTS === 'true';
async function disposable(run) {
    assert.equal(process.env.NODE_ENV, 'test');
    assert.ok(['127.0.0.1', 'localhost', '::1'].includes(process.env.DB_HOST));
    const { Client } = require('pg');
    const config = { host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME,
        user: process.env.DB_USER, password: process.env.DB_PASSWORD, ssl: false };
    const database = `healthcare_browser_upgrade_test_${process.pid}_${crypto.randomBytes(4).toString('hex')}`;
    const admin = new Client(config); await admin.connect();
    let client;
    try {
        await admin.query(`CREATE DATABASE "${database}" TEMPLATE template0`);
        client = new Client({ ...config, database }); await client.connect();
        await client.query(`CREATE SCHEMA healthcare; CREATE SCHEMA extensions;
            CREATE EXTENSION "uuid-ossp" WITH SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
            SET search_path TO healthcare,public,extensions,pg_temp;
            CREATE TABLE healthcare._migrations(id VARCHAR(100) PRIMARY KEY,file_hash VARCHAR(64) NOT NULL,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),applied_by TEXT NOT NULL DEFAULT CURRENT_USER,execution_time_ms INTEGER NOT NULL)`);
        await client.query('BEGIN');
        for (const migration of base) {
            await client.query(migration.sql);
            await client.query('INSERT INTO healthcare._migrations(id,file_hash,execution_time_ms) VALUES($1,$2,0)', [migration.id, migration.hash]);
        }
        await client.query('CREATE TABLE healthcare.upgrade_sentinel(id integer PRIMARY KEY,value text); INSERT INTO healthcare.upgrade_sentinel VALUES(1,\'Fixture existing data\'); COMMIT');
        return await run(client);
    } finally {
        if (client) await client.end().catch(() => {});
        assert.match(database, /^healthcare_browser_upgrade_test_[a-z0-9_]+$/);
        await admin.query(`DROP DATABASE IF EXISTS "${database}"`).catch(() => {});
        await admin.end();
    }
}

async function snapshot(client) {
    return {
        ledger: (await client.query('SELECT * FROM healthcare._migrations ORDER BY id')).rows,
        objects: (await client.query("SELECT c.relname,c.relkind,c.relacl::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='healthcare' ORDER BY c.relname")).rows,
        functions: (await client.query("SELECT p.proname,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='healthcare' AND p.prokind IN ('f','p') ORDER BY p.proname,p.oid")).rows,
        constraint: (await client.query("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='healthcare.security_events'::regclass AND conname='security_events_event_type_check'")).rows,
        data: (await client.query('SELECT * FROM healthcare.upgrade_sentinel')).rows,
    };
}

test('actual private-schema 017 to 025 upgrade preserves data and exact target replay is a no-op', { skip: !enabled, timeout: 120000 }, async () => disposable(async client => {
    assert.equal(migrations.length, 25);
    const sql = buildBrowserUpgradeSql({ from: '017' });
    await client.query(sql);
    assert.deepEqual((await client.query('SELECT id,file_hash FROM healthcare._migrations ORDER BY id')).rows,
        migrations.map(item => ({ id: item.id, file_hash: item.hash })));
    assert.ok((await client.query("SELECT to_regclass('healthcare.privacy_breaches') AS name")).rows[0].name);
    assert.ok((await client.query("SELECT to_regclass('healthcare.audit_chain_head') AS name")).rows[0].name);
    assert.deepEqual((await client.query('SELECT * FROM healthcare.upgrade_sentinel')).rows, [{ id: 1, value: 'Fixture existing data' }]);
    const before = await snapshot(client);
    await client.query(sql);
    assert.deepEqual(await snapshot(client), before);
    await client.query(buildBrowserUpgradeSql({ from: '025' }));
    assert.deepEqual(await snapshot(client), before);
}));

test('unknown, drifted, missing and partial/wrong ledgers reject before any schema or data mutation', { skip: !enabled, timeout: 120000 }, async t => disposable(async client => {
    const sql = buildBrowserUpgradeSql({ from: '017' });
    const cases = [
        ['hash drift', "UPDATE healthcare._migrations SET file_hash=repeat('0',64) WHERE id='001_core'", /hash drift/],
        ['unknown ID', "INSERT INTO healthcare._migrations(id,file_hash,execution_time_ms) VALUES('999_unknown',repeat('f',64),0)", /unknown IDs/],
        ['missing migration', "DELETE FROM healthcare._migrations WHERE id='007_insurance'", /partial or wrong prefix/],
        ['wrong known prefix', "DELETE FROM healthcare._migrations WHERE id>'010_immutable_records'", /partial or wrong prefix/],
        ['partial pending prefix', 'INSERT INTO healthcare._migrations(id,file_hash,execution_time_ms) VALUES($1,$2,0)', /partial or wrong prefix/, [migrations[17].id, migrations[17].hash]],
        ['non-prefix with expected row count', "DELETE FROM healthcare._migrations WHERE id='017_bed_tenant_scope'; INSERT INTO healthcare._migrations(id,file_hash,execution_time_ms) VALUES($1,$2,0)", /missing or non-prefix/, [migrations[17].id, migrations[17].hash]],
    ];
    for (const [name, mutation, expected, parameters] of cases) await t.test(name, async () => {
        await client.query('TRUNCATE healthcare._migrations');
        for (const migration of base) await client.query('INSERT INTO healthcare._migrations(id,file_hash,execution_time_ms) VALUES($1,$2,0)', [migration.id, migration.hash]);
        if (name === 'non-prefix with expected row count') {
            await client.query("DELETE FROM healthcare._migrations WHERE id='017_bed_tenant_scope'");
            await client.query('INSERT INTO healthcare._migrations(id,file_hash,execution_time_ms) VALUES($1,$2,0)', parameters);
        } else await client.query(mutation, parameters);
        const before = await snapshot(client);
        await assert.rejects(client.query(sql), expected);
        await client.query('ROLLBACK');
        assert.deepEqual(await snapshot(client), before);
    });
}));

test('a late pending migration failure rolls the entire incremental batch and ledger back to 017', { skip: !enabled, timeout: 120000 }, async () => disposable(async client => {
    const sql = 'CREATE TABLE healthcare.upgrade_failure_probe(id integer); SELECT nonexistent_incremental_upgrade_fixture();';
    const before = await snapshot(client);
    await assert.rejects(client.query(buildBrowserUpgradeSql({ from: '017', migrations: [...migrations, { id: '026_fixture_failure', sql, hash: hash(sql) }] })), /nonexistent_incremental_upgrade_fixture/);
    await client.query('ROLLBACK');
    assert.deepEqual(await snapshot(client), before);
    assert.equal((await client.query("SELECT to_regclass('healthcare.upgrade_failure_probe') AS name")).rows[0].name, null);
}));

test('a public shadow ledger cannot substitute for the required private ledger', { skip: !enabled, timeout: 120000 }, async () => disposable(async client => {
    await client.query('CREATE TABLE public._migrations (LIKE healthcare._migrations INCLUDING ALL); INSERT INTO public._migrations SELECT * FROM healthcare._migrations; ALTER TABLE healthcare._migrations RENAME TO _migrations_held');
    const before = (await client.query('SELECT * FROM public._migrations ORDER BY id')).rows;
    await assert.rejects(client.query(buildBrowserUpgradeSql({ from: '017' })), /private healthcare migration ledger/);
    await client.query('ROLLBACK');
    assert.deepEqual((await client.query('SELECT * FROM public._migrations ORDER BY id')).rows, before);
    assert.equal((await client.query("SELECT to_regclass('healthcare.privacy_breaches') AS name")).rows[0].name, null);
}));

test('incremental upgrade waits for the existing migrator advisory lock before applying changes', { skip: !enabled, timeout: 120000 }, async () => disposable(async client => {
    const { Client } = require('pg');
    const database = (await client.query('SELECT current_database() AS name')).rows[0].name;
    const peer = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database,
        user: process.env.DB_USER, password: process.env.DB_PASSWORD, ssl: false });
    await peer.connect();
    const pid = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    let upgrade; let released = false;
    try {
        await peer.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
        upgrade = client.query(buildBrowserUpgradeSql({ from: '017' }));
        let waiting = false;
        for (let attempt = 0; attempt < 80; attempt++) {
            waiting = (await peer.query("SELECT 1 FROM pg_locks WHERE pid=$1 AND locktype='advisory' AND NOT granted", [pid])).rows.length > 0;
            if (waiting) break;
            await new Promise(resolve => setTimeout(resolve, 25));
        }
        assert.equal(waiting, true, 'Upgrade must wait for the migration advisory lock');
        assert.equal((await peer.query('SELECT count(*)::int AS count FROM healthcare._migrations')).rows[0].count, 17);
        assert.equal((await peer.query("SELECT to_regclass('healthcare.privacy_breaches') AS name")).rows[0].name, null);
        await peer.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]); released = true;
        await upgrade;
        assert.equal((await client.query('SELECT count(*)::int AS count FROM healthcare._migrations')).rows[0].count, 25);
    } finally {
        if (!released) await peer.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => {});
        if (upgrade) await upgrade.catch(() => {});
        await client.query('ROLLBACK').catch(() => {});
        await peer.end();
    }
}));
