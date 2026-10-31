const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const migrationDirectory = path.join(__dirname, 'ordered');
const LOCK_KEY = 731405921;

function readMigrations(directory = migrationDirectory) {
    return fs.readdirSync(directory).filter(name => /^\d{3}_[a-z0-9_]+\.sql$/.test(name)).sort().map(name => {
        const sql = fs.readFileSync(path.join(directory, name), 'utf8');
        return { id: name.replace(/\.sql$/, ''), sql, hash: crypto.createHash('sha256').update(sql).digest('hex') };
    });
}

async function migrate(client, { status = false, dryRun = false, migrations = readMigrations(), log = console.log } = {}) {
    // The same session owns the lock throughout inspection and application.
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
    try {
        const trackingExists = (await client.query("SELECT to_regclass('_migrations') AS name")).rows[0].name;
        const applied = trackingExists ? (await client.query('SELECT id, file_hash FROM _migrations')).rows : [];
        const recorded = new Map(applied.map(row => [row.id, row.file_hash]));
        for (const migration of migrations) {
            if (recorded.has(migration.id) && recorded.get(migration.id) !== migration.hash) {
                throw new Error(`Applied migration ${migration.id} has changed. Restore its contents and add a new migration.`);
            }
        }
        if (status || dryRun) {
            for (const migration of migrations) log(`${recorded.has(migration.id) ? 'applied' : 'pending'} ${migration.id}`);
            return { applied: 0, pending: migrations.filter(m => !recorded.has(m.id)).length };
        }
        await client.query(`CREATE TABLE IF NOT EXISTS _migrations (
            id VARCHAR(100) PRIMARY KEY, file_hash VARCHAR(64) NOT NULL,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), applied_by TEXT NOT NULL DEFAULT CURRENT_USER,
            execution_time_ms INTEGER NOT NULL)`);
        let count = 0;
        for (const migration of migrations) {
            if (recorded.has(migration.id)) continue;
            const started = Date.now();
            await client.query('BEGIN');
            try {
                await client.query(migration.sql);
                await client.query('INSERT INTO _migrations(id,file_hash,execution_time_ms) VALUES($1,$2,$3)',
                    [migration.id, migration.hash, Date.now() - started]);
                await client.query('COMMIT');
            } catch (error) {
                await client.query('ROLLBACK');
                throw new Error(`${migration.id}: ${error.message}`, { cause: error });
            }
            count++;
            log(`applied ${migration.id}`);
        }
        log(count ? `${count} migration(s) applied.` : 'Database is up to date.');
        return { applied: count, pending: 0 };
    } finally {
        await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]);
    }
}

async function main(args = process.argv.slice(2)) {
    const unknown = args.filter(arg => !['--status', '--dry-run', '--from-scratch'].includes(arg));
    if (unknown.length) throw new Error(`Unknown migration argument(s): ${unknown.join(', ')}`);
    // --from-scratch is a compatibility alias; it never drops or reseeds data.
    const { database } = require('../config/env');
    const client = new Client({ host: database.host, port: database.port, database: database.name,
        user: database.user, password: database.password, ssl: database.ssl,
        connectionTimeoutMillis: 10000, application_name: 'healthcare-migrations' });
    try {
        await client.connect();
        return await migrate(client, { status: args.includes('--status'), dryRun: args.includes('--dry-run') });
    } finally {
        await client.end();
    }
}

async function isSchemaReady(db) {
    const exists = await db.query("SELECT to_regclass('_migrations') AS name");
    if (!exists.rows[0].name) return false;
    const applied = await db.query('SELECT id,file_hash FROM _migrations');
    const recorded = new Map(applied.rows.map(row => [row.id, row.file_hash]));
    return readMigrations().every(migration => recorded.get(migration.id) === migration.hash);
}
if (require.main === module) main().catch(error => { console.error(`Migration failed: ${error.message}`); process.exitCode = 1; });
module.exports = { migrate, main, readMigrations, isSchemaReady };
