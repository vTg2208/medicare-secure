// Runs only with migration-owner credentials; the API never receives these.
const { Client } = require('pg');
const config = require('../src/config/env');
async function main() {
    const name = process.env.DB_APP_USER;
    const password = process.env.DB_APP_PASSWORD;
    if (!/^[a-z][a-z0-9_]{2,62}$/.test(name || '') || !password || password.length < 20 || name === config.database.user) {
        throw new Error('Set a distinct DB_APP_USER and random DB_APP_PASSWORD of at least 20 characters');
    }
    const client = new Client({ ...config.database, database: config.database.name });
    await client.connect();
    try {
        await client.query('BEGIN');
        const exists = (await client.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [name])).rowCount;
        const statement = await client.query("SELECT format($1::text,$2::text,$3::text) AS sql", [
            `${exists ? 'ALTER' : 'CREATE'} ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L`, name, password]);
        await client.query(statement.rows[0].sql);
        const identifier = (await client.query('SELECT quote_ident($1) AS name', [name])).rows[0].name;
        await client.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
        await client.query(`GRANT USAGE ON SCHEMA public TO ${identifier}`);
        await client.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO ${identifier}`);
        await client.query(`GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO ${identifier}`);
        await client.query(`REVOKE INSERT,UPDATE,DELETE ON _migrations FROM ${identifier}`);
        await client.query(`REVOKE UPDATE,DELETE ON audit_logs FROM ${identifier}`);
        await client.query('COMMIT');
        console.log('Application database role provisioned with data access and no schema administration privileges');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { await client.end(); }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { main };
