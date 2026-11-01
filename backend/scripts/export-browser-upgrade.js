const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const OUTPUT_DIRECTORY = path.resolve(__dirname, '../../.local');
const MIGRATION_DIRECTORY = path.resolve(__dirname, '../src/database/ordered');
const LOCK_KEY = 731405921;
const literal = value => `'${String(value).replaceAll("'", "''")}'`;
const hash = sql => crypto.createHash('sha256').update(sql).digest('hex');

// Deliberately independent of the connection/migrator module: exporting SQL
// must not load .env, connect to a database or execute application code.
function readOrderedMigrations(directory = MIGRATION_DIRECTORY) {
    return fs.readdirSync(directory).filter(name => /^\d{3}_[a-z0-9_]+\.sql$/.test(name)).sort().map(name => {
        const sql = fs.readFileSync(path.join(directory, name), 'utf8');
        return { id: name.slice(0, -4), sql, hash: hash(sql) };
    });
}

function dollarQuote(body, name) {
    let suffix = 0;
    while (body.includes(`$${name}_${suffix}$`)) suffix++;
    const delimiter = `$${name}_${suffix}$`;
    return `${delimiter}${body}${delimiter}`;
}

function buildBrowserUpgradeSql({ from, migrations = readOrderedMigrations() } = {}) {
    if (!/^\d{3}$/.test(from || '')) throw new Error('An explicit three-digit --from migration prefix is required');
    if (!migrations.length) throw new Error('No ordered migrations found');
    migrations.forEach((migration, index) => {
        const prefix = String(index + 1).padStart(3, '0');
        if (!new RegExp(`^${prefix}_[a-z0-9_]+$`).test(migration.id) || typeof migration.sql !== 'string' || migration.hash !== hash(migration.sql)) {
            throw new Error('Ordered migrations must be contiguous and match their exact SQL hashes');
        }
    });
    const prefixCount = migrations.findIndex(migration => migration.id.startsWith(`${from}_`)) + 1;
    if (!prefixCount) throw new Error('The requested migration prefix is unknown');
    const expected = migrations.map((migration, index) => `(${literal(migration.id)},${literal(migration.hash)},${index + 1})`).join(',\n            ');
    const pending = migrations.slice(prefixCount);
    const apply = `
BEGIN
    -- Exact target-ledger replay is a no-op. Every partial state is rejected by
    -- the preceding guard while the ledger and transaction locks remain held.
    IF (SELECT count(*) FROM healthcare._migrations) = ${prefixCount} THEN
${pending.length ? pending.map((migration, index) => `        -- Pending migration ${migration.id}; SHA-256 ${migration.hash}
        EXECUTE ${dollarQuote(migration.sql, `shms_pending_${index}`)};
        INSERT INTO healthcare._migrations(id,file_hash,execution_time_ms)
        VALUES (${literal(migration.id)},${literal(migration.hash)},0);
`).join('') : '        NULL;\n'}    END IF;
END
`;
    return `BEGIN;
SELECT pg_advisory_xact_lock(${LOCK_KEY});
-- Incremental upgrade only: never create, replace or reseed the application schema.
DO $shms_upgrade_exists$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname='healthcare') THEN
        RAISE EXCEPTION 'Incremental upgrade requires the existing healthcare schema';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='healthcare' AND c.relname='_migrations' AND c.relkind IN ('r','p')) THEN
        RAISE EXCEPTION 'Incremental upgrade requires the private healthcare migration ledger';
    END IF;
END
$shms_upgrade_exists$;
LOCK TABLE healthcare._migrations IN SHARE ROW EXCLUSIVE MODE;
SET LOCAL search_path TO healthcare, public, extensions, pg_temp;
DO $shms_upgrade_guard$
DECLARE
    applied_count INTEGER;
BEGIN
    IF EXISTS (
        SELECT 1 FROM healthcare._migrations m LEFT JOIN (VALUES
            ${expected}
        ) AS expected(id,file_hash,ordinal) ON expected.id=m.id
        WHERE expected.id IS NULL OR m.file_hash IS DISTINCT FROM expected.file_hash
    ) THEN
        RAISE EXCEPTION 'Migration ledger contains unknown IDs or hash drift';
    END IF;
    SELECT count(*) INTO applied_count FROM healthcare._migrations;
    IF applied_count NOT IN (${prefixCount},${migrations.length}) THEN
        RAISE EXCEPTION 'Migration ledger is not the exact expected prefix or complete target; partial or wrong prefix refused';
    END IF;
    IF EXISTS (
        SELECT 1 FROM (VALUES
            ${expected}
        ) AS expected(id,file_hash,ordinal) LEFT JOIN healthcare._migrations m ON m.id=expected.id
        WHERE expected.ordinal<=applied_count AND m.id IS NULL
    ) THEN
        RAISE EXCEPTION 'Migration ledger has a missing or non-prefix migration';
    END IF;
END
$shms_upgrade_guard$;
DO ${dollarQuote(apply, 'shms_upgrade_apply')};
COMMIT;
`;
}

function main(args = process.argv.slice(2)) {
    let from; let requested;
    for (let index = 0; index < args.length; index++) {
        if (args[index] === '--from' && args[index + 1] && from === undefined) from = args[++index];
        else if (args[index] === '--output' && args[index + 1] && requested === undefined) requested = args[++index];
        else throw new Error('Usage: node scripts/export-browser-upgrade.js --from 017 [--output .local/file.sql]');
    }
    const migrations = readOrderedMigrations();
    const sql = buildBrowserUpgradeSql({ from, migrations });
    const latest = migrations.at(-1).id.slice(0, 3);
    const output = requested ? path.resolve(requested) : path.join(OUTPUT_DIRECTORY, `browser-upgrade-${from}-to-${latest}.sql`);
    const relative = path.relative(OUTPUT_DIRECTORY, output);
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        throw new Error('Incremental SQL output must remain inside the ignored project .local directory');
    }
    fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true, mode: 0o700 });
    if (fs.lstatSync(OUTPUT_DIRECTORY).isSymbolicLink() || fs.realpathSync(OUTPUT_DIRECTORY) !== OUTPUT_DIRECTORY) throw new Error('Unsafe SQL output directory');
    let parent = OUTPUT_DIRECTORY;
    for (const segment of relative.split(path.sep).slice(0, -1)) {
        parent = path.join(parent, segment);
        try { fs.mkdirSync(parent, { mode: 0o700 }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
        if (fs.lstatSync(parent).isSymbolicLink() || fs.realpathSync(parent) !== parent) throw new Error('Unsafe SQL output directory');
    }
    fs.writeFileSync(output, sql, { flag: 'wx', mode: 0o600 });
    console.log(`Private-schema incremental SQL written to ${output}`);
    return output;
}

if (require.main === module) {
    try { main(); } catch (error) { console.error(`Incremental SQL export failed: ${error.message}`); process.exitCode = 1; }
}
module.exports = { buildBrowserUpgradeSql, readOrderedMigrations, main, OUTPUT_DIRECTORY, LOCK_KEY };
