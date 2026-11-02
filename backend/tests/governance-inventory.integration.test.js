const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('pg');
const { migrate } = require('../src/database/migrate');
const inventory = require('../../docs/compliance/data-inventory.json');
test('the governance inventory covers the actual migrated public and private catalogs and rejects drift', { skip: process.env.RUN_DB_TESTS !== 'true', timeout: 60000 }, async t => {
    assert.equal(process.env.NODE_ENV, 'test');
    assert.equal(process.env.DB_HOST, '127.0.0.1');
    assert.equal(String(process.env.DB_PORT), '55432');
    const connection = { host: '127.0.0.1', port: 55432, user: process.env.DB_USER, password: process.env.DB_PASSWORD, ssl: false };
    const admin = new Client({ ...connection, database: process.env.DB_NAME }); await admin.connect();
    try {
        for (const schema of ['public','healthcare']) await t.test(`${schema}: metadata-only validation detects unknown tables and columns`, async () => {
            const name = `healthcare_inventory_${schema}_${process.pid}`;
            assert.match(name, /^healthcare_inventory_(public|healthcare)_\d+$/);
            await admin.query(`CREATE DATABASE "${name}"`);
            const client = new Client({ ...connection, database: name }); await client.connect();
            try {
                if (schema === 'healthcare') await client.query('CREATE SCHEMA healthcare; CREATE SCHEMA extensions; CREATE EXTENSION "uuid-ossp" SCHEMA extensions; CREATE EXTENSION pgcrypto SCHEMA extensions; CREATE EXTENSION btree_gist SCHEMA healthcare; SET search_path=healthcare,extensions,public');
                await migrate(client, { log() {} });
                const { verifyCatalog } = require('../scripts/governance-evidence');
                await client.query('BEGIN READ ONLY');
                assert.deepEqual(await verifyCatalog(client, inventory, schema), { tables: inventory.tables.length, columns: inventory.tables.reduce((sum, table) => sum + table.columns.length, 0) });
                await client.query('COMMIT');
                await client.query('CREATE TABLE unclassified_fixture(id int)');
                await assert.rejects(verifyCatalog(client, inventory, schema), /table inventory differs/);
                await client.query('DROP TABLE unclassified_fixture; ALTER TABLE pharmacy_inventory ADD COLUMN unclassified_fixture text');
                await assert.rejects(verifyCatalog(client, inventory, schema), /column inventory differs.*pharmacy_inventory/);
                await client.query('ALTER TABLE pharmacy_inventory DROP COLUMN unclassified_fixture');
                await client.query('CREATE TABLE unclassified_fixture ()');
                await assert.rejects(verifyCatalog(client, inventory, schema), /table inventory differs/);
                await client.query('DROP TABLE unclassified_fixture');
                await assert.rejects(verifyCatalog(client, inventory, 'other_schema'), /unsupported.*schema/i);
                await verifyCatalog(client, inventory, schema);
            } finally { await client.end(); await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`); }
        });
    } finally { await admin.end(); }
});
