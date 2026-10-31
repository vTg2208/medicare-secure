const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const bcrypt = require('bcrypt');
const { Client } = require('pg');

function validateAdmin(options) {
    const email = String(options.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('ADMIN_EMAIL must be a valid email address.');
    const password = options.password || '';
    if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) throw new Error('ADMIN_PASSWORD must contain at least 12 characters and at most 72 UTF-8 bytes.');
    const role = options.role || 'system_admin';
    if (!['system_admin', 'hospital_admin'].includes(role)) throw new Error('ADMIN_ROLE must be system_admin or hospital_admin.');
    if (role === 'hospital_admin' && !/^[0-9a-f-]{36}$/i.test(options.organizationId || '')) throw new Error('Hospital administrators require an existing ADMIN_ORGANIZATION_ID.');
    return { ...options, email, password, role };
}

async function bootstrapAdmin(client, options) {
    const admin = validateAdmin(options);
    const passwordHash = await bcrypt.hash(admin.password, 12);
    await client.query('BEGIN');
    try {
        await client.query('SELECT pg_advisory_xact_lock($1)', [731405922]);
        const existing = await client.query('SELECT id FROM users WHERE lower(email)=$1', [admin.email]);
        if (existing.rowCount) throw new Error('An account already exists for ADMIN_EMAIL; bootstrap never overwrites credentials or grants roles to an existing account.');
        const role = await client.query('SELECT id FROM roles WHERE name=$1', [admin.role]);
        if (!role.rowCount) throw new Error('Administrator role is missing. Run db:migrate first.');
        if (admin.role === 'system_admin') {
            const admins = await client.query('SELECT id FROM users WHERE role_id=$1 LIMIT 1', [role.rows[0].id]);
            if (admins.rowCount) throw new Error('A system administrator already exists. Use the authenticated staff workflow to add administrators.');
        } else {
            const organization = await client.query('SELECT id FROM organizations WHERE id=$1', [admin.organizationId]);
            if (!organization.rowCount) throw new Error('ADMIN_ORGANIZATION_ID does not identify an existing organization.');
        }
        const result = await client.query(`INSERT INTO users(email,password_hash,first_name,last_name,role_id,is_verified,status,account_status,verification_status)
            VALUES($1,$2,$3,$4,$5,TRUE,'active','active','verified') RETURNING id,email`,
        [admin.email, passwordHash, admin.firstName || 'Administrator', admin.lastName || '', role.rows[0].id]);
        if (admin.role === 'hospital_admin') {
            await client.query("INSERT INTO staff_org_mapping(user_id,organization_id,role_id,status) VALUES($1,$2,$3,'active')", [result.rows[0].id, admin.organizationId, role.rows[0].id]);
        }
        await client.query('COMMIT');
        return result.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
}

async function main() {
    const options = validateAdmin({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD,
        role: process.env.ADMIN_ROLE, organizationId: process.env.ADMIN_ORGANIZATION_ID,
        firstName: process.env.ADMIN_FIRST_NAME, lastName: process.env.ADMIN_LAST_NAME });
    const { database } = require('../src/config/env');
    const client = new Client({ host: database.host, port: database.port, database: database.name,
        user: database.user, password: database.password, ssl: database.ssl, connectionTimeoutMillis: 10000 });
    try {
        await client.connect();
        const user = await bootstrapAdmin(client, options);
        console.log(`Administrator created: ${user.email} (${user.id}). Password was not logged.`);
    } finally { await client.end(); }
}
if (require.main === module) main().catch(error => { console.error(`Administrator bootstrap failed: ${error.message}`); process.exitCode = 1; });
module.exports = { main, bootstrapAdmin, validateAdmin };
