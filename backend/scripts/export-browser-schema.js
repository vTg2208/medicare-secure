const fs = require('node:fs');
const path = require('node:path');
const { readMigrations } = require('../src/database/migrate');

const OUTPUT_DIRECTORY = path.resolve(__dirname, '../../.local');
const LOCK_KEY = 731405921;

function sqlLiteral(value) {
    return `'${String(value).replace(/'/g, "''")}'`;
}

function buildBrowserSchemaSql(migrations = readMigrations()) {
    if (!migrations.length) throw new Error('No ordered migrations found');
    return `BEGIN;
SELECT pg_advisory_xact_lock(${LOCK_KEY});
-- Fresh installation only. An existing healthcare schema is always preserved.
DO $browser_guard$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'healthcare') THEN
        RAISE EXCEPTION 'Refusing browser installation: healthcare schema already exists';
    END IF;
END
$browser_guard$;
CREATE SCHEMA healthcare;
REVOKE ALL ON SCHEMA healthcare FROM PUBLIC;
-- Preinstall missing extensions outside the application schema. Existing
-- extensions in public or extensions are resolved by the search path below.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
SET LOCAL search_path TO healthcare, public, extensions;
CREATE TABLE _migrations (
    id VARCHAR(100) PRIMARY KEY, file_hash VARCHAR(64) NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), applied_by TEXT NOT NULL DEFAULT CURRENT_USER,
    execution_time_ms INTEGER NOT NULL);
${migrations.map(migration => `
-- Ordered migration: ${migration.id}; SHA-256: ${migration.hash}
${migration.sql}
INSERT INTO _migrations(id,file_hash,execution_time_ms)
VALUES (${sqlLiteral(migration.id)}, ${sqlLiteral(migration.hash)}, 0);
`).join('')}
COMMIT;
`;
}

function main(args = process.argv.slice(2)) {
    if (args.length !== 0 && (args.length !== 2 || args[0] !== '--output')) {
        throw new Error('Usage: node scripts/export-browser-schema.js [--output path]');
    }
    const output = args.length ? path.resolve(args[1]) : path.join(OUTPUT_DIRECTORY, 'browser-schema.sql');
    const sql = buildBrowserSchemaSql();
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, sql, { flag: 'wx', mode: 0o600 });
    console.log(`Fresh-install schema SQL written to ${output}`);
    return output;
}

if (require.main === module) main();
module.exports = { buildBrowserSchemaSql, sqlLiteral, main, OUTPUT_DIRECTORY, LOCK_KEY };
