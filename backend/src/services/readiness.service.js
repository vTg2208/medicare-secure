const { query } = require('../config/db');
const { readMigrations } = require('../database/migrate');
const required = readMigrations();
async function assertSchemaReady() {
    const result = await query('SELECT id, file_hash FROM _migrations');
    const applied = new Map(result.rows.map(row => [row.id, row.file_hash]));
    if (!required.every(migration => applied.get(migration.id) === migration.hash)) {
        throw new Error('Database migrations are missing or have changed; run npm run db:migrate');
    }
}
module.exports = { assertSchemaReady };
